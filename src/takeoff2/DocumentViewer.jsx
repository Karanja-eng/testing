// Minimal DocumentViewer placeholder (restored to valid JS/JSX)
import React from "react";

const DocumentViewer = ({ onClose }) => {
  return (
    <div className="p-4 bg-white rounded">
      <h2 className="text-lg font-semibold">Document Viewer (placeholder)</h2>
      <p className="text-sm text-gray-500">
        Original viewer was corrupted; placeholder in place. I will restore full
        functionality next.
      </p>
      <div className="mt-2">
        <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">
          Close
        </button>
      </div>
    </div>
  );
};

export default DocumentViewer;
