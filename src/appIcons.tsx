const rawIcons = import.meta.glob("./assets/brand-icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

interface BrandIcon {
  path: string;
  hex: string;
}

function parseIcon(svg: string): BrandIcon {
  const pathMatch = svg.match(/<path d="([^"]+)"/);
  return { path: pathMatch?.[1] ?? "", hex: "888888" };
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
};

const ICONS: Record<string, BrandIcon> = {};
for (const [filePath, svg] of Object.entries(rawIcons)) {
  const slug = filePath.split("/").pop()!.replace(".svg", "");
  const parsed = parseIcon(svg);
  ICONS[slug] = { path: parsed.path, hex: HEX_BY_SLUG[slug] ?? "888888" };
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
  { tokens: ["git"], slug: "git" },
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
  { tokens: ["gnome-shell", "gnome-terminal", "gnome"], slug: "gnome" },
  { tokens: ["plasmashell", "kwin_x11", "kwin_wayland", "kwin", "kde"], slug: "kde" },
];

function hasToken(name: string, token: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-z0-9]|$)`, "i");
  return pattern.test(name);
}

export function findBrandIcon(name: string): BrandIcon | null {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.tokens.some((token) => hasToken(lower, token))) {
      return ICONS[rule.slug] ?? null;
    }
  }
  return null;
}

export function ProcIcon({ name, size = 20 }: { name: string; size?: number }) {
  const brand = findBrandIcon(name);
  if (brand && brand.path) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="proc-icon-svg"
        aria-hidden="true"
      >
        <path d={brand.path} fill={`#${brand.hex}`} />
      </svg>
    );
  }
  return (
    <span className="proc-icon-fallback" style={{ width: size, height: size }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
