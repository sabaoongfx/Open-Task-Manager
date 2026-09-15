import type { Snapshot } from "./types";

interface Seed {
  pid: number;
  name: string;
  baseCpu: number;
  baseMem: number;
  baseDisk: number;
}

function mb(n: number) {
  return n * 1024 * 1024;
}

let seedState: Seed[] = [
  { pid: 1000, name: "Google Chrome", baseCpu: 8, baseMem: mb(900), baseDisk: mb(0.4) },
  { pid: 1001, name: "Google Chrome", baseCpu: 3, baseMem: mb(320), baseDisk: mb(0.1) },
  { pid: 1002, name: "Google Chrome", baseCpu: 1.5, baseMem: mb(210), baseDisk: 0 },
  { pid: 1003, name: "Google Chrome", baseCpu: 0.4, baseMem: mb(180), baseDisk: 0 },
  { pid: 1004, name: "Google Chrome", baseCpu: 0.2, baseMem: mb(160), baseDisk: 0 },
  { pid: 1007, name: "Microsoft Edge", baseCpu: 3, baseMem: mb(300), baseDisk: mb(0.05) },
  { pid: 1008, name: "Microsoft Edge", baseCpu: 0.9, baseMem: mb(140), baseDisk: 0 },
  { pid: 1014, name: "Notepad", baseCpu: 0, baseMem: mb(17), baseDisk: 0 },
  { pid: 1021, name: "Task Manager", baseCpu: 1.3, baseMem: mb(57), baseDisk: 0 },
  { pid: 1028, name: "Visual Studio Code", baseCpu: 0.1, baseMem: mb(219), baseDisk: mb(0.02) },
  { pid: 1035, name: "Spotify", baseCpu: 0.1, baseMem: mb(786), baseDisk: mb(0.15) },
  { pid: 1042, name: "Antimalware Service Executable", baseCpu: 0.1, baseMem: mb(12), baseDisk: mb(0.3) },
  { pid: 1049, name: "System", baseCpu: 0.2, baseMem: mb(4), baseDisk: mb(0.05) },
  { pid: 1056, name: "svchost.exe", baseCpu: 0.6, baseMem: mb(2), baseDisk: 0 },
  { pid: 1057, name: "svchost.exe", baseCpu: 0.1, baseMem: mb(3), baseDisk: 0 },
  { pid: 1058, name: "svchost.exe", baseCpu: 0.1, baseMem: mb(5), baseDisk: 0 },
  { pid: 1063, name: "crashpad_handler", baseCpu: 0.1, baseMem: mb(3), baseDisk: 0 },
  { pid: 1064, name: "crashpad_handler", baseCpu: 0.1, baseMem: mb(1), baseDisk: 0 },
  { pid: 1070, name: "COM Surrogate", baseCpu: 0.2, baseMem: mb(30), baseDisk: 0 },
  { pid: 1071, name: "COM Surrogate", baseCpu: 0.1, baseMem: mb(2), baseDisk: 0 },
  { pid: 1077, name: "Registry", baseCpu: 0.4, baseMem: mb(8), baseDisk: 0 },
  { pid: 1084, name: "Runtime Broker", baseCpu: 0.3, baseMem: mb(8), baseDisk: 0 },
  { pid: 1091, name: "Desktop Window Manager", baseCpu: 0.4, baseMem: mb(8), baseDisk: 0 },
  { pid: 1098, name: "Explorer", baseCpu: 0.5, baseMem: mb(8), baseDisk: mb(0.02) },
];

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function mockKill(pid: number) {
  seedState = seedState.filter((p) => p.pid !== pid);
  return true;
}

export function mockSnapshot(): Snapshot {
  const processes = seedState.map((p) => ({
    pid: p.pid,
    name: p.name,
    cpu_usage: Math.max(0, p.baseCpu + (Math.random() - 0.5) * p.baseCpu * 0.4),
    memory: Math.max(0, p.baseMem + (Math.random() - 0.5) * p.baseMem * 0.05),
    disk_bytes_per_sec: Math.max(0, p.baseDisk + (Math.random() - 0.5) * (p.baseDisk || 1) * 0.6),
  }));

  const totalMemory = 16 * 1024 * 1024 * 1024;
  const usedMemory = seedState.reduce((sum, p) => sum + p.baseMem, 0) * 1.3;
  const cpu = Math.min(
    100,
    seedState.reduce((sum, p) => sum + p.baseCpu, 0) + Math.random() * 3
  );

  return {
    processes,
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
