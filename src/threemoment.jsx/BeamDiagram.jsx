// BeamDiagram.jsx
import React, { useEffect, useRef } from "react";
import paper from "paper";

const BeamDiagram = ({ spans, supports, loads }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    paper.setup(canvasRef.current);
    paper.project.activeLayer.removeChildren();

    let scale = 80; // px per meter
    let x = 50,
      y = 200;

    // Draw beam baseline
    let totalLength = spans.reduce((acc, s) => acc + s.length, 0);
    new paper.Path.Line({
      from: [x, y],
      to: [x + totalLength * scale, y],
      strokeColor: "black",
      strokeWidth: 3,
    });

    // Draw supports
    supports.forEach((s, i) => {
      let posX = x + (i * (totalLength * scale)) / (supports.length - 1);
      if (s.type === "pinned") {
        new paper.Path.RegularPolygon({
          center: [posX, y + 15],
          sides: 3,
          radius: 12,
          fillColor: "gray",
        });
      } else if (s.type === "fixed") {
        new paper.Path.Rectangle({
          point: [posX - 6, y],
          size: [12, 25],
          fillColor: "gray",
        });
      }
    });

    // Draw loads
    loads.forEach((l) => {
      if (l.type === "point") {
        let loadX =
          x + l.position * scale + (l.span - 1) * spans[0].length * scale;
        new paper.Path.Line({
          from: [loadX, y - 40],
          to: [loadX, y],
          strokeColor: "blue",
          strokeWidth: 2,
        });
        new paper.Path.RegularPolygon({
          center: [loadX, y - 45],
          sides: 3,
          radius: 8,
          fillColor: "blue",
        });
      } else if (l.type === "udl") {
        let startX =
          x + l.start * scale + (l.span - 1) * spans[0].length * scale;
        let endX = x + l.end * scale + (l.span - 1) * spans[0].length * scale;
        for (let px = startX; px <= endX; px += 20) {
          new paper.Path.Line({
            from: [px, y - 20],
            to: [px, y],
            strokeColor: "red",
            strokeWidth: 1.5,
          });
          new paper.Path.RegularPolygon({
            center: [px, y - 25],
            sides: 3,
            radius: 6,
            fillColor: "red",
          });
        }
      }
    });

    paper.view.draw();
  }, [spans, supports, loads]);

  return (
    <canvas
      ref={canvasRef}
      resize="true"
      style={{ width: "100%", height: "300px" }}
    />
  );
};

export default BeamDiagram;
