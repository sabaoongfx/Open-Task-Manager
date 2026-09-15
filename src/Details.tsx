import { useEffect, useState } from "react";
import type { ProcessInfo } from "./types";
import { formatBytes } from "./format";
import { IconProhibit, IconRunNewTask, IconSearch } from "./icons";
import { ProcIcon } from "./appIcons";

type SortKey = "name" | "pid" | "status" | "user_name" | "cpu_usage" | "memory";

export default function DetailsPane({
  processes,
  onEndTask,
}: {
  processes: ProcessInfo[];
  onEndTask: (pids: number[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pid: number } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="sort-arrow">{sortDesc ? "▼" : "▲"}</span>;
  }

  const filtered = processes.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
  const dir = sortDesc ? -1 : 1;
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
    if (sortKey === "pid") return (a.pid - b.pid) * dir;
    if (sortKey === "status") return a.status.localeCompare(b.status) * dir;
    if (sortKey === "user_name") return (a.user_name ?? "").localeCompare(b.user_name ?? "") * dir;
    if (sortKey === "cpu_usage") return (a.cpu_usage - b.cpu_usage) * dir;
    return (a.memory - b.memory) * dir;
  });

  const selectedProcess = processes.find((p) => p.pid === selectedPid) ?? null;

  async function endTask(pid: number) {
    await onEndTask([pid]);
    setSelectedPid(null);
    setContextMenu(null);
  }

  return (
    <>
      <div className="panel-header">
        <h1>Details</h1>
        <div className="spacer" />
        <div className="toolbar">
          <button className="toolbar-btn" disabled>
            <IconRunNewTask size={14} />
            Run new task
          </button>
          <button
            className="toolbar-btn danger"
            disabled={!selectedProcess}
            onClick={() => selectedProcess && endTask(selectedProcess.pid)}
          >
            <IconProhibit size={14} />
            End task
          </button>
          <button className="icon-btn" onClick={() => setShowSearch(!showSearch)} aria-label="Search">
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

      <div className="process-table">
        <div className="table-head">
          <div className="col col-name" onClick={() => toggleSort("name")}>
            Name {sortArrow("name")}
          </div>
          <div className="col col-pid" onClick={() => toggleSort("pid")}>
            PID {sortArrow("pid")}
          </div>
          <div className="col col-status" onClick={() => toggleSort("status")}>
            Status {sortArrow("status")}
          </div>
          <div className="col col-user" onClick={() => toggleSort("user_name")}>
            User name {sortArrow("user_name")}
          </div>
          <div className="col col-cpu" onClick={() => toggleSort("cpu_usage")}>
            CPU {sortArrow("cpu_usage")}
          </div>
          <div className="col col-mem" onClick={() => toggleSort("memory")}>
            Memory {sortArrow("memory")}
          </div>
          <div className="col-spacer" />
        </div>

        <div className="table-body">
          {sorted.map((p) => (
            <div
              key={p.pid}
              className={`row ${selectedPid === p.pid ? "selected" : ""}`}
              onClick={() => setSelectedPid(p.pid)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedPid(p.pid);
                setContextMenu({ x: e.clientX, y: e.clientY, pid: p.pid });
              }}
            >
              <div className="col col-name">
                <ProcIcon name={p.name} />
                {p.name}
              </div>
              <div className="col col-pid">{p.pid}</div>
              <div className="col col-status">{p.status}</div>
              <div className="col col-user">{p.user_name ?? "—"}</div>
              <div className="col col-cpu">{p.cpu_usage.toFixed(1)}%</div>
              <div className="col col-mem">{formatBytes(p.memory)}</div>
              <div className="col-spacer" />
            </div>
          ))}
        </div>
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item danger" onClick={() => endTask(contextMenu.pid)}>
            <IconProhibit size={14} />
            End task
          </button>
        </div>
      )}
    </>
  );
}
