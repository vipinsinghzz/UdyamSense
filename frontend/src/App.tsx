import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cpu,
  Factory,
  Gauge,
  History,
  LayoutDashboard,
  Search,
  Settings,
  Thermometer,
  TrendingUp,
  Volume2,
  Wifi,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ChartPoint } from "./components/ChartCard";
import {
  getLatestReading,
  getMachines,
  getReadingHistory,
  onBackendConnectionStatus,
  onMachineData,
  type BackendConnectionStatus,
  type MachineData,
} from "./services/backend";

const ChartCard = lazy(() => import("./components/ChartCard"));

type Page =
  | "Dashboard"
  | "Analytics"
  | "Alerts"
  | "History"
  | "Machines"
  | "Settings";
type AlertSeverity = "normal" | "warning" | "critical";
type SensorKind = "vibration" | "temperature" | "sound";
type MachineFilter = "ALL" | "NORMAL" | "WARNING" | "CRITICAL" | "OFFLINE";
type Tone = "healthy" | "warning" | "critical" | "neutral";

type AlertItem = {
  type: string;
  message: string;
  time: string;
  severity: AlertSeverity;
  normal?: boolean;
};

type ManagedMachine = {
  id: string;
  name: string;
  location: string;
  status: MachineData["state"] | "OFFLINE";
  lastSeen: string;
};

const MAX_CHART_POINTS = 60;
const MAX_EVENTS = 50;

const initialMachineData: MachineData = {
  machine_id: "M001",
  timestamp: new Date().toISOString(),
  vibration: 0,
  sound: 0,
  temperature: 0,
  state: "NORMAL",
  health_score: 100,
  risk_level: "LOW",
  trend: "STABLE",
  anomaly: false,
  probable_fault: "NONE",
  recommendation: "Waiting for sensor data.",
};

function clampHealthScore(score: number) {
  return Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
}

function getHealthCategory(score: number) {
  const value = clampHealthScore(score);
  if (value >= 80) {
    return {
      label: "Excellent",
      text: "text-emerald-400",
      bar: "bg-emerald-400",
      border: "border-emerald-500/30",
    };
  }
  if (value >= 60) {
    return {
      label: "Good",
      text: "text-cyan-300",
      bar: "bg-cyan-400",
      border: "border-cyan-500/30",
    };
  }
  if (value >= 40) {
    return {
      label: "Warning",
      text: "text-amber-400",
      bar: "bg-amber-400",
      border: "border-amber-500/30",
    };
  }
  return {
    label: "Critical",
    text: "text-red-400",
    bar: "bg-red-400",
    border: "border-red-500/30",
  };
}

function getStateTone(state: MachineData["state"] | "OFFLINE") {
  if (state === "OFFLINE") {
    return {
      text: "text-slate-400",
      bg: "bg-slate-800",
      border: "border-slate-700",
      dot: "bg-slate-500",
    };
  }
  if (state.startsWith("CRITICAL_")) {
    return {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      dot: "bg-red-400",
    };
  }
  if (state.startsWith("WARNING_")) {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
    };
  }
  return {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  };
}

function getSeverityTone(severity: AlertSeverity) {
  if (severity === "critical") {
    return {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      icon: "text-red-400",
    };
  }
  if (severity === "warning") {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      icon: "text-amber-400",
    };
  }
  return {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: "text-emerald-400",
  };
}

function getBackendStatusLabel(status: BackendConnectionStatus) {
  if (status === "connected") return "ONLINE";
  if (status === "connecting") return "CONNECTING";
  if (status === "reconnecting") return "RECONNECTING";
  if (status === "error") return "ERROR";
  return "OFFLINE";
}

function getBackendStatusTone(status: BackendConnectionStatus) {
  if (status === "connected") {
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
      dot: "bg-emerald-400",
    };
  }
  if (status === "connecting" || status === "reconnecting") {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      dot: "bg-amber-400",
    };
  }
  return {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/25",
    dot: "bg-red-400",
  };
}

function getToneStyles(tone: Tone) {
  if (tone === "critical") {
    return {
      text: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      dot: "bg-red-400",
    };
  }
  if (tone === "warning") {
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      dot: "bg-amber-400",
    };
  }
  if (tone === "neutral") {
    return {
      text: "text-slate-400",
      bg: "bg-slate-800",
      border: "border-slate-700",
      dot: "bg-slate-500",
    };
  }
  return {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  };
}

