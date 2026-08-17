import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = {
  timestamp: number;
  label: string;
  value: number;
};

type ChartCardProps = {
  title: string;
  subtitle: string;
  data: ChartPoint[];
  unit: string;
  color?: string;
  emptyMessage?: string;
};

function formatTooltipValue(value: unknown, unit: string) {
  if (typeof value === "number") return `${value.toFixed(2)} ${unit}`;
  return `${value} ${unit}`;
}

function formatTimestamp(timestamp: number, includeSeconds = false) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
  });
}

function formatTooltipLabel(timestamp: unknown) {
  if (typeof timestamp !== "number") return "Not available";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shouldShowSeconds(data: ChartPoint[]) {
  const minuteLabels = data.map((point) => formatTimestamp(point.timestamp));
  return new Set(minuteLabels).size < Math.min(data.length, 4);
}

function buildTicks(data: ChartPoint[]) {
  if (data.length <= 6) return data.map((point) => point.timestamp);

  const tickCount = 6;
  const lastIndex = data.length - 1;
  const indexes = new Set<number>();

  for (let tick = 0; tick < tickCount; tick += 1) {
    indexes.add(Math.round((tick * lastIndex) / (tickCount - 1)));
  }

  return Array.from(indexes)
    .sort((first, second) => first - second)
    .map((index) => data[index].timestamp);
}

function ChartCard({
  title,
  subtitle,
  data,
  unit,
  color = "#22d3ee",
  emptyMessage = "No readings available yet",
}: ChartCardProps) {
  const visibleData = data
    .slice(-60)
    .toSorted((first, second) => first.timestamp - second.timestamp);
  const includeSeconds = shouldShowSeconds(visibleData);
  const ticks = buildTicks(visibleData);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="w-fit rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">
          {unit}
        </span>
      </div>

      <div className="h-64 min-w-0">
        {visibleData.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950 text-center">
            <div>
              <p className="text-sm text-slate-400">{emptyMessage}</p>
              <p className="mt-1 text-xs text-slate-600">
                Waiting for backend readings
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={visibleData}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(value) =>
                  typeof value === "number"
                    ? formatTimestamp(value, includeSeconds)
                    : ""
                }
                interval={0}
                minTickGap={28}
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(value) => [formatTooltipValue(value, unit), title]}
                labelFormatter={formatTooltipLabel}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default ChartCard;
