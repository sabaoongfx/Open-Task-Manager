import { useState } from "react";
import type { ProcessInfo, SystemStats } from "./types";
import { formatBytes, formatRate } from "./format";
import { IconChevronDown, IconRunNewTask } from "./icons";

interface UserGroup {
  user: string;
  pids: number[];
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  instances: ProcessInfo[];
}

function groupByUser(rows: ProcessInfo[]): UserGroup[] {
  const map = new Map<string, ProcessInfo[]>();
  for (const p of rows) {
    const key = p.user_name ?? "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.entries()]
    .map(([user, instances]) => ({
      user,
      pids: instances.map((p) => p.pid),
      totalCpu: instances.reduce((sum, p) => sum + p.cpu_usage, 0),
      totalMemory: instances.reduce((sum, p) => sum + p.memory, 0),
      totalDisk: instances.reduce((sum, p) => sum + p.disk_bytes_per_sec, 0),
      instances,
    }))
    .sort((a, b) => b.totalMemory - a.totalMemory);
}

export default function UsersPane({
  processes,
  stats,
  onEndTask,
}: {
  processes: ProcessInfo[];
  stats: SystemStats | null;
  onEndTask: (pids: number[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const groups = groupByUser(processes);
  const selectedGroup = groups.find((g) => g.user === selectedUser) ?? null;

  async function disconnect() {
    if (!selectedGroup) return;
    await onEndTask(selectedGroup.pids);
    setSelectedUser(null);
  }

  return (
    <>
      <div className="panel-header">
        <h1>Users</h1>
        <div className="spacer" />
        <div className="toolbar">
          <button className="toolbar-btn" disabled>
            <IconRunNewTask size={14} />
            Run new task
          </button>
          <button className="toolbar-btn danger" disabled={!selectedGroup} onClick={disconnect}>
            Disconnect
          </button>
          <button className="toolbar-btn" disabled>
            Manage user accounts
          </button>
        </div>
      </div>

      <div className="process-table">
        <div className="table-head">
          <div className="col col-name">User</div>
          <div className="col col-cpu">
            <span className="total-value">{stats ? `${stats.cpu_usage.toFixed(0)}%` : "…"}</span>
            <span className="total-label">CPU</span>
          </div>
          <div className="col col-mem">
            <span className="total-value">
              {stats ? `${((stats.used_memory / stats.total_memory) * 100).toFixed(0)}%` : "…"}
            </span>
            <span className="total-label">Memory</span>
          </div>
          <div className="col col-disk">
            <span className="total-value">{stats ? `${stats.disk_active_percent.toFixed(0)}%` : "…"}</span>
            <span className="total-label">Disk</span>
          </div>
          <div className="col-spacer" />
        </div>

        <div className="table-body">
          {groups.map((g) => {
            const isExpanded = expanded[g.user];
            const isSelected = selectedUser === g.user;
            return (
              <div key={g.user}>
                <div
                  className={`row ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedUser(g.user);
                    setExpanded((prev) => ({ ...prev, [g.user]: !prev[g.user] }));
                  }}
                >
                  <div className="col col-name">
                    <span
                      className={`chevron inline ${isExpanded ? "" : "collapsed"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((prev) => ({ ...prev, [g.user]: !prev[g.user] }));
                      }}
                    >
                      <IconChevronDown size={11} />
                    </span>
                    {g.user} ({g.instances.length})
                  </div>
                  <div className="col col-cpu">{g.totalCpu.toFixed(1)}%</div>
                  <div className="col col-mem">{formatBytes(g.totalMemory)}</div>
                  <div className="col col-disk">{formatRate(g.totalDisk)}</div>
                  <div className="col-spacer" />
                </div>
                {isExpanded &&
                  g.instances.map((p) => (
                    <div key={p.pid} className="row sub-row" onClick={(e) => e.stopPropagation()}>
                      <div className="col col-name sub-name">{p.name}</div>
                      <div className="col col-cpu">{p.cpu_usage.toFixed(1)}%</div>
                      <div className="col col-mem">{formatBytes(p.memory)}</div>
                      <div className="col col-disk">{formatRate(p.disk_bytes_per_sec)}</div>
                      <div className="col-spacer" />
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
