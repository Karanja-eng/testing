// src/api.js
import axios from "axios";

const API_URL = "http://localhost:8000/calculate";

export const calculateMomentDistribution = async (data) => {
  console.log("Sending POST request to:", API_URL, "with data:", data);
  try {
    const response = await axios.post(API_URL, data, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://localhost:3000", // Optional, handled by backend
      },
      withCredentials: true, // Ensure credentials are sent if needed
    });
    console.log("Received response:", response.data);
    return response.data;
  } catch (error) {
    console.error("API error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || "API request failed");
  }
};
