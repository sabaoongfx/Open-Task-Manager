//! Renders `otm` screens for the website's terminal section from curated demo data (never the
//! real machine's processes or user names), through the real renderer, as coloured HTML.
//!
//! Regenerate after changing the TUI's look:
//!     cargo test -p otm export_website_demo -- --ignored
//! It rewrites the block between `<!-- otm-demo:start -->` and `<!-- otm-demo:end -->` in
//! website/index.html.

use crate::app::{App, Tab, HISTORY_LEN};
use crate::ui;
use otm_core::{AppHistoryEntry, CpuInfo, DiskInfo, NetworkInterface, ProcessInfo, SystemStats};
use ratatui::backend::TestBackend;
use ratatui::buffer::Buffer;
use ratatui::style::{Color, Modifier};
use ratatui::Terminal;
use std::fmt::Write as _;
use std::time::Duration;

const WIDTH: u16 = 118;
const HEIGHT: u16 = 30;
const GB: u64 = 1024 * 1024 * 1024;
const MB: u64 = 1024 * 1024;

/// Deterministic pseudo-random numbers (a tiny LCG) so the demo is identical on every run.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
}

fn process(pid: u32, name: &str, cpu: f32, mem_mb: u64, disk_mb: f64, user: &str) -> ProcessInfo {
    ProcessInfo {
        pid,
        name: name.to_string(),
        cpu_usage: cpu,
        memory: mem_mb * MB,
        disk_bytes_per_sec: disk_mb * MB as f64,
        status: "Sleeping".to_string(),
        user_name: Some(user.to_string()),
    }
}

fn demo_app() -> App {
    let mut app = App::new(Duration::from_millis(1500));
    let u = "alex";
    let mut processes = vec![
        process(2210, "Firefox", 9.8, 612, 0.4, u),
        process(2264, "Firefox", 6.1, 388, 0.0, u),
        process(2291, "Firefox", 3.4, 274, 0.0, u),
        process(2318, "Firefox", 1.2, 196, 0.0, u),
        process(2342, "Firefox", 0.6, 131, 0.0, u),
        process(3105, "Code", 4.9, 540, 1.8, u),
        process(3122, "Code", 2.2, 301, 0.0, u),
        process(3140, "Code", 0.8, 158, 0.0, u),
        process(4011, "Spotify", 2.6, 342, 0.1, u),
        process(4033, "Spotify", 0.9, 121, 0.0, u),
        process(4502, "Discord", 1.7, 410, 0.0, u),
        process(4519, "Discord", 0.4, 188, 0.0, u),
        process(1870, "Gnome Shell", 3.1, 472, 0.0, u),
        process(1655, "Xwayland", 1.1, 96, 0.0, u),
        process(5120, "Obsidian", 0.7, 265, 0.0, u),
        process(5301, "Kitty", 0.5, 88, 0.0, u),
        process(6010, "Otm", 0.3, 9, 0.0, u),
        process(5480, "Nautilus", 0.0, 142, 0.0, u),
        process(1, "Systemd", 0.0, 14, 0.0, "root"),
        process(402, "Systemd Journald", 0.2, 38, 0.3, "root"),
        process(911, "Dbus Daemon", 0.1, 6, 0.0, "messagebus"),
        process(1502, "Polkit Agent", 0.0, 31, 0.0, u),
        process(1733, "Upower Daemon", 0.0, 9, 0.0, "root"),
        process(1790, "Gsd Power Helper", 0.0, 27, 0.0, u),
    ];
    processes.sort_by_key(|p| p.pid);
    app.snapshot.processes = processes;

    app.snapshot.app_history = ["Firefox", "Code", "Gnome Shell", "Spotify", "Discord"]
        .iter()
        .zip([2941.0, 1720.0, 1103.0, 512.0, 388.0])
        .map(|(name, cpu_seconds)| AppHistoryEntry { name: name.to_string(), cpu_seconds })
        .collect();

    app.snapshot.stats = SystemStats {
        cpu_usage: 23.0,
        total_memory: 32 * GB,
        used_memory: 12 * GB + 700 * MB,
        total_swap: 8 * GB,
        used_swap: 0,
        disk_bytes_per_sec: 2.3 * MB as f64,
        disk_active_percent: 4.0,
        network_rx_bytes_per_sec: 1.9 * MB as f64,
        network_tx_bytes_per_sec: 0.2 * MB as f64,
        uptime_secs: 3 * 3600 + 12 * 60 + 40,
        process_count: 312,
        cpu_info: CpuInfo {
            brand: "Intel Core i7-1360P".to_string(),
            frequency_mhz: 3400,
            physical_cores: 12,
            logical_cores: 16,
        },
        disks: vec![
            DiskInfo {
                name: "nvme0n1p2".to_string(),
                mount_point: "/".to_string(),
                kind: "SSD".to_string(),
                total_bytes: 953 * GB,
                available_bytes: 612 * GB,
                active_percent: 4.0,
            },
            DiskInfo {
                name: "nvme0n1p1".to_string(),
                mount_point: "/boot/efi".to_string(),
                kind: "SSD".to_string(),
                total_bytes: GB,
                available_bytes: GB - 180 * MB,
                active_percent: 0.0,
            },
        ],
        network_interfaces: vec![
            NetworkInterface {
                name: "wlan0".to_string(),
                rx_bytes_per_sec: 1.9 * MB as f64,
                tx_bytes_per_sec: 0.2 * MB as f64,
            },
            NetworkInterface { name: "lo".to_string(), rx_bytes_per_sec: 0.0, tx_bytes_per_sec: 0.0 },
        ],
    };

    // A believable minute of history: a CPU that wanders, steady memory, bursty disk and network.
    let mut rng = Lcg(7);
    let h = &mut app.history;
    for series in [&mut h.cpu, &mut h.memory, &mut h.disk, &mut h.network] {
        series.clear();
    }
    for i in 0..HISTORY_LEN {
        let t = i as f64;
        h.cpu.push_back(22.0 + 10.0 * (t / 7.0).sin() + 8.0 * rng.next());
        h.memory.push_back(39.0 + 1.2 * (t / 20.0).sin() + 0.4 * rng.next());
        let disk_burst = if rng.next() > 0.8 { 6.0 * rng.next() } else { 0.3 * rng.next() };
        h.disk.push_back(disk_burst * MB as f64);
        h.network.push_back((0.8 + 1.4 * (t / 5.0).sin().abs() + 0.5 * rng.next()) * MB as f64);
    }

    app.expanded.insert("grp:Firefox".to_string());
    app.tab_state_mut(Tab::Processes).selected_key = Some("grp:Firefox".to_string());
    app
}

