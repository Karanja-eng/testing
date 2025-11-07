// App.js
import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
} from "recharts";

/**
 * ColumnSection draws a rectangular column section with bars.
 * - If distribution is provided (top/bottom/left/right counts, including corners),
 *   it places bars accordingly.
 * - Otherwise it evenly distributes `numBars` around the perimeter (corners included).
 */
function ColumnSection({ b, h, cover, tieDia, barDia, numBars }) {
  if (!b || !h || !numBars) return null;

  const widthPx = 300;
  const heightPx = 300;
  const margin = 40;

  // scaling mm → px
  const sx = (val) => (val / b) * (widthPx - 2 * margin);
  const sy = (val) => (val / h) * (heightPx - 2 * margin);

  // tie rectangle
  const tieRect = {
    x: margin + sx(cover + tieDia),
    y: margin + sy(cover + tieDia),
    w: sx(b - 2 * (cover + tieDia)),
    h: sy(h - 2 * (cover + tieDia)),
  };

  // -------------------
  // ✅ BAR DISTRIBUTION
  // -------------------
  const bars = [];
  const barRadiusPx = Math.max(2, sx(barDia / 2));

  // always place 4 corner bars
  const corners = [
    { x: cover, y: cover },
    { x: b - cover, y: cover },
    { x: cover, y: h - cover },
    { x: b - cover, y: h - cover },
  ];
  corners.forEach((c) => bars.push(c));

  // remaining bars
  let remaining = numBars - 4;
  const sides = ["top", "bottom", "left", "right"];
  let sideIdx = 0;

  while (remaining > 0) {
    const side = sides[sideIdx % 4];
    sideIdx++;

    if (side === "top") {
      const x =
        cover +
        (bars.filter((p) => p.y === cover).length * (b - 2 * cover)) /
          (remaining + 1);
      bars.push({ x, y: cover });
    }
    if (side === "bottom") {
      const x =
        cover +
        (bars.filter((p) => p.y === h - cover).length * (b - 2 * cover)) /
          (remaining + 1);
      bars.push({ x, y: h - cover });
    }
    if (side === "left") {
      const y =
        cover +
        (bars.filter((p) => p.x === cover).length * (h - 2 * cover)) /
          (remaining + 1);
      bars.push({ x: cover, y });
    }
    if (side === "right") {
      const y =
        cover +
        (bars.filter((p) => p.x === b - cover).length * (h - 2 * cover)) /
          (remaining + 1);
      bars.push({ x: b - cover, y });
    }

    remaining--;
  }

  return (
    <svg
      width={widthPx}
      height={heightPx}
      style={{ border: "1px solid #ccc", background: "#fff" }}
    >
      {/* column outline */}
      <rect
        x={margin}
        y={margin}
        width={sx(b)}
        height={sy(h)}
        stroke="#333"
        fill="#f8f8f8"
      />

      {/* tie rectangle */}
      <rect
        x={tieRect.x}
        y={tieRect.y}
        width={tieRect.w}
        height={tieRect.h}
        stroke="#666"
        strokeDasharray="6 4"
        fill="none"
      />

      {/* bars */}
      {bars.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x) + margin}
          cy={sy(p.y) + margin}
          r={barRadiusPx}
          fill="red"
          stroke="darkred"
        />
      ))}

      {/* labels */}
      <text x={8} y={14} fontSize="12" fill="#333">
        b={b}mm, h={h}mm
      </text>
      <text x={8} y={30} fontSize="12" fill="#333">
        cover={cover}mm, tie Ø{tieDia}mm, bar Ø{barDia}mm
      </text>
      <text x={8} y={46} fontSize="12" fill="#333">
        bars drawn: {bars.length} (expected {numBars})
      </text>
    </svg>
  );
}

