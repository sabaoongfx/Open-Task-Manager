import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import type { AppHistoryEntry, ProcessInfo, Snapshot, SystemStats } from "./types";
import { isTauri, mockKill, mockResetAppHistory, mockSnapshot } from "./mockData";
import { ProcIcon } from "./appIcons";
import { formatBytes, formatRate } from "./format";
import PerformancePane, { type PerfHistory, HISTORY_LEN } from "./Performance";
import DetailsPane from "./Details";
import UsersPane from "./Users";
import StartupAppsPane from "./StartupApps";
import ServicesPane from "./Services";
import AppHistoryPane from "./AppHistory";
import {
  IconChevronDown,
  IconDetails,
  IconHistory,
  IconLeafPair,
  IconMenu,
  IconPerformance,
  IconProcesses,
  IconProhibit,
  IconRunNewTask,
  IconSearch,
  IconServices,
  IconSettings,
  IconStartup,
  IconUsers,
} from "./icons";

type SortKey = "name" | "cpu_usage" | "memory" | "pid" | "disk_bytes_per_sec";

const NAV_ITEMS = [
  { key: "processes", label: "Processes", icon: IconProcesses },
  { key: "performance", label: "Performance", icon: IconPerformance },
  { key: "history", label: "App history", icon: IconHistory },
  { key: "startup", label: "Startup apps", icon: IconStartup },
  { key: "users", label: "Users", icon: IconUsers },
  { key: "details", label: "Details", icon: IconDetails },
  { key: "services", label: "Services", icon: IconServices },
];

const BACKGROUND_HINTS = [
  "service",
  "svchost",
  "daemon",
  "helper",
  "agent",
  "system",
  "registry",
  "crashpad",
  "com surrogate",
  "runtime broker",
  "window manager",
  "explorer",
];

function isBackgroundProcess(name: string): boolean {
  const lower = name.toLowerCase();
  return BACKGROUND_HINTS.some((hint) => lower.includes(hint));
}

function heatAlpha(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(0.4, (value / max) * 0.4);
}

interface NameGroup {
  name: string;
  instances: ProcessInfo[];
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  minPid: number;
}

function groupByName(rows: ProcessInfo[]): NameGroup[] {
  const map = new Map<string, ProcessInfo[]>();
  for (const p of rows) {
    const arr = map.get(p.name);
    if (arr) arr.push(p);
    else map.set(p.name, [p]);
  }
  return Array.from(map.entries()).map(([name, instances]) => ({
    name,
    instances: [...instances].sort((a, b) => a.pid - b.pid),
    totalCpu: instances.reduce((sum, p) => sum + p.cpu_usage, 0),
    totalMemory: instances.reduce((sum, p) => sum + p.memory, 0),
    totalDisk: instances.reduce((sum, p) => sum + p.disk_bytes_per_sec, 0),
    minPid: Math.min(...instances.map((p) => p.pid)),
  }));
}

function singletonGroups(rows: ProcessInfo[]): NameGroup[] {
  return rows.map((p) => ({
    name: p.name,
    instances: [p],
    totalCpu: p.cpu_usage,
    totalMemory: p.memory,
    totalDisk: p.disk_bytes_per_sec,
    minPid: p.pid,
  }));
}

type Selection =
  | { kind: "pid"; pid: number }
  | { kind: "group"; key: string; pids: number[] };

