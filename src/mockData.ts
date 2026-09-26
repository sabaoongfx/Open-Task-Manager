import type { DiskNode, DiskScan, ExtensionStat, ServiceInfo, Snapshot, StartupAppInfo } from "./types";

interface Seed {
  pid: number;
  name: string;
  baseCpu: number;
  baseMem: number;
  baseDisk: number;
  user: string;
}

function mb(n: number) {
  return n * 1024 * 1024;
}

let seedState: Seed[] = [
  { pid: 1000, name: "Google Chrome", baseCpu: 8, baseMem: mb(900), baseDisk: mb(0.4), user: "sabaoongfx" },
  { pid: 1001, name: "Google Chrome", baseCpu: 3, baseMem: mb(320), baseDisk: mb(0.1), user: "sabaoongfx" },
  { pid: 1002, name: "Google Chrome", baseCpu: 1.5, baseMem: mb(210), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1003, name: "Google Chrome", baseCpu: 0.4, baseMem: mb(180), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1004, name: "Google Chrome", baseCpu: 0.2, baseMem: mb(160), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1007, name: "Microsoft Edge", baseCpu: 3, baseMem: mb(300), baseDisk: mb(0.05), user: "sabaoongfx" },
  { pid: 1008, name: "Microsoft Edge", baseCpu: 0.9, baseMem: mb(140), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1014, name: "Notepad", baseCpu: 0, baseMem: mb(17), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1021, name: "Task Manager", baseCpu: 1.3, baseMem: mb(57), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1028, name: "Visual Studio Code", baseCpu: 0.1, baseMem: mb(219), baseDisk: mb(0.02), user: "sabaoongfx" },
  { pid: 1035, name: "Spotify", baseCpu: 0.1, baseMem: mb(786), baseDisk: mb(0.15), user: "sabaoongfx" },
  { pid: 1042, name: "Antimalware Service Executable", baseCpu: 0.1, baseMem: mb(12), baseDisk: mb(0.3), user: "SYSTEM" },
  { pid: 1049, name: "System", baseCpu: 0.2, baseMem: mb(4), baseDisk: mb(0.05), user: "SYSTEM" },
  { pid: 1056, name: "svchost.exe", baseCpu: 0.6, baseMem: mb(2), baseDisk: 0, user: "SYSTEM" },
  { pid: 1057, name: "svchost.exe", baseCpu: 0.1, baseMem: mb(3), baseDisk: 0, user: "SYSTEM" },
  { pid: 1058, name: "svchost.exe", baseCpu: 0.1, baseMem: mb(5), baseDisk: 0, user: "LOCAL SERVICE" },
  { pid: 1063, name: "crashpad_handler", baseCpu: 0.1, baseMem: mb(3), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1064, name: "crashpad_handler", baseCpu: 0.1, baseMem: mb(1), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1070, name: "COM Surrogate", baseCpu: 0.2, baseMem: mb(30), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1071, name: "COM Surrogate", baseCpu: 0.1, baseMem: mb(2), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1077, name: "Registry", baseCpu: 0.4, baseMem: mb(8), baseDisk: 0, user: "SYSTEM" },
  { pid: 1084, name: "Runtime Broker", baseCpu: 0.3, baseMem: mb(8), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1091, name: "Desktop Window Manager", baseCpu: 0.4, baseMem: mb(8), baseDisk: 0, user: "sabaoongfx" },
  { pid: 1098, name: "Explorer", baseCpu: 0.5, baseMem: mb(8), baseDisk: mb(0.02), user: "sabaoongfx" },
];

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function mockKill(pid: number) {
  seedState = seedState.filter((p) => p.pid !== pid);
  return true;
}

let appCpuSeconds: Record<string, number> = {};

export function mockResetAppHistory() {
  appCpuSeconds = {};
}

