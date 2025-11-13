import React, { useState } from "react";
import FloorplanViewer from "./FloorplanViewer";

export default function MainDApp() {
  const [url, setUrl] = useState("");

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);

    // change origin if backend served elsewhere; here backend runs on same host:8000
    const res = await fetch("http://localhost:8001/convert", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (res.ok) {
      // backend returns /generated/<id>.glb — create full URL to fetch
      setUrl(`http://localhost:8001${data.glb_url}`);
    } else {
      alert("Error: " + (data.detail || JSON.stringify(data)));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: 12 }}>
        <input type="file" accept="image/*" onChange={handleFile} />
        <p>
          Upload a floorplan image — Furukawa model will segment & produce a
          GLB.
        </p>
      </div>
      <div style={{ flex: 1 }}>
        {url ? (
          <FloorplanViewer url={url} />
        ) : (
          <div style={{ padding: 20 }}>No model yet</div>
        )}
      </div>
    </div>
  );
}