function formatClockTime(timestamp?: string) {
  const date = timestamp ? new Date(timestamp) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return safeDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(timestamp?: string) {
  if (!timestamp) return "Not available";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStateLabel(state: string) {
  return state.replaceAll("_", " ");
}

function formatProbableFault(fault?: string) {
  if (!fault || fault === "NONE") return "None detected";

  const readable = fault.replaceAll("_", " ").toLowerCase();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function getDiagnosisTone(data: MachineData): Tone {
  if (data.state.startsWith("CRITICAL_") || data.risk_level === "CRITICAL") {
    return "critical";
  }
  if (
    data.state.startsWith("WARNING_") ||
    data.risk_level === "HIGH" ||
    data.risk_level === "MEDIUM" ||
    data.anomaly
  ) {
    return "warning";
  }
  return "healthy";
}

function getAffectedSensors(state: MachineData["state"]): SensorKind[] {
  if (state === "NORMAL") return [];
  if (state === "CRITICAL_ALL") return ["vibration", "temperature", "sound"];

  const affected: SensorKind[] = [];
  if (state.includes("VIB")) affected.push("vibration");
  if (state.includes("TEMP")) affected.push("temperature");
  if (state.includes("SOUND")) affected.push("sound");
  return affected;
}

function getSensorInsight(
  type: SensorKind,
  data: MachineData,
  hasSensorData: boolean
) {
  if (!hasSensorData) {
    return {
      label: "No data",
      detail: "Waiting for a backend reading",
      tone: "neutral" as Tone,
    };
  }

  const affected = getAffectedSensors(data.state).includes(type);
  if (data.state === "NORMAL") {
    return {
      label: "Monitoring",
      detail: "Current backend state is normal",
      tone: "healthy" as Tone,
    };
  }

  if (!affected) {
    return {
      label: "Not flagged",
      detail: "Backend state points to another sensor",
      tone: "healthy" as Tone,
    };
  }

  if (data.state.startsWith("CRITICAL_") || data.risk_level === "CRITICAL") {
    return {
      label: "Critical",
      detail: "Flagged by backend state",
      tone: "critical" as Tone,
    };
  }

  return {
    label: "Warning",
    detail: "Flagged by backend state",
    tone: "warning" as Tone,
  };
}

function getAlertSeverity(data: MachineData): AlertSeverity {
  if (data.state === "NORMAL") return "normal";
  if (data.state.startsWith("CRITICAL_") || data.risk_level === "CRITICAL") {
    return "critical";
  }
  return "warning";
}

function getStateEvent(data: MachineData): AlertItem {
  const time = formatClockTime(data.timestamp);

  if (data.state === "NORMAL") {
    return {
      type: "NORMAL",
      message: "Machine returned to normal operation",
      time,
      severity: "normal",
      normal: true,
    };
  }

  const affectedSensors = getAffectedSensors(data.state);
  const sensorText = affectedSensors.length
    ? affectedSensors.map((sensor) => sensor.toUpperCase()).join(", ")
    : "machine condition";

  return {
    type: data.risk_level,
    message: `${formatStateLabel(data.state)} detected for ${sensorText}. Vibration ${data.vibration.toFixed(
      2
    )} m/s², temperature ${data.temperature.toFixed(1)} °C, sound ${data.sound}.`,
    time,
    severity: getAlertSeverity(data),
  };
}

function makeChartPoint(reading: MachineData, value: number): ChartPoint {
  const timestamp = Date.parse(reading.timestamp);

  return {
    timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
    label: formatClockTime(reading.timestamp),
    value,
  };
}

function normalizeChartPoints(points: ChartPoint[]) {
  const pointsByTimestamp = new Map<number, ChartPoint>();

  points
    .filter((point) => Number.isFinite(point.timestamp))
    .toSorted((first, second) => first.timestamp - second.timestamp)
    .forEach((point) => pointsByTimestamp.set(point.timestamp, point));

  return Array.from(pointsByTimestamp.values()).slice(-MAX_CHART_POINTS);
}

function appendChartPoint(previous: ChartPoint[], newPoint: ChartPoint) {
  if (!Number.isFinite(newPoint.timestamp)) return previous;
  if (previous.length === 0) return [newPoint];

  const lastPoint = previous[previous.length - 1];
  if (newPoint.timestamp < lastPoint.timestamp) return previous;

  if (newPoint.timestamp === lastPoint.timestamp) {
    return [...previous.slice(0, -1), newPoint].slice(-MAX_CHART_POINTS);
  }

  return [...previous, newPoint].slice(-MAX_CHART_POINTS);
}

function getDataReceiptStatus(
  backendStatus: BackendConnectionStatus,
  hasSensorData: boolean
) {
  if (backendStatus === "connected" && hasSensorData) {
    return { label: "Data received", tone: "healthy" as Tone };
  }
  if (backendStatus === "connected") {
    return { label: "No recent data", tone: "warning" as Tone };
  }
  if (backendStatus === "connecting") {
    return { label: "Connecting", tone: "warning" as Tone };
  }
  if (backendStatus === "reconnecting") {
    return { label: "Reconnecting", tone: "warning" as Tone };
  }
  if (backendStatus === "error") {
    return { label: "Socket error", tone: "critical" as Tone };
  }
  return { label: "Offline", tone: "critical" as Tone };
}

function getPageTitle(page: Page) {
  return page === "Dashboard" ? "Machine Health Dashboard" : page;
}

function mapMachines(
  items: Awaited<ReturnType<typeof getMachines>>
): ManagedMachine[] {
  return items.map((machine) => ({
    id: machine.machine_id,
    name: machine.machine_name,
    location: machine.location ?? "Not specified",
    status: "OFFLINE",
    lastSeen: "No data",
  }));
}

function App() {
  const [activePage, setActivePage] = useState<Page>("Dashboard");
  const [machineData, setMachineData] =
    useState<MachineData>(initialMachineData);
  const [liveVibrationData, setLiveVibrationData] = useState<ChartPoint[]>([]);
  const [liveTemperatureData, setLiveTemperatureData] = useState<ChartPoint[]>(
    []
  );
  const [liveSoundData, setLiveSoundData] = useState<ChartPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [eventHistory, setEventHistory] = useState<AlertItem[]>([]);
  const [backendStatus, setBackendStatus] =
    useState<BackendConnectionStatus>("connecting");
  const [machines, setMachines] = useState<ManagedMachine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [machinesError, setMachinesError] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState("M001");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(true);
  const [hasSensorData, setHasSensorData] = useState(false);
  const [lastReadingAt, setLastReadingAt] = useState<string | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const previousState = useRef<MachineData["state"] | null>(null);

  const selectedMachine = useMemo(
    () => machines.find((machine) => machine.id === selectedMachineId) ?? null,
    [machines, selectedMachineId]
  );

  const applyMachineData = useCallback(
    (newData: MachineData, options: { recordEvent?: boolean } = {}) => {
      const { recordEvent = true } = options;
      const event = getStateEvent(newData);

      setMachineData(newData);
      setHasSensorData(true);
      setLastReadingAt(newData.timestamp);
      setReadingError(null);
      setLiveVibrationData((previous) =>
        appendChartPoint(
          previous,
          makeChartPoint(newData, Number(newData.vibration.toFixed(2)))
        )
      );
      setLiveTemperatureData((previous) =>
        appendChartPoint(
          previous,
          makeChartPoint(newData, Number(newData.temperature.toFixed(1)))
        )
      );
      setLiveSoundData((previous) =>
        appendChartPoint(previous, makeChartPoint(newData, newData.sound))
      );
      setMachines((previous) =>
        previous.map((machine) =>
          machine.id === newData.machine_id
            ? {
                ...machine,
                status: newData.state,
                lastSeen: formatDateTime(newData.timestamp),
              }
            : machine
        )
      );

      if (previousState.current !== newData.state) {
        previousState.current = newData.state;

        if (recordEvent) {
          setEventHistory((previous) =>
            [event, ...previous].slice(0, MAX_EVENTS)
          );
          setNotificationsRead(false);
        }

        if (newData.state === "NORMAL") {
          setAlerts([]);
        } else {
          setAlerts((previous) =>
            recordEvent ? [event, ...previous].slice(0, 5) : [event]
          );
        }
      } else if (!recordEvent && newData.state !== "NORMAL") {
        setAlerts([event]);
      }
    },
    []
  );

  useEffect(() => {
    const unsubscribeData = onMachineData((reading) => {
      if (
        selectedMachineId === "all" ||
        reading.machine_id === selectedMachineId
      ) {
        applyMachineData(reading);
      }
    });
    const unsubscribeStatus = onBackendConnectionStatus(setBackendStatus);

    return () => {
      unsubscribeData();
      unsubscribeStatus();
    };
  }, [applyMachineData, selectedMachineId]);

  useEffect(() => {
    let cancelled = false;

    getMachines()
      .then((items) => {
        if (cancelled) return;
        const nextMachines = mapMachines(items);
        setMachines(nextMachines);
        setSelectedMachineId((current) =>
          nextMachines.length > 0 &&
          current !== "all" &&
          !nextMachines.some((machine) => machine.id === current)
            ? nextMachines[0].id
            : current
        );
      })
      .catch((error: Error) => {
        if (!cancelled) setMachinesError(error.message);
      })
      .finally(() => {
        if (!cancelled) setMachinesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    previousState.current = null;
    queueMicrotask(() => {
      if (cancelled) return;
      setMachineData({
        ...initialMachineData,
        machine_id: selectedMachineId === "all" ? "all" : selectedMachineId,
        timestamp: new Date().toISOString(),
      });
      setHasSensorData(false);
      setLastReadingAt(null);
      setReadingError(null);
      setAlerts([]);
      setLiveVibrationData([]);
      setLiveTemperatureData([]);
      setLiveSoundData([]);
      setReadingLoading(selectedMachineId !== "all");
    });

    if (selectedMachineId === "all") {
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      getLatestReading(selectedMachineId),
      getReadingHistory(selectedMachineId, 24, MAX_CHART_POINTS),
    ])
      .then(([latest, readings]) => {
        if (cancelled) return;
        applyMachineData(latest, { recordEvent: false });

        const chartReadings = readings.length ? readings : [latest];
        setLiveVibrationData(
          normalizeChartPoints(
            chartReadings.map((reading) =>
              makeChartPoint(reading, Number(reading.vibration.toFixed(2)))
            )
          )
        );
        setLiveTemperatureData(
          normalizeChartPoints(
            chartReadings.map((reading) =>
              makeChartPoint(reading, Number(reading.temperature.toFixed(1)))
            )
          )
        );
        setLiveSoundData(
          normalizeChartPoints(
            chartReadings.map((reading) => makeChartPoint(reading, reading.sound))
          )
        );
      })
      .catch((error: Error) => {
        if (!cancelled) setReadingError(error.message);
      })
      .finally(() => {
        if (!cancelled) setReadingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMachineId, applyMachineData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <aside className="fixed left-0 top-0 z-20 hidden h-screen w-64 border-r border-slate-800 bg-slate-900 lg:block">
        <BrandBlock />

        <nav className="space-y-2 p-4">
          <SidebarItem
            icon={<LayoutDashboard size={19} />}
            label="Dashboard"
            active={activePage === "Dashboard"}
            onClick={() => setActivePage("Dashboard")}
          />
          <SidebarItem
            icon={<TrendingUp size={19} />}
            label="Analytics"
            active={activePage === "Analytics"}
            onClick={() => setActivePage("Analytics")}
          />
          <SidebarItem
            icon={<Bell size={19} />}
            label="Alerts"
            active={activePage === "Alerts"}
            onClick={() => setActivePage("Alerts")}
          />
          <SidebarItem
            icon={<History size={19} />}
            label="History"
            active={activePage === "History"}
            onClick={() => setActivePage("History")}
          />
          <SidebarItem
            icon={<Factory size={19} />}
            label="Machines"
            active={activePage === "Machines"}
            onClick={() => setActivePage("Machines")}
          />

          <div className="my-6 border-t border-slate-800" />

          <SidebarItem
            icon={<Settings size={19} />}
            label="Settings"
            active={activePage === "Settings"}
            onClick={() => setActivePage("Settings")}
          />
        </nav>

        <div className="absolute bottom-6 left-4 right-4">
          <ConnectionCard status={backendStatus} hasSensorData={hasSensorData} />
        </div>
      </aside>

      <main className="min-w-0 lg:ml-64">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
          <div className="flex min-h-20 flex-col gap-4 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Industrial Monitoring
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-slate-100">
                {getPageTitle(activePage)}
              </h2>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <select
                value={selectedMachineId}
                onChange={(event) => setSelectedMachineId(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-400 sm:flex-none"
                aria-label="Select machine"
              >
                <option value="all">All Machines</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.id} - {machine.name}
                  </option>
                ))}
              </select>

              <BackendStatusPill status={backendStatus} />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 transition hover:bg-slate-800"
                  aria-label="Open alerts"
                >
                  <Bell className="h-5 w-5 text-slate-300" />
                  {!notificationsRead && eventHistory.length > 0 && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />
                  )}
                </button>
                {notificationsOpen && (
                  <NotificationCenter
                    events={eventHistory}
                    onMarkRead={() => setNotificationsRead(true)}
                    onViewAlerts={() => {
                      setNotificationsRead(true);
                      setNotificationsOpen(false);
                      setActivePage("Alerts");
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <MobileNav activePage={activePage} onChange={setActivePage} />
        </header>

        {activePage === "Dashboard" && (
          <DashboardPage
            machineData={machineData}
            machineName={selectedMachine?.name}
            liveVibrationData={liveVibrationData}
            liveTemperatureData={liveTemperatureData}
            liveSoundData={liveSoundData}
            alerts={alerts}
            backendStatus={backendStatus}
            selectedMachineId={selectedMachineId}
            hasSensorData={hasSensorData}
            lastReadingAt={lastReadingAt}
            readingLoading={readingLoading}
            readingError={readingError}
            onViewAllAlerts={() => setActivePage("Alerts")}
          />
        )}

        {activePage === "Analytics" && (
          <AnalyticsPage machineData={machineData} hasSensorData={hasSensorData} />
        )}

        {activePage === "Alerts" && <AlertsPage alerts={alerts} />}

        {activePage === "History" && (
          <HistoryPage selectedMachineId={selectedMachineId} />
        )}

        {activePage === "Machines" && (
          <MachinesPage
            machines={machines}
            selectedMachineId={selectedMachineId}
            machinesLoading={machinesLoading}
            machinesError={machinesError}
            onSelect={setSelectedMachineId}
          />
        )}

        {activePage === "Settings" && (
          <SettingsPage
            backendStatus={backendStatus}
            selectedMachineId={selectedMachineId}
            machineCount={machines.length}
            hasSensorData={hasSensorData}
            lastReadingAt={lastReadingAt}
          />
        )}
      </main>
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
        <Cpu className="h-6 w-6 text-cyan-400" />
      </div>

      <div>
        <h1 className="font-semibold text-slate-100">MachineGuard</h1>
        <p className="text-xs text-slate-500">Viksit Nagpur</p>
      </div>
    </div>
  );
}

function DashboardPage({
  machineData,
  machineName,
  liveVibrationData,
  liveTemperatureData,
  liveSoundData,
  alerts,
  backendStatus,
  selectedMachineId,
  hasSensorData,
  lastReadingAt,
  readingLoading,
  readingError,
  onViewAllAlerts,
}: {
  machineData: MachineData;
  machineName?: string;
  liveVibrationData: ChartPoint[];
  liveTemperatureData: ChartPoint[];
  liveSoundData: ChartPoint[];
  alerts: AlertItem[];
  backendStatus: BackendConnectionStatus;
  selectedMachineId: string;
  hasSensorData: boolean;
  lastReadingAt: string | null;
  readingLoading: boolean;
  readingError: string | null;
  onViewAllAlerts: () => void;
}) {
  const machineTitle =
    selectedMachineId === "all"
      ? "Fleet overview"
      : machineName ?? "Machine";
  const liveLabel =
    backendStatus === "connected" && hasSensorData
      ? "Receiving backend data"
      : backendStatus === "connected"
        ? "Connected, awaiting data"
        : getBackendStatusLabel(backendStatus);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {readingError && (
        <InlineNotice
          tone="warning"
          title="Stored reading unavailable"
          message={readingError}
        />
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <BackendStatusPill status={backendStatus} label={liveLabel} />
              {readingLoading && (
                <span className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">
                  Loading latest reading
                </span>
              )}
            </div>

            <h3 className="truncate text-2xl font-semibold text-slate-100">
              {machineTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Machine ID:{" "}
              <span className="text-slate-300">{machineData.machine_id}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <StatePanel state={machineData.state} hasSensorData={hasSensorData} />
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Last update
              </p>
              <p className="mt-1 font-medium text-slate-200">
                {hasSensorData ? formatDateTime(lastReadingAt ?? undefined) : "No data"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-5">
        <HealthCard machineData={machineData} hasSensorData={hasSensorData} />
        <SensorCard
          icon={<Activity className="h-5 w-5" />}
          title="Vibration"
          sensorName="ADXL345"
          value={hasSensorData ? machineData.vibration.toFixed(2) : "No data"}
          unit="m/s²"
          insight={getSensorInsight("vibration", machineData, hasSensorData)}
        />
        <SensorCard
          icon={<Thermometer className="h-5 w-5" />}
          title="Temperature"
          sensorName="DS18B20"
          value={hasSensorData ? machineData.temperature.toFixed(1) : "No data"}
          unit="°C"
          insight={getSensorInsight("temperature", machineData, hasSensorData)}
        />
        <SensorCard
          icon={<Volume2 className="h-5 w-5" />}
          title="Sound"
          sensorName="MAX9814"
          value={hasSensorData ? machineData.sound.toString() : "No data"}
          unit="level"
          insight={getSensorInsight("sound", machineData, hasSensorData)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Suspense fallback={<ChartSkeleton />}>
          <ChartCard
            title="Vibration Trend"
            subtitle="Live and recent vibration readings"
            data={liveVibrationData}
            unit="m/s²"
            color="#22d3ee"
          />
          <ChartCard
            title="Temperature Trend"
            subtitle="Live and recent thermal readings"
            data={liveTemperatureData}
            unit="°C"
            color="#34d399"
          />
          <ChartCard
            title="Sound Trend"
            subtitle="Live and recent sound readings"
            data={liveSoundData}
            unit="level"
            color="#f59e0b"
          />
        </Suspense>
      </section>

      <MachineDiagnosisCard
        machineData={machineData}
        hasSensorData={hasSensorData}
      />

      <section className="grid gap-5 xl:grid-cols-3">
        <SystemStatus
          backendStatus={backendStatus}
          hasSensorData={hasSensorData}
          lastReadingAt={lastReadingAt}
        />
        <RecentAlerts alerts={alerts} onViewAllAlerts={onViewAllAlerts} />
      </section>
    </div>
  );
}

function MachineDiagnosisCard({
  machineData,
  hasSensorData,
}: {
  machineData: MachineData;
  hasSensorData: boolean;
}) {
  const stateTone = getStateTone(machineData.state);
  const diagnosisTone = getToneStyles(getDiagnosisTone(machineData));
  const anomalyTone = machineData.anomaly ? diagnosisTone : getToneStyles("healthy");

  if (!hasSensorData) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-100">Machine Diagnosis</h3>
            <p className="mt-1 text-sm text-slate-500">
              Waiting for sensor data.
            </p>
          </div>
          <span className="w-fit rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">
            No data
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">Machine Diagnosis</h3>
          <p className="mt-1 text-sm text-slate-500">
            Maintenance insight from the latest backend reading
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs ${stateTone.bg} ${stateTone.border} ${stateTone.text}`}
          >
            {formatStateLabel(machineData.state)}
          </span>
          <span
            className={`rounded-md border px-2.5 py-1 text-xs ${diagnosisTone.bg} ${diagnosisTone.border} ${diagnosisTone.text}`}
          >
            Risk {machineData.risk_level}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={`rounded-lg border p-4 ${anomalyTone.bg} ${anomalyTone.border}`}>
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950/60 ${anomalyTone.text}`}
            >
              {machineData.anomaly ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <p className={`font-semibold ${anomalyTone.text}`}>
                {machineData.anomaly
                  ? "Anomaly detected"
                  : "No anomaly detected"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {machineData.anomaly
                  ? "Review the backend recommendation below."
                  : "Machine is currently operating within the monitored condition."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <DiagnosisSignal label="Trend" value={machineData.trend} />
          <DiagnosisSignal label="Risk" value={machineData.risk_level} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm text-slate-500">Probable Issue</p>
          <p className="mt-2 text-lg font-semibold text-slate-100">
            {formatProbableFault(machineData.probable_fault)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
          <p className="text-sm text-slate-500">Recommended Action</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {machineData.recommendation}
          </p>
        </div>
      </div>
    </section>
  );
}

function DiagnosisSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function HealthCard({
  machineData,
  hasSensorData,
}: {
  machineData: MachineData;
  hasSensorData: boolean;
}) {
  const healthScore = clampHealthScore(machineData.health_score);
  const category = getHealthCategory(healthScore);
  const stateTone = getStateTone(machineData.state);

  return (
    <div
      className={`rounded-xl border bg-slate-900 p-6 shadow-sm xl:col-span-2 ${category.border}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Machine Health</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-tight text-slate-100">
              {hasSensorData ? healthScore : "--"}
            </span>
            <span className="pb-2 text-sm text-slate-500">/100</span>
          </div>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
          <Gauge className="h-6 w-6 text-emerald-400" />
        </div>
      </div>

      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${category.bar}`}
          style={{ width: hasSensorData ? `${healthScore}%` : "0%" }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`text-sm font-semibold ${category.text}`}>
          {hasSensorData ? category.label : "No data"}
        </span>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs ${stateTone.bg} ${stateTone.border} ${stateTone.text}`}
        >
          {hasSensorData ? formatStateLabel(machineData.state) : "Awaiting reading"}
        </span>
        <span className="text-xs text-slate-500">
          Risk: {hasSensorData ? machineData.risk_level : "Not available"}
        </span>
      </div>
    </div>
  );
}

function SensorCard({
  icon,
  title,
  sensorName,
  value,
  unit,
  insight,
}: {
  icon: ReactNode;
  title: string;
  sensorName: string;
  value: string;
  unit: string;
  insight: ReturnType<typeof getSensorInsight>;
}) {
  const tone = getToneStyles(insight.tone);
  const hasValue = value !== "No data";

  return (
    <div className={`rounded-xl border bg-slate-900 p-5 shadow-sm ${tone.border}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-600">
            {sensorName}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${tone.bg} ${tone.border} ${tone.text}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 flex min-w-0 items-baseline gap-2">
        <span
          className={`truncate font-bold text-slate-100 ${
            hasValue ? "text-3xl" : "text-xl"
          }`}
        >
          {value}
        </span>
        {hasValue && <span className="text-sm text-slate-500">{unit}</span>}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <span className={`text-sm font-medium ${tone.text}`}>
          {insight.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{insight.detail}</p>
    </div>
  );
}

function AnalyticsPage({
  machineData,
  hasSensorData,
}: {
  machineData: MachineData;
  hasSensorData: boolean;
}) {
  const health = getHealthCategory(machineData.health_score);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SectionHeading
        title="Analytics"
        subtitle="Rule-based maintenance signals from the current backend contract."
      />

      {!hasSensorData && (
        <InlineNotice
          tone="warning"
          title="No sensor reading selected"
          message="Analytics will populate after the latest backend reading is available."
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsMetric
          label="Machine Health"
          value={hasSensorData ? `${clampHealthScore(machineData.health_score)}/100` : "No data"}
          detail={hasSensorData ? health.label : "Awaiting reading"}
          tone={hasSensorData ? health.text : "text-slate-400"}
        />
        <AnalyticsMetric
          label="Risk Assessment"
          value={hasSensorData ? machineData.risk_level : "No data"}
          detail={hasSensorData ? formatStateLabel(machineData.state) : "Not available"}
          tone={getStateTone(machineData.state).text}
        />
        <AnalyticsMetric
          label="Trend"
          value={hasSensorData ? machineData.trend : "No data"}
          detail="Backend rule output"
          tone="text-cyan-300"
        />
        <AnalyticsMetric
          label="Anomaly Status"
          value={
            hasSensorData
              ? machineData.anomaly
                ? "Detected"
                : "None"
              : "No data"
          }
          detail="Current reading"
          tone={machineData.anomaly ? "text-amber-400" : "text-emerald-400"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <InsightPanel
          title="Probable Fault"
          value={hasSensorData ? machineData.probable_fault : "Not available"}
          description="Rule-based fault category returned by the backend."
        />
        <InsightPanel
          title="Recommendation"
          value={hasSensorData ? machineData.recommendation : "Not available"}
          description="Operational recommendation from the current backend rules."
        />
      </section>
    </div>
  );
}

function AnalyticsMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function InsightPanel({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-lg font-semibold text-slate-100">
        {formatStateLabel(value)}
      </p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function NotificationCenter({
  events,
  onMarkRead,
  onViewAlerts,
}: {
  events: AlertItem[];
  onMarkRead: () => void;
  onViewAlerts: () => void;
}) {
  return (
    <div className="absolute right-0 top-12 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-100">Notifications</h3>
        <button
          type="button"
          onClick={onMarkRead}
          className="text-xs text-cyan-400 transition hover:text-cyan-300"
        >
          Mark all read
        </button>
      </div>
      {events.length ? (
        events.slice(0, 4).map((event, index) => (
          <CompactAlert
            key={`${event.time}-${index}`}
            alert={event}
            className="border-t border-slate-800 py-3"
          />
        ))
      ) : (
        <p className="py-5 text-center text-sm text-slate-500">
          No new notifications
        </p>
      )}
      <button
        type="button"
        onClick={onViewAlerts}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 text-sm text-cyan-400 transition hover:border-cyan-500/50"
      >
        Open alert center
      </button>
    </div>
  );
}

function MachinesPage({
  machines,
  selectedMachineId,
  machinesLoading,
  machinesError,
  onSelect,
}: {
  machines: ManagedMachine[];
  selectedMachineId: string;
  machinesLoading: boolean;
  machinesError: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MachineFilter>("ALL");
  const visibleMachines = machines.filter((machine) => {
    const matchesQuery = `${machine.id} ${machine.name} ${machine.location}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesFilter =
      filter === "ALL" ||
      (filter === "WARNING" && machine.status.startsWith("WARNING_")) ||
      (filter === "CRITICAL" && machine.status.startsWith("CRITICAL_")) ||
      machine.status === filter;

    return matchesQuery && matchesFilter;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SectionHeading
        title="Machines"
        subtitle="Machine identities from the existing machine API."
      />

      {machinesError && (
        <InlineNotice
          tone="critical"
          title="Machine API error"
          message={machinesError}
        />
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3">
          <Search size={17} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search machine or location"
            className="w-full bg-transparent py-3 text-sm outline-none"
          />
        </label>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as MachineFilter)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none"
        >
          <option value="ALL">All statuses</option>
          <option value="NORMAL">Normal</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
          <option value="OFFLINE">No data</option>
        </select>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="hidden grid-cols-4 gap-3 border-b border-slate-800 px-5 py-3 text-xs uppercase tracking-wide text-slate-500 md:grid">
          <span>Machine</span>
          <span>Location</span>
          <span>Status</span>
          <span>Last seen</span>
        </div>

        {machinesLoading ? (
          <EmptyState title="Loading machines" message="Reading from /api/machines." />
        ) : visibleMachines.length === 0 ? (
          <EmptyState title="No machines found" message="Adjust search or status filters." />
        ) : (
          visibleMachines.map((machine) => (
            <MachineRow
              key={machine.id}
              machine={machine}
              selected={selectedMachineId === machine.id}
              onSelect={() => onSelect(machine.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function MachineRow({
  machine,
  selected,
  onSelect,
}: {
  machine: ManagedMachine;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = getStateTone(machine.status);
  const statusLabel =
    machine.status === "OFFLINE" ? "No recent data" : formatStateLabel(machine.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full gap-3 border-b border-slate-800 px-5 py-4 text-left text-sm transition last:border-0 md:grid-cols-4 ${
        selected ? "bg-cyan-500/10" : "hover:bg-slate-800/70"
      }`}
    >
      <span>
        <strong className="block text-slate-100">{machine.name}</strong>
        <span className="text-xs text-slate-500">{machine.id}</span>
      </span>
      <span className="text-slate-400">{machine.location}</span>
      <span className={`flex items-center gap-2 ${tone.text}`}>
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        {statusLabel}
      </span>
      <span className="text-slate-500">{machine.lastSeen}</span>
    </button>
  );
}

function AlertsPage({ alerts }: { alerts: AlertItem[] }) {
  const [filter, setFilter] = useState<"ALL" | AlertSeverity>("ALL");
  const visibleAlerts = alerts.filter(
    (alert) => filter === "ALL" || alert.severity === filter
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          title="Alerts"
          subtitle="Current warnings and critical events from live readings."
        />
        <select
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "ALL" | AlertSeverity)
          }
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none"
        >
          <option value="ALL">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
        {visibleAlerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-400" />}
            title="No active alerts"
            message="No warning or critical live events are active for the selected machine."
          />
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((alert, index) => (
              <AlertRow key={`${alert.time}-${index}`} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPage({ selectedMachineId }: { selectedMachineId: string }) {
  const [hours, setHours] = useState(24);
  const [readings, setReadings] = useState<MachineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (selectedMachineId === "all") {
      queueMicrotask(() => {
        if (cancelled) return;
        setReadings([]);
        setError(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    getReadingHistory(selectedMachineId, hours, 250)
      .then((items) => {
        if (!cancelled) setReadings(items);
      })
      .catch((requestError: Error) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMachineId, hours]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeading
          title="History"
          subtitle="Historical sensor readings from the existing history API."
        />
        <select
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
          disabled={selectedMachineId === "all"}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>

      {selectedMachineId === "all" ? (
        <EmptyState
          title="Select a machine"
          message="History is available for one machine at a time."
        />
      ) : error ? (
        <InlineNotice tone="critical" title="History API error" message={error} />
      ) : (
        <ReadingsTable readings={readings} loading={loading} />
      )}
    </div>
  );
}

function ReadingsTable({
  readings,
  loading,
}: {
  readings: MachineData[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <EmptyState title="Loading history" message="Reading sensor history." />
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <EmptyState
          title="No history found"
          message="The selected range has no stored readings."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Vibration</th>
              <th className="px-4 py-3 font-medium">Sound</th>
              <th className="px-4 py-3 font-medium">Temperature</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Anomaly</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading) => {
              const tone = getStateTone(reading.state);
              return (
                <tr
                  key={`${reading.machine_id}-${reading.timestamp}`}
                  className="border-b border-slate-800/80 last:border-0"
                >
                  <td className="px-4 py-3 text-slate-300">
                    {formatDateTime(reading.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {reading.vibration.toFixed(2)} m/s²
                  </td>
                  <td className="px-4 py-3 text-slate-400">{reading.sound}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {reading.temperature.toFixed(1)} °C
                  </td>
                  <td className={`px-4 py-3 ${tone.text}`}>
                    {formatStateLabel(reading.state)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {clampHealthScore(reading.health_score)}/100
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {reading.risk_level}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {reading.anomaly ? "Detected" : "None"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPage({
  backendStatus,
  selectedMachineId,
  machineCount,
  hasSensorData,
  lastReadingAt,
}: {
  backendStatus: BackendConnectionStatus;
  selectedMachineId: string;
  machineCount: number;
  hasSensorData: boolean;
  lastReadingAt: string | null;
}) {
  const receipt = getDataReceiptStatus(backendStatus, hasSensorData);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <SectionHeading
        title="Settings"
        subtitle="Current frontend diagnostics and available runtime information."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-100">Runtime status</h3>
          <div className="mt-5 space-y-3">
            <StatusRow
              name="Backend connection"
              status={getBackendStatusLabel(backendStatus)}
              tone={backendStatus === "connected" ? "healthy" : receipt.tone}
            />
            <StatusRow
              name="Selected machine"
              status={selectedMachineId === "all" ? "All machines" : selectedMachineId}
              tone="neutral"
            />
            <StatusRow
              name="Machine API records"
              status={machineCount.toString()}
              tone={machineCount > 0 ? "healthy" : "warning"}
            />
            <StatusRow
              name="Latest reading"
              status={hasSensorData ? formatDateTime(lastReadingAt ?? undefined) : "No data"}
              tone={receipt.tone}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-100">
            Configuration boundary
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This frontend uses the existing backend API and Socket.IO stream. No
            backend-configurable notification, MQTT, database, authentication, or
            deployment settings are exposed by the current API.
          </p>
        </div>
      </section>
    </div>
  );
}

function SystemStatus({
  backendStatus,
  hasSensorData,
  lastReadingAt,
}: {
  backendStatus: BackendConnectionStatus;
  hasSensorData: boolean;
  lastReadingAt: string | null;
}) {
  const receipt = getDataReceiptStatus(backendStatus, hasSensorData);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-100">System Status</h3>
          <p className="text-sm text-slate-500">Backend data receipt</p>
        </div>
        <Wifi className={`h-5 w-5 ${getBackendStatusTone(backendStatus).text}`} />
      </div>

      <div className="space-y-3">
        <StatusRow
          name="ADXL345 Vibration"
          status={receipt.label}
          tone={receipt.tone}
        />
        <StatusRow
          name="MAX9814 Sound"
          status={receipt.label}
          tone={receipt.tone}
        />
        <StatusRow
          name="DS18B20 Temperature"
          status={receipt.label}
          tone={receipt.tone}
        />
        <StatusRow
          name="Backend connection"
          status={getBackendStatusLabel(backendStatus)}
          tone={backendStatus === "connected" ? "healthy" : receipt.tone}
        />
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Last reading: {hasSensorData ? formatDateTime(lastReadingAt ?? undefined) : "No data"}
      </p>
    </div>
  );
}

function RecentAlerts({
  alerts,
  onViewAllAlerts,
}: {
  alerts: AlertItem[];
  onViewAllAlerts: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm xl:col-span-2">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-100">Recent Alerts</h3>
          <p className="text-sm text-slate-500">Latest live machine events</p>
        </div>

        <button
          type="button"
          onClick={onViewAllAlerts}
          className="rounded-md px-2 py-1 text-sm text-cyan-400 transition hover:bg-cyan-500/10 hover:text-cyan-300"
        >
          View all
        </button>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-9 w-9 text-emerald-400" />}
            title="No active alerts"
            message="The selected machine has no active warning or critical event."
          />
        ) : (
          alerts.map((alert, index) => (
            <AlertRow key={`${alert.time}-${index}`} alert={alert} />
          ))
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: Page;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
        active
          ? "bg-cyan-500/10 text-cyan-400"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNav({
  activePage,
  onChange,
}: {
  activePage: Page;
  onChange: (page: Page) => void;
}) {
  const pages: Page[] = [
    "Dashboard",
    "Analytics",
    "Alerts",
    "History",
    "Machines",
    "Settings",
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto border-t border-slate-800 px-4 py-3 lg:hidden">
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onChange(page)}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
            activePage === page
              ? "bg-cyan-500/10 text-cyan-400"
              : "text-slate-400"
          }`}
        >
          {page}
        </button>
      ))}
    </nav>
  );
}

function BackendStatusPill({
  status,
  label,
}: {
  status: BackendConnectionStatus;
  label?: string;
}) {
  const tone = getBackendStatusTone(status);

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${tone.bg} ${tone.border} ${tone.text}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
      <span className="whitespace-nowrap">{label ?? getBackendStatusLabel(status)}</span>
    </div>
  );
}

function ConnectionCard({
  status,
  hasSensorData,
}: {
  status: BackendConnectionStatus;
  hasSensorData: boolean;
}) {
  const tone = getBackendStatusTone(status);
  const receipt = getDataReceiptStatus(status, hasSensorData);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Wifi className={`h-4 w-4 ${tone.text}`} />
        <span className={`text-sm font-medium ${tone.text}`}>
          Backend {getBackendStatusLabel(status)}
        </span>
      </div>

      <p className="text-xs text-slate-500">{receipt.label}</p>
    </div>
  );
}

function StatePanel({
  state,
  hasSensorData,
}: {
  state: MachineData["state"];
  hasSensorData: boolean;
}) {
  const tone = getStateTone(state);

  return (
    <div className={`rounded-lg border px-4 py-3 ${tone.bg} ${tone.border}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Operating State
      </p>
      <p className={`mt-1 truncate font-semibold ${tone.text}`}>
        {hasSensorData ? formatStateLabel(state) : "Awaiting reading"}
      </p>
    </div>
  );
}

function StatusRow({
  name,
  status,
  tone,
}: {
  name: string;
  status: string;
  tone: Tone;
}) {
  const styles = getToneStyles(tone);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-4 py-3">
      <span className="min-w-0 truncate text-sm text-slate-300">{name}</span>

      <div className="flex shrink-0 items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
        <span className={`text-xs ${styles.text}`}>{status}</span>
      </div>
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const tone = getSeverityTone(alert.severity);

  return (
    <div className={`flex gap-4 rounded-xl border bg-slate-950 p-4 ${tone.border}`}>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.bg}`}
      >
        {alert.normal ? (
          <CheckCircle2 className={`h-5 w-5 ${tone.icon}`} />
        ) : (
          <AlertTriangle className={`h-5 w-5 ${tone.icon}`} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${tone.text}`}>{alert.type}</p>
          <span className="text-xs text-slate-600">{alert.time}</span>
        </div>

        <p className="mt-1 text-sm leading-5 text-slate-400">{alert.message}</p>
      </div>
    </div>
  );
}

function CompactAlert({
  alert,
  className = "",
}: {
  alert: AlertItem;
  className?: string;
}) {
  const tone = getSeverityTone(alert.severity);

  return (
    <div className={`text-sm ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={tone.text}>{alert.type}</p>
        <span className="text-xs text-slate-600">{alert.time}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-slate-400">{alert.message}</p>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h3 className="text-2xl font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function InlineNotice({
  tone,
  title,
  message,
}: {
  tone: "warning" | "critical";
  title: string;
  message: string;
}) {
  const styles =
    tone === "critical" ? getSeverityTone("critical") : getSeverityTone("warning");

  return (
    <div className={`rounded-xl border p-4 ${styles.bg} ${styles.border}`}>
      <p className={`text-sm font-semibold ${styles.text}`}>{title}</p>
      <p className="mt-1 text-sm text-slate-400">{message}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-40 items-center justify-center p-6 text-center">
      <div>
        {icon && <div className="mb-3 flex justify-center">{icon}</div>}
        <p className="font-medium text-slate-300">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[21.75rem] rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="h-full animate-pulse rounded-lg bg-slate-950" />
    </div>
  );
}

export default App;
