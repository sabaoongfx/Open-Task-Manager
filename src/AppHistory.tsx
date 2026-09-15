import { useState } from "react";
import { ProcIcon } from "./appIcons";
import { formatUptime } from "./format";
import type { AppHistoryEntry } from "./types";

export default function AppHistoryPane({
  entries,
  onDeleteHistory,
}: {
  entries: AppHistoryEntry[];
  onDeleteHistory: () => Promise<void>;
}) {
  const [sinceLabel] = useState(() =>
    new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" })
  );

  return (
    <>
      <div className="panel-header">
        <h1>App history</h1>
      </div>

      <div className="history-meta">
        <p>CPU time accumulated since this app was opened ({sinceLabel}).</p>
        <button className="link-btn" onClick={onDeleteHistory}>
          Delete usage history
        </button>
      </div>

      <div className="process-table">
        <div className="table-head">
          <div className="col col-name">Name</div>
          <div className="col col-cputime">CPU time</div>
          <div className="col-spacer" />
        </div>
        <div className="table-body">
          {entries.length === 0 && <div className="empty-hint">Still gathering data…</div>}
          {entries.map((r) => (
            <div key={r.name} className="row">
              <div className="col col-name">
                <ProcIcon name={r.name} />
                {r.name}
              </div>
              <div className="col col-cputime">{formatUptime(r.cpu_seconds)}</div>
              <div className="col-spacer" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