export function mockServices(): ServiceInfo[] {
  return [
    { name: "AudioEndpointBuilder", description: "Windows Audio Endpoint Builder", status: "Running" },
    { name: "BITS", description: "Background Intelligent Transfer Service", status: "Stopped" },
    { name: "Dnscache", description: "DNS Client", status: "Running" },
    { name: "EventLog", description: "Windows Event Log", status: "Running" },
    { name: "LanmanServer", description: "Server", status: "Running" },
    { name: "LanmanWorkstation", description: "Workstation", status: "Running" },
    { name: "PlugPlay", description: "Plug and Play", status: "Running" },
    { name: "Schedule", description: "Task Scheduler", status: "Running" },
    { name: "Spooler", description: "Print Spooler", status: "Stopped" },
    { name: "Themes", description: "Themes", status: "Running" },
    { name: "W32Time", description: "Windows Time", status: "Stopped" },
    { name: "WcmSvc", description: "Windows Connection Manager", status: "Running" },
    { name: "WinDefend", description: "Microsoft Defender Antivirus Service", status: "Running" },
    { name: "wuauserv", description: "Windows Update", status: "Stopped" },
  ];
}

export function mockStartupApps(): StartupAppInfo[] {
  return [
    { name: "Google Chrome", publisher: "Google LLC", enabled: true },
    { name: "Microsoft Edge", publisher: "Microsoft Corporation", enabled: true },
    { name: "Spotify", publisher: "Spotify AB", enabled: true },
    { name: "Visual Studio Code", publisher: "Microsoft Corporation", enabled: false },
    { name: "Steam", publisher: "Valve Corporation", enabled: false },
    { name: "Discord", publisher: "Discord Inc.", enabled: true },
    { name: "OneDrive", publisher: "Microsoft Corporation", enabled: true },
    { name: "NVIDIA GeForce Experience", publisher: "NVIDIA Corporation", enabled: false },
  ];
}

export function mockSnapshot(): Snapshot {
  const processes = seedState.map((p) => ({
    pid: p.pid,
    name: p.name,
    cpu_usage: Math.max(0, p.baseCpu + (Math.random() - 0.5) * p.baseCpu * 0.4),
    memory: Math.max(0, p.baseMem + (Math.random() - 0.5) * p.baseMem * 0.05),
    disk_bytes_per_sec: Math.max(0, p.baseDisk + (Math.random() - 0.5) * (p.baseDisk || 1) * 0.6),
    status: "Running",
    user_name: p.user,
  }));

  for (const p of processes) {
    appCpuSeconds[p.name] = (appCpuSeconds[p.name] ?? 0) + (p.cpu_usage / 100) * 1.5;
  }
  const app_history = Object.entries(appCpuSeconds)
    .map(([name, cpu_seconds]) => ({ name, cpu_seconds }))
    .sort((a, b) => b.cpu_seconds - a.cpu_seconds);

  const totalMemory = 16 * 1024 * 1024 * 1024;
  const usedMemory = seedState.reduce((sum, p) => sum + p.baseMem, 0) * 1.3;
  const cpu = Math.min(
    100,
    seedState.reduce((sum, p) => sum + p.baseCpu, 0) + Math.random() * 3
  );

  return {
    processes,
    app_history,
    stats: {
      cpu_usage: cpu,
      total_memory: totalMemory,
      used_memory: usedMemory,
      total_swap: mb(4096),
      used_swap: mb(320) + Math.random() * mb(40),
      disk_bytes_per_sec: processes.reduce((sum, p) => sum + p.disk_bytes_per_sec, 0),
      disk_active_percent: Math.min(100, 8 + Math.random() * 10),
      uptime_secs: 5025,
      process_count: processes.length,
      cpu_info: {
        brand: "AMD Ryzen 7 5800H",
        frequency_mhz: 3200 + Math.round(Math.random() * 600),
        physical_cores: 8,
        logical_cores: 16,
      },
      disks: [
        {
          name: "nvme0n1",
          mount_point: "/",
          kind: "SSD",
          total_bytes: 512 * 1024 * 1024 * 1024,
          available_bytes: 210 * 1024 * 1024 * 1024,
          active_percent: Math.min(100, 8 + Math.random() * 10),
        },
      ],
      network_interfaces: [
        {
          name: "wlan0",
          rx_bytes_per_sec: mb(1.2) + Math.random() * mb(0.6),
          tx_bytes_per_sec: mb(0.15) + Math.random() * mb(0.1),
        },
      ],
      network_rx_bytes_per_sec: mb(1.2) + Math.random() * mb(0.6),
      network_tx_bytes_per_sec: mb(0.15) + Math.random() * mb(0.1),
    },
  };
}

