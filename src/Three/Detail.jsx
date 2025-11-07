import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";

// ============================================================================
// MATERIAL CONSTANTS AND COLORS
// ============================================================================

const COLORS = {
  concrete: "#a8a8a8",
  concreteTransparent: "#a8a8a8",
  mainRebar: "#cc3333",
  stirrups: "#3366cc",
  distributionBars: "#cc8833",
  steel: "#778899",
  highlight: "#ffff00",
  lap: "#ff6600",
  hook: "#00ff00",
};

const DEFAULT_OPACITY = {
  concrete: 0.4,
  steel: 1.0,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function computeLapLength(
  barDiameter,
  anchorageFactor = 1.0,
  condition = "tension"
) {
  const baseMultiplier = condition === "tension" ? 45 : 35;
  return barDiameter * baseMultiplier * anchorageFactor;
}

function generateBarPositions(numBars, totalWidth, cover, barDiameter) {
  if (numBars === 1) return [0];
  const availableWidth = totalWidth - 2 * (cover + barDiameter / 2);
  const spacing = availableWidth / (numBars - 1);
  const positions = [];
  for (let i = 0; i < numBars; i++) {
    positions.push(-availableWidth / 2 + i * spacing);
  }
  return positions;
}

// ============================================================================
// BASIC COMPONENTS
// ============================================================================

function StraightBar({
  diameter,
  length,
  color,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const geometry = React.useMemo(
    () => new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 16),
    [diameter, length]
  );
  const material = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }),
    [color]
  );
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
    />
  );
}

function Hook135({ diameter, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const bendRadius = diameter * 2;
  const extensionLength = diameter * 6;

  const hookPath = React.useMemo(() => {
    const path = new THREE.CurvePath();
    path.add(
      new THREE.LineCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, extensionLength * 0.3, 0)
      )
    );
    const arcAngle = (3 * Math.PI) / 4;
    const arcPoints = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * arcAngle;
      const x = bendRadius * Math.sin(angle);
      const y = extensionLength * 0.3 + bendRadius * (1 - Math.cos(angle));
      arcPoints.push(new THREE.Vector3(x, y, 0));
    }
    for (let i = 0; i < arcPoints.length - 1; i++) {
      path.add(new THREE.LineCurve3(arcPoints[i], arcPoints[i + 1]));
    }
    const lastPoint = arcPoints[arcPoints.length - 1];
    const angle135 = (3 * Math.PI) / 4;
    const extX = extensionLength * 0.7 * Math.cos(angle135 - Math.PI / 2);
    const extY = extensionLength * 0.7 * Math.sin(angle135 - Math.PI / 2);
    path.add(
      new THREE.LineCurve3(
        lastPoint,
        new THREE.Vector3(lastPoint.x + extX, lastPoint.y + extY, 0)
      )
    );
    return path;
  }, [diameter, bendRadius, extensionLength]);

  const geometry = React.useMemo(
    () => new THREE.TubeGeometry(hookPath, 32, diameter / 2, 8, false),
    [hookPath, diameter]
  );
  const material = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.hook,
        metalness: 0.7,
        roughness: 0.3,
      }),
    []
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
    />
  );
}