fn color_name(color: Color) -> Option<&'static str> {
    Some(match color {
        Color::Black => "black",
        Color::Red => "red",
        Color::Green => "green",
        Color::Yellow => "yellow",
        Color::Blue => "blue",
        Color::Magenta => "magenta",
        Color::Cyan => "cyan",
        Color::Gray => "gray",
        Color::DarkGray => "darkgray",
        Color::LightRed => "lightred",
        Color::White => "white",
        _ => return None,
    })
}

fn classes(cell: &ratatui::buffer::Cell) -> String {
    let mut c = Vec::new();
    if let Some(fg) = color_name(cell.fg) {
        c.push(format!("f-{fg}"));
    }
    if let Some(bg) = color_name(cell.bg) {
        c.push(format!("b-{bg}"));
    }
    if cell.modifier.contains(Modifier::BOLD) {
        c.push("bold".to_string());
    }
    if cell.modifier.contains(Modifier::UNDERLINED) {
        c.push("ul".to_string());
    }
    c.join(" ")
}

/// HTML-escapes, and wraps each Braille character (the graphs) in `<i>`: IBM Plex Mono has no
/// Braille glyphs, so browsers borrow them from a fallback font with a different advance width,
/// which skews every graph row. The site's CSS pins `.term-screen i` to exactly one cell (1ch).
fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\u{2800}'..='\u{28FF}' => {
                out.push_str("<i>");
                out.push(c);
                out.push_str("</i>");
            }
            c => out.push(c),
        }
    }
    out
}

/// Buffer → `<pre>` with one `<span class=…>` per run of identically styled cells.
fn to_html(buffer: &Buffer, screen: &str, label: &str, hidden: bool) -> String {
    let mut out = format!(
        "<pre class=\"term-screen\" data-screen=\"{screen}\" role=\"img\" aria-label=\"{label}\"{}>",
        if hidden { " hidden" } else { "" }
    );
    for y in 0..buffer.area.height {
        let mut run_class = String::new();
        let mut run_text = String::new();
        let flush = |out: &mut String, class: &str, text: &str| {
            if text.is_empty() {
                return;
            }
            if class.is_empty() {
                out.push_str(&escape(text));
            } else {
                let _ = write!(out, "<span class=\"{class}\">{}</span>", escape(text));
            }
        };
        for x in 0..buffer.area.width {
            let cell = &buffer[(x, y)];
            let class = classes(cell);
            if class != run_class {
                flush(&mut out, &run_class, &run_text);
                run_text.clear();
                run_class = class;
            }
            run_text.push_str(cell.symbol());
        }
        if run_class.is_empty() {
            run_text.truncate(run_text.trim_end().len()); // no trailing blanks at line ends
        }
        flush(&mut out, &run_class, &run_text);
        out.push('\n');
    }
    out.push_str("</pre>");
    out
}

fn render(app: &mut App, tab: Tab) -> Buffer {
    app.tab = tab;
    let mut terminal = Terminal::new(TestBackend::new(WIDTH, HEIGHT)).unwrap();
    terminal.draw(|frame| ui::draw(frame, app)).unwrap();
    terminal.backend().buffer().clone()
}

#[test]
#[ignore = "rewrites the otm demo in website/index.html; run manually after changing the TUI's look"]
fn export_website_demo() {
    let mut app = demo_app();
    let processes = render(&mut app, Tab::Processes);
    let performance = render(&mut app, Tab::Performance);
    let block = format!(
        "<!-- otm-demo:start (generated by `cargo test -p otm export_website_demo -- --ignored`; do not edit) -->\n{}\n{}\n<!-- otm-demo:end -->",
        to_html(&processes, "processes", "otm showing the Processes tab: apps grouped by name, sorted by CPU", false),
        to_html(&performance, "performance", "otm showing the Performance tab: live CPU, memory, disk and network graphs", true),
    );

    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../website/index.html");
    let html = std::fs::read_to_string(path).unwrap();
    let start = html.find("<!-- otm-demo:start").expect("otm-demo:start marker in website/index.html");
    let end_marker = "<!-- otm-demo:end -->";
    let end = html.find(end_marker).expect("otm-demo:end marker") + end_marker.len();
    std::fs::write(path, format!("{}{}{}", &html[..start], block, &html[end..])).unwrap();
}
