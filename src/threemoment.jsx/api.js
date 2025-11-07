// api.js
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

export const postThreeMoment = (payload) =>
  axios.post(`${API_BASE}/three-moment/`, payload).then((r) => r.data);
export const postDesignBeam = (payload) =>
  axios.post(`${API_BASE}/design-beam/`, payload).then((r) => r.data);
export const getDefaultTests = () =>
  axios.get(`${API_BASE}/default-tests/`).then((r) => r.data);
