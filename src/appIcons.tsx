const rawIcons = import.meta.glob("./assets/brand-icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

interface BrandIcon {
  slug: string;
  path: string;
  /** SVG fill: the brand color, or the text color for near-black brands (see isNearBlack). */
  fill: string;
}

function parsePath(svg: string): string {
  return svg.match(/<path d="([^"]+)"/)?.[1] ?? "";
}

const HEX_BY_SLUG: Record<string, string> = {
  googlechrome: "4285F4",
  firefox: "FF7139",
  spotify: "1ED760",
  discord: "5865F2",
  docker: "2496ED",
  git: "F05032",
  nodedotjs: "5FA04E",
  python: "3776AB",
  rust: "000000",
  steam: "000000",
  telegram: "26A5E4",
  vlcmediaplayer: "FF8800",
  thunderbird: "0A84FF",
  obsstudio: "302E31",
  virtualbox: "183A61",
  postman: "FF6C37",
  figma: "F24E1E",
  notion: "000000",
  obsidian: "7C3AED",
  brave: "FB542B",
  opera: "FF1B2D",
  signal: "3A76F0",
  libreoffice: "18A303",
  vim: "019733",
  neovim: "57A143",
  sublimetext: "FF9800",
  intellijidea: "000000",
  pycharm: "000000",
  androidstudio: "3DDC84",
  htop: "009020",
  gimp: "5C5543",
  blender: "F5792A",
  inkscape: "000000",
  audacity: "0000CC",
  wireshark: "1679A7",
  qbittorrent: "2F67BA",
  transmission: "D70000",
  zoom: "0B5CFF",
  whatsapp: "25D366",
  gnome: "4A86CF",
  kde: "1D99F3",
  claude: "D97757",
  gnometerminal: "241F31",
  "1password": "145FE4",
  alacritty: "F46D01",
  ardour: "C61C3E",
  bitwarden: "175DDC",
  bun: "000000",
  caddy: "1F88C0",
  cinnamon: "DC682E",
  clion: "000000",
  containerd: "575757",
  deno: "000000",
  element: "0DBD8B",
  ffmpeg: "007808",
  fishshell: "34C534",
  flatpak: "4A90D9",
  gitkraken: "179287",
  github: "181717",
  gnubash: "4EAA25",
  gnuemacs: "7F5AB6",
  godotengine: "478CBF",
  goland: "000000",
  grafana: "F46800",
  helix: "281733",
  hyprland: "58E1FF",
  i3: "52C0FF",
  influxdb: "22ADF6",
  insomnia: "4000BF",
  jellyfin: "00A4DC",
  jetbrains: "000000",
  joplin: "1071D3",
  kdenlive: "527EB2",
  keepassxc: "6CAC4D",
  kodi: "17B2E7",
  krita: "3BABFF",
  librewolf: "00ACFF",
  lmms: "10B146",
  logseq: "85C8C8",
  lutris: "FF9900",
  mariadb: "003545",
  mattermost: "0058CC",
  mongodb: "47A248",
  mpv: "691F69",
  mumble: "000000",
  mysql: "4479A1",
  nextcloud: "0082C9",
  nginx: "009639",
  notepadplusplus: "90E59A",
  onlyoffice: "444444",
  openvpn: "EA7E20",
  owncloud: "041E42",
  perl: "0073A1",
  php: "777BB4",
  plex: "EBAF00",
  podman: "892CA0",
  postgresql: "4169E1",
  prometheus: "E6522C",
  qemu: "FF6600",
  redis: "FF4438",
  rider: "000000",
  ruby: "CC342D",
  seafile: "FF9800",
  snapcraft: "E95420",
  sourcetree: "0052CC",
  sway: "68751C",
  syncthing: "0891D1",
  tailscale: "242424",
  tmux: "1BB91F",
  todoist: "E44332",
  torbrowser: "7D4698",
  vault: "FFEC6E",
  vivaldi: "EF3939",
  vmware: "607078",
  webstorm: "000000",
  wezterm: "4E49EE",
  xfce: "2284F2",
  zotero: "CC2936",
  zsh: "F15A24",
  zulip: "6492FE",
};

