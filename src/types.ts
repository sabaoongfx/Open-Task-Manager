export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory: number;
  disk_bytes_per_sec: number;
  status: string;
  user_name: string | null;
}

export interface CpuInfo {
  brand: string;
  frequency_mhz: number;
  physical_cores: number;
  logical_cores: number;
}

export interface DiskInfo {
  name: string;
  mount_point: string;
  kind: string;
  total_bytes: number;
  available_bytes: number;
  active_percent: number;
}

export interface NetworkInterface {
  name: string;
  rx_bytes_per_sec: number;
  tx_bytes_per_sec: number;
}

export interface SystemStats {
  cpu_usage: number;
  total_memory: number;
  used_memory: number;
  total_swap: number;
  used_swap: number;
  disk_bytes_per_sec: number;
  disk_active_percent: number;
  network_rx_bytes_per_sec: number;
  network_tx_bytes_per_sec: number;
  uptime_secs: number;
  process_count: number;
  cpu_info: CpuInfo;
  disks: DiskInfo[];
  network_interfaces: NetworkInterface[];
}

export interface AppHistoryEntry {
  name: string;
  cpu_seconds: number;
}

export interface Snapshot {
  processes: ProcessInfo[];
  stats: SystemStats;
  app_history: AppHistoryEntry[];
}

export interface ServiceInfo {
  name: string;
  description: string;
  status: string;
}

export interface StartupAppInfo {
  name: string;
  publisher: string;
  enabled: boolean;
}

export interface DiskNode {
  name: string;
  kind: "dir" | "file" | "other";
  size: number;
  files: number;
  children: DiskNode[];
}

export interface ExtensionStat {
  ext: string;
  size: number;
  files: number;
}

export interface DiskScan {
  path: string;
  root: DiskNode;
  extensions: ExtensionStat[];
  errors: number;
  cancelled: boolean;
}
