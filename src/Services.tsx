import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri, mockServices } from "./mockData";
import type { ServiceInfo } from "./types";
import { IconPlay, IconProhibit, IconRunNewTask, IconSearch } from "./icons";

// System and user units can share a name, so a row is identified by scope + name.
const keyOf = (s: ServiceInfo) => `${s.scope}/${s.name}`;

export default function ServicesPane() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = isTauri() ? await invoke<ServiceInfo[]>("get_services") : mockServices();
      if (!cancelled) setServices(list);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // UI-only for now: Start/Stop never reach systemd (see README roadmap).
  function setRunning(key: string, running: boolean) {
    setServices((prev) =>
      prev.map((s) => (keyOf(s) === key ? { ...s, status: running ? "Running" : "Stopped" } : s))
    );
  }

  const failedCount = services.filter((s) => s.status === "Failed").length;

  const filtered = services.filter((s) => {
    const q = filter.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.scope.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="panel-header">
        <h1>Services</h1>
        {failedCount > 0 && (
          <span className="failed-count" title="Units that failed to start or crashed">
            {failedCount} failed
          </span>
        )}
        <div className="spacer" />
        <div className="toolbar">
          <button className="toolbar-btn" disabled>
            <IconRunNewTask size={20} />
            Run new task
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
          placeholder="Filter services..."
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
        />
      )}

      <div className="process-table">
        <div className="table-head">
          <div className="col col-name">Name</div>
          <div className="col col-scope">Scope</div>
          <div className="col col-desc">Description</div>
          <div className="col col-status">Status</div>
          <div className="col-spacer" />
        </div>
        <div className="table-body">
          {services.length === 0 && <div className="empty-hint">Loading services…</div>}
          {filtered.map((s) => {
            const key = keyOf(s);
            return (
              <div
                key={key}
                className={`row ${selected === key ? "selected" : ""}`}
                onClick={() => setSelected(key)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(key);
                  setContextMenu({ x: e.clientX, y: e.clientY, key });
                }}
              >
                <div className="col col-name">{s.name}</div>
                <div className="col col-scope">{s.scope}</div>
                <div className="col col-desc">{s.description}</div>
                <div className={`col col-status ${s.status === "Failed" ? "failed" : ""}`}>{s.status}</div>
                <div className="col-spacer" />
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu &&
        (() => {
          const svc = services.find((s) => keyOf(s) === contextMenu.key);
          if (!svc) return null;
          const running = svc.status === "Running";
          return (
            <div
              className="context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {running ? (
                <button
                  className="context-menu-item danger"
                  onClick={() => {
                    setRunning(contextMenu.key, false);
                    setContextMenu(null);
                  }}
                >
                  <IconProhibit size={14} />
                  Stop
                </button>
              ) : (
                <button
                  className="context-menu-item"
                  onClick={() => {
                    setRunning(contextMenu.key, true);
                    setContextMenu(null);
                  }}
                >
                  <IconPlay size={14} />
                  Start
                </button>
              )}
            </div>
          );
        })()}
    </>
  );
}
