eMaterial} position={child.position} rotation={child.rotation} />
          ))}
        </group>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group>
          {/* Main reinforcement (along flight) - bottom of waist */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const x = -width / 2 + i * barSpacing;
            // Position bars at bottom of inclined waist with proper cover
            const yStart = 0 + cover * Math.cos(angle);
            const zStart = 0 + cover * Math.sin(angle);
            return (
              <StraightBar
                key={`main-${i}`}
                diameter={barDiameter}
                length={waistLength}
                color={COLORS.mainRebar}
                position={[x, rise / 2 + yStart, flightLength / 2 + zStart]}
                rotation={[-angle, 0, 0]}
              />
            );
          })}

          {/* Top reinforcement for cantilever stairs */}
          {type === 'cantilever' && (
            <>
              {Array.from({ length: numMainBars }).map((_, i) => {
                const x = -width / 2 + i * barSpacing;
                const yStart = -waistThickness + cover * Math.cos(angle);
                const zStart = -waistThickness * Math.sin(angle) + cover * Math.sin(angle);
                return (
                  <StraightBar
                    key={`main-top-${i}`}
                    diameter={barDiameter}
                    length={waistLength}
                    color={COLORS.mainRebar}
                    position={[x, rise / 2 + yStart, flightLength / 2 + zStart]}
                    rotation={[-angle, 0, 0]}
                  />
                );
              })}
            </>
          )}

          {/* Distribution bars (transverse to flight) */}
          {Array.from({ length: numDistBars }).map((_, i) => {
            const zLocal = -waistLength / 2 + i * distBarSpacing;
            // Convert to global coordinates along inclined waist
            const z = flightLength / 2 + zLocal * Math.cos(angle);
            const y = rise / 2 - zLocal * Math.sin(angle);
            const yOffset = cover * Math.cos(angle) + barDiameter;
            
            return (
              <StraightBar
                key={`dist-${i}`}
                diameter={distBarDiameter}
                length={width}
                color={COLORS.distributionBars}
                position={[0, y + yOffset, z]}
                rotation={[0, 0, Math.PI / 2]}
              />
            );
          })}

          {/* Landing connection reinforcement */}
          {/* Bottom landing bars extending into flight */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const x = -width / 2 + i * barSpacing;
            const anchorageLength = barDiameter * 40; // Anchorage length per BS
            return (
              <StraightBar
                key={`landing-bottom-${i}`}
                diameter={barDiameter}
                length={anchorageLength}
                color={COLORS.highlight}
                position={[x, -anchorageLength / 2, 0]}
              />
            );
          })}

          {/* Top landing bars extending into flight */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const x = -width / 2 + i * barSpacing;
            const anchorageLength = barDiameter * 40;
            return (
              <StraightBar
                key={`landing-top-${i}`}
                diameter={barDiameter}
                length={anchorageLength}
                color={COLORS.highlight}
                position={[x, rise + anchorageLength / 2, flightLength]}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// STEEL SECTION COMPONENTS
// ============================================================================

/**
 * Draw a structural steel section (Universal Beam or Column).
 * 
 * Simplified representation of steel I-sections with optional bolt/plate connections.
 * 
 * @param {Object} params - Steel section parameters
 * @param {string} params.type - 'UB' (Universal Beam) or 'UC' (Universal Column), default 'UB'
 * @param {number} params.length - Section length in meters, default 5.0
 * @param {number} params.depth - Section depth (height) in meters, default 0.400
 * @param {number} params.flangeWidth - Flange width in meters, default 0.180
 * @param {number} params.flangeThickness - Flange thickness in meters, default 0.016
 * @param {number} params.webThickness - Web thickness in meters, default 0.010
 * @param {boolean} params.showBolts - Show bolt connections at ends, default false
 * @param {number} params.boltDiameter - Bolt diameter in meters, default 0.020
 * @param {number} params.numBolts - Number of bolts per connection, default 4
 * @param {boolean} params.showEndPlates - Show end plates, default false
 * @param {number} params.endPlateThickness - End plate thickness in meters, default 0.020
 * @returns {JSX.Element}
 */
export function drawSteelSection(params = {}) {
  const {
    type = 'UB',
    length = 5.0,
    depth = 0.400,
    flangeWidth = 0.180,
    flangeThickness = 0.016,
    webThickness = 0.010,
    showBolts = false,
    boltDiameter = 0.020,
    numBolts = 4,
    showEndPlates = false,
    endPlateThickness = 0.020,
  } = params;

  // Create I-section geometry
  const sectionGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = flangeWidth / 2;
    const hd = depth / 2;
    const ft = flangeThickness;
    const wt = webThickness / 2;

    // Draw I-section profile (viewed from end)
    // Top flange
    shape.moveTo(-hw, hd);
    shape.lineTo(hw, hd);
    shape.lineTo(hw, hd - ft);
    // Right side of web
    shape.lineTo(wt, hd - ft);
    shape.lineTo(wt, -hd + ft);
    // Bottom flange
    shape.lineTo(hw, -hd + ft);
    shape.lineTo(hw, -hd);
    shape.lineTo(-hw, -hd);
    shape.lineTo(-hw, -hd + ft);
    // Left side of web
    shape.lineTo(-wt, -hd + ft);
    shape.lineTo(-wt, hd - ft);
    shape.lineTo(-hw, hd - ft);
    shape.lineTo(-hw, hd);

    const extrudeSettings = { depth: length, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -length / 2);
    return geo;
  }, [depth, flangeWidth, flangeThickness, webThickness, length]);

  const steelMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: COLORS.steel, 
      metalness: 0.9, 
      roughness: 0.2 
    }),
    []
  );

  const boltMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: '#333333', 
      metalness: 0.8, 
      roughness: 0.3 
    }),
    []
  );

  const plateMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: '#555555', 
      metalness: 0.85, 
      roughness: 0.25 
    }),
    []
  );

  // Bolt positions for end connections
  const boltPositions = useMemo(() => {
    const positions = [];
    if (numBolts === 4) {
      const offset = depth * 0.3;
      positions.push([-offset, offset], [offset, offset], [offset, -offset], [-offset, -offset]);
    } else if (numBolts === 6) {
      const offsetY = depth * 0.35;
      const offsetX = flangeWidth * 0.25;
      positions.push(
        [-offsetX, offsetY], [offsetX, offsetY],
        [-offsetX, 0], [offsetX, 0],
        [-offsetX, -offsetY], [offsetX, -offsetY]
      );
    }
    return positions;
  }, [numBolts, depth, flangeWidth]);

  return (
    <group>
      {/* Steel section */}
      <mesh geometry={sectionGeometry} material={steelMaterial} />

      {/* End plates */}
      {showEndPlates && (
        <>
          <mesh
            geometry={new THREE.BoxGeometry(flangeWidth * 1.2, depth * 1.1, endPlateThickness)}
            material={plateMaterial}
            position={[0, 0, -length / 2 - endPlateThickness / 2]}
          />
          <mesh
            geometry={new THREE.BoxGeometry(flangeWidth * 1.2, depth * 1.1, endPlateThickness)}
            material={plateMaterial}
            position={[0, 0, length / 2 + endPlateThickness / 2]}
          />
        </>
      )}

      {/* Bolts */}
      {showBolts && (
        <>
          {/* Bolts at start end */}
          {boltPositions.map(([x, y], i) => {
            const boltLength = endPlateThickness + 0.050;
            return (
              <mesh
                key={`bolt-start-${i}`}
                geometry={new THREE.CylinderGeometry(boltDiameter / 2, boltDiameter / 2, boltLength, 16)}
                material={boltMaterial}
                position={[x, y, -length / 2 - boltLength / 2]}
              />
            );
          })}

          {/* Bolts at end */}
          {boltPositions.map(([x, y], i) => {
            const boltLength = endPlateThickness + 0.050;
            return (
              <mesh
                key={`bolt-end-${i}`}
                geometry={new THREE.CylinderGeometry(boltDiameter / 2, boltDiameter / 2, boltLength, 16)}
                material={boltMaterial}
                position={[x, y, length / 2 + boltLength / 2]}
              />
            );
          })}
        </>
      )}
    </group>
  );
}

