import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";

/*
  Expects analysis object with:
  - positions: [x0, x1, x2...]
  - shear: [...]
  - moment: [...]
  - spans: [{span_index, length, EI, loads}]
  - supports: [...]
*/

export default function Diagrams({ analysis }) {
  if (!analysis) return null;

  const positions = analysis.positions || [];
  const shear = analysis.shear || [];
  const moment = analysis.moment || [];

  const data = positions.map((x, i) => ({
    x: Number(x.toFixed(3)),
    V: Number(shear[i].toFixed(3)),
    M: Number(moment[i].toFixed(3)),
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-brand-blue mb-3">Diagrams</h3>

      <div className="grid grid-cols-1 gap-6">
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottomRight",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Shear (kN)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="V"
                stroke="#0f4c81"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="V"
                fillOpacity={0.15}
                stroke="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                label={{
                  value: "Distance (m)",
                  position: "insideBottomRight",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Moment (kN·m)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="M"
                stroke="#c53030"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="M"
                fillOpacity={0.12}
                stroke="none"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
