import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Ingress forces `Access-Control-Allow-Origin: *`, so cookies cannot be used cross-origin.
// Auth uses the session token in the Authorization header instead.
export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("av_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(detail, fallback = "Something went wrong. Please try again.") {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (typeof detail.msg === "string") return detail.msg;
  return fallback;
}

export const errMsg = (e, fallback) => apiError(e?.response?.data?.detail, fallback) || e?.message;

export const fmtMoney = (v, cur = "$") =>
  `${cur}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtNum = (v, d = 0) =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";
