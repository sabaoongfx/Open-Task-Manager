import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { isTauri, mockDiskScan, mockDiskScanProgress } from "./mockData";
import type { DiskNode, DiskScan, SystemStats } from "./types";
import { formatSize } from "./format";
import { IconChevronDown, IconFile, IconFolder, IconProhibit, IconSearch } from "./icons";

// The first eight extensions by size get a categorical hue each (validated light/dark pairs);
// everything else, including folded "smaller items", is neutral gray.
const EXT_COLORS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const EXT_COLORS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const GRAY_LIGHT = "#9a9a9a";
const GRAY_DARK = "#6e6e6e";

function isDarkTheme(): boolean {
  const theme = document.documentElement.dataset.theme;
  if (theme) return theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 && i + 1 < name.length ? name.slice(i + 1).toLowerCase() : "";
}

function extLabel(ext: string): string {
  return ext ? `.${ext}` : "(no extension)";
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

interface IndexedNode {
  node: DiskNode;
  /** Full path for real files and folders; "smaller items" rows get a non-path key. */
  key: string;
  parentKey: string | null;
  depth: number;
}

function joinPath(parent: string, name: string): string {
  const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
  return parent.endsWith(sep) ? parent + name : parent + sep + name;
}

function indexTree(root: DiskNode): Map<string, IndexedNode> {
  const map = new Map<string, IndexedNode>();
  (function walk(node: DiskNode, key: string, parentKey: string | null, depth: number) {
    map.set(key, { node, key, parentKey, depth });
    for (const child of node.children) {
      const childKey = child.kind === "other" ? `${key}\u0000other` : joinPath(key, child.name);
      walk(child, childKey, key, depth + 1);
    }
  })(root, root.name, null, 0);
  return map;
}

function childKey(parentKey: string, child: DiskNode): string {
  return child.kind === "other" ? `${parentKey}\u0000other` : joinPath(parentKey, child.name);
}

// ---- Treemap: squarified layout, van Wijk cushion shading (the WinDirStat look). ----

interface Surface {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface Tile {
  key: string;
  node: DiskNode;
  ext: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // Cushion surface coefficients, accumulated from every enclosing folder.
  s: Surface;
}

const CUSHION_HEIGHT = 0.5;
const CUSHION_FALLOFF = 0.75;

function addRidge(s: Surface, x: number, y: number, w: number, h: number, height: number): Surface {
  return {
    x1: s.x1 + (4 * height * (2 * x + w)) / w,
    x2: s.x2 - (4 * height) / w,
    y1: s.y1 + (4 * height * (2 * y + h)) / h,
    y2: s.y2 - (4 * height) / h,
  };
}

function squarify(sizes: number[], x: number, y: number, w: number, h: number) {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total <= 0) return out;
  const areas = sizes.map((s) => (s / total) * w * h);
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    let sum = areas[i];
    let min = areas[i];
    let max = areas[i];
    const worst = (s: number, lo: number, hi: number) =>
      Math.max((side * side * hi) / (s * s), (s * s) / (side * side * lo));
    let best = worst(sum, min, max);
    let j = i + 1;
    while (j < areas.length) {
      const a = areas[j];
      const next = worst(sum + a, Math.min(min, a), Math.max(max, a));
      if (next > best) break;
      sum += a;
      min = Math.min(min, a);
      max = Math.max(max, a);
      best = next;
      j++;
    }
    if (w >= h) {
      const colW = h > 0 ? sum / h : 0;
      let cy = y;
      for (let k = i; k < j; k++) {
        const rh = colW > 0 ? areas[k] / colW : 0;
        out.push({ x, y: cy, w: colW, h: rh });
        cy += rh;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = w > 0 ? sum / w : 0;
      let cx = x;
      for (let k = i; k < j; k++) {
        const cw = rowH > 0 ? areas[k] / rowH : 0;
        out.push({ x: cx, y, w: cw, h: rowH });
        cx += cw;
      }
      y += rowH;
      h -= rowH;
    }
    i = j;
  }
  return out;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Leaf tiles to paint, plus the rect of every placed file and folder (for outlining a selection). */
function layoutTreemap(root: DiskNode, rootKey: string, width: number, height: number) {
  const tiles: Tile[] = [];
  const rects = new Map<string, Rect>();
  (function place(node: DiskNode, key: string, x: number, y: number, w: number, h: number, s: Surface, ridge: number) {
    if (w < 0.5 || h < 0.5 || node.size <= 0) return;
    rects.set(key, { x, y, w, h });
    const surface = addRidge(s, x, y, w, h, ridge);
    if (node.kind !== "dir" || node.children.length === 0) {
      tiles.push({ key, node, ext: node.kind === "file" ? extensionOf(node.name) : "", x, y, w, h, s: surface });
      return;
    }
    const kids = node.children.filter((c) => c.size > 0);
    const placed = squarify(
      kids.map((c) => c.size),
      x,
      y,
      w,
      h
    );
    kids.forEach((child, i) => {
      const r = placed[i];
      place(child, childKey(key, child), r.x, r.y, r.w, r.h, surface, ridge * CUSHION_FALLOFF);
    });
  })(root, rootKey, 0, 0, width, height, { x1: 0, x2: 0, y1: 0, y2: 0 }, CUSHION_HEIGHT);
  return { tiles, rects };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface TreemapProps {
  root: DiskNode;
  rootKey: string;
  colorFor: (ext: string, kind: DiskNode["kind"]) => string;
  selectedKey: string | null;
  selectedExt: string | null;
  onSelect: (key: string) => void;
}

function Treemap({ root, rootKey, colorFor, selectedKey, selectedExt, onSelect }: TreemapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ tile: Tile; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { tiles, rects } = useMemo(
    () =>
      size.w > 0 && size.h > 0
        ? layoutTreemap(root, rootKey, size.w, size.h)
        : { tiles: [], rects: new Map<string, Rect>() },
    [root, rootKey, size]
  );

  // Shade every pixel from its tile's cushion surface: ambient + diffuse light from the top left.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(size.w * dpr);
    const H = Math.round(size.h * dpr);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    const data = img.data;
    const [lx, ly, lz] = [-1, -1, 10].map((v, _, a) => v / Math.hypot(a[0], a[1], a[2]));
    const ambient = 0.35;
    const diffuse = 0.75;
    for (const t of tiles) {
      const [r, g, b] = hexToRgb(colorFor(t.ext, t.node.kind));
      const x0 = Math.round(t.x * dpr);
      const x1 = Math.round((t.x + t.w) * dpr);
      const y0 = Math.round(t.y * dpr);
      const y1 = Math.round((t.y + t.h) * dpr);
      for (let py = y0; py < y1; py++) {
        const cy = (py + 0.5) / dpr;
        const ny = -(2 * t.s.y2 * cy + t.s.y1);
        for (let px = x0; px < x1; px++) {
          const cx = (px + 0.5) / dpr;
          const nx = -(2 * t.s.x2 * cx + t.s.x1);
          const cos = (nx * lx + ny * ly + lz) / Math.sqrt(nx * nx + ny * ny + 1);
          const light = Math.min(1.25, ambient + diffuse * Math.max(0, cos));
          const i = (py * W + px) * 4;
          data[i] = Math.min(255, r * light);
          data[i + 1] = Math.min(255, g * light);
          data[i + 2] = Math.min(255, b * light);
          data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.scale(dpr, dpr);
    const outline = (t: Rect) => {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.strokeRect(t.x + 1, t.y + 1, Math.max(0, t.w - 2), Math.max(0, t.h - 2));
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(t.x + 1, t.y + 1, Math.max(0, t.w - 2), Math.max(0, t.h - 2));
    };
    if (selectedExt != null) {
      tiles.filter((t) => t.node.kind === "file" && t.ext === selectedExt).forEach(outline);
    }
    const sel = selectedKey ? rects.get(selectedKey) : undefined;
    if (sel) outline(sel);
  }, [tiles, rects, size, colorFor, selectedKey, selectedExt]);

  function tileAt(e: React.MouseEvent): { tile: Tile; x: number; y: number } | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const tile = tiles.find((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
    return tile ? { tile, x, y } : null;
  }

  return (
    <div
      className="treemap"
      ref={wrapRef}
      onMouseMove={(e) => setHover(tileAt(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const hit = tileAt(e);
        if (hit) onSelect(hit.tile.key);
      }}
    >
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} aria-label="Treemap of disk usage" />
      {hover && (
        <div
          className="treemap-tooltip"
          style={{
            left: Math.min(hover.x + 14, Math.max(0, size.w - 260)),
            top: hover.y + 18 > size.h - 60 ? hover.y - 58 : hover.y + 18,
          }}
        >
          <div className="treemap-tooltip-name">{hover.tile.node.name}</div>
          <div className="treemap-tooltip-meta">
            {formatSize(hover.tile.node.size)}
            {hover.tile.node.kind === "file" ? ` · ${extLabel(hover.tile.ext)}` : ` · ${hover.tile.node.files.toLocaleString()} files`}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- The pane ----

// Outlives the pane, which unmounts on every tab switch: coming back shows the last scan (with
// its open folders) instead of rescanning, and a scan still running shows up when it finishes.
const cache: {
  target: string;
  scan: DiskScan | null;
  expanded: Record<string, boolean>;
  /** The most recently started scan, kept after it finishes to tell stale results apart. */
  latest: Promise<DiskScan> | null;
  running: boolean;
} = { target: "", scan: null, expanded: {}, latest: null, running: false };

export default function DiskUsagePane({ stats }: { stats: SystemStats | null }) {
  const [target, setTarget] = useState(cache.target);
  const [scan, setScan] = useState<DiskScan | null>(cache.scan);
  const [scanning, setScanning] = useState(cache.running);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(cache.expanded);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedExt, setSelectedExt] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const locations = useMemo(() => {
    const mounts = [...new Set((stats?.disks ?? []).map((d) => d.mount_point))].sort();
    return [{ label: "Home folder", path: "" }, ...mounts.map((m) => ({ label: m, path: m }))];
  }, [stats]);

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
    if (!scanning) return;
    const interval = setInterval(async () => {
      setProgress(isTauri() ? await invoke<number>("disk_scan_progress") : mockDiskScanProgress());
    }, 250);
    return () => clearInterval(interval);
  }, [scanning]);

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  function startScan(path: string) {
    cache.target = path;
    cache.latest = isTauri()
      ? invoke<DiskScan>("scan_disk", { path: path || null })
      : mockDiskScan(path || null);
    cache.running = true;
    return showScan(cache.latest);
  }

  async function showScan(pending: Promise<DiskScan>) {
    setScanning(true);
    setProgress(0);
    setError(null);
    try {
      const result = await pending;
      if (cache.latest !== pending) return; // a newer scan replaced this one
      cache.scan = result;
      cache.expanded = { [result.root.name]: true };
      setScan(result);
      setExpanded(cache.expanded);
      setSelected(null);
      setSelectedExt(null);
    } catch (e) {
      if (cache.latest === pending) setError(String(e));
    } finally {
      if (cache.latest === pending) {
        cache.running = false;
        setScanning(false);
      }
    }
  }

  // The first time the tab opens, scan the home folder right away.
  useEffect(() => {
    if (cache.running && cache.latest) showScan(cache.latest);
    else if (!cache.scan) startScan("");
  }, []);

  useEffect(() => {
    cache.expanded = expanded;
  }, [expanded]);

  async function stopScan() {
    if (isTauri()) await invoke("cancel_disk_scan");
  }

  const index = useMemo(() => (scan ? indexTree(scan.root) : new Map<string, IndexedNode>()), [scan]);

  const extColors = useMemo(() => {
    const map = new Map<string, number>();
    (scan?.extensions ?? []).slice(0, EXT_COLORS_LIGHT.length).forEach((e, i) => map.set(e.ext, i));
    return map;
  }, [scan]);

  const [dark, setDark] = useState(isDarkTheme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(isDarkTheme());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const colorFor = useMemo(
    () => (ext: string, kind: DiskNode["kind"]) => {
      const slot = kind === "file" ? extColors.get(ext) : undefined;
      if (slot === undefined) return dark ? GRAY_DARK : GRAY_LIGHT;
      return (dark ? EXT_COLORS_DARK : EXT_COLORS_LIGHT)[slot];
    },
    [extColors, dark]
  );

  const rows = useMemo(() => {
    const out: IndexedNode[] = [];
    if (!scan) return out;
    (function walk(key: string) {
      const entry = index.get(key);
      if (!entry) return;
      out.push(entry);
      if (expanded[key]) entry.node.children.forEach((c) => walk(childKey(key, c)));
    })(scan.root.name);
    return out;
  }, [scan, index, expanded]);

  // Selecting a tile in the treemap opens the tree down to it and scrolls it into view.
  function selectFromTreemap(key: string) {
    setSelected(key);
    setExpanded((prev) => {
      const next = { ...prev };
      let parent = index.get(key)?.parentKey ?? null;
      while (parent) {
        next[parent] = true;
        parent = index.get(parent)?.parentKey ?? null;
      }
      return next;
    });
    requestAnimationFrame(() => rowRefs.current.get(key)?.scrollIntoView({ block: "nearest" }));
  }

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const menuEntry = contextMenu ? index.get(contextMenu.key) : undefined;
  const totalExtSize = scan?.extensions.reduce((sum, e) => sum + e.size, 0) ?? 0;

  return (
    <>
      <div className="panel-header">
        <h1>Disk usage</h1>
        <div className="spacer" />
        <div className="toolbar disk-toolbar">
          <select
            className="disk-location"
            aria-label="Location"
            value={locations.some((l) => l.path === target) ? target : "__custom"}
            onChange={(e) => {
              if (e.currentTarget.value !== "__custom") setTarget(e.currentTarget.value);
            }}
            disabled={scanning}
          >
            {locations.map((l) => (
              <option key={l.path} value={l.path}>
                {l.label}
              </option>
            ))}
            {!locations.some((l) => l.path === target) && <option value="__custom">{target}</option>}
          </select>
          <input
            className="disk-path"
            aria-label="Folder to scan"
            placeholder="Home folder, or type a path"
            value={target}
            disabled={scanning}
            onChange={(e) => setTarget(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !scanning) startScan(target.trim());
            }}
          />
          {scanning ? (
            <button className="toolbar-btn danger" onClick={stopScan} disabled={!isTauri()}>
              <IconProhibit size={14} />
              Stop
            </button>
          ) : (
            <button className="toolbar-btn" onClick={() => startScan(target.trim())}>
              <IconSearch size={14} />
              Scan
            </button>
          )}
        </div>
      </div>

      {(scan || scanning || error) && (
        <div className="history-meta">
          {scanning ? (
            <span>Scanning… {progress.toLocaleString()} files</span>
          ) : error ? (
            <span className="disk-error">{error}</span>
          ) : (
            scan && (
              <>
                <span>{scan.path}</span>
                <span>{formatSize(scan.root.size)}</span>
                <span>{scan.root.files.toLocaleString()} files</span>
                {scan.errors > 0 && (
                  <span>
                    {scan.errors.toLocaleString()} folder{scan.errors === 1 ? "" : "s"} couldn't be read
                  </span>
                )}
                {scan.cancelled && <span>Stopped early — sizes are partial</span>}
              </>
            )
          )}
        </div>
      )}

      {!scan ? (
        <div className="placeholder-pane">
          <p>{scanning ? "Scanning…" : "See what's using your disk"}</p>
          <span>
            {scanning
              ? "Scanning your home folder. A whole drive can take a minute."
              : "Pick a drive or folder above and press Scan."}
          </span>
        </div>
      ) : (
        <div className="disk-usage">
          <div className="disk-usage-top">
            <div
              className="process-table disk-tree"
              style={{ ["--scrollbar-width" as string]: `${scrollbarWidth}px` }}
            >
              <div className="table-head">
                <div className="col col-du-name">Name</div>
                <div className="col col-size">Size</div>
                <div className="col col-percent">% of folder</div>
                <div className="col col-files">Files</div>
              </div>
              <div className="table-body">
                {rows.map(({ node, key, parentKey, depth }) => {
                  const parentSize = parentKey ? index.get(parentKey)?.node.size ?? 0 : node.size;
                  const pct = percent(node.size, parentSize);
                  const canExpand = node.kind === "dir" && node.children.length > 0;
                  return (
                    <div
                      key={key}
                      ref={(el) => {
                        if (el) rowRefs.current.set(key, el);
                        else rowRefs.current.delete(key);
                      }}
                      className={`row ${selected === key ? "selected" : ""} ${node.kind === "other" ? "dim" : ""}`}
                      onClick={() => setSelected(key)}
                      onDoubleClick={() => canExpand && toggle(key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelected(key);
                        setContextMenu({ x: e.clientX, y: e.clientY, key });
                      }}
                    >
                      <div className="col col-du-name" style={{ paddingLeft: depth * 18 }}>
                        {canExpand ? (
                          <span
                            className={`chevron inline ${expanded[key] ? "" : "collapsed"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(key);
                            }}
                          >
                            <IconChevronDown size={12} />
                          </span>
                        ) : (
                          <span className="chevron-spacer" />
                        )}
                        <span className="disk-node-icon" style={node.kind === "file" ? { color: colorFor(extensionOf(node.name), "file") } : undefined}>
                          {node.kind === "file" ? <IconFile size={14} /> : <IconFolder size={14} />}
                        </span>
                        <span className="disk-node-name">{node.name}</span>
                      </div>
                      <div className="col col-size">{formatSize(node.size)}</div>
                      <div className="col col-percent">
                        <span className="disk-bar">
                          <span className="disk-bar-fill" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="disk-bar-label">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="col col-files">{node.files.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="process-table disk-extensions"
              style={{ ["--scrollbar-width" as string]: `${scrollbarWidth}px` }}
            >
              <div className="table-head">
                <div className="col col-ext">Extension</div>
                <div className="col col-size">Size</div>
                <div className="col col-files">Files</div>
              </div>
              <div className="table-body">
                {scan.extensions.map((e) => (
                  <div
                    key={e.ext}
                    className={`row ${selectedExt === e.ext ? "selected" : ""}`}
                    onClick={() => setSelectedExt(selectedExt === e.ext ? null : e.ext)}
                    title={`${percent(e.size, totalExtSize).toFixed(1)}% of all file bytes`}
                  >
                    <div className="col col-ext">
                      <span className="ext-swatch" style={{ background: colorFor(e.ext, "file") }} />
                      {extLabel(e.ext)}
                    </div>
                    <div className="col col-size">{formatSize(e.size)}</div>
                    <div className="col col-files">{e.files.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Treemap
            root={scan.root}
            rootKey={scan.root.name}
            colorFor={colorFor}
            selectedKey={selected}
            selectedExt={selectedExt}
            onSelect={selectFromTreemap}
          />
        </div>
      )}

      {contextMenu && menuEntry && menuEntry.node.kind !== "other" && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuEntry.node.kind === "dir" && (
            <button
              className="context-menu-item"
              onClick={() => {
                setTarget(menuEntry.key);
                setContextMenu(null);
                startScan(menuEntry.key);
              }}
            >
              <IconSearch size={14} />
              Scan this folder
            </button>
          )}
          <button
            className="context-menu-item"
            onClick={() => {
              if (isTauri()) revealItemInDir(menuEntry.key).catch(() => {});
              setContextMenu(null);
            }}
          >
            <IconFolder size={14} />
            Show in file manager
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              navigator.clipboard?.writeText(menuEntry.key).catch(() => {});
              setContextMenu(null);
            }}
          >
            <IconFile size={14} />
            Copy path
          </button>
        </div>
      )}
    </>
  );
}
