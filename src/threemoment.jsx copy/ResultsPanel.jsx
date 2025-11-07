import React from "react";

export default function ResultsPanel({ analysis, design }) {
  if (!analysis) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-brand-blue">Results</h3>
        <p className="text-sm text-brand-gray mt-2">
          Run analysis to see moments, reactions and suggested beam design.
        </p>
      </div>
    );
  }

  const moments = analysis.support_moments || [];
  const reactions = analysis.reactions || [];

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="font-semibold text-brand-blue">Analysis Results</h3>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <h4 className="font-medium">Support Moments (kN·m)</h4>
          <ul className="mt-2 text-sm">
            {moments.map((m, i) => (
              <li key={i}>
                M{i + 1}: {m.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium">Support Reactions (kN)</h4>
          <ul className="mt-2 text-sm">
            {reactions.map((r, i) => (
              <li key={i}>
                R{i + 1}: {r.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-medium">Beam Design Suggestion</h4>
        {design ? (
          <div className="mt-2 text-sm">
            <div>
              Ast (mm²):{" "}
              {design.Ast_mm2 ?? design.Ast_required_mm2 ?? design["Ast_mm2"]}
            </div>
            <div>Steel ratio: {design.rho}</div>
            <div>Lever arm z: {design.z_mm ?? design.z}</div>
            <div>Checks: {design.is_rho_reasonable ? "OK" : "Review"}</div>
          </div>
        ) : (
          <div className="mt-2 text-sm">
            Design results will appear after analysis (uses peak moment).
          </div>
        )}
      </div>
    </div>
  );
}
