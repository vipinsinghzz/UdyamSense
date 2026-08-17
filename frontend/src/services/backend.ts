import { io } from "socket.io-client";

export type MachineState = "NORMAL" | "WARNING_VIBRATION" | "WARNING_SOUND" | "WARNING_TEMP" | "CRITICAL_VIB_SOUND" | "CRITICAL_VIB_TEMP" | "CRITICAL_SOUND_TEMP" | "CRITICAL_ALL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Trend = "RISING" | "FALLING" | "STABLE";
export type ProbableFault = "NONE" | "MECHANICAL_ABNORMALITY" | "OVERHEATING" | "EXCESSIVE_VIBRATION" | "LOOSE_COMPONENT" | "UNKNOWN";

export type MachineData = {
  machine_id: string;
  timestamp: string;
  vibration: number;
  sound: number;
  temperature: number;
  state: MachineState;
  health_score: number;
  risk_level: RiskLevel;
  trend: Trend;
  anomaly: boolean;
  probable_fault: ProbableFault;
  recommendation: string;
};

export type Machine = { id: number; machine_id: string; machine_name: string; location: string | null; created_at: string; updated_at: string };
export type BackendConnectionStatus = "connecting" | "connected" | "offline" | "reconnecting" | "error";
type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };

const api_url = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(api_url, { autoConnect: true, transports: ["websocket", "polling"] });
const dataListeners = new Set<(data: MachineData) => void>();
const statusListeners = new Set<(status: BackendConnectionStatus) => void>();
let connectionStatus: BackendConnectionStatus = "connecting";

function setConnectionStatus(status: BackendConnectionStatus) { connectionStatus = status; statusListeners.forEach((listener) => listener(status)); }
function isMachineData(value: unknown): value is MachineData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.machine_id === "string" && typeof data.timestamp === "string" && ["vibration", "sound", "temperature", "health_score"].every((key) => typeof data[key] === "number" && Number.isFinite(data[key] as number)) && typeof data.state === "string" && typeof data.risk_level === "string" && typeof data.trend === "string" && typeof data.anomaly === "boolean" && typeof data.probable_fault === "string" && typeof data.recommendation === "string";
}

socket.on("connect", () => setConnectionStatus("connected"));
socket.on("disconnect", () => setConnectionStatus("offline"));
socket.io.on("reconnect_attempt", () => setConnectionStatus("reconnecting"));
socket.on("connect_error", () => setConnectionStatus("error"));
socket.on("sensor:update", (reading: unknown) => { if (isMachineData(reading)) dataListeners.forEach((listener) => listener(reading)); });

export function onMachineData(callback: (data: MachineData) => void) { dataListeners.add(callback); return () => dataListeners.delete(callback); }
export function onBackendConnectionStatus(callback: (status: BackendConnectionStatus) => void) { statusListeners.add(callback); callback(connectionStatus); return () => statusListeners.delete(callback); }
async function request<T>(path: string): Promise<T> { const response = await fetch(`${api_url}${path}`); const body = await response.json() as ApiResponse<T>; if (!response.ok || !body.success) throw new Error("error" in body ? body.error : "Backend request failed"); return body.data; }
export const getMachines = () => request<Machine[]>("/api/machines");
export const getLatestReading = (machine_id: string) => request<MachineData>(`/api/sensors/latest/${encodeURIComponent(machine_id)}`);
export const getReadingHistory = (machine_id: string, hours = 24, limit = 60) => request<MachineData[]>(`/api/sensors/history/${encodeURIComponent(machine_id)}?hours=${hours}&limit=${limit}`);