// Near-black brand colors (GNOME Terminal, Rust, Steam, ...) vanish on the dark theme; those
// follow the text color instead.
function isNearBlack(hex: string): boolean {
  const n = parseInt(hex, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 60;
}

const ICONS: Record<string, BrandIcon> = {};
for (const [filePath, svg] of Object.entries(rawIcons)) {
  const slug = filePath.split("/").pop()!.replace(".svg", "");
  const hex = HEX_BY_SLUG[slug] ?? "888888";
  ICONS[slug] = { slug, path: parsePath(svg), fill: isNearBlack(hex) ? "currentColor" : `#${hex}` };
}

interface Rule {
  tokens: string[];
  slug: string;
}

const RULES: Rule[] = [
  { tokens: ["chrome", "google-chrome", "chromium"], slug: "googlechrome" },
  { tokens: ["firefox"], slug: "firefox" },
  { tokens: ["spotify"], slug: "spotify" },
  { tokens: ["discord"], slug: "discord" },
  { tokens: ["docker", "dockerd"], slug: "docker" },
  { tokens: ["git", "gitstatusd"], slug: "git" },
  { tokens: ["claude"], slug: "claude" },
  { tokens: ["node"], slug: "nodedotjs" },
  { tokens: ["python", "python3"], slug: "python" },
  { tokens: ["rust", "rustc", "cargo"], slug: "rust" },
  { tokens: ["steam"], slug: "steam" },
  { tokens: ["telegram"], slug: "telegram" },
  { tokens: ["vlc"], slug: "vlcmediaplayer" },
  { tokens: ["thunderbird"], slug: "thunderbird" },
  { tokens: ["obs"], slug: "obsstudio" },
  { tokens: ["virtualbox", "vboxheadless", "vboxsvc"], slug: "virtualbox" },
  { tokens: ["postman"], slug: "postman" },
  { tokens: ["figma"], slug: "figma" },
  { tokens: ["notion"], slug: "notion" },
  { tokens: ["obsidian"], slug: "obsidian" },
  { tokens: ["brave"], slug: "brave" },
  { tokens: ["opera"], slug: "opera" },
  { tokens: ["signal"], slug: "signal" },
  { tokens: ["libreoffice", "soffice"], slug: "libreoffice" },
  { tokens: ["nvim", "neovim"], slug: "neovim" },
  { tokens: ["vim"], slug: "vim" },
  { tokens: ["subl", "sublime_text", "sublimetext"], slug: "sublimetext" },
  { tokens: ["idea", "intellij"], slug: "intellijidea" },
  { tokens: ["pycharm"], slug: "pycharm" },
  { tokens: ["android-studio", "androidstudio"], slug: "androidstudio" },
  { tokens: ["htop"], slug: "htop" },
  { tokens: ["gimp"], slug: "gimp" },
  { tokens: ["blender"], slug: "blender" },
  { tokens: ["inkscape"], slug: "inkscape" },
  { tokens: ["audacity"], slug: "audacity" },
  { tokens: ["wireshark"], slug: "wireshark" },
  { tokens: ["qbittorrent"], slug: "qbittorrent" },
  { tokens: ["transmission-gtk", "transmission"], slug: "transmission" },
  { tokens: ["zoom"], slug: "zoom" },
  { tokens: ["whatsapp"], slug: "whatsapp" },
  { tokens: ["1password"], slug: "1password" },
  { tokens: ["alacritty"], slug: "alacritty" },
  { tokens: ["ardour"], slug: "ardour" },
  { tokens: ["bitwarden"], slug: "bitwarden" },
  { tokens: ["bun"], slug: "bun" },
  { tokens: ["caddy"], slug: "caddy" },
  { tokens: ["cinnamon"], slug: "cinnamon" },
  { tokens: ["clion"], slug: "clion" },
  { tokens: ["containerd"], slug: "containerd" },
  { tokens: ["deno"], slug: "deno" },
  { tokens: ["element"], slug: "element" },
  { tokens: ["ffmpeg", "ffprobe"], slug: "ffmpeg" },
  { tokens: ["fish"], slug: "fishshell" },
  { tokens: ["flatpak"], slug: "flatpak" },
  { tokens: ["gitkraken"], slug: "gitkraken" },
  { tokens: ["github desktop"], slug: "github" },
  { tokens: ["bash"], slug: "gnubash" },
  { tokens: ["emacs"], slug: "gnuemacs" },
  { tokens: ["godot"], slug: "godotengine" },
  { tokens: ["goland"], slug: "goland" },
  { tokens: ["grafana"], slug: "grafana" },
  { tokens: ["hx", "helix"], slug: "helix" },
  { tokens: ["hyprland"], slug: "hyprland" },
  { tokens: ["i3", "i3bar"], slug: "i3" },
  { tokens: ["influxd", "influxdb"], slug: "influxdb" },
  { tokens: ["insomnia"], slug: "insomnia" },
  { tokens: ["jellyfin"], slug: "jellyfin" },
  { tokens: ["jetbrains toolbox"], slug: "jetbrains" },
  { tokens: ["joplin"], slug: "joplin" },
  { tokens: ["kdenlive"], slug: "kdenlive" },
  { tokens: ["keepassxc"], slug: "keepassxc" },
  { tokens: ["kodi"], slug: "kodi" },
  { tokens: ["krita"], slug: "krita" },
  { tokens: ["librewolf"], slug: "librewolf" },
  { tokens: ["lmms"], slug: "lmms" },
  { tokens: ["logseq"], slug: "logseq" },
  { tokens: ["lutris"], slug: "lutris" },
  { tokens: ["mariadbd", "mariadb"], slug: "mariadb" },
  { tokens: ["mattermost"], slug: "mattermost" },
  { tokens: ["mongod", "mongodb", "mongosh"], slug: "mongodb" },
  { tokens: ["mpv"], slug: "mpv" },
  { tokens: ["mumble"], slug: "mumble" },
  { tokens: ["mysqld", "mysql"], slug: "mysql" },
  { tokens: ["nextcloud"], slug: "nextcloud" },
  { tokens: ["nginx"], slug: "nginx" },
  { tokens: ["notepad++"], slug: "notepadplusplus" },
  { tokens: ["onlyoffice", "desktopeditors"], slug: "onlyoffice" },
  { tokens: ["openvpn"], slug: "openvpn" },
  { tokens: ["owncloud"], slug: "owncloud" },
  { tokens: ["perl"], slug: "perl" },
  { tokens: ["php"], slug: "php" },
  { tokens: ["plex"], slug: "plex" },
  { tokens: ["podman", "conmon"], slug: "podman" },
  { tokens: ["postgres", "postmaster", "postgresql"], slug: "postgresql" },
  { tokens: ["prometheus"], slug: "prometheus" },
  { tokens: ["qemu"], slug: "qemu" },
  { tokens: ["redis"], slug: "redis" },
  { tokens: ["rider"], slug: "rider" },
  { tokens: ["ruby"], slug: "ruby" },
  { tokens: ["seafile", "seaf daemon"], slug: "seafile" },
  { tokens: ["snapd"], slug: "snapcraft" },
  { tokens: ["sourcetree"], slug: "sourcetree" },
  { tokens: ["sway", "swaybar"], slug: "sway" },
  { tokens: ["syncthing"], slug: "syncthing" },
  { tokens: ["tailscaled", "tailscale"], slug: "tailscale" },
  { tokens: ["tmux"], slug: "tmux" },
  { tokens: ["todoist"], slug: "todoist" },
  { tokens: ["tor browser", "torbrowser"], slug: "torbrowser" },
  { tokens: ["vault"], slug: "vault" },
  { tokens: ["vivaldi"], slug: "vivaldi" },
  { tokens: ["vmware"], slug: "vmware" },
  { tokens: ["webstorm"], slug: "webstorm" },
  { tokens: ["wezterm"], slug: "wezterm" },
  { tokens: ["xfce4", "xfwm4", "xfdesktop"], slug: "xfce" },
  { tokens: ["zotero"], slug: "zotero" },
  { tokens: ["zsh"], slug: "zsh" },
  { tokens: ["zulip"], slug: "zulip" },
  { tokens: ["gnome terminal"], slug: "gnometerminal" },
  { tokens: ["gnome"], slug: "gnome" },
  {
    tokens: [
      "plasmashell", "kwin", "kde", "konsole", "kioworker", "kiod6",
      "kded5", "kded6", "kaccess", "ksecretd", "kwalletd5", "kwalletd6", "kactivitymanagerd",
      "ksmserver", "krunner", "kscreen", "ksystemstats", "kglobalacceld", "kdeconnectd", "dolphin",
      "kate", "okular", "spectacle", "gwenview", "ark", "systemsettings", "powerdevil", "baloo_file",
    ],
    slug: "kde",
  },
];

// Process names arrive either raw ("gnome-terminal-server") or prettified ("Gnome Terminal
// Server"), so "-" and "_" count as spaces on both sides of the match.
function normalize(text: string): string {
  return text.toLowerCase().replace(/[-_]+/g, " ");
}

const COMPILED = RULES.map((rule) => ({
  slug: rule.slug,
  patterns: rule.tokens.map(
    (token) =>
      new RegExp(`(^|[^a-z0-9])${normalize(token).replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z0-9]|$)`)
  ),
}));

// Every row asks on every refresh, so remember the answer per name instead of re-running
// ~120 patterns for hundreds of rows every 1.5 seconds.
const lookupCache = new Map<string, BrandIcon | null>();

// This app itself (the GUI's process and otm) shows its own logo, not a brand icon.
const OWN_NAMES = new Set(["open task manager", "otm"]);
const OWN_ICON: BrandIcon = { slug: "open-task-manager", path: "", fill: "" };

export function findBrandIcon(name: string): BrandIcon | null {
  const cached = lookupCache.get(name);
  if (cached !== undefined) return cached;
  const text = normalize(name);
  const icon = OWN_NAMES.has(text)
    ? OWN_ICON
    : ICONS[COMPILED.find((r) => r.patterns.some((p) => p.test(text)))?.slug ?? ""] ?? null;
  lookupCache.set(name, icon);
  return icon;
}

export function ProcIcon({ name, size = 20 }: { name: string; size?: number }) {
  const brand = findBrandIcon(name);
  if (brand === OWN_ICON) {
    // Relative, not "/...": the website embeds this build under a subfolder (see CLAUDE.md).
    return <img src="open%20task%20manager.svg" width={size} height={size} className="proc-icon-svg" alt="" />;
  }
  if (brand) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="proc-icon-svg"
        aria-hidden="true"
      >
        <path d={brand.path} fill={brand.fill} />
      </svg>
    );
  }
  return (
    <span className="proc-icon-fallback" style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
