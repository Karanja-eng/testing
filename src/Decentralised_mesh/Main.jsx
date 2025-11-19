import React, { useState, useEffect } from "react";
import { Upload, Send, Activity, Database, Cpu, Zap } from "lucide-react";

const API_BASE = "http://localhost:8000";

export default function MeshNetworkApp() {
  const [activeTab, setActiveTab] = useState("publish");
  const [devices, setDevices] = useState([]);
  const [models, setModels] = useState([]);
  const [inferenceResult, setInferenceResult] = useState(null);
  const [publishResult, setPublishResult] = useState(null);

  const [publishFile, setPublishFile] = useState(null);
  const [modelName, setModelName] = useState("llama-7b");
  const [numLayers, setNumLayers] = useState(32);
  const [shardSize, setShardSize] = useState(200);
  const [inferModelName, setInferModelName] = useState("llama-7b");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    loadDevices();
    simulateDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const res = await fetch(`${API_BASE}/devices`);
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error("Failed to load devices:", error);
    }
  };

  const simulateDevices = async () => {
    const deviceTypes = [
      { id: "phone_1", battery: 85, cpu: 30, ram: 45, plugged: false },
      { id: "laptop_1", battery: 95, cpu: 15, ram: 35, plugged: true },
      { id: "router_1", battery: 100, cpu: 10, ram: 20, plugged: true },
      { id: "tablet_1", battery: 60, cpu: 40, ram: 50, plugged: false },
      { id: "desktop_1", battery: 100, cpu: 5, ram: 25, plugged: true },
    ];

    for (const device of deviceTypes) {
      try {
        await fetch(`${API_BASE}/telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: device.id,
            battery_percent: device.battery,
            cpu_load_percent: device.cpu,
            ram_usage_percent: device.ram,
            idle_percent: 100 - device.cpu,
            link_quality: 0.9,
            available_storage_mb: 5000,
            is_plugged_in: device.plugged,
          }),
        });
      } catch (error) {
        console.error("Failed to register device:", error);
      }
    }

    loadDevices();
  };

  const handlePublishFile = async () => {
    if (!publishFile) return;

    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", publishFile);

      const res = await fetch(`${API_BASE}/publish`, {
        method: "POST",
        body: uploadFormData,
      });

      const data = await res.json();
      setPublishResult(data);
    } catch (error) {
      console.error("Failed to publish:", error);
    }
  };

  const handleRegisterModel = async () => {
    try {
      const res = await fetch(`${API_BASE}/model/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: modelName,
          num_layers: numLayers,
          shard_size_mb: shardSize,
        }),
      });

      const data = await res.json();
      setModels([...models, data]);
      setModelName("");
      setNumLayers(32);
      setShardSize(200);
    } catch (error) {
      console.error("Failed to register model:", error);
    }
  };

  const handleInference = async () => {
    try {
      const res = await fetch(`${API_BASE}/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: inferModelName,
          prompt: prompt,
          max_tokens: 100,
          temperature: 0.7,
        }),
      });

      const data = await res.json();
      setInferenceResult(data);
    } catch (error) {
      console.error("Failed to run inference:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-gray-800" />
              <h1 className="text-2xl font-light text-gray-900">
                Mesh Network
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Activity className="w-4 h-4" />
              <span>{devices.length} devices online</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {["publish", "model", "inference", "devices"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === "publish" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Publish Content
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setPublishFile(e.target.files[0])}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
                <button
                  onClick={handlePublishFile}
                  className="w-full bg-gray-900 text-white py-2 px-4 rounded hover:bg-gray-800 transition-colors"
                >
                  Publish to Mesh
                </button>
              </div>
            </div>

            {publishResult && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Publication Result
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Content ID:</span>
                    <span className="font-mono text-gray-900">
                      {publishResult.content_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chunks:</span>
                    <span className="text-gray-900">
                      {publishResult.num_chunks}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Content Address:</span>
                    <span className="font-mono text-gray-900 text-xs">
                      {publishResult.content_address?.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-medium text-gray-700 mb-2">
                    Chunk Distribution
                  </h4>
                  <div className="space-y-2">
                    {publishResult.placements?.slice(0, 3).map((p, i) => (
                      <div key={i} className="text-xs">
                        <div className="text-gray-600">
                          Chunk {i + 1}: {p.devices.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "model" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Register Distributed Model
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="llama-7b"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Layers
                    </label>
                    <input
                      type="number"
                      value={numLayers}
                      onChange={(e) => setNumLayers(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shard Size (MB)
                    </label>
                    <input
                      type="number"
                      value={shardSize}
                      onChange={(e) => setShardSize(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                </div>
                <button
                  onClick={handleRegisterModel}
                  className="w-full bg-gray-900 text-white py-2 px-4 rounded hover:bg-gray-800 transition-colors"
                >
                  Register Model
                </button>
              </div>
            </div>

            {models.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Registered Models
                </h3>
                <div className="space-y-3">
                  {models.map((model, i) => (
                    <div key={i} className="border-l-2 border-gray-900 pl-4">
                      <div className="font-medium text-gray-900">
                        {model.model_name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {model.num_shards} shards distributed across mesh
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "inference" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Send className="w-5 h-5" />
                Run Inference
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={inferModelName}
                    onChange={(e) => setInferModelName(e.target.value)}
                    placeholder="llama-7b"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Explain quantum computing..."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <button
                  onClick={handleInference}
                  className="w-full bg-gray-900 text-white py-2 px-4 rounded hover:bg-gray-800 transition-colors"
                >
                  Run Distributed Inference
                </button>
              </div>
            </div>

            {inferenceResult && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Result
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-2">
                      Generated Text:
                    </div>
                    <div className="text-sm text-gray-900 bg-gray-50 p-4 rounded">
                      {inferenceResult.generated_text}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Latency</div>
                      <div className="font-medium text-gray-900">
                        {inferenceResult.latency_ms?.toFixed(2)} ms
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Devices Used</div>
                      <div className="font-medium text-gray-900">
                        {inferenceResult.compute_path?.length || 0}
                      </div>
                    </div>
                  </div>
                  {inferenceResult.compute_path && (
                    <div>
                      <div className="text-xs text-gray-600 mb-2">
                        Compute Path:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {inferenceResult.compute_path.map((device, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {device}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "devices" && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Network Devices
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {devices.map((device, i) => (
                <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-gray-900">
                      {device.device_id}
                    </div>
                    <div className="text-sm text-gray-600">
                      Score: {device.score?.toFixed(1)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Battery</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-900 transition-all"
                            style={{ width: `${device.battery}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-700">
                          {device.battery?.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">CPU Load</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-600 transition-all"
                            style={{ width: `${device.cpu_load}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-700">
                          {device.cpu_load?.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 mb-1">
                        RAM Usage
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 transition-all"
                            style={{ width: `${device.ram_usage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-700">
                          {device.ram_usage?.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {device.is_plugged_in && (
                      <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 rounded">
                        Plugged In
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