function mockFile(name: string, sizeMb: number): DiskNode {
  return { name, kind: "file", size: mb(sizeMb), files: 1, children: [] };
}

function mockDir(name: string, children: DiskNode[]): DiskNode {
  const sorted = [...children].sort((a, b) => b.size - a.size);
  return {
    name,
    kind: "dir",
    size: sorted.reduce((sum, c) => sum + c.size, 0),
    files: sorted.reduce((sum, c) => sum + c.files, 0),
    children: sorted,
  };
}

function mockSeries(prefix: string, ext: string, count: number, baseMb: number): DiskNode[] {
  return Array.from({ length: count }, (_, i) =>
    mockFile(`${prefix}-${String(i + 1).padStart(3, "0")}.${ext}`, baseMb * (1 + ((i * 37) % 11) / 5))
  );
}

function mockOther(count: number, sizeMb: number): DiskNode {
  return { name: `${count} smaller items`, kind: "other", size: mb(sizeMb), files: count, children: [] };
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 && i + 1 < name.length ? name.slice(i + 1).toLowerCase() : "";
}

let mockScanFiles = 0;

// A made-up home folder (never the real machine's), the same shape `scan_disk` returns.
export async function mockDiskScan(path: string | null): Promise<DiskScan> {
  const rootPath = path || "/home/user";
  mockScanFiles = 0;
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 150));
    mockScanFiles += 31_000;
  }
  const root = mockDir(rootPath, [
    mockDir("Videos", [
      mockDir("Holiday 2025", mockSeries("clip", "mp4", 14, 850)),
      mockFile("Big Buck Bunny.mkv", 4200),
      mockFile("screen-recording.webm", 1800),
    ]),
    mockDir("Games", [
      mockDir("SteamLibrary", [
        mockDir("Portal 2", [...mockSeries("pak", "vpk", 20, 380), mockOther(812, 240)]),
        mockDir("Celeste", [mockFile("Celeste.bin", 1200), ...mockSeries("audio", "bank", 6, 90)]),
      ]),
    ]),
    mockDir("Pictures", [
      mockDir("Camera", mockSeries("IMG", "jpg", 60, 6)),
      mockDir("Raw", mockSeries("DSC", "raw", 30, 28)),
      mockOther(2140, 310),
    ]),
    mockDir("Documents", [
      mockDir("Projects", [
        mockDir("open-task-manager", [
          mockDir("node_modules", [mockOther(18_430, 420)]),
          mockDir("target", [mockFile("otm", 18), mockOther(5_210, 1900)]),
        ]),
      ]),
      mockDir("Invoices", mockSeries("invoice", "pdf", 40, 0.8)),
      mockFile("thesis.docx", 45),
    ]),
    mockDir("Music", [
      mockDir("Albums", mockSeries("track", "flac", 48, 32)),
      mockDir("Podcasts", mockSeries("episode", "mp3", 25, 55)),
    ]),
    mockDir(".cache", [
      mockDir("mozilla", [mockOther(9_800, 950)]),
      mockDir("yarn", [mockOther(12_100, 1400)]),
    ]),
    mockDir("Downloads", [
      mockFile("ubuntu-24.04-desktop-amd64.iso", 5800),
      mockFile("archlinux-x86_64.iso", 1150),
      ...mockSeries("setup", "zip", 8, 120),
    ]),
    mockFile(".bash_history", 0.2),
  ]);

  const byExt = new Map<string, ExtensionStat>();
  (function tally(node: DiskNode) {
    if (node.kind === "dir") return node.children.forEach(tally);
    if (node.kind !== "file") return;
    const ext = extensionOf(node.name);
    const stat = byExt.get(ext) ?? { ext, size: 0, files: 0 };
    stat.size += node.size;
    stat.files += 1;
    byExt.set(ext, stat);
  })(root);
  const extensions = [...byExt.values()].sort((a, b) => b.size - a.size);

  return { path: rootPath, root, extensions, errors: path ? 0 : 3, cancelled: false };
}

export function mockDiskScanProgress(): number {
  return mockScanFiles;
}
