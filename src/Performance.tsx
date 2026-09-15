import { useState } from "react";
import type { SystemStats } from "./types";
import { formatGB, formatHz, formatRate, formatUptime } from "./format";

export const HISTORY_LEN = 60;

export interface PerfHistory {
  cpu: number[];
  memory: number[];
  disk: number[];
  network: number[];
}

type MetricKey = "cpu" | "memory" | "disk" | "network";

function pathFor(data: number[], width: number, height: number, max: number): string {
  if (data.length === 0) return "";
  const padded = data.length < HISTORY_LEN ? Array(HISTORY_LEN - data.length).fill(data[0] ?? 0).concat(data) : data;
  const step = width / (HISTORY_LEN - 1);
  const safeMax = max <= 0 ? 1 : max;
  return padded
    .map((v, i) => {
      const x = i * step;
      const y = height - (Math.min(v, safeMax) / safeMax) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({ data, max, color }: { data: number[]; max: number; color: string }) {
  const width = 90;
  const height = 36;
  const line = pathFor(data, width, height, max);
  const area = line ? `${line} L${width},${height} L0,${height} Z` : "";
  return (
    <svg width={width} height={height} className="sparkline">
      {area && <path d={area} fill={color} fillOpacity={0.18} stroke="none" />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth={1.4} />}
    </svg>
  );
}

function BigChart({
  data,
  max,
  color,
  topLabel,
  maxLabel,
}: {
  data: number[];
  max: number;
  color: string;
  topLabel: string;
  maxLabel: string;
}) {
  const width = 900;
  const height = 260;
  const line = pathFor(data, width, height, max);
  const area = line ? `${line} L${width},${height} L0,${height} Z` : "";
  const gridLines = [0.25, 0.5, 0.75];

  return (
    <div className="perf-chart-wrap">
      <div className="perf-chart-axis-top">
        <span>{topLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="perf-chart" preserveAspectRatio="none">
        {gridLines.map((g) => (
          <line
            key={g}
            x1={0}
            x2={width}
            y1={height * g}
            y2={height * g}
            className="perf-grid-line"
          />
        ))}
        {area && <path d={area} fill={color} fillOpacity={0.15} stroke="none" />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2} />}
      </svg>
      <div className="perf-chart-axis-bottom">
        <span>60 seconds</span>
        <span>0</span>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="perf-stat">
      <span className="perf-stat-label">{label}</span>
      <span className="perf-stat-value">{value}</span>
    </div>
  );
}

export default function PerformancePane({
  stats,
  history,
}: {
  stats: SystemStats | null;
  history: PerfHistory;
}) {
  const [selected, setSelected] = useState<MetricKey>("cpu");

  const memPercent = stats ? (stats.used_memory / stats.total_memory) * 100 : 0;
  const primaryDisk = stats?.disks[0];
  const primaryNet = stats?.network_interfaces[0];
  const maxNetwork = Math.max(1024 * 1024, ...history.network);
  const maxDisk = Math.max(1024 * 1024, ...history.disk);

  const tiles: Array<{
    key: MetricKey;
    title: string;
    subtitle: string;
    data: number[];
    max: number;
    color: string;
  }> = [
    {
      key: "cpu",
      title: "CPU",
      subtitle: stats ? `${stats.cpu_usage.toFixed(0)}%  ${formatHz(stats.cpu_info.frequency_mhz)}` : "…",
      data: history.cpu,
      max: 100,
      color: "#0ea5e9",
    },
    {
      key: "memory",
      title: "Memory",
      subtitle: stats
        ? `${formatGB(stats.used_memory)}/${formatGB(stats.total_memory)} (${memPercent.toFixed(0)}%)`
        : "…",
      data: history.memory,
      max: 100,
      color: "#8b5cf6",
    },
    {
      key: "disk",
      title: primaryDisk ? primaryDisk.name || "Disk" : "Disk",
      subtitle: stats
        ? `${primaryDisk?.kind ?? ""}  ${stats.disk_active_percent.toFixed(0)}%`
        : "…",
      data: history.disk,
      max: maxDisk,
      color: "#22c55e",
    },
    {
      key: "network",
      title: "Network",
      subtitle: stats
        ? `${primaryNet?.name ?? ""} ${formatRate(stats.network_rx_bytes_per_sec + stats.network_tx_bytes_per_sec)}`
        : "…",
      data: history.network,
      max: maxNetwork,
      color: "#f59e0b",
    },
  ];

  const activeTile = tiles.find((t) => t.key === selected)!;

  return (
    <div className="perf-pane">
      <div className="panel-header">
        <h1>Performance</h1>
      </div>

      <div className="perf-layout">
        <div className="perf-tile-list">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              className={`perf-tile ${selected === tile.key ? "active" : ""}`}
              onClick={() => setSelected(tile.key)}
            >
              <Sparkline data={tile.data} max={tile.max} color={tile.color} />
              <div className="perf-tile-text">
                <span className="perf-tile-title">{tile.title}</span>
                <span className="perf-tile-subtitle">{tile.subtitle}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="perf-detail">
          <div className="perf-detail-header">
            <h2>{activeTile.title}</h2>
            {selected === "cpu" && stats && <span className="perf-detail-model">{stats.cpu_info.brand}</span>}
          </div>

          {selected === "cpu" && (
            <>
              <BigChart data={history.cpu} max={100} color="#0ea5e9" topLabel="% Utilization" maxLabel="100%" />
              <div className="perf-stat-grid">
                <StatBlock label="Utilization" value={stats ? `${stats.cpu_usage.toFixed(0)}%` : "…"} />
                <StatBlock label="Speed" value={stats ? formatHz(stats.cpu_info.frequency_mhz) : "…"} />
                <StatBlock label="Processes" value={stats ? String(stats.process_count) : "…"} />
                <StatBlock
                  label="Cores"
                  value={stats ? `${stats.cpu_info.physical_cores} physical` : "…"}
                />
                <StatBlock
                  label="Logical processors"
                  value={stats ? String(stats.cpu_info.logical_cores) : "…"}
                />
                <StatBlock label="Up time" value={stats ? formatUptime(stats.uptime_secs) : "…"} />
              </div>
            </>
          )}

          {selected === "memory" && (
            <>
              <BigChart data={history.memory} max={100} color="#8b5cf6" topLabel="% Utilization" maxLabel="100%" />
              <div className="perf-stat-grid">
                <StatBlock label="In use" value={stats ? formatGB(stats.used_memory) : "…"} />
                <StatBlock label="Total" value={stats ? formatGB(stats.total_memory) : "…"} />
                <StatBlock
                  label="Available"
                  value={stats ? formatGB(stats.total_memory - stats.used_memory) : "…"}
                />
                <StatBlock label="Swap used" value={stats ? formatGB(stats.used_swap) : "…"} />
                <StatBlock label="Swap total" value={stats ? formatGB(stats.total_swap) : "…"} />
                <StatBlock label="Utilization" value={stats ? `${memPercent.toFixed(0)}%` : "…"} />
              </div>
            </>
          )}

          {selected === "disk" && (
            <>
              <BigChart
                data={history.disk}
                max={maxDisk}
                color="#22c55e"
                topLabel="Activity"
                maxLabel={formatRate(maxDisk)}
              />
              <div className="perf-stat-grid">
                <StatBlock
                  label="Active time"
                  value={stats ? `${stats.disk_active_percent.toFixed(0)}%` : "…"}
                />
                <StatBlock label="Throughput" value={stats ? formatRate(stats.disk_bytes_per_sec) : "…"} />
                <StatBlock label="Type" value={primaryDisk?.kind ?? "…"} />
                <StatBlock label="Mount point" value={primaryDisk?.mount_point ?? "…"} />
                <StatBlock label="Capacity" value={primaryDisk ? formatGB(primaryDisk.total_bytes) : "…"} />
                <StatBlock
                  label="Available"
                  value={primaryDisk ? formatGB(primaryDisk.available_bytes) : "…"}
                />
              </div>
            </>
          )}

          {selected === "network" && (
            <>
              <BigChart
                data={history.network}
                max={maxNetwork}
                color="#f59e0b"
                topLabel="Throughput"
                maxLabel={formatRate(maxNetwork)}
              />
              <div className="perf-stat-grid">
                <StatBlock
                  label="Send"
                  value={stats ? formatRate(stats.network_tx_bytes_per_sec) : "…"}
                />
                <StatBlock
                  label="Receive"
                  value={stats ? formatRate(stats.network_rx_bytes_per_sec) : "…"}
                />
                <StatBlock label="Interface" value={primaryNet?.name ?? "…"} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
