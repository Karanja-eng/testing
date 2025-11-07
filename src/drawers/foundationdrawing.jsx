import React, { useRef, useEffect } from "react";

const FoundationVisualizer = () => {
  const canvasRef = useRef(null);
  const [footingLength, setFootingLength] = React.useState(2000);
  const [footingWidth, setFootingWidth] = React.useState(1500);
  const [columnLength, setColumnLength] = React.useState(400);
  const [columnWidth, setColumnWidth] = React.useState(300);
  const [cover, setCover] = React.useState(50);
  const [barDia, setBarDia] = React.useState(16);
  const [spacing, setSpacing] = React.useState(200);
  const [hookLength, setHookLength] = React.useState(80); // 5 * barDia

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;

    // Scale factor (adjust as needed)
    const scale = 0.2;
    const offsetX = (canvas.width - footingWidth * scale) / 2;
    const offsetY = (canvas.height - footingLength * scale) / 2;

    // Draw outer rectangle (footing)
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, footingWidth * scale, footingLength * scale);
    ctx.stroke();

    // Draw column (centered)
    const xCol = offsetX + ((footingWidth - columnWidth) * scale) / 2;
    const yCol = offsetY + ((footingLength - columnLength) * scale) / 2;
    ctx.beginPath();
    ctx.rect(xCol, yCol, columnWidth * scale, columnLength * scale);
    ctx.stroke();

    // Horizontal U-bar
    const yPos = offsetY + cover * scale + spacing * scale;
    ctx.beginPath();
    ctx.moveTo(offsetX + cover * scale, yPos + hookLength * scale);
    ctx.lineTo(offsetX + cover * scale, yPos);
    ctx.lineTo(offsetX + (footingWidth - cover) * scale, yPos);
    ctx.lineTo(
      offsetX + (footingWidth - cover) * scale,
      yPos + hookLength * scale
    );
    ctx.stroke();

    // Vertical U-bar
    const xPos = offsetX + cover * scale + spacing * scale;
    ctx.beginPath();
    ctx.moveTo(xPos + hookLength * scale, offsetY + cover * scale);
    ctx.lineTo(xPos, offsetY + cover * scale);
    ctx.lineTo(xPos, offsetY + (footingLength - cover) * scale);
    ctx.lineTo(
      xPos + hookLength * scale,
      offsetY + (footingLength - cover) * scale
    );
    ctx.stroke();
  }, [
    footingLength,
    footingWidth,
    columnLength,
    columnWidth,
    cover,
    barDia,
    spacing,
    hookLength,
  ]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <h2>Foundation Visualizer</h2>
      <form
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <label>
          Footing Length (mm):
          <input
            type="number"
            value={footingLength}
            onChange={(e) => setFootingLength(Number(e.target.value))}
            min={1000}
            max={3000}
          />
        </label>
        <label>
          Footing Width (mm):
          <input
            type="number"
            value={footingWidth}
            onChange={(e) => setFootingWidth(Number(e.target.value))}
            min={1000}
            max={3000}
          />
        </label>
        <label>
          Column Length (mm):
          <input
            type="number"
            value={columnLength}
            onChange={(e) => setColumnLength(Number(e.target.value))}
            min={200}
            max={600}
          />
        </label>
        <label>
          Column Width (mm):
          <input
            type="number"
            value={columnWidth}
            onChange={(e) => setColumnWidth(Number(e.target.value))}
            min={200}
            max={600}
          />
        </label>
        <label>
          Cover (mm):
          <input
            type="number"
            value={cover}
            onChange={(e) => setCover(Number(e.target.value))}
            min={40}
            max={100}
          />
        </label>
        <label>
          Bar Diameter (mm):
          <input
            type="number"
            value={barDia}
            onChange={(e) => {
              setBarDia(Number(e.target.value));
              setHookLength(5 * Number(e.target.value));
            }}
            min={12}
            max={25}
          />
        </label>
        <label>
          Spacing (mm):
          <input
            type="number"
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
            min={100}
            max={300}
          />
        </label>
      </form>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid black" }}
      />
    </div>
  );
};

export default FoundationVisualizer;
