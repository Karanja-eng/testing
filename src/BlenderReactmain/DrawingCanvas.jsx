// components/DrawingCanvas.jsx
import React, { useRef, useEffect, useState, forwardRef } from "react";
import * as THREE from "three";

const DrawingCanvas = forwardRef(
  (
    {
      activeTool,
      setActiveTool,
      drawingObjects,
      setDrawingObjects,
      selectedObjects,
      setSelectedObjects,
      layers,
      activeLayer,
      snapSettings,
      gridVisible,
      orthoMode,
      zoomLevel,
      panOffset,
      addToHistory,
    },
    ref
  ) => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const [currentPoint, setCurrentPoint] = useState(null);
    const [snapPoint, setSnapPoint] = useState(null);
    const [tempPoints, setTempPoints] = useState([]);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());

    // Initialize Three.js Scene
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1f2937);
      sceneRef.current = scene;

      // Camera (Orthographic for 2D drawing)
      const camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        height / 2,
        -height / 2,
        0.1,
        1000
      );
      camera.position.z = 100;
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Grid
      const gridHelper = new THREE.GridHelper(5000, 100, 0x444444, 0x333333);
      gridHelper.rotateX(Math.PI / 2);
      gridHelper.position.z = -1;
      if (gridVisible) scene.add(gridHelper);

      // Lighting
      const light = new THREE.DirectionalLight(0xffffff, 0.5);
      light.position.set(0, 0, 100);
      scene.add(light);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      // Render Loop
      const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.left = -newWidth / 2;
        camera.right = newWidth / 2;
        camera.top = newHeight / 2;
        camera.bottom = -newHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        container.removeChild(renderer.domElement);
      };
    }, [gridVisible]);

    // Update grid visibility
    useEffect(() => {
      if (sceneRef.current) {
        const grid = sceneRef.current.getObjectByName("grid");
        if (grid) grid.visible = gridVisible;
      }
    }, [gridVisible]);

    // Mouse move handler
    const handleMouseMove = (e) => {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = (-(e.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);

      const canvas = rendererRef.current.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      const worldX =
        (e.clientX - rect.left - width / 2) / zoomLevel + panOffset.x;
      const worldY =
        (height / 2 - (e.clientY - rect.top)) / zoomLevel + panOffset.y;

      setCurrentPoint({ x: worldX, y: worldY });

      // Find snap point
      const snap = findSnapPoint(
        { x: worldX, y: worldY },
        snapSettings,
        drawingObjects
      );
      setSnapPoint(snap);
    };

    // Find snap point (AutoCAD-like object snapping)
    const findSnapPoint = (point, snapSettings, objects) => {
      const threshold = 10;
      let closest = null;
      let closestDist = threshold;

      objects.forEach((obj) => {
        if (!obj.visible) return;

        switch (obj.type) {
          case "line":
            // Endpoint
            if (snapSettings.endpoint) {
              [obj.start, obj.end].forEach((p) => {
                const dist = Math.hypot(point.x - p.x, point.y - p.y);
                if (dist < closestDist) {
                  closest = { ...p, snapType: "endpoint" };
                  closestDist = dist;
                }
              });
            }
            // Midpoint
            if (snapSettings.midpoint) {
              const mid = {
                x: (obj.start.x + obj.end.x) / 2,
                y: (obj.start.y + obj.end.y) / 2,
              };
              const dist = Math.hypot(point.x - mid.x, point.y - mid.y);
              if (dist < closestDist) {
                closest = { ...mid, snapType: "midpoint" };
                closestDist = dist;
              }
            }
            break;

          case "circle":
            // Center
            if (snapSettings.center) {
              const dist = Math.hypot(
                point.x - obj.center.x,
                point.y - obj.center.y
              );
              if (dist < closestDist) {
                closest = { ...obj.center, snapType: "center" };
                closestDist = dist;
              }
            }
            break;

          case "rectangle":
            // Corners and center
            const corners = [
              obj.start,
              { x: obj.end.x, y: obj.start.y },
              obj.end,
              { x: obj.start.x, y: obj.end.y },
            ];
            corners.forEach((c) => {
              if (snapSettings.endpoint) {
                const dist = Math.hypot(point.x - c.x, point.y - c.y);
                if (dist < closestDist) {
                  closest = { ...c, snapType: "endpoint" };
                  closestDist = dist;
                }
              }
            });
            if (snapSettings.center) {
              const center = {
                x: (obj.start.x + obj.end.x) / 2,
                y: (obj.start.y + obj.end.y) / 2,
              };
              const dist = Math.hypot(point.x - center.x, point.y - center.y);
              if (dist < closestDist) {
                closest = { ...center, snapType: "center" };
                closestDist = dist;
              }
            }
            break;
        }
      });

      return closest;
    };

    // Create drawing object
    const createObject = (type, data) => {
      const id = Math.random().toString(36).substr(2, 9);
      return {
        id,
        type,
        layerId: activeLayer,
        visible: true,
        selected: false,
        strokeColor: "#FFFFFF",
        strokeWidth: 2,
        fillColor: null,
        ...data,
        timestamp: Date.now(),
      };
    };

    // Handle drawing tools
    const handleMouseDown = (e) => {
      if (!activeTool) return;

      const point = snapPoint || currentPoint;
      setStartPoint(point);
      setIsDrawing(true);

      // Polyline specific handling
      if (activeTool === "polyline") {
        setTempPoints([...tempPoints, point]);
      }
    };

    const handleMouseUp = (e) => {
      if (!activeTool || !startPoint || !currentPoint) return;

      const endPoint = snapPoint || currentPoint;

      let newObj = null;

      switch (activeTool) {
        case "line":
          newObj = createObject("line", {
            start: startPoint,
            end: endPoint,
          });
          break;

        case "circle":
          const radius = Math.hypot(
            endPoint.x - startPoint.x,
            endPoint.y - startPoint.y
          );
          newObj = createObject("circle", {
            center: startPoint,
            radius,
          });
          break;

        case "rectangle":
          newObj = createObject("rectangle", {
            start: startPoint,
            end: endPoint,
          });
          break;

        case "arc":
          newObj = createObject("arc", {
            start: startPoint,
            end: endPoint,
            center: {
              x: (startPoint.x + endPoint.x) / 2,
              y: (startPoint.y + endPoint.y) / 2,
            },
          });
          break;

        case "polyline":
          // Polyline handled in double-click or ESC key
          break;
      }

      if (newObj) {
        const updated = [...drawingObjects, newObj];
        setDrawingObjects(updated);
        addToHistory(updated);
        setSelectedObjects([newObj.id]);
      }

      setIsDrawing(false);
      setStartPoint(null);
    };

    // Double-click to finish polyline
    const handleDoubleClick = (e) => {
      if (activeTool === "polyline" && tempPoints.length > 1) {
        const newObj = createObject("polyline", {
          points: tempPoints,
        });
        const updated = [...drawingObjects, newObj];
        setDrawingObjects(updated);
        addToHistory(updated);
        setTempPoints([]);
        setActiveTool(null);
      }
    };

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "z") {
            e.preventDefault();
            // Undo handled in parent
          } else if (e.key === "y") {
            e.preventDefault();
            // Redo handled in parent
          }
        }
        if (e.key === "Escape") {
          setActiveTool(null);
          setTempPoints([]);
          setIsDrawing(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTool]);

    return (
      <div
        ref={containerRef}
        className="flex-1 bg-gray-800 relative cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Snap indicator */}
        {snapPoint && (
          <div
            className="absolute w-4 h-4 border-2 border-yellow-400 pointer-events-none"
            style={{
              left: `${
                snapPoint.x / zoomLevel + containerRef.current?.clientWidth / 2
              }px`,
              top: `${
                containerRef.current?.clientHeight / 2 - snapPoint.y / zoomLevel
              }px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="absolute -inset-1 border border-yellow-300" />
          </div>
        )}

        {/* Drawing preview */}
        {isDrawing && startPoint && currentPoint && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={currentPoint.x}
              y2={currentPoint.y}
              stroke="#888888"
              strokeWidth="1"
              strokeDasharray="5,5"
            />
          </svg>
        )}

        {/* Temp polyline preview */}
        {activeTool === "polyline" && tempPoints.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {tempPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="#ffff00" />
            ))}
          </svg>
        )}
      </div>
    );
  }
);

DrawingCanvas.displayName = "DrawingCanvas";
export default DrawingCanvas;
