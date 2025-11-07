import React, { useEffect, useState } from "react";
import { postThreeMoment, postDesignBeam } from "./api";

/*
  BeamForm:
  - allows quick load of default test
  - allows editing spans and loads (basic)
  - posts to backend and returns JSON results via callback
*/

const emptyLoad = () => ({
  load_type: "POINT",
  magnitude: 10.0,
  position: 1.0,
  length: 0.0,
  magnitude2: 0.0,
});

export default function BeamForm({
  defaults,
  onAnalysisResult,
  onDesignResult,
}) {
  const [spans, setSpans] = useState([
    {
      length: 6.0,
      E: 200e9,
      I: 8.33e-6,
      loads: [
        {
          load_type: "POINT",
          magnitude: 50.0,
          position: 3.0,
          length: 0,
          magnitude2: 0,
        },
      ],
    },
    {
      length: 8.0,
      E: 200e9,
      I: 8.33e-6,
      loads: [
        {
          load_type: "POINT",
          magnitude: 30.0,
          position: 4.0,
          length: 0,
          magnitude2: 0,
        },
      ],
    },
  ]);
  const [supports, setSupports] = useState([
    { support_type: "PINNED", position: 0.0 },
    { support_type: "PINNED", position: 6.0 },
    { support_type: "PINNED", position: 14.0 },
  ]);

  // design params
  const [fcu, setFcu] = useState(25.0);
  const [fy, setFy] = useState(500.0);
  const [b, setB] = useState(300);
  const [d, setD] = useState(500);

  useEffect(() => {
    if (defaults) {
      // do nothing automatically; keep defaults for manual load
    }
  }, [defaults]);

  function setDefault(testKey) {
    if (!defaults) return;
    const test = defaults[testKey];
    if (!test) return;
    setSpans(test.spans.map((s) => ({ ...s })));
    setSupports(test.supports.map((s) => ({ ...s })));
  }

  function updateSpan(idx, field, val) {
    const ss = JSON.parse(JSON.stringify(spans));
    ss[idx][field] = val;
    setSpans(ss);
  }

  function updateLoad(spanIdx, loadIdx, field, val) {
    const ss = JSON.parse(JSON.stringify(spans));
    ss[spanIdx].loads[loadIdx][field] = val;
    setSpans(ss);
  }

  function addSpan() {
    setSpans([...spans, { length: 4.0, E: 200e9, I: 1e-5, loads: [] }]);
    // append support
    const lastPos = supports[supports.length - 1].position;
    setSupports([
      ...supports,
      { support_type: "PINNED", position: lastPos + 4.0 },
    ]);
  }

  function addLoad(spanIdx) {
    const ss = JSON.parse(JSON.stringify(spans));
    ss[spanIdx].loads.push(emptyLoad());
    setSpans(ss);
  }

  function runAnalysis() {
    // make positions consistent for supports based on span lengths
    const computedSupports = [];
    let pos = 0.0;
    computedSupports.push({
      support_type: supports[0].support_type,
      position: 0.0,
    });
    for (let i = 0; i < spans.length; i++) {
      pos += Number(spans[i].length);
      computedSupports.push({
        support_type:
          supports[i + 1] && supports[i + 1].support_type
            ? supports[i + 1].support_type
            : "PINNED",
        position: pos,
      });
    }

    const payload = { spans: spans, supports: computedSupports };
    postThreeMoment(payload)
      .then((res) => {
        onAnalysisResult(res);
        // automatically call design with peak moment
        const momentVals = res.moment.map(Math.abs);
        const maxMoment = Math.max(...momentVals) / 1.0; // kN·m already
        // actually moments returned are in kN·m? backend returns in same units as loads (kN) and lengths (m) -> moment kN·m
        // find maximum absolute moment
        const maxAbsMoment = Math.max(...res.moment.map((m) => Math.abs(m)));
        // call design endpoint
        postDesignBeam({ fcu, fy, b, d, Mu: Math.abs(maxAbsMoment) / 1.0 })
          .then(onDesignResult)
          .catch((err) => console.error("Design error", err));
      })
      .catch((err) => {
        console.error(err);
        alert(
          "Analysis error: " + (err?.response?.data?.detail || err.message)
        );
      });
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-blue">Beam Input</h2>
        <div className="space-x-2">
          <button
            onClick={() => setDefault("test1")}
            className="px-3 py-1 bg-brand-blue text-white rounded text-sm"
          >
            Load Test 1
          </button>
          <button
            onClick={() => setDefault("test2")}
            className="px-3 py-1 bg-white border border-gray-200 rounded text-sm"
          >
            Load Test 2
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {spans.map((sp, si) => (
          <div key={si} className="border p-3 rounded">
            <div className="flex justify-between items-center">
              <div className="font-medium">Span {si + 1}</div>
              <div className="text-sm text-brand-gray">
                Length (m):
                <input
                  type="number"
                  step="0.1"
                  value={sp.length}
                  onChange={(e) =>
                    updateSpan(si, "length", Number(e.target.value))
                  }
                  className="ml-2 w-24 border rounded px-2 py-1"
                />
              </div>
            </div>

            <div className="mt-2">
              <div className="text-sm font-semibold mb-2">Loads</div>
              {sp.loads.map((ld, li) => (
                <div
                  key={li}
                  className="grid grid-cols-12 gap-2 items-end mb-2"
                >
                  <div className="col-span-4">
                    <label className="text-xs">Type</label>
                    <select
                      value={ld.load_type}
                      onChange={(e) =>
                        updateLoad(si, li, "load_type", e.target.value)
                      }
                      className="w-full border rounded px-2 py-1"
                    >
                      <option>POINT</option>
                      <option>UDL</option>
                      <option>PARTIAL_UDL</option>
                      <option>TRIANGULAR</option>
                      <option>TRAPEZOIDAL</option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs">Mag</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ld.magnitude}
                      onChange={(e) =>
                        updateLoad(si, li, "magnitude", Number(e.target.value))
                      }
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs">Pos (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ld.position}
                      onChange={(e) =>
                        updateLoad(si, li, "position", Number(e.target.value))
                      }
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs">Len (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={ld.length}
                      onChange={(e) =>
                        updateLoad(si, li, "length", Number(e.target.value))
                      }
                      className="w-full border rounded px-2 py-1"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => {
                        const ss = JSON.parse(JSON.stringify(spans));
                        ss[si].loads.splice(li, 1);
                        setSpans(ss);
                      }}
                      className="px-2 py-1 bg-red-500 text-white rounded"
                    >
                      X
                    </button>
                  </div>
                </div>
              ))}
              <div>
                <button
                  onClick={() => addLoad(si)}
                  className="px-2 py-1 bg-white border rounded text-sm"
                >
                  + Add Load
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="flex space-x-2">
          <button
            onClick={addSpan}
            className="px-3 py-2 bg-white border rounded"
          >
            + Add Span
          </button>
        </div>

        <div className="border p-3 rounded">
          <div className="font-medium mb-2">Design parameters (BS simple)</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs">fcu (N/mm²)</label>
              <input
                type="number"
                value={fcu}
                onChange={(e) => setFcu(Number(e.target.value))}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-xs">fy (N/mm²)</label>
              <input
                type="number"
                value={fy}
                onChange={(e) => setFy(Number(e.target.value))}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-xs">b (mm)</label>
              <input
                type="number"
                value={b}
                onChange={(e) => setB(Number(e.target.value))}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <div>
              <label className="text-xs">d (mm)</label>
              <input
                type="number"
                value={d}
                onChange={(e) => setD(Number(e.target.value))}
                className="w-full border rounded px-2 py-1"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <div className="text-sm text-brand-gray">
            Supports are computed from span lengths (pinned by default).
          </div>
          <div>
            <button
              onClick={runAnalysis}
              className="px-4 py-2 bg-brand-blue text-white rounded"
            >
              Run Analysis & Design
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
