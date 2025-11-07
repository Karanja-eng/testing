import React, { useState, useRef, useEffect } from "react";

const BeamColumnDrawer = () => {
  const [type, setType] = useState("t_beam"); // Default to T-beam
  const [webWidth, setWebWidth] = useState(250); // mm
  const [beamDepth, setBeamDepth] = useState(350); // mm
  const [flangeThk, setFlangeThk] = useState(120); // mm for T and L
  const [topBars, setTopBars] = useState(2);
  const [topBarDia, setTopBarDia] = useState(16);
  const [botBars, setBotBars] = useState(3);
  const [botBarDia, setBotBarDia] = useState(20);
  const [sideBars, setSideBars] = useState(2); // For columns, vertical bars on sides
  const [cover, setCover] = useState(20);
  const canvasRef = useRef(null);

  // Scale factor to make drawing visible on canvas (pixels per mm)
  const SCALE = 0.5; // Adjust as needed for visibility

  useEffect(() => {
    draw();
  }, [
    type,
    webWidth,
    beamDepth,
    flangeThk,
    topBars,
    topBarDia,
    botBars,
    botBarDia,
    sideBars,
    cover,
  ]);

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black";
    ctx.fillStyle = "black";
    ctx.lineWidth = 1;

    // Adjust coordinates to canvas scale and origin (top-left is 0,0, y positive down)
    const flipY = (y) => canvas.height / 2 - y * SCALE; // Center and flip y-axis
    const xOffset = canvas.width / 2 - (getMaxWidth() * SCALE) / 2; // Center horizontally

    if (type === "t_beam") {
      drawTBeam(ctx, xOffset, flipY);
    } else if (type === "l_beam") {
      drawLBeam(ctx, xOffset, flipY);
    } else if (type === "flangless_beam") {
      drawFlanglessBeam(ctx, xOffset, flipY);
    } else if (type === "column") {
      drawColumn(ctx, xOffset, flipY);
    }
  };

  const getMaxWidth = () => {
    if (type === "t_beam") return beamDepth * 2;
    if (type === "l_beam") return webWidth + beamDepth;
    return webWidth;
  };

  const drawTBeam = (ctx, xOffset, flipY) => {
    const flangeLen = beamDepth * 2;
    const x0 = xOffset;
    const y0 = flipY(0);
    const x1 = xOffset + flangeLen * SCALE;
    const y1 = flipY(-flangeThk);
    const x2 = xOffset + ((flangeLen - webWidth) / 2) * SCALE;
    const x3 = x2 + webWidth * SCALE;
    const y2 = flipY(-beamDepth);

    // Concrete outline
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x3, y1);
    ctx.lineTo(x3, y2);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.stroke();

    // Stirrups
    ctx.beginPath();
    ctx.moveTo(x2 + cover * SCALE, flipY(-cover));
    ctx.lineTo(x3 - cover * SCALE, flipY(-cover));
    ctx.lineTo(x3 - cover * SCALE, y2 - cover * SCALE);
    ctx.lineTo(x2 + cover * SCALE, y2 - cover * SCALE);
    ctx.closePath();
    ctx.stroke();

    // Top bars
    const spacingTop = (webWidth - 2 * cover - topBarDia) / (topBars - 1) || 0;
    for (let i = 0; i < topBars; i++) {
      const x = x2 + (cover + topBarDia / 2 + i * spacingTop) * SCALE;
      const y = flipY(-cover - topBarDia / 2);
      ctx.beginPath();
      ctx.arc(x, y, (topBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Bottom bars
    const spacingBot = (webWidth - 2 * cover - botBarDia) / (botBars - 1) || 0;
    for (let i = 0; i < botBars; i++) {
      const x = x2 + (cover + botBarDia / 2 + i * spacingBot) * SCALE;
      const y = y2 - (cover + botBarDia / 2) * SCALE;
      ctx.beginPath();
      ctx.arc(x, y, (botBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const drawLBeam = (ctx, xOffset, flipY) => {
    const flangeLen = beamDepth;
    const x0 = xOffset;
    const y0 = flipY(0);
    const x1 = xOffset + (webWidth + flangeLen) * SCALE;
    const y1 = flipY(-flangeThk);
    const x2 = xOffset;
    const x3 = xOffset + webWidth * SCALE;
    const y2 = flipY(-beamDepth);

    // Concrete outline
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x3, y1);
    ctx.lineTo(x3, y2);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, y0);
    ctx.closePath();
    ctx.stroke();

    // Stirrups
    ctx.beginPath();
    ctx.moveTo(x2 + cover * SCALE, flipY(-cover));
    ctx.lineTo(x3 - cover * SCALE, flipY(-cover));
    ctx.lineTo(x3 - cover * SCALE, y2 - cover * SCALE);
    ctx.lineTo(x2 + cover * SCALE, y2 - cover * SCALE);
    ctx.closePath();
    ctx.stroke();

    // Top bars
    const spacingTop = (webWidth - 2 * cover - topBarDia) / (topBars - 1) || 0;
    for (let i = 0; i < topBars; i++) {
      const x = x2 + (cover + topBarDia / 2 + i * spacingTop) * SCALE;
      const y = flipY(-cover - topBarDia / 2);
      ctx.beginPath();
      ctx.arc(x, y, (topBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Bottom bars
    const spacingBot = (webWidth - 2 * cover - botBarDia) / (botBars - 1) || 0;
    for (let i = 0; i < botBars; i++) {
      const x = x2 + (cover + botBarDia / 2 + i * spacingBot) * SCALE;
      const y = y2 - (cover + botBarDia / 2) * SCALE;
      ctx.beginPath();
      ctx.arc(x, y, (botBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const drawFlanglessBeam = (ctx, xOffset, flipY) => {
    const x0 = xOffset;
    const y0 = flipY(0);
    const x1 = xOffset + webWidth * SCALE;
    const y1 = flipY(-beamDepth);

    // Concrete outline
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.stroke();

    // Stirrups
    ctx.beginPath();
    ctx.moveTo(x0 + cover * SCALE, flipY(-cover));
    ctx.lineTo(x1 - cover * SCALE, flipY(-cover));
    ctx.lineTo(x1 - cover * SCALE, y1 - cover * SCALE);
    ctx.lineTo(x0 + cover * SCALE, y1 - cover * SCALE);
    ctx.closePath();
    ctx.stroke();

    // Top bars
    const spacingTop = (webWidth - 2 * cover - topBarDia) / (topBars - 1) || 0;
    for (let i = 0; i < topBars; i++) {
      const x = x0 + (cover + topBarDia / 2 + i * spacingTop) * SCALE;
      const y = flipY(-cover - topBarDia / 2);
      ctx.beginPath();
      ctx.arc(x, y, (topBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Bottom bars
    const spacingBot = (webWidth - 2 * cover - botBarDia) / (botBars - 1) || 0;
    for (let i = 0; i < botBars; i++) {
      const x = x0 + (cover + botBarDia / 2 + i * spacingBot) * SCALE;
      const y = y1 - (cover + botBarDia / 2) * SCALE;
      ctx.beginPath();
      ctx.arc(x, y, (botBarDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const drawColumn = (ctx, xOffset, flipY) => {
    const x0 = xOffset;
    const y0 = flipY(0);
    const x1 = xOffset + webWidth * SCALE;
    const y1 = flipY(-beamDepth);

    // Concrete outline
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y1);
    ctx.closePath();
    ctx.stroke();

    // Ties (similar to stirrups)
    ctx.beginPath();
    ctx.moveTo(x0 + cover * SCALE, flipY(-cover));
    ctx.lineTo(x1 - cover * SCALE, flipY(-cover));
    ctx.lineTo(x1 - cover * SCALE, y1 - cover * SCALE);
    ctx.lineTo(x0 + cover * SCALE, y1 - cover * SCALE);
    ctx.closePath();
    ctx.stroke();

    // Top and bottom bars (symmetric, same number and dia)
    const nHorizontal = topBars; // Use topBars for horizontal
    const barDia = topBarDia; // Use topBarDia for all
    const spacingHoriz =
      (webWidth - 2 * cover - barDia) / (nHorizontal - 1) || 0;

    // Top bars
    for (let i = 0; i < nHorizontal; i++) {
      const x = x0 + (cover + barDia / 2 + i * spacingHoriz) * SCALE;
      const y = flipY(-cover - barDia / 2);
      ctx.beginPath();
      ctx.arc(x, y, (barDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Bottom bars
    for (let i = 0; i < nHorizontal; i++) {
      const x = x0 + (cover + barDia / 2 + i * spacingHoriz) * SCALE;
      const y = y1 - (cover + barDia / 2) * SCALE;
      ctx.beginPath();
      ctx.arc(x, y, (barDia / 2) * SCALE, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Side bars (vertical on left and right, if sideBars > 2 include middles)
    if (sideBars > 2) {
      const spacingVert = (beamDepth - 2 * cover - barDia) / (sideBars - 1);
      // Left side
      const xLeft = x0 + (cover + barDia / 2) * SCALE;
      for (let i = 1; i < sideBars - 1; i++) {
        const y = flipY(-(cover + barDia / 2 + i * spacingVert));
        ctx.beginPath();
        ctx.arc(xLeft, y, (barDia / 2) * SCALE, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Right side
      const xRight = x1 - (cover + barDia / 2) * SCALE;
      for (let i = 1; i < sideBars - 1; i++) {
        const y = flipY(-(cover + barDia / 2 + i * spacingVert));
        ctx.beginPath();
        ctx.arc(xRight, y, (barDia / 2) * SCALE, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <h2>Beam/Column Drawer</h2>
      <form
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}
      >
        <label>
          Type:
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="t_beam">T-Beam</option>
            <option value="l_beam">L-Beam</option>
            <option value="flangless_beam">Flangless Beam</option>
            <option value="column">Column</option>
          </select>
        </label>
        <label>
          Web Width (mm):
          <input
            type="number"
            value={webWidth}
            onChange={(e) => setWebWidth(Number(e.target.value))}
            min={200}
            max={300}
          />
        </label>
        <label>
          Depth (mm):
          <input
            type="number"
            value={beamDepth}
            onChange={(e) => setBeamDepth(Number(e.target.value))}
            min={350}
            max={500}
          />
        </label>
        {(type === "t_beam" || type === "l_beam") && (
          <label>
            Flange Thickness (mm):
            <input
              type="number"
              value={flangeThk}
              onChange={(e) => setFlangeThk(Number(e.target.value))}
            />
          </label>
        )}
        <label>
          Cover (mm):
          <input
            type="number"
            value={cover}
            onChange={(e) => setCover(Number(e.target.value))}
          />
        </label>
        <label>
          Top Bars Count:
          <input
            type="number"
            value={topBars}
            onChange={(e) => setTopBars(Number(e.target.value))}
            min={2}
            max={4}
          />
        </label>
        <label>
          Top Bar Diameter (mm):
          <input
            type="number"
            value={topBarDia}
            onChange={(e) => setTopBarDia(Number(e.target.value))}
            min={16}
            max={25}
          />
        </label>
        {type !== "column" && (
          <>
            <label>
              Bottom Bars Count:
              <input
                type="number"
                value={botBars}
                onChange={(e) => setBotBars(Number(e.target.value))}
                min={2}
                max={4}
              />
            </label>
            <label>
              Bottom Bar Diameter (mm):
              <input
                type="number"
                value={botBarDia}
                onChange={(e) => setBotBarDia(Number(e.target.value))}
                min={16}
                max={25}
              />
            </label>
          </>
        )}
        {type === "column" && (
          <label>
            Side Bars Count (per side):
            <input
              type="number"
              value={sideBars}
              onChange={(e) => setSideBars(Number(e.target.value))}
              min={2}
              max={4}
            />
          </label>
        )}
      </form>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: "1px solid black", marginTop: "20px" }}
      />
    </div>
  );
};

export default BeamColumnDrawer;
