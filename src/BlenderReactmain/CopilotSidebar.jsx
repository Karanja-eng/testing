// components/CopilotSidebar.jsx
import React, { useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Zap,
  Settings,
  Clock,
  Command,
  Sparkles,
  MessageCircle,
  Send,
} from "lucide-react";

const CopilotSidebar = ({
  copilotOpen,
  setCopilotOpen,
  copilotTab,
  setCopilotTab,
  selectedObjects,
  history,
  historyIndex,
  drawingObjects,
}) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState([
    {
      type: "assistant",
      text: "Hello! I can help you automate civil engineering drawings. Describe what you need to draw.",
    },
  ]);

  const handleAISend = () => {
    if (!aiPrompt.trim()) return;
    setAiMessages([
      ...aiMessages,
      { type: "user", text: aiPrompt },
      {
        type: "assistant",
        text: "[AI Processing] This is a placeholder for LLM integration. Your request will be processed by the AI model.",
      },
    ]);
    setAiPrompt("");
  };

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setCopilotTab(id)}
      className={`p-2 rounded transition-colors ${
        copilotTab === id
          ? "bg-blue-600 text-white"
          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
      }`}
      title={label}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div
      className={`bg-gray-800 border-l border-gray-700 flex flex-col transition-all ${
        copilotOpen ? "w-80" : "w-16"
      } overflow-hidden`}
    >
      {/* Header */}
      <div className="border-b border-gray-700 p-3 flex items-center justify-between">
        {copilotOpen && (
          <h3 className="text-sm font-bold text-gray-100">Copilot</h3>
        )}
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          className="p-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors ml-auto"
        >
          {copilotOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Tab Buttons */}
      <div className="border-b border-gray-700 p-2 flex gap-1">
        <TabButton id="ai" icon={Sparkles} label="AI Assistant" />
        <TabButton id="properties" icon={Settings} label="Properties" />
        <TabButton id="history" icon={Clock} label="History" />
        <TabButton id="commands" icon={Command} label="Commands" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* AI Assistant Tab */}
        {copilotTab === "ai" && copilotOpen && (
          <div className="flex flex-col h-full gap-3">
            <div className="flex-1 bg-gray-900 rounded p-3 overflow-y-auto space-y-3">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`text-sm p-2 rounded ${
                    msg.type === "user"
                      ? "bg-blue-900 text-blue-100 ml-4"
                      : "bg-gray-700 text-gray-200 mr-4"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe drawing..."
                className="flex-1 bg-gray-700 text-gray-100 px-2 py-2 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAISend();
                }}
              />
              <button
                onClick={handleAISend}
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Properties Tab */}
        {copilotTab === "properties" && copilotOpen && (
          <div className="space-y-3">
            {selectedObjects.length === 0 ? (
              <div className="text-gray-500 text-sm">
                Select objects to view properties
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-300">
                  Selected Objects: {selectedObjects.length}
                </div>
                <div className="bg-gray-900 rounded p-2 space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="text-gray-200 float-right">Multiple</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Layer:</span>
                    <span className="text-gray-200 float-right">Multiple</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Color:</span>
                    <div className="w-full h-6 bg-gray-700 rounded mt-1" />
                  </div>
                  <div>
                    <span className="text-gray-400">Line Width:</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      defaultValue="2"
                      className="w-full mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {copilotTab === "history" && copilotOpen && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-300">Edit History</div>
            {history.length === 0 ? (
              <div className="text-gray-500 text-sm">No history yet</div>
            ) : (
              <div className="space-y-1 text-xs">
                {history.map((state, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      idx === historyIndex
                        ? "bg-blue-900 text-blue-100"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Step {idx + 1}: {state.length} objects
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Commands Tab */}
        {copilotTab === "commands" && copilotOpen && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-300">
              Available Commands
            </div>
            <div className="space-y-1 text-xs">
              <div className="bg-gray-700 p-2 rounded">
                <div className="font-semibold text-gray-200">L</div>
                <div className="text-gray-400">Line command</div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="font-semibold text-gray-200">C</div>
                <div className="text-gray-400">Circle command</div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="font-semibold text-gray-200">M</div>
                <div className="text-gray-400">Move command</div>
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <div className="font-semibold text-gray-200">E</div>
                <div className="text-gray-400">Erase command</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotSidebar;