export default function App() {
  // geometry / loads
  const [mode, setMode] = useState("uniaxial");
  const [b, setB] = useState(300);
  const [h, setH] = useState(300);
  const [N, setN] = useState(1480); // kN
  const [M, setM] = useState(54); // kNm (uniaxial)
  const [Mx, setMx] = useState(40); // kNm (biaxial)
  const [My, setMy] = useState(20); // kNm (biaxial)
  const [alpha, setAlpha] = useState(1.0);

  // cover / tie / aggregate
  const [cover, setCover] = useState(40);
  const [tieDia, setTieDia] = useState(8);
  const [maxAgg, setMaxAgg] = useState(20);

  // bar diameter input (user selectable)
  const barDiameterOptions = [6, 8, 10, 12, 16, 20, 25, 32, 40];
  const [barDiameter, setBarDiameter] = useState(16);

  // UI state
  const [result, setResult] = useState(null);
  const [chartVisible, setChartVisible] = useState(false);
  const [chartData, setChartData] = useState([]);

  // Submit design request
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload =
      mode === "uniaxial"
        ? {
            mode,
            b,
            h,
            N: N,
            M: M,
            cover,
            tie_dia: tieDia,
            max_agg: maxAgg,
            bar_diameter: barDiameter,
          }
        : {
            mode,
            b,
            h,
            N: N,
            Mx: Mx,
            My: My,
            alpha,
            cover,
            tie_dia: tieDia,
            max_agg: maxAgg,
            bar_diameter: barDiameter,
          };

    const res = await fetch("http://localhost:8000/design-column", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log("API ->", data);
    setResult(data);
    setChartVisible(false);
  };

  const fetchChart = async () => {
    const res = await fetch("http://localhost:8000/get-interaction-data");
    const data = await res.json();
    setChartData(data.data || []);
    setChartVisible(true);
  };

  const randColor = () =>
    `#${Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")}`;

  // Helper to safely extract bar selection regardless of server key names
  const getBarSelection = (resp) => {
    if (!resp) return null;
    return (
      resp.bar_selection ??
      resp.barSelection ??
      resp.bars ??
      resp.bars_selection ??
      null
    );
  };

  // Chart renderer (x-axis projection)
  const renderChart = (axis = "x") => {
    if (!chartVisible || !chartData.length) return null;
    const scatterPoints = [];
    if (result?.status === "success") {
      if (result.mode === "uniaxial") {
        const dp = result.design_point;
        const cp = result.chart_point;
        if (dp?.N != null && dp?.M != null)
          scatterPoints.push({ name: "Target", M: dp.M, N: dp.N });
        if (cp?.N != null && cp?.M != null)
          scatterPoints.push({ name: "Chart", M: cp.M, N: cp.N });
      } else {
        const dp = result.design_point;
        const cp = result.chart_point;
        if (axis === "x") {
          if (dp?.N != null && dp?.Mx != null)
            scatterPoints.push({ name: "TargetX", M: dp.Mx, N: dp.N });
          if (cp?.N != null && cp?.Mux != null)
            scatterPoints.push({ name: "ChartX", M: cp.Mux, N: cp.N });
        } else {
          if (dp?.N != null && dp?.My != null)
            scatterPoints.push({ name: "TargetY", M: dp.My, N: dp.N });
          if (cp?.N != null && cp?.Muy != null)
            scatterPoints.push({ name: "ChartY", M: cp.Muy, N: cp.N });
        }
      }
    }

    return (
      <LineChart
        width={800}
        height={400}
        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="M"
          type="number"
          domain={["auto", "auto"]}
          label={{ value: "M/bh² (N/mm²)", position: "bottom" }}
        />
        <YAxis
          dataKey="N"
          type="number"
          label={{ value: "N/bh (N/mm²)", angle: -90, position: "insideLeft" }}
          domain={["auto", "auto"]}
        />
        <Tooltip />
        <Legend verticalAlign="middle" align="right" layout="vertical" />
        {chartData.map((dataset, idx) => (
          <Line
            key={idx}
            data={dataset.points}
            dataKey="N"
            name={`${dataset.steelPercentage}%`}
            stroke={randColor()}
            strokeWidth={1}
            dot={false}
          />
        ))}
        {scatterPoints.length > 0 && (
          <Scatter
            name="Design points"
            data={scatterPoints}
            fill="red"
            shape="star"
          />
        )}
      </LineChart>
    );
  };

  // UI helpers to read server bar data reliably
  const barSel = getBarSelection(result);
  const serverNumBars = barSel
    ? barSel.num_bars ??
      barSel.numBars ??
      barSel.num_bars ??
      barSel.num_bars ??
      null
    : null;
  const serverDia = barSel
    ? barSel.bar_dia ?? barSel.barDia ?? barSel.diameter ?? barSel.diam ?? null
    : null;
  const serverTotalArea = barSel
    ? barSel.total_area ??
      barSel.totalArea ??
      barSel.total_area ??
      barSel.provided_area ??
      null
    : null;
  const serverDistribution = barSel
    ? barSel.distribution ?? barSel.dist ?? null
    : null;

  return (
    <div className="App" style={{ padding: 18 }}>
      <h1 className="font-bold">Column Design Tool</h1>
      <div className="flex flex-row ">
        <form
          onSubmit={handleSubmit}
          style={{
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            minWidth: 360,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <label>Mode: </label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="uniaxial">Uniaxial</option>
              <option value="biaxial">Biaxial</option>
            </select>
          </div>

          <div className="flex flex-col bg-gray-100">
            <label>
              Width b (mm):{" "}
              <input
                type="number"
                value={b}
                onChange={(e) => setB(+e.target.value)}
              />
            </label>
            <label>
              Depth h (mm):{" "}
              <input
                type="number"
                value={h}
                onChange={(e) => setH(+e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-col bg-gray-100">
            <label>
              Axial N (kN):{" "}
              <input
                type="number"
                value={N}
                onChange={(e) => setN(+e.target.value)}
              />
            </label>
          </div>

          {mode === "uniaxial" ? (
            <div style={{ marginTop: 8 }}>
              <label>
                Moment M (kNm):{" "}
                <input
                  type="number"
                  value={M}
                  onChange={(e) => setM(+e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <label>
                Mx (kNm):{" "}
                <input
                  type="number"
                  value={Mx}
                  onChange={(e) => setMx(+e.target.value)}
                />
              </label>
              <label style={{ marginLeft: 8 }}>
                My (kNm):{" "}
                <input
                  type="number"
                  value={My}
                  onChange={(e) => setMy(+e.target.value)}
                />
              </label>
              <div style={{ marginTop: 6 }}>
                <label>
                  α (power):{" "}
                  <input
                    type="number"
                    step="0.1"
                    value={alpha}
                    onChange={(e) => setAlpha(+e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

          <div>
            <label>
              Cover (mm):{" "}
              <input
                type="number"
                value={cover}
                onChange={(e) => setCover(+e.target.value)}
              />
            </label>
            <label>
              Tie Ø (mm):{" "}
              <input
                type="number"
                value={tieDia}
                onChange={(e) => setTieDia(+e.target.value)}
              />
            </label>
            <label>
              Max agg (mm):{" "}
              <input
                type="number"
                value={maxAgg}
                onChange={(e) => setMaxAgg(+e.target.value)}
              />
            </label>
          </div>

          <div>
            <label>
              Bar diameter (mm):{" "}
              <select
                value={barDiameter}
                onChange={(e) => setBarDiameter(+e.target.value)}
              >
                {barDiameterOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="bg-orange-700 hover:bg-orange-600" type="submit">
              Design Column
            </button>
          </div>
        </form>

        <div
          style={{
            width: 520,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
          }}
        >
          <h3>Results</h3>
          {result ? (
            <>
              <p>Status: {result.status}</p>
              {result.status === "success" ? (
                <>
                  <p>Mode: {result.mode}</p>
                  <p>
                    Dimensions: {result.dimensions?.b} × {result.dimensions?.h}{" "}
                    mm
                  </p>
                  {result.mode === "uniaxial" ? (
                    <p>
                      Loads: N = {(result.loads.N / 1000).toFixed(1)} kN, M ={" "}
                      {(result.loads.M / 1e6).toFixed(2)} kNm
                    </p>
                  ) : (
                    <p>
                      Loads: N = {(result.loads.N / 1000).toFixed(1)} kN, Mx ={" "}
                      {(result.loads.Mx / 1e6).toFixed(2)} kNm, My ={" "}
                      {(result.loads.My / 1e6).toFixed(2)} kNm
                    </p>
                  )}
                  <p>Steel %: {result.steel_percentage?.toFixed?.(2)}</p>
                  <p>
                    Required steel area Asc = {result.steel_area.toFixed(1)} mm²
                  </p>

                  {/* bar selection display (robust to server key names) */}
                  {barSel ? (
                    <>
                      <h4>Bar selection</h4>
                      <p>
                        {serverNumBars ?? "-"} × Ø{serverDia ?? barDiameter} mm
                        — total {serverTotalArea ?? "-"} mm²
                      </p>
                      <div style={{ marginTop: 8 }}>
                        <ColumnSection
                          b={b}
                          h={h}
                          barDia={serverDia ?? barDiameter}
                          numBars={serverNumBars ?? 4}
                          distribution={serverDistribution}
                          cover={cover}
                          tieDia={tieDia}
                        />
                      </div>
                    </>
                  ) : (
                    <p>No bar selection returned from server.</p>
                  )}

                  <div style={{ marginTop: 8 }}>
                    <button onClick={fetchChart} disabled={chartVisible}>
                      {chartVisible ? "Chart Visible" : "Visualize Chart"}
                    </button>
                  </div>
                </>
              ) : (
                <p>{result.message}</p>
              )}
            </>
          ) : (
            <p>No result yet</p>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          background: "#fff",
          padding: 12,
          borderRadius: 8,
        }}
      >
        {chartVisible && renderChart("x")}
      </div>
    </div>
  );
}
