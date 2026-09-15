import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri, mockServices } from "./mockData";
import type { ServiceInfo } from "./types";
import { IconPlay, IconProhibit, IconRunNewTask, IconSearch } from "./icons";

export default function ServicesPane() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; name: string } | null>(null);

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

  function setRunning(name: string, running: boolean) {
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, status: running ? "Running" : "Stopped" } : s))
    );
  }

  const filtered = services.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
      <div className="panel-header">
        <h1>Services</h1>
        <div className="spacer" />
        <div className="toolbar">
          <button className="toolbar-btn" disabled>
            <IconRunNewTask size={14} />
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
          <div className="col col-desc">Description</div>
          <div className="col col-status">Status</div>
          <div className="col-spacer" />
        </div>
        <div className="table-body">
          {services.length === 0 && <div className="empty-hint">Loading services…</div>}
          {filtered.map((s) => (
            <div
              key={s.name}
              className={`row ${selected === s.name ? "selected" : ""}`}
              onClick={() => setSelected(s.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelected(s.name);
                setContextMenu({ x: e.clientX, y: e.clientY, name: s.name });
              }}
            >
              <div className="col col-name">{s.name}</div>
              <div className="col col-desc">{s.description}</div>
              <div className="col col-status">{s.status}</div>
              <div className="col-spacer" />
            </div>
          ))}
        </div>
      </div>

      {contextMenu &&
        (() => {
          const svc = services.find((s) => s.name === contextMenu.name);
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
                    setRunning(contextMenu.name, false);
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
                    setRunning(contextMenu.name, true);
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
