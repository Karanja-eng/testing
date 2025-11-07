import React, { useState, useRef } from "react";

import ColumnCanvas from "../components/ColumnCanvas";
import ColumnControls from "../components/ColumnControls";

const MainApp = () => {
  const canvasRef = useRef(null);
  const [columnData, setColumnData] = useState({
    width: 300,
    height: 400,
    rebar_count: 6,
    bar_diameter: 16,
    cover: 25,
    stirrup_diameter: 8,
    hook_length: 50,
  });

  const rebarLabel = `${columnData.rebar_count}Y${columnData.bar_diameter}`;

  return (
    <div className="p-2">
      <h2>Smart Column Drawer</h2>
      <ColumnControls data={columnData} setData={setColumnData} />
      <div className="mb-2 font-bold">
        Reinforcement Summary: {rebarLabel} bars
      </div>
      <ColumnCanvas canvasRef={canvasRef} columnData={columnData} />
    </div>
  );
};
export default MainApp;
