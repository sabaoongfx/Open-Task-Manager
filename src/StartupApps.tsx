import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri, mockStartupApps } from "./mockData";
import type { ProcessInfo, StartupAppInfo } from "./types";
import { ProcIcon } from "./appIcons";
import { IconPlay, IconProhibit, IconRunNewTask } from "./icons";

function impactFor(app: StartupAppInfo, processes: ProcessInfo[]): "High" | "Medium" | "Low" | "None" {
  const needle = app.name.toLowerCase();
  const matches = processes.filter(
    (p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase())
  );
  if (matches.length === 0) return "None";
  const totalMemory = matches.reduce((sum, p) => sum + p.memory, 0);
  if (totalMemory > 300 * 1024 * 1024) return "High";
  if (totalMemory > 50 * 1024 * 1024) return "Medium";
  return "Low";
}

export default function StartupAppsPane({ processes }: { processes: ProcessInfo[] }) {
  const [apps, setApps] = useState<StartupAppInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = isTauri() ? await invoke<StartupAppInfo[]>("get_startup_apps") : mockStartupApps();
      if (!cancelled) setApps(list);
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

  const selectedApp = apps.find((a) => a.name === selected) ?? null;

  function setEnabledFor(name: string, enabled: boolean) {
    setApps((prev) => prev.map((a) => (a.name === name ? { ...a, enabled } : a)));
  }

  function setEnabled(enabled: boolean) {
    if (!selected) return;
    setEnabledFor(selected, enabled);
  }

  return (
    <>
      <div className="panel-header">
        <h1>Startup apps</h1>
        <div className="spacer" />
        <div className="toolbar">
          <button className="toolbar-btn" disabled>
            <IconRunNewTask size={14} />
            Run new task
          </button>
          <button
            className="toolbar-btn"
            disabled={!selectedApp || selectedApp.enabled}
            onClick={() => setEnabled(true)}
          >
            <IconPlay size={14} />
            Enable
          </button>
          <button
            className="toolbar-btn danger"
            disabled={!selectedApp || !selectedApp.enabled}
            onClick={() => setEnabled(false)}
          >
            <IconProhibit size={14} />
            Disable
          </button>
        </div>
      </div>

      <div className="process-table">
        <div className="table-head">
          <div className="col col-name">Name</div>
          <div className="col col-publisher">Publisher</div>
          <div className="col col-status">Status</div>
          <div className="col col-impact">Startup impact</div>
          <div className="col-spacer" />
        </div>
        <div className="table-body">
          {apps.length === 0 && <div className="empty-hint">Loading startup apps…</div>}
          {apps.map((a) => (
            <div
              key={a.name}
              className={`row ${selected === a.name ? "selected" : ""} ${!a.enabled ? "dim" : ""}`}
              onClick={() => setSelected(a.name)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelected(a.name);
                setContextMenu({ x: e.clientX, y: e.clientY, name: a.name });
              }}
            >
              <div className="col col-name">
                <ProcIcon name={a.name} />
                {a.name}
              </div>
              <div className="col col-publisher">{a.publisher}</div>
              <div className="col col-status">{a.enabled ? "Enabled" : "Disabled"}</div>
              <div className="col col-impact">{impactFor(a, processes)}</div>
              <div className="col-spacer" />
            </div>
          ))}
        </div>
      </div>

      {contextMenu &&
        (() => {
          const app = apps.find((a) => a.name === contextMenu.name);
          if (!app) return null;
          return (
            <div
              className="context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              {app.enabled ? (
                <button
                  className="context-menu-item danger"
                  onClick={() => {
                    setEnabledFor(contextMenu.name, false);
                    setContextMenu(null);
                  }}
                >
                  <IconProhibit size={14} />
                  Disable
                </button>
              ) : (
                <button
                  className="context-menu-item"
                  onClick={() => {
                    setEnabledFor(contextMenu.name, true);
                    setContextMenu(null);
                  }}
                >
                  <IconPlay size={14} />
                  Enable
                </button>
              )}
            </div>
          );
        })()}
    </>
  );
}
