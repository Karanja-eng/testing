// BOQ.jsx - simple Bill of Quantities viewer/exporter
import React from "react";

const BOQ = ({ boqItems = [], onExportCSV }) => {
  const exportCSV = () => {
    if (!boqItems || boqItems.length === 0) return;
    const header = ["Description", "Quantity", "Unit", "Rate", "Amount"];
    const rows = boqItems.map((i) => [
      i.description || "",
      i.quantity || 0,
      i.unit || "",
      i.rate || "",
      i.amount || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boq.csv";
    a.click();
    URL.revokeObjectURL(url);

    onExportCSV && onExportCSV(csv);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Bill of Quantities (BOQ)</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-right">Quantity</th>
              <th className="p-2 text-left">Unit</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {boqItems && boqItems.length > 0 ? (
              boqItems.map((item, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2">{item.unit}</td>
                  <td className="p-2 text-right">{item.rate ?? ""}</td>
                  <td className="p-2 text-right">{item.amount ?? ""}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="p-4 text-center text-gray-500" colSpan={5}>
                  No BOQ items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BOQ;
