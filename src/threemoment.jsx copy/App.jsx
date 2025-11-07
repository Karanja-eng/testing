import React, { useEffect, useState } from "react";
import BeamForm from "./BeamForm";
import ResultsPanel from "./ResultsPanel";
import Diagrams from "./Diagrams";
import { getDefaultTests } from "./api";

export default function App() {
  const [defaults, setDefaults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [design, setDesign] = useState(null);

  useEffect(() => {
    getDefaultTests()
      .then(setDefaults)
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-blue">
              Beam Design Studio
            </h1>
            <p className="text-sm text-brand-gray">
              Continuous beams — Three-Moment analysis + simplified BS design
            </p>
          </div>
          <div>
            <button className="px-4 py-2 bg-brand-blue text-white rounded">
              Professional Mode
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
        <section className="col-span-5">
          <BeamForm
            defaults={defaults}
            onAnalysisResult={setAnalysis}
            onDesignResult={setDesign}
          />
        </section>

        <section className="col-span-7">
          <ResultsPanel analysis={analysis} design={design} />
          {analysis && <Diagrams analysis={analysis} />}
        </section>
      </main>
    </div>
  );
}