function RectangularStirrup({
  width,
  height,
  diameter,
  color = COLORS.stirrups,
  position = [0, 0, 0],
}) {
  const stirrupPath = React.useMemo(() => {
    const path = new THREE.CurvePath();
    const hw = width / 2;
    const hh = height / 2;
    const points = [
      new THREE.Vector3(-hw, -hh, 0),
      new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0),
      new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    return path;
  }, [width, height]);

  const geometry = React.useMemo(
    () => new THREE.TubeGeometry(stirrupPath, 64, diameter / 2, 8, true),
    [stirrupPath, diameter]
  );
  const material = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }),
    [color]
  );

  return (
    <group position={position}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

// ============================================================================
// BEAM COMPONENT
// ============================================================================

function Beam({ params }) {
  const {
    span = 5.0,
    width = 0.3,
    depth = 0.5,
    cover = 0.025,
    bottomBarCount = 4,
    bottomBarDiameter = 0.02,
    topBarCount = 2,
    topBarDiameter = 0.016,
    stirrupDiameter = 0.01,
    stirrupSpacing = 0.15,
    showConcrete = true,
    showRebar = true,
  } = params;

  const bottomBarPositions = generateBarPositions(
    bottomBarCount,
    width,
    cover,
    bottomBarDiameter
  );
  const topBarPositions = generateBarPositions(
    topBarCount,
    width,
    cover,
    topBarDiameter
  );
  const stirrupWidth = width - 2 * cover - stirrupDiameter;
  const stirrupHeight = depth - 2 * cover - stirrupDiameter;
  const numStirrups = Math.floor(span / stirrupSpacing) + 1;

  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(width, depth, span),
    [width, depth, span]
  );

  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.concreteTransparent,
        transparent: true,
        opacity: DEFAULT_OPACITY.concrete,
      }),
    []
  );

  return (
    <group>
      {showConcrete && (
        <mesh geometry={concreteGeometry} material={concreteMaterial} />
      )}
      {showRebar && (
        <group>
          {bottomBarPositions.map((x, i) => {
            const y = -depth / 2 + cover + bottomBarDiameter / 2;
            return (
              <StraightBar
                key={`bottom-${i}`}
                diameter={bottomBarDiameter}
                length={span}
                color={COLORS.mainRebar}
                position={[x, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            );
          })}
          {topBarPositions.map((x, i) => {
            const y = depth / 2 - cover - topBarDiameter / 2;
            return (
              <StraightBar
                key={`top-${i}`}
                diameter={topBarDiameter}
                length={span}
                color={COLORS.mainRebar}
                position={[x, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            );
          })}
          {Array.from({ length: numStirrups }).map((_, i) => {
            const z = -span / 2 + i * stirrupSpacing;
            return (
              <RectangularStirrup
                key={`stirrup-${i}`}
                width={stirrupWidth}
                height={stirrupHeight}
                diameter={stirrupDiameter}
                position={[0, 0, z]}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// COLUMN COMPONENT
// ============================================================================

function Column({ params }) {
  const {
    width = 0.4,
    depth = 0.4,
    height = 3.0,
    cover = 0.03,
    barCount = 8,
    barDiameter = 0.02,
    linkDiameter = 0.01,
    linkSpacing = 0.2,
    showConcrete = true,
    showRebar = true,
  } = params;

  const barPositions = React.useMemo(() => {
    const positions = [];
    const hw = width / 2 - cover - barDiameter / 2;
    const hd = depth / 2 - cover - barDiameter / 2;

    if (barCount === 4) {
      positions.push([-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]);
    } else {
      const barsPerSide = Math.floor(barCount / 4);
      for (let i = 0; i < barsPerSide; i++) {
        const x = -hw + (i / (barsPerSide - 1 || 1)) * (2 * hw);
        positions.push([x, -hd]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const y = -hd + (i / (barsPerSide - 1 || 1)) * (2 * hd);
        positions.push([hw, y]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const x = hw - (i / (barsPerSide - 1 || 1)) * (2 * hw);
        positions.push([x, hd]);
      }
      for (let i = 1; i < barsPerSide; i++) {
        const y = hd - (i / (barsPerSide - 1 || 1)) * (2 * hd);
        positions.push([-hw, y]);
      }
    }
    return positions.slice(0, barCount);
  }, [barCount, width, depth, cover, barDiameter]);

  const linkWidth = width - 2 * cover - linkDiameter;
  const linkDepth = depth - 2 * cover - linkDiameter;
  const numLinks = Math.floor(height / linkSpacing) + 1;

  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(width, depth, height),
    [width, depth, height]
  );

  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.concreteTransparent,
        transparent: true,
        opacity: DEFAULT_OPACITY.concrete,
      }),
    []
  );

  return (
    <group>
      {showConcrete && (
        <mesh
          geometry={concreteGeometry}
          material={concreteMaterial}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}
      {showRebar && (
        <group>
          {barPositions.map(([x, y], i) => (
            <StraightBar
              key={`bar-${i}`}
              diameter={barDiameter}
              length={height}
              color={COLORS.mainRebar}
              position={[x, y, 0]}
            />
          ))}
          {Array.from({ length: numLinks }).map((_, i) => {
            const z = -height / 2 + i * linkSpacing;
            return (
              <RectangularStirrup
                key={`link-${i}`}
                width={linkWidth}
                height={linkDepth}
                diameter={linkDiameter}
                position={[0, 0, z]}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// SLAB COMPONENT
// ============================================================================

function Slab({ params }) {
  const {
    length = 6.0,
    width = 4.0,
    thickness = 0.2,
    cover = 0.02,
    mainBarDiameter = 0.012,
    mainBarSpacing = 0.15,
    distBarDiameter = 0.01,
    distBarSpacing = 0.2,
    showConcrete = true,
    showRebar = true,
  } = params;

  const numMainBars = Math.floor(width / mainBarSpacing) + 1;
  const numDistBars = Math.floor(length / distBarSpacing) + 1;

  const concreteGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, width, thickness),
    [length, width, thickness]
  );

  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.concreteTransparent,
        transparent: true,
        opacity: DEFAULT_OPACITY.concrete,
      }),
    []
  );

  return (
    <group>
      {showConcrete && (
        <mesh geometry={concreteGeometry} material={concreteMaterial} />
      )}
      {showRebar && (
        <group>
          {Array.from({ length: numMainBars }).map((_, i) => {
            const y = -width / 2 + i * mainBarSpacing;
            const z = -thickness / 2 + cover + mainBarDiameter / 2;
            return (
              <StraightBar
                key={`main-${i}`}
                diameter={mainBarDiameter}
                length={length}
                color={COLORS.mainRebar}
                position={[0, y, z]}
                rotation={[0, Math.PI / 2, 0]}
              />
            );
          })}
          {Array.from({ length: numDistBars }).map((_, i) => {
            const x = -length / 2 + i * distBarSpacing;
            const z =
              -thickness / 2 + cover + mainBarDiameter + distBarDiameter / 2;
            return (
              <StraightBar
                key={`dist-${i}`}
                diameter={distBarDiameter}
                length={width}
                color={COLORS.distributionBars}
                position={[x, 0, z]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// FOUNDATION COMPONENT
// ============================================================================

function Foundation({ params }) {
  const {
    length = 2.0,
    width = 2.0,
    thickness = 0.5,
    cover = 0.05,
    barDiameter = 0.02,
    barSpacing = 0.15,
    showConcrete = true,
    showRebar = true,
  } = params;

  const numBarsX = Math.floor(width / barSpacing) + 1;
  const numBarsY = Math.floor(length / barSpacing) + 1;

  const foundationGeometry = React.useMemo(
    () => new THREE.BoxGeometry(length, thickness, width),
    [length, thickness, width]
  );

  const concreteMaterial = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.concreteTransparent,
        transparent: true,
        opacity: DEFAULT_OPACITY.concrete,
      }),
    []
  );

  return (
    <group>
      {showConcrete && (
        <mesh geometry={foundationGeometry} material={concreteMaterial} />
      )}
      {showRebar && (
        <group>
          {Array.from({ length: numBarsX }).map((_, i) => {
            const z = -width / 2 + i * barSpacing;
            const y = -thickness / 2 + cover + barDiameter / 2;
            return (
              <StraightBar
                key={`x-${i}`}
                diameter={barDiameter}
                length={length}
                color={COLORS.mainRebar}
                position={[0, y, z]}
                rotation={[0, 0, Math.PI / 2]}
              />
            );
          })}
          {Array.from({ length: numBarsY }).map((_, i) => {
            const x = -length / 2 + i * barSpacing;
            const y = -thickness / 2 + cover + barDiameter * 1.5;
            return (
              <StraightBar
                key={`z-${i}`}
                diameter={barDiameter}
                length={width}
                color={COLORS.mainRebar}
                position={[x, y, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              />
            );
          })}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function ThreeApp() {
  const [memberType, setMemberType] = useState("beam");
  const [showConcrete, setShowConcrete] = useState(true);
  const [showRebar, setShowRebar] = useState(true);

  // Beam parameters
  const [beamSpan, setBeamSpan] = useState(5.0);
  const [beamWidth, setBeamWidth] = useState(0.3);
  const [beamDepth, setBeamDepth] = useState(0.5);
  const [bottomBars, setBottomBars] = useState(4);
  const [topBars, setTopBars] = useState(2);
  const bottomBarDiameter = 0.02;
  const topBarDiameter = 0.016;

  // Column parameters
  const [colWidth, setColWidth] = useState(0.4);
  const [colHeight, setColHeight] = useState(3.0);
  const [colBars, setColBars] = useState(8);

  // Slab parameters
  const [slabLength, setSlabLength] = useState(6.0);
  const [slabWidth, setSlabWidth] = useState(4.0);
  const [slabThickness, setSlabThickness] = useState(0.2);

  // Foundation parameters
  const [footLength, setFootLength] = useState(2.0);
  const [footWidth, setFootWidth] = useState(2.0);
  const [footThickness, setFootThickness] = useState(0.5);

  const renderMember = () => {
    switch (memberType) {
      case "beam":
        return (
          <Beam
            params={{
              span: beamSpan,
              width: beamWidth,
              depth: beamDepth,
              bottomBarCount: bottomBars,
              topBarCount: topBars,
              showConcrete,
              showRebar,
            }}
          />
        );
      case "column":
        return (
          <Column
            params={{
              width: colWidth,
              depth: colWidth,
              height: colHeight,
              barCount: colBars,
              showConcrete,
              showRebar,
            }}
          />
        );
      case "slab":
        return (
          <Slab
            params={{
              length: slabLength,
              width: slabWidth,
              thickness: slabThickness,
              showConcrete,
              showRebar,
            }}
          />
        );
      case "foundation":
        return (
          <Foundation
            params={{
              length: footLength,
              width: footWidth,
              thickness: footThickness,
              showConcrete,
              showRebar,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-screen h-screen flex bg-gray-900">
      {/* Control Panel */}
      <div className="w-80 bg-gray-800 text-white p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6 text-blue-400">
          Structural Member Visualizer
        </h1>

        {/* Member Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Member Type
          </label>
          <select
            value={memberType}
            onChange={(e) => setMemberType(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          >
            <option value="beam">Beam</option>
            <option value="column">Column</option>
            <option value="slab">Slab</option>
            <option value="foundation">Foundation</option>
          </select>
        </div>

        {/* Visibility Controls */}
        <div className="mb-6 p-4 bg-gray-700 rounded">
          <h3 className="font-semibold mb-3 text-blue-300">Display Options</h3>
          <label className="flex items-center mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showConcrete}
              onChange={(e) => setShowConcrete(e.target.checked)}
              className="mr-2 w-4 h-4"
            />
            <span>Show Concrete</span>
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showRebar}
              onChange={(e) => setShowRebar(e.target.checked)}
              className="mr-2 w-4 h-4"
            />
            <span>Show Reinforcement</span>
          </label>
        </div>

        {/* Beam Parameters */}
        {memberType === "beam" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-300">
              Beam Parameters
            </h3>
            <div>
              <label className="block text-sm mb-1">
                Span (m): {beamSpan.toFixed(2)}
              </label>
              <input
                type="range"
                min="2"
                max="10"
                step="0.5"
                value={beamSpan}
                onChange={(e) => setBeamSpan(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Width (m): {beamWidth.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.2"
                max="0.6"
                step="0.05"
                value={beamWidth}
                onChange={(e) => setBeamWidth(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Depth (m): {beamDepth.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={beamDepth}
                onChange={(e) => setBeamDepth(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Bottom Bars: {bottomBars}
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={bottomBars}
                onChange={(e) => setBottomBars(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Top Bars: {topBars}</label>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={topBars}
                onChange={(e) => setTopBars(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Column Parameters */}
        {memberType === "column" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-300">
              Column Parameters
            </h3>
            <div>
              <label className="block text-sm mb-1">
                Width (m): {colWidth.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.25"
                max="0.8"
                step="0.05"
                value={colWidth}
                onChange={(e) => setColWidth(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Height (m): {colHeight.toFixed(1)}
              </label>
              <input
                type="range"
                min="2.0"
                max="6.0"
                step="0.5"
                value={colHeight}
                onChange={(e) => setColHeight(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Longitudinal Bars: {colBars}
              </label>
              <input
                type="range"
                min="4"
                max="12"
                step="1"
                value={colBars}
                onChange={(e) => setColBars(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Slab Parameters */}
        {memberType === "slab" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-300">
              Slab Parameters
            </h3>
            <div>
              <label className="block text-sm mb-1">
                Length (m): {slabLength.toFixed(1)}
              </label>
              <input
                type="range"
                min="3"
                max="10"
                step="0.5"
                value={slabLength}
                onChange={(e) => setSlabLength(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Width (m): {slabWidth.toFixed(1)}
              </label>
              <input
                type="range"
                min="2"
                max="8"
                step="0.5"
                value={slabWidth}
                onChange={(e) => setSlabWidth(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Thickness (m): {slabThickness.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.12"
                max="0.30"
                step="0.02"
                value={slabThickness}
                onChange={(e) => setSlabThickness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Foundation Parameters */}
        {memberType === "foundation" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg text-blue-300">
              Foundation Parameters
            </h3>
            <div>
              <label className="block text-sm mb-1">
                Length (m): {footLength.toFixed(1)}
              </label>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.5"
                value={footLength}
                onChange={(e) => setFootLength(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Width (m): {footWidth.toFixed(1)}
              </label>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.5"
                value={footWidth}
                onChange={(e) => setFootWidth(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">
                Thickness (m): {footThickness.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.1"
                value={footThickness}
                onChange={(e) => setFootThickness(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-700 rounded">
          <h3 className="font-semibold mb-3 text-blue-300">Color Legend</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: COLORS.mainRebar }}
              ></div>
              <span>Main Reinforcement</span>
            </div>
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: COLORS.stirrups }}
              ></div>
              <span>Stirrups/Links</span>
            </div>
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: COLORS.distributionBars }}
              ></div>
              <span>Distribution Bars</span>
            </div>
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: COLORS.concrete }}
              ></div>
              <span>Concrete</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-900 bg-opacity-50 rounded text-xs">
          <h3 className="font-semibold mb-2">Controls</h3>
          <ul className="space-y-1">
            <li>• Left click + drag: Rotate view</li>
            <li>• Right click + drag: Pan view</li>
            <li>• Scroll: Zoom in/out</li>
            <li>• Adjust sliders to modify dimensions</li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 p-3 bg-red-900 bg-opacity-30 rounded text-xs">
          <p className="font-semibold mb-1">⚠️ Disclaimer</p>
          <p className="text-gray-300">
            This is a visualization tool only. All structural designs must be
            verified by a qualified engineer per applicable codes.
          </p>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 relative bg-gray-950">
        <Canvas
          camera={{ position: [8, 6, 8], fov: 50 }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.0} />
            <directionalLight position={[-10, 10, -5]} intensity={0.6} />
            <directionalLight position={[0, -10, 0]} intensity={0.3} />
            <hemisphereLight args={["#ffffff", "#444444", 0.4]} />

            {/* Grid */}
            <Grid
              args={[20, 20]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#6b7280"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#9ca3af"
              fadeDistance={25}
              fadeStrength={1}
              followCamera={false}
              infiniteGrid={true}
            />

            {/* Render selected member */}
            {renderMember()}

            {/* Controls */}
            <OrbitControls
              enableZoom={true}
              enablePan={true}
              enableRotate={true}
              minDistance={3}
              maxDistance={50}
            />
          </Suspense>
        </Canvas>

        {/* Info overlay */}
        <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 text-white p-4 rounded shadow-lg">
          <h2 className="text-lg font-bold mb-2 text-blue-400">
            {memberType.charAt(0).toUpperCase() + memberType.slice(1)} View
          </h2>
          <div className="text-xs space-y-1 text-gray-300">
            {memberType === "beam" && (
              <>
                <p>Span: {beamSpan.toFixed(2)}m</p>
                <p>
                  Section: {(beamWidth * 1000).toFixed(0)} ×{" "}
                  {(beamDepth * 1000).toFixed(0)}mm
                </p>
                <p>
                  Bottom bars: {bottomBars}T
                  {(bottomBarDiameter * 1000).toFixed(0)}
                </p>
                <p>
                  Top bars: {topBars}T{(topBarDiameter * 1000).toFixed(0)}
                </p>
              </>
            )}
            {memberType === "column" && (
              <>
                <p>Height: {colHeight.toFixed(2)}m</p>
                <p>
                  Section: {(colWidth * 1000).toFixed(0)} ×{" "}
                  {(colWidth * 1000).toFixed(0)}mm
                </p>
                <p>Longitudinal: {colBars}T20</p>
                <p>Links: T10 @ 200mm c/c</p>
              </>
            )}
            {memberType === "slab" && (
              <>
                <p>
                  Dimensions: {slabLength.toFixed(1)}m × {slabWidth.toFixed(1)}m
                </p>
                <p>Thickness: {(slabThickness * 1000).toFixed(0)}mm</p>
                <p>Main bars: T12 @ 150mm</p>
                <p>Distribution: T10 @ 200mm</p>
              </>
            )}
            {memberType === "foundation" && (
              <>
                <p>
                  Plan: {footLength.toFixed(1)}m × {footWidth.toFixed(1)}m
                </p>
                <p>Thickness: {(footThickness * 1000).toFixed(0)}mm</p>
                <p>Reinforcement: T20 @ 150mm</p>
                <p>Both directions</p>
              </>
            )}
          </div>
        </div>

        {/* View mode indicator */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {showConcrete && (
            <div className="bg-gray-700 text-white px-3 py-1 rounded text-xs">
              Concrete visible
            </div>
          )}
          {showRebar && (
            <div className="bg-blue-700 text-white px-3 py-1 rounded text-xs">
              Rebar visible
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
