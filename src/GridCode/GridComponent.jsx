import React, { useEffect } from "react";
import paper from "paper";

const GridComponent = ({ grid, onElementClick, canvasRef, zoom, scroll }) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paper.setup(canvas);

    paper.project.clear();

    // Draw dashed grid lines on all sides
    for (let i = 0; i <= grid.rows; i++) {
      new paper.Path.Line({
        from: [-50 + scroll.x, i * 100 * zoom + scroll.y],
        to: [grid.cols * 100 * zoom + 50 + scroll.x, i * 100 * zoom + scroll.y],
        strokeColor: "black",
        strokeWidth: 1,
        dashArray: [5, 5],
      });
    }
    for (let i = 0; i <= grid.cols; i++) {
      new paper.Path.Line({
        from: [i * 100 * zoom + scroll.x, -50 + scroll.y],
        to: [i * 100 * zoom + scroll.x, grid.rows * 100 * zoom + 50 + scroll.y],
        strokeColor: "black",
        strokeWidth: 1,
        dashArray: [5, 5],
      });
    }

    // Draw slabs (labeled with 4 grid points)
    for (let i = 1; i < grid.rows; i++) {
      for (
        let j = "A".charCodeAt(0);
        j < "A".charCodeAt(0) + grid.cols - 1;
        j++
      ) {
        const slabKey = `${i}${String.fromCharCode(j)}-${
          i + 1
        }${String.fromCharCode(j + 1)}`;
        const dim = grid.panelDimensions[`${i}${String.fromCharCode(j)}`] || {
          width: 7200,
          height: 6000,
        };
        const x = j - "A".charCodeAt(0) + 5 * zoom + scroll.x;
        const y = i * 100 * zoom + 5 * zoom + scroll.y;
        new paper.Path.Rectangle({
          point: [x, y],
          size: [(dim.width / 2000) * zoom, (dim.height / 2000) * zoom],
          fillColor: "black",
          onClick: (event) => onElementClick(slabKey, "panel", event.point),
        });
        new paper.PointText({
          point: [x + 10 * zoom, y + 20 * zoom],
          content: slabKey,
          fillColor: "white",
          fontSize: 10 * zoom,
        });
      }
    }

    // Draw beams
    for (let i = 1; i < grid.rows; i++) {
      const beamKey = `beam${i}A`;
      const dim = grid.beamDimensions[beamKey] || {
        width: 7200,
        depth: 400,
        breadth: 300,
      };
      const x = 5 * zoom + scroll.x;
      const y = i * 100 * zoom - 95 * zoom + scroll.y;
      new paper.Path.Rectangle({
        point: [x, y],
        size: [(dim.width / 2000) * zoom, (dim.breadth / 2000) * zoom],
        fillColor: "black",
        onClick: (event) => onElementClick(beamKey, "beam", event.point),
      });
    }
    for (
      let i = "A".charCodeAt(0);
      i < "A".charCodeAt(0) + grid.cols - 1;
      i++
    ) {
      const beamKey = `beamA${String.fromCharCode(i)}`;
      const dim = grid.beamDimensions[beamKey] || {
        width: 6000,
        depth: 400,
        breadth: 300,
      };
      const x = (i - "A".charCodeAt(0) + 1) * 100 * zoom + 5 * zoom + scroll.x;
      const y = 5 * zoom + scroll.y;
      new paper.Path.Rectangle({
        point: [x, y],
        size: [(dim.breadth / 2000) * zoom, (dim.depth / 2000) * zoom],
        fillColor: "black",
        onClick: (event) => onElementClick(beamKey, "beam", event.point),
      });
    }

    // Draw columns
    Object.entries(grid.columnDimensions).forEach(([key, dim]) => {
      const [row, col] = key.split("");
      const x = (col.charCodeAt(0) - 65) * 100 * zoom + 45 * zoom + scroll.x;
      const y = (row - 1) * 100 * zoom + 45 * zoom + scroll.y;
      const column = new paper.Path.Rectangle({
        point: [x, y],
        size: [(dim.width / 2000) * zoom, (dim.height / 2000) * zoom],
        fillColor: "black",
        onClick: (event) => onElementClick(key, "column", event.point),
      });
      column.rotate(
        dim.rotation,
        new paper.Point(
          x + (dim.width / 4000) * zoom,
          y + (dim.height / 4000) * zoom
        )
      );
      new paper.PointText({
        point: [x + 10 * zoom, y + 20 * zoom],
        content: key,
        fillColor: "white",
        fontSize: 10 * zoom,
      });
    });

    // Add labels on all sides
    for (let i = 0; i < grid.rows; i++) {
      new paper.PointText({
        point: [5 * zoom + scroll.x, i * 100 * zoom + 10 * zoom + scroll.y],
        content: (i + 1).toString(),
        fillColor: "black",
        fontSize: 12 * zoom,
      });
      new paper.PointText({
        point: [
          (grid.cols - 1) * 100 * zoom + 90 * zoom + scroll.x,
          i * 100 * zoom + 10 * zoom + scroll.y,
        ],
        content: (i + 1).toString(),
        fillColor: "black",
        fontSize: 12 * zoom,
      });
    }
    for (let i = 0; i < grid.cols; i++) {
      new paper.PointText({
        point: [i * 100 * zoom + 90 * zoom + scroll.x, 10 * zoom + scroll.y],
        content: String.fromCharCode(65 + i),
        fillColor: "black",
        fontSize: 12 * zoom,
      });
      new paper.PointText({
        point: [
          i * 100 * zoom + 90 * zoom + scroll.x,
          (grid.rows - 1) * 100 * zoom + 10 * zoom + scroll.y,
        ],
        content: String.fromCharCode(65 + i),
        fillColor: "black",
        fontSize: 12 * zoom,
      });
    }
  }, [grid, onElementClick, zoom, scroll, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      width={grid.cols * 100 * 2}
      height={grid.rows * 100 * 2}
    />
  );
};

export default GridComponent;
