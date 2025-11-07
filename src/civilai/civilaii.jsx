import React, { useState, useEffect } from "react";
import axios from "axios";

function Civilapp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerId, setTimerId] = useState(null);

  const startTimer = () => {
    const start = performance.now();
    const id = setInterval(() => {
      setElapsed(((performance.now() - start) / 1000).toFixed(1));
    }, 100);
    setTimerId(id);
  };

  const stopTimer = () => {
    clearInterval(timerId);
    setTimerId(null);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setElapsed(0);
    startTimer();

    try {
      const startTime = performance.now();
      const response = await axios.post("http://127.0.0.1:8000/generate", {
        text: input,
      });
      const endTime = performance.now();
      const total = ((endTime - startTime) / 1000).toFixed(2);

      const aiMessage = {
        role: "ai",
        content: response.data.response,
        time: total,
      };
      stopTimer();
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      stopTimer();
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "Error connecting to AI backend." },
      ]);
    }

    setInput("");
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 🌀 Animated loading dots component
  const LoadingDots = () => {
    const [dots, setDots] = useState("");
    useEffect(() => {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + "." : ""));
      }, 400);
      return () => clearInterval(interval);
    }, []);
    return <span>{dots}</span>;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Civil AI Chat</h1>

        <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-100 rounded-lg">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-2 p-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-auto max-w-xs"
                  : "bg-gray-700 text-white mr-auto max-w-xs"
              }`}
            >
              <p>{msg.content}</p>
              {msg.role === "ai" && msg.time && (
                <p className="text-xs text-gray-300 mt-1">
                  ⏱ {msg.time}s response time
                </p>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-gray-600 mt-2">
              <div className="loader-dots" />
              <p>
                Thinking
                <LoadingDots /> ⏱ {elapsed}s
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <textarea
            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about beam design, AutoCAD scripts, etc..."
            rows="3"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>

      {/* 🔵 Add some inline CSS for loader animation */}
      <style>{`
        .loader-dots {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #3b82f6;
          animation: pulse 1s infinite alternate;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default Civilapp;
