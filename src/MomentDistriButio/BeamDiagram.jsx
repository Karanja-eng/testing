// src/BeamDiagram.js
import React from "react";

const BeamDiagram = ({ diagram }) => {
  if (!diagram || !diagram.elements) return null;

  const totalLength = diagram.total_length;
  const width = 600;
  const height = 200;
  const scale = width / (totalLength + 0.5);
  const yBeam = 100;

  return (
    <svg width={width} height={height}>
      {diagram.elements.map((el, idx) => {
        if (el.type === "beam") {
          return (
            <line
              key={idx}
              x1={el.x_start * scale}
              y1={yBeam}
              x2={el.x_end * scale}
              y2={yBeam}
              stroke="black"
              strokeWidth="2"
            />
          );
        } else if (el.type === "support") {
          if (el.support_type === "fixed") {
            return (
              <g key={idx}>
                <line
                  x1={el.x * scale}
                  y1={yBeam}
                  x2={el.x * scale}
                  y2={yBeam + 20}
                  stroke="black"
                  strokeWidth="2"
                />
                <line
                  x1={(el.x - 0.2) * scale}
                  y1={yBeam + 20}
                  x2={(el.x + 0.2) * scale}
                  y2={yBeam + 20}
                  stroke="black"
                  strokeWidth="2"
                />
                <text x={el.x * scale} y={yBeam - 10} textAnchor="middle">
                  {el.label}
                </text>
              </g>
            );
          } else if (el.support_type === "pinned") {
            return (
              <g key={idx}>
                <polygon
                  points={`${el.x * scale},${yBeam} ${(el.x - 0.2) * scale},${
                    yBeam + 20
                  } ${(el.x + 0.2) * scale},${yBeam + 20}`}
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                />
                <text x={el.x * scale} y={yBeam - 10} textAnchor="middle">
                  {el.label}
                </text>
              </g>
            );
          } else if (el.support_type === "roller") {
            return (
              <g key={idx}>
                <circle
                  cx={el.x * scale}
                  cy={yBeam + 20}
                  r={5}
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                />
                <line
                  x1={(el.x - 0.2) * scale}
                  y1={yBeam + 20}
                  x2={(el.x + 0.2) * scale}
                  y2={yBeam + 20}
                  stroke="black"
                  strokeWidth="2"
                />
                <text x={el.x * scale} y={yBeam - 10} textAnchor="middle">
                  {el.label}
                </text>
              </g>
            );
          }
        } else if (el.type === "free_end") {
          return (
            <text key={idx} x={el.x * scale} y={yBeam - 10} textAnchor="middle">
              {el.label}
            </text>
          );
        } else if (el.type === "load_arrow") {
          const arrowWidth = el.load_type === "point" ? 0.2 : 0.1;
          return (
            <g key={idx}>
              <line
                x1={el.x * scale}
                y1={yBeam - 20}
                x2={el.x * scale}
                y2={yBeam}
                stroke={el.load_type === "point" ? "red" : "blue"}
                strokeWidth="2"
              />
              <polygon
                points={`${el.x * scale},${yBeam - 20} ${
                  (el.x - arrowWidth) * scale
                },${yBeam - 25} ${(el.x + arrowWidth) * scale},${yBeam - 25}`}
                fill={el.load_type === "point" ? "red" : "blue"}
              />
            </g>
          );
        } else if (el.type === "load_label") {
          return (
            <text key={idx} x={el.x * scale} y={yBeam - 30} textAnchor="middle">
              {el.text}
            </text>
          );
        } else if (el.type === "span_label") {
          return (
            <text key={idx} x={el.x * scale} y={yBeam + 15} textAnchor="middle">
              {el.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
};

export default BeamDiagram;

/* src/App.css */
