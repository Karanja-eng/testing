import React, { useState } from "react";
import axios from "axios";
import { SendIcon } from "lucide-react";

function GptApp() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async () => {
    const res = await axios.post("http://localhost:8000/generate", {
      text: prompt,
    });
    setResponse(res.data.response);
  };

  return (
    <div
      className="bg-gray-200 border rounded-md h-screen"
      style={{ padding: "2rem" }}
    >
      <div clasName=" border border-blue-500 p-4 rounded-md shadow-md">
        <h2 className="text-black py-2 border-b border-blue-500 ">
          CivilAI GPT Assistant
        </h2>
        <textarea
          className="bg-gray-100 text-black"
          rows="4"
          cols="50"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt here..."
        />
        <br />

        <button
          icon={<SendIcon />}
          color="white"
          size="md"
          className=" bg-green-400 hover:bg-green-500
      text-black rounded-md px-4 py-2 mt-2"
          onClick={handleSubmit}
        >
          Generate
        </button>
        <h3 className="text-black">Response:</h3>
        <p className="bg-gray-200 text-black">{response}</p>
      </div>
    </div>
  );
}

export default GptApp;