function App() {
  const [activeTab, setActiveTab] = useState("processes");
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("cpu_usage");
  const [sortDesc, setSortDesc] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedNames, setExpandedNames] = useState<Record<string, boolean>>({});
  const [compact, setCompact] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [history, setHistory] = useState<PerfHistory>({ cpu: [], memory: [], disk: [], network: [] });
  const [appHistory, setAppHistory] = useState<AppHistoryEntry[]>([]);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; selection: Selection } | null>(null);

  useEffect(() => {
    const outer = document.createElement("div");
    outer.style.cssText = "visibility:hidden;overflow:scroll;position:absolute;top:-9999px;width:100px;height:100px;";
    const inner = document.createElement("div");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    setScrollbarWidth(outer.offsetWidth - inner.offsetWidth);
    document.body.removeChild(outer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const snapshot = isTauri() ? await invoke<Snapshot>("get_snapshot") : mockSnapshot();

      if (!cancelled) {
        setProcesses(snapshot.processes);
        setStats(snapshot.stats);
        setAppHistory(snapshot.app_history);
        setHistory((prev) => ({
          cpu: [...prev.cpu, snapshot.stats.cpu_usage].slice(-HISTORY_LEN),
          memory: [
            ...prev.memory,
            (snapshot.stats.used_memory / snapshot.stats.total_memory) * 100,
          ].slice(-HISTORY_LEN),
          disk: [...prev.disk, snapshot.stats.disk_bytes_per_sec].slice(-HISTORY_LEN),
          network: [
            ...prev.network,
            snapshot.stats.network_rx_bytes_per_sec + snapshot.stats.network_tx_bytes_per_sec,
          ].slice(-HISTORY_LEN),
        }));
      }
    }

    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(
    () => processes.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())),
    [processes, filter]
  );

  const maxCpu = useMemo(() => Math.max(0, ...filtered.map((p) => p.cpu_usage)), [filtered]);
  const maxDisk = useMemo(
    () => Math.max(0, ...filtered.map((p) => p.disk_bytes_per_sec)),
    [filtered]
  );
  function sortNameGroups(nameGroups: NameGroup[]) {
    const dir = sortDesc ? -1 : 1;
    return [...nameGroups].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "pid") return (a.minPid - b.minPid) * dir;
      if (sortKey === "cpu_usage") return (a.totalCpu - b.totalCpu) * dir;
      if (sortKey === "disk_bytes_per_sec") return (a.totalDisk - b.totalDisk) * dir;
      return (a.totalMemory - b.totalMemory) * dir;
    });
  }

  const categories = useMemo(() => {
    const apps = sortNameGroups(
      groupByName(filtered.filter((p) => !isBackgroundProcess(p.name)))
    );
    const background = sortNameGroups(
      singletonGroups(filtered.filter((p) => isBackgroundProcess(p.name)))
    );
    return [
      { key: "apps", label: "Apps", nameGroups: apps },
      { key: "background", label: "Background processes", nameGroups: background },
    ];
  }, [filtered, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleExpandedName(key: string) {
    setExpandedNames((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function killPid(pid: number) {
    if (isTauri()) {
      await invoke("kill_process", { pid });
    } else {
      mockKill(pid);
    }
  }

  async function endPids(pids: number[]) {
    await Promise.all(pids.map(killPid));
    setProcesses((prev) => prev.filter((p) => !pids.includes(p.pid)));
  }

  async function endTask() {
    if (!selection) return;
    const pids = selection.kind === "pid" ? [selection.pid] : selection.pids;
    await endPids(pids);
    setSelection(null);
  }

  async function resetAppHistory() {
    if (isTauri()) {
      await invoke("reset_app_history");
    } else {
      mockResetAppHistory();
    }
    setAppHistory((prev) => prev.map((e) => ({ ...e, cpu_seconds: 0 })));
  }

  function handleContextMenu(e: React.MouseEvent, sel: Selection) {
    e.preventDefault();
    e.stopPropagation();
    setSelection(sel);
    setContextMenu({ x: e.clientX, y: e.clientY, selection: sel });
  }

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="sort-arrow">{sortDesc ? "▼" : "▲"}</span>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <button
            className="menu-btn"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <IconMenu />
          </button>
          <span className="brand-title">
            <img className="brand-logo" src="open%20task%20manager.svg" alt="" />
            <span className="brand-text">Open Task Manager</span>
          </span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? "active" : ""}`}
              onClick={() => setActiveTab(item.key)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button
          className={`nav-item settings ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
          title={sidebarCollapsed ? "Settings" : undefined}
        >
          <IconSettings />
          <span className="nav-label">Settings</span>
        </button>
      </aside>

      <main className="main-panel">
        <div className="content-card">
        {activeTab === "performance" ? (
          <PerformancePane stats={stats} history={history} />
        ) : activeTab === "details" ? (
          <DetailsPane processes={processes} onEndTask={endPids} />
        ) : activeTab === "users" ? (
          <UsersPane processes={processes} stats={stats} onEndTask={endPids} />
        ) : activeTab === "startup" ? (
          <StartupAppsPane processes={processes} />
        ) : activeTab === "services" ? (
          <ServicesPane />
        ) : activeTab === "history" ? (
          <AppHistoryPane entries={appHistory} onDeleteHistory={resetAppHistory} />
        ) : activeTab !== "processes" ? (
          <div className="placeholder-pane">
            <p>{NAV_ITEMS.find((n) => n.key === activeTab)?.label ?? "Settings"}</p>
            <span>Not implemented yet</span>
          </div>
        ) : (
          <>
            <div className="panel-header">
              <h1>Processes</h1>
              <div className="spacer" />
              <div className="toolbar">
                <button className="toolbar-btn" disabled>
                  <IconRunNewTask size={14} />
                  Run new task
                </button>
                <button
                  className="toolbar-btn danger"
                  disabled={selection == null}
                  onClick={endTask}
                >
                  <IconProhibit size={14} />
                  End task
                </button>
                <button
                  className={`toolbar-btn ${compact ? "active" : ""}`}
                  onClick={() => setCompact(!compact)}
                >
                  <IconLeafPair size={14} />
                  Efficiency mode
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setShowSearch(!showSearch)}
                  aria-label="Search"
                >
                  <IconSearch size={16} />
                </button>
              </div>
            </div>

            {showSearch && (
              <input
                className="search"
                autoFocus
                placeholder="Filter processes..."
                value={filter}
                onChange={(e) => setFilter(e.currentTarget.value)}
              />
            )}

            <div
              className={`process-table ${compact ? "compact" : ""}`}
              style={{ ["--scrollbar-width" as string]: `${scrollbarWidth}px` }}
            >
              <div className="table-head">
                <div className="col col-name" onClick={() => toggleSort("name")}>
                  Name {sortArrow("name")}
                </div>
                <div className="col col-pid" onClick={() => toggleSort("pid")}>
                  PID {sortArrow("pid")}
                </div>
                <div className="col col-cpu" onClick={() => toggleSort("cpu_usage")}>
                  <span className="total-value">{stats ? `${stats.cpu_usage.toFixed(0)}%` : "…"}</span>
                  <span className="total-label">CPU {sortArrow("cpu_usage")}</span>
                </div>
                <div className="col col-mem" onClick={() => toggleSort("memory")}>
                  <span className="total-value">
                    {stats ? `${((stats.used_memory / stats.total_memory) * 100).toFixed(0)}%` : "…"}
                  </span>
                  <span className="total-label">Memory {sortArrow("memory")}</span>
                </div>
                <div className="col col-disk" onClick={() => toggleSort("disk_bytes_per_sec")}>
                  <span className="total-value">
                    {stats ? `${stats.disk_active_percent.toFixed(0)}%` : "…"}
                  </span>
                  <span className="total-label">Disk {sortArrow("disk_bytes_per_sec")}</span>
                </div>
                <div className="col-spacer" />
              </div>

              <div className="table-body">
                {categories.map((category) =>
                  category.nameGroups.length === 0 ? null : (
                    <div key={category.key} className="group">
                      <button
                        className="group-header"
                        onClick={() => toggleGroup(category.key)}
                      >
                        <span className="group-header-name">
                          <span className={`chevron ${collapsed[category.key] ? "collapsed" : ""}`}>
                            <IconChevronDown size={12} />
                          </span>
                          {category.label} ({category.nameGroups.length})
                        </span>
                        <span className="group-header-col" style={{ width: 90 }} />
                        <span className="group-header-col" style={{ width: 90 }} />
                        <span className="group-header-col" style={{ width: 120 }} />
                        <span className="group-header-col" style={{ width: 100 }} />
                        <span className="group-header-fill" />
                      </button>
                      {!collapsed[category.key] &&
                        category.nameGroups.map((ng) => {
                          const isMulti = ng.instances.length > 1;
                          const groupKey = `${category.key}:${ng.name}:${ng.minPid}`;
                          const expanded = expandedNames[groupKey];
                          const isGroupSelected =
                            isMulti &&
                            selection?.kind === "group" &&
                            selection.key === groupKey;
                          const singlePid = ng.instances[0].pid;
                          const isSingleSelected =
                            !isMulti && selection?.kind === "pid" && selection.pid === singlePid;

                          return (
                            <div key={groupKey}>
                              <div
                                className={`row ${isGroupSelected || isSingleSelected ? "selected" : ""}`}
                                onClick={() => {
                                  setSelection(
                                    isMulti
                                      ? { kind: "group", key: groupKey, pids: ng.instances.map((p) => p.pid) }
                                      : { kind: "pid", pid: singlePid }
                                  );
                                  if (isMulti) toggleExpandedName(groupKey);
                                }}
                                onContextMenu={(e) =>
                                  handleContextMenu(
                                    e,
                                    isMulti
                                      ? { kind: "group", key: groupKey, pids: ng.instances.map((p) => p.pid) }
                                      : { kind: "pid", pid: singlePid }
                                  )
                                }
                              >
                                <div className="col col-name">
                                  {isMulti ? (
                                    <span
                                      className={`chevron inline ${expanded ? "" : "collapsed"}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleExpandedName(groupKey);
                                      }}
                                    >
                                      <IconChevronDown size={11} />
                                    </span>
                                  ) : (
                                    <span className="chevron-spacer" />
                                  )}
                                  <ProcIcon name={ng.name} />
                                  {ng.name}
                                  {isMulti && ` (${ng.instances.length})`}
                                </div>
                                <div className="col col-pid">{isMulti ? "" : singlePid}</div>
                                <div
                                  className="col col-cpu"
                                  style={{
                                    background: `rgba(0, 120, 212, ${heatAlpha(ng.totalCpu, maxCpu)})`,
                                  }}
                                >
                                  {ng.totalCpu.toFixed(1)}%
                                </div>
                                <div className="col col-mem">{formatBytes(ng.totalMemory)}</div>
                                <div
                                  className="col col-disk"
                                  style={{
                                    background: `rgba(0, 120, 212, ${heatAlpha(ng.totalDisk, maxDisk)})`,
                                  }}
                                >
                                  {formatRate(ng.totalDisk)}
                                </div>
                                <div className="col-spacer" />
                              </div>

                              {isMulti &&
                                expanded &&
                                ng.instances.map((p) => {
                                  const subSelected = selection?.kind === "pid" && selection.pid === p.pid;
                                  return (
                                    <div
                                      key={p.pid}
                                      className={`row sub-row ${subSelected ? "selected" : ""}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelection({ kind: "pid", pid: p.pid });
                                      }}
                                      onContextMenu={(e) => handleContextMenu(e, { kind: "pid", pid: p.pid })}
                                    >
                                      <div className="col col-name sub-name">{p.name}</div>
                                      <div className="col col-pid">{p.pid}</div>
                                      <div
                                        className="col col-cpu"
                                        style={{
                                          background: `rgba(0, 120, 212, ${heatAlpha(p.cpu_usage, maxCpu)})`,
                                        }}
                                      >
                                        {p.cpu_usage.toFixed(1)}%
                                      </div>
                                      <div className="col col-mem">{formatBytes(p.memory)}</div>
                                      <div
                                        className="col col-disk"
                                        style={{
                                          background: `rgba(0, 120, 212, ${heatAlpha(p.disk_bytes_per_sec, maxDisk)})`,
                                        }}
                                      >
                                        {formatRate(p.disk_bytes_per_sec)}
                                      </div>
                                      <div className="col-spacer" />
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        })}
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </main>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item danger"
            onClick={async () => {
              setContextMenu(null);
              await endTask();
            }}
          >
            <IconProhibit size={14} />
            End task
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