// ============================================================================
// EXAMPLE SCENE COMPOSITION
// ============================================================================

/**
 * Example function showing how to compose multiple structural elements.
 * This demonstrates typical usage and can be used for testing/visualization.
 * 
 * @returns {JSX.Element} Complete scene with multiple structural elements
 */
export function ExampleStructuralScene() {
  return (
    <group>
      {/* Pad foundation with column base */}
      <group position={[0, -2, 0]}>
        {drawFoundation({
          type: 'column-base',
          length: 2.5,
          width: 2.5,
          thickness: 0.6,
          columnWidth: 0.4,
          columnDepth: 0.4,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Column on foundation */}
      <group position={[0, 0.5, 0]}>
        {drawColumn({
          width: 0.4,
          depth: 0.4,
          height: 3.0,
          barCount: 8,
          barDiameter: 0.020,
          linkSpacing: 0.15,
          showLaps: true,
          lapHeight: 1.0,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Beam connecting to column */}
      <group position={[3.0, 2.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        {drawBeam({
          type: 'rectangular',
          span: 6.0,
          width: 0.3,
          depth: 0.5,
          bottomBarCount: 4,
          topBarCount: 2,
          stirrupSpacing: 0.15,
          showLaps: true,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Slab at beam level */}
      <group position={[0, 2.25, 4.0]}>
        {drawSlab({
          type: 'two-way',
          length: 6.0,
          width: 4.0,
          thickness: 0.18,
          mainBarSpacing: 0.15,
          distBarSpacing: 0.20,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Cantilever retaining wall */}
      <group position={[-5.0, 0, 0]}>
        {drawWall({
          type: 'cantilever',
          length: 6.0,
          height: 3.5,
          thickness: 0.25,
          footingWidth: 2.0,
          footingThickness: 0.5,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Staircase */}
      <group position={[6.0, 0, 0]}>
        {drawStair({
          type: 'simply-supported',
          width: 1.2,
          flightLength: 3.0,
          rise: 1.5,
          treadDepth: 0.25,
          riserHeight: 0.15,
          showConcrete: true,
          showRebar: true,
        })}
      </group>

      {/* Steel beam example */}
      <group position={[0, 4.0, 0]} rotation={[0, 0, Math.PI / 2]}>
        {drawSteelSection({
          type: 'UB',
          length: 8.0,
          depth: 0.450,
          flangeWidth: 0.190,
          flangeThickness: 0.018,
          webThickness: 0.011,
          showBolts: true,
          showEndPlates: true,
        })}
      </group>

      {/* Pile cap foundation */}
      <group position={[8.0, -2, 0]}>
        {drawFoundation({
          type: 'pile-cap',
          length: 3.0,
          width: 3.0,
          thickness: 0.8,
          numPiles: 4,
          pileDiameter: 0.45,
          pileLength: 3.0,
          columnWidth: 0.5,
          columnDepth: 0.5,
          showConcrete: true,
          showRebar: true,
          showPiles: true,
        })}
      </group>
    </group>
  );
}

// ============================================================================
// UTILITY COMPONENT FOR COMPLETE SCENE WITH LIGHTING AND CONTROLS
// ============================================================================

/**
 * Complete scene wrapper with proper lighting, camera, and controls.
 * Use this as a template for rendering the structural elements.
 * 
 * Note: This component assumes you're using @react-three/fiber and @react-three/drei.
 * 
 * @param {Object} props - Component props
 * @param {JSX.Element} props.children - Structural elements to render
 * @returns {JSX.Element}
 */
export function StructuralVisualizationScene({ children }) {
  return (
    <>
      {/* Lighting setup for concrete and steel visualization */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.0} castShadow />
      <directionalLight position={[-10, 10, -5]} intensity={0.6} />
      <directionalLight position={[0, -10, 0]} intensity={0.3} />
      <hemisphereLight args={['#ffffff', '#444444', 0.4]} />
      
      {/* Grid helper for reference */}
      <gridHelper args={[50, 50, '#888888', '#cccccc']} position={[0, -2.5, 0]} />
      
      {/* Render structural elements */}
      {children}
    </>
  );
}

// ============================================================================
// ADDITIONAL HELPER COMPONENTS
// ============================================================================

/**
 * Connection detail component for beam-column joints.
 * Shows typical moment connection with end plate and bolts.
 * 
 * @param {Object} params - Connection parameters
 * @param {number} params.beamDepth - Beam depth in meters
 * @param {number} params.columnWidth - Column width in meters
 * @param {number} params.plateThickness - Connection plate thickness in meters, default 0.020
 * @param {number} params.boltDiameter - Bolt diameter in meters, default 0.020
 * @param {Array} params.position - Position [x, y, z]
 * @returns {JSX.Element}
 */
export function BeamColumnConnection(params = {}) {
  const {
    beamDepth = 0.5,
    columnWidth = 0.4,
    plateThickness = 0.020,
    boltDiameter = 0.020,
    position = [0, 0, 0],
  } = params;

  const plateMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: '#555555', 
      metalness: 0.85, 
      roughness: 0.25 
    }),
    []
  );

  const boltMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: '#333333', 
      metalness: 0.8, 
      roughness: 0.3 
    }),
    []
  );

  return (
    <group position={position}>
      {/* Connection plate */}
      <mesh
        geometry={new THREE.BoxGeometry(columnWidth * 1.1, beamDepth * 0.8, plateThickness)}
        material={plateMaterial}
      />

      {/* Bolts */}
      {[-beamDepth * 0.3, beamDepth * 0.3].map((y, i) =>
        [-columnWidth * 0.3, columnWidth * 0.3].map((x, j) => (
          <mesh
            key={`bolt-${i}-${j}`}
            geometry={new THREE.CylinderGeometry(boltDiameter / 2, boltDiameter / 2, plateThickness * 2, 16)}
            material={boltMaterial}
            position={[x, y, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        ))
      )}
    </group>
  );
}

/**
 * Shear key detail for beam-wall connections.
 * 
 * @param {Object} params - Shear key parameters
 * @param {number} params.width - Key width in meters, default 0.15
 * @param {number} params.depth - Key depth in meters, default 0.10
 * @param {number} params.length - Key length in meters, default 0.20
 * @param {Array} params.position - Position [x, y, z]
 * @returns {JSX.Element}
 */
export function ShearKey(params = {}) {
  const {
    width = 0.15,
    depth = 0.10,
    length = 0.20,
    position = [0, 0, 0],
  } = params;

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ 
      color: COLORS.concrete, 
      metalness: 0.1, 
      roughness: 0.9 
    }),
    []
  );

  return (
    <mesh
      geometry={new THREE.BoxGeometry(width, depth, length)}
      material={concreteMaterial}
      position={position}
    />
  );
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

/**
 * This module exports the following main functions/components:
 * 
 * - drawBeam(params): Rectangular, T-beam, L-beam with full reinforcement detailing
 * - drawColumn(params): Square and rectangular columns with links and lap zones
 * - drawSlab(params): One-way, two-way, waffle, ribbed, cantilever slabs
 * - drawWall(params): Retaining (cantilever, counterfort), shear, elevator shaft walls
 * - drawFoundation(params): Pad, strip, column base, pile cap foundations
 * - drawStair(params): Simply supported and cantilever stairs
 * - drawSteelSection(params): Universal beams (UB) and columns (UC)
 * 
 * Helper components:
 * - BeamColumnConnection: Moment connection details
 * - ShearKey: Shear key for beam-wall connections
 * - ExampleStructuralScene: Sample composition of multiple elements
 * - StructuralVisualizationScene: Scene wrapper with lighting
 * 
 * All components follow BS practice for:
 * - Minimum clear cover requirements
 * - 135° hooks for stirrups and anchorage
 * - Lap splice lengths based on bar diameter and stress condition
 * - Proper bar spacing and positioning
 * 
 * DISCLAIMER: This visualization tool is for educational and preliminary design
 * purposes only. All structural designs, reinforcement details, and material
 * specifications must be verified and approved by a qualified structural engineer
 * in accordance with applicable building codes and standards.
 */

export default {
  drawBeam,
  drawColumn,
  drawSlab,
  drawWall,
  drawFoundation,
  drawStair,
  drawSteelSection,
  BeamColumnConnection,
  ShearKey,
  ExampleStructuralScene,
  StructuralVisualizationScene,
};