//! Turns app data into generic table views, one builder per tab. Each builder mirrors the
//! grouping and columns of the matching GUI pane (App.tsx's Processes view, Users.tsx, ...).

use crate::app::{App, SortKey, Tab};
use crate::format;
use otm_core::ProcessInfo;
use ratatui::layout::{Alignment, Constraint};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::Cell;
use std::cmp::Ordering;
use std::collections::BTreeMap;

pub struct Column {
    pub title: &'static str,
    pub width: Constraint,
    pub sort: Option<SortKey>,
    pub right: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Toggle {
    None,
    /// A group row that expands to show its members (collapsed by default).
    Expand,
    /// A section header that collapses its contents (expanded by default).
    Section,
}

pub struct ViewRow {
    /// Stable identity used to keep the selection on the same item across refreshes.
    pub key: String,
    /// Human-readable name for the end-task confirmation.
    pub label: String,
    /// Processes that "End task" on this row would kill (empty = not killable).
    pub pids: Vec<u32>,
    pub toggle: Toggle,
    pub cells: Vec<Cell<'static>>,
    pub style: Style,
}

pub struct View {
    pub columns: Vec<Column>,
    pub rows: Vec<ViewRow>,
    pub title: String,
}

// Same name heuristic as App.tsx's BACKGROUND_HINTS.
const BACKGROUND_HINTS: &[&str] = &[
    "service",
    "svchost",
    "daemon",
    "helper",
    "agent",
    "system",
    "registry",
    "crashpad",
    "com surrogate",
    "runtime broker",
    "window manager",
    "explorer",
];

fn is_background_process(name: &str) -> bool {
    let lower = name.to_lowercase();
    BACKGROUND_HINTS.iter().any(|hint| lower.contains(hint))
}

fn col(title: &'static str, width: Constraint, sort: Option<SortKey>, right: bool) -> Column {
    Column { title, width, sort, right }
}

fn text(s: impl Into<String>) -> Cell<'static> {
    Cell::from(s.into())
}

fn num(s: impl Into<String>, style: Style) -> Cell<'static> {
    Cell::from(Line::from(s.into()).alignment(Alignment::Right)).style(style)
}

fn heat(value: f64, warn: f64, hot: f64) -> Style {
    if value >= hot {
        Style::new().fg(Color::LightRed).add_modifier(Modifier::BOLD)
    } else if value >= warn {
        Style::new().fg(Color::Yellow)
    } else {
        Style::new()
    }
}

fn cpu_heat(cpu: f64) -> Style {
    heat(cpu, 10.0, 50.0)
}

fn mem_heat(app: &App, memory: u64) -> Style {
    let pct = memory as f64 / app.snapshot.stats.total_memory.max(1) as f64 * 100.0;
    heat(pct, 2.0, 10.0)
}

fn disk_heat(rate: f64) -> Style {
    heat(rate / 1024.0 / 1024.0, 1.0, 10.0)
}

fn status_style(status: &str) -> Style {
    match status {
        "Running" | "Enabled" => Style::new().fg(Color::Green),
        _ => Style::new().fg(Color::DarkGray),
    }
}

fn apply_dir(ord: Ordering, desc: bool) -> Ordering {
    if desc {
        ord.reverse()
    } else {
        ord
    }
}

fn cmp_f64(a: f64, b: f64) -> Ordering {
    a.partial_cmp(&b).unwrap_or(Ordering::Equal)
}

fn cmp_process(a: &ProcessInfo, b: &ProcessInfo, key: SortKey) -> Ordering {
    match key {
        SortKey::Name => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        SortKey::Pid => a.pid.cmp(&b.pid),
        SortKey::Status => a.status.cmp(&b.status),
        SortKey::User => a.user_name.cmp(&b.user_name),
        SortKey::Cpu => cmp_f64(a.cpu_usage as f64, b.cpu_usage as f64),
        SortKey::Memory => a.memory.cmp(&b.memory),
        SortKey::Disk => cmp_f64(a.disk_bytes_per_sec, b.disk_bytes_per_sec),
    }
}

struct Group<'a> {
    name: String,
    instances: Vec<&'a ProcessInfo>,
    cpu: f64,
    memory: u64,
    disk: f64,
    min_pid: u32,
}

impl<'a> Group<'a> {
    fn new(name: String, mut instances: Vec<&'a ProcessInfo>) -> Self {
        instances.sort_by_key(|p| p.pid);
        Group {
            cpu: instances.iter().map(|p| p.cpu_usage as f64).sum(),
            memory: instances.iter().map(|p| p.memory).sum(),
            disk: instances.iter().map(|p| p.disk_bytes_per_sec).sum(),
            min_pid: instances.first().map(|p| p.pid).unwrap_or(0),
            name,
            instances,
        }
    }

    fn pids(&self) -> Vec<u32> {
        self.instances.iter().map(|p| p.pid).collect()
    }
}

fn group_by<'a>(procs: &[&'a ProcessInfo], key: impl Fn(&ProcessInfo) -> String) -> Vec<Group<'a>> {
    let mut map: BTreeMap<String, Vec<&'a ProcessInfo>> = BTreeMap::new();
    for p in procs {
        map.entry(key(p)).or_default().push(p);
    }
    map.into_iter().map(|(name, instances)| Group::new(name, instances)).collect()
}

fn sort_groups(groups: &mut [Group], key: SortKey, desc: bool) {
    groups.sort_by(|a, b| {
        let ord = match key {
            SortKey::Pid => a.min_pid.cmp(&b.min_pid),
            SortKey::Cpu => cmp_f64(a.cpu, b.cpu),
            SortKey::Memory => a.memory.cmp(&b.memory),
            SortKey::Disk => cmp_f64(a.disk, b.disk),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        apply_dir(ord, desc)
    });
}

pub fn build(app: &App, tab: Tab) -> View {
    match tab {
        Tab::Processes => processes(app),
        Tab::Details => details(app),
        Tab::Users => users(app),
        Tab::AppHistory => app_history(app),
        Tab::Startup => startup(app),
        Tab::Services => services(app),
        Tab::Performance => View { columns: Vec::new(), rows: Vec::new(), title: String::new() },
    }
}

fn filtered_processes(app: &App, tab: Tab) -> Vec<&ProcessInfo> {
    let filter = app.tab_state(tab).filter.to_lowercase();
    app.snapshot
        .processes
        .iter()
        .filter(|p| p.name.to_lowercase().contains(&filter))
        .collect()
}

fn processes(app: &App) -> View {
    let procs = filtered_processes(app, Tab::Processes);
    let (sort, desc) = app.sort_for(Tab::Processes);
    let (background, foreground): (Vec<&ProcessInfo>, Vec<&ProcessInfo>) =
        procs.iter().partition(|p| is_background_process(&p.name));

    // Apps are grouped by name (e.g. every Chromium process under one row); background
    // processes stay one row each, same as the GUI.
    let mut apps = group_by(&foreground, |p| p.name.clone());
    let mut bg: Vec<Group> = background.iter().map(|p| Group::new(p.name.clone(), vec![*p])).collect();
    sort_groups(&mut apps, sort, desc);
    sort_groups(&mut bg, sort, desc);

    let mut rows = Vec::new();
    for (section_key, label, groups) in [("sec:apps", "Apps", apps), ("sec:background", "Background processes", bg)] {
        if groups.is_empty() {
            continue;
        }
        let collapsed = app.collapsed.contains(section_key);
        rows.push(ViewRow {
            key: section_key.to_string(),
            label: label.to_string(),
            pids: Vec::new(),
            toggle: Toggle::Section,
            cells: vec![text(format!("{} {} ({})", if collapsed { "▸" } else { "▾" }, label, groups.len()))],
            style: Style::new().fg(Color::Cyan).add_modifier(Modifier::BOLD),
        });
        if collapsed {
            continue;
        }
        for g in groups {
            let multi = g.instances.len() > 1;
            let key = if multi { format!("grp:{}", g.name) } else { format!("pid:{}", g.min_pid) };
            let expanded = multi && app.expanded.contains(&key);
            let name = if multi {
                format!("  {} {} ({})", if expanded { "▾" } else { "▸" }, g.name, g.instances.len())
            } else {
                format!("    {}", g.name)
            };
            rows.push(ViewRow {
                label: g.name.clone(),
                pids: g.pids(),
                toggle: if multi { Toggle::Expand } else { Toggle::None },
                cells: vec![
                    text(name),
                    num(if multi { String::new() } else { g.min_pid.to_string() }, Style::new().fg(Color::DarkGray)),
                    num(format!("{:.1}%", g.cpu), cpu_heat(g.cpu)),
                    num(format::bytes(g.memory), mem_heat(app, g.memory)),
                    num(format::rate(g.disk), disk_heat(g.disk)),
                ],
                style: Style::new(),
                key,
            });
            if expanded {
                for p in &g.instances {
                    rows.push(process_child_row(app, p));
                }
            }
        }
    }

    View {
        title: format!("Processes · {}", procs.len()),
        columns: vec![
            col("Name", Constraint::Min(24), Some(SortKey::Name), false),
            col("PID", Constraint::Length(8), Some(SortKey::Pid), true),
            col("CPU", Constraint::Length(8), Some(SortKey::Cpu), true),
            col("Memory", Constraint::Length(11), Some(SortKey::Memory), true),
            col("Disk", Constraint::Length(10), Some(SortKey::Disk), true),
        ],
        rows,
    }
}

fn process_child_row(app: &App, p: &ProcessInfo) -> ViewRow {
    let cpu = p.cpu_usage as f64;
    ViewRow {
        key: format!("pid:{}", p.pid),
        label: format!("{} (PID {})", p.name, p.pid),
        pids: vec![p.pid],
        toggle: Toggle::None,
        cells: vec![
            text(format!("      └ {}", p.name)),
            num(p.pid.to_string(), Style::new().fg(Color::DarkGray)),
            num(format!("{cpu:.1}%"), cpu_heat(cpu)),
            num(format::bytes(p.memory), mem_heat(app, p.memory)),
            num(format::rate(p.disk_bytes_per_sec), disk_heat(p.disk_bytes_per_sec)),
        ],
        style: Style::new().fg(Color::Gray),
    }
}

fn details(app: &App) -> View {
    let mut procs = filtered_processes(app, Tab::Details);
    let (sort, desc) = app.sort_for(Tab::Details);
    procs.sort_by(|a, b| apply_dir(cmp_process(a, b, sort), desc));

    let rows = procs
        .iter()
        .map(|p| {
            let cpu = p.cpu_usage as f64;
            ViewRow {
                key: format!("pid:{}", p.pid),
                label: format!("{} (PID {})", p.name, p.pid),
                pids: vec![p.pid],
                toggle: Toggle::None,
                cells: vec![
                    text(p.name.clone()),
                    num(p.pid.to_string(), Style::new().fg(Color::DarkGray)),
                    text(p.status.clone()),
                    text(p.user_name.clone().unwrap_or_else(|| "—".to_string())),
                    num(format!("{cpu:.1}%"), cpu_heat(cpu)),
                    num(format::bytes(p.memory), mem_heat(app, p.memory)),
                ],
                style: Style::new(),
            }
        })
        .collect();

    View {
        title: format!("Details · {}", procs.len()),
        columns: vec![
            col("Name", Constraint::Min(20), Some(SortKey::Name), false),
            col("PID", Constraint::Length(8), Some(SortKey::Pid), true),
            col("Status", Constraint::Length(10), Some(SortKey::Status), false),
            col("User name", Constraint::Length(14), Some(SortKey::User), false),
            col("CPU", Constraint::Length(8), Some(SortKey::Cpu), true),
            col("Memory", Constraint::Length(11), Some(SortKey::Memory), true),
        ],
        rows,
    }
}

fn users(app: &App) -> View {
    let procs = filtered_processes(app, Tab::Users);
    let (sort, desc) = app.sort_for(Tab::Users);
    let mut groups = group_by(&procs, |p| p.user_name.clone().unwrap_or_else(|| "Unknown".to_string()));
    sort_groups(&mut groups, sort, desc);

    let mut rows = Vec::new();
    for g in &groups {
        let key = format!("user:{}", g.name);
        let expanded = app.expanded.contains(&key);
        rows.push(ViewRow {
            label: g.name.clone(),
            pids: Vec::new(),
            toggle: Toggle::Expand,
            cells: vec![
                text(format!("{} {} ({})", if expanded { "▾" } else { "▸" }, g.name, g.instances.len())),
                num(format!("{:.1}%", g.cpu), cpu_heat(g.cpu)),
                num(format::bytes(g.memory), mem_heat(app, g.memory)),
                num(format::rate(g.disk), disk_heat(g.disk)),
            ],
            style: Style::new().add_modifier(Modifier::BOLD),
            key,
        });
        if expanded {
            let mut children = g.instances.clone();
            children.sort_by(|a, b| apply_dir(cmp_process(a, b, sort), desc));
            for p in children {
                let mut row = process_child_row(app, p);
                row.cells.remove(1); // no PID column on this tab
                row.cells[0] = text(format!("    └ {} ({})", p.name, p.pid));
                rows.push(row);
            }
        }
    }

    View {
        title: format!("Users · {}", groups.len()),
        columns: vec![
            col("User", Constraint::Min(24), Some(SortKey::Name), false),
            col("CPU", Constraint::Length(8), Some(SortKey::Cpu), true),
            col("Memory", Constraint::Length(11), Some(SortKey::Memory), true),
            col("Disk", Constraint::Length(10), Some(SortKey::Disk), true),
        ],
        rows,
    }
}

fn app_history(app: &App) -> View {
    let filter = app.tab_state(Tab::AppHistory).filter.to_lowercase();
    let (sort, desc) = app.sort_for(Tab::AppHistory);
    let mut entries: Vec<_> = app
        .snapshot
        .app_history
        .iter()
        .filter(|e| e.name.to_lowercase().contains(&filter))
        .collect();
    entries.sort_by(|a, b| {
        let ord = match sort {
            SortKey::Name => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            _ => cmp_f64(a.cpu_seconds, b.cpu_seconds),
        };
        apply_dir(ord, desc)
    });

    let rows = entries
        .iter()
        .map(|e| ViewRow {
            key: e.name.clone(),
            label: e.name.clone(),
            pids: Vec::new(),
            toggle: Toggle::None,
            cells: vec![text(e.name.clone()), num(format::uptime(e.cpu_seconds), Style::new())],
            style: Style::new(),
        })
        .collect();

    View {
        title: format!("App history · CPU time since launch · {}", entries.len()),
        columns: vec![
            col("Name", Constraint::Min(24), Some(SortKey::Name), false),
            col("CPU time", Constraint::Length(12), Some(SortKey::Cpu), true),
        ],
        rows,
    }
}

fn startup(app: &App) -> View {
    let filter = app.tab_state(Tab::Startup).filter.to_lowercase();
    let (sort, desc) = app.sort_for(Tab::Startup);
    let mut apps: Vec<_> = app
        .startup_apps
        .iter()
        .filter(|a| a.name.to_lowercase().contains(&filter))
        .collect();
    apps.sort_by(|a, b| {
        let ord = match sort {
            SortKey::Status => a.enabled.cmp(&b.enabled),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        apply_dir(ord, desc)
    });

    let rows = apps
        .iter()
        .map(|a| {
            let status = if a.enabled { "Enabled" } else { "Disabled" };
            ViewRow {
                key: a.name.clone(),
                label: a.name.clone(),
                pids: Vec::new(),
                toggle: Toggle::None,
                cells: vec![
                    text(a.name.clone()),
                    Cell::from(a.publisher.clone()).style(Style::new().fg(Color::Gray)),
                    Cell::from(status).style(status_style(status)),
                ],
                style: Style::new(),
            }
        })
        .collect();

    View {
        title: format!("Startup apps · {}", apps.len()),
        columns: vec![
            col("Name", Constraint::Min(20), Some(SortKey::Name), false),
            col("Publisher", Constraint::Fill(2), None, false),
            col("Status", Constraint::Length(10), Some(SortKey::Status), false),
        ],
        rows,
    }
}

fn services(app: &App) -> View {
    let filter = app.tab_state(Tab::Services).filter.to_lowercase();
    let (sort, desc) = app.sort_for(Tab::Services);
    let mut services: Vec<_> = app
        .services
        .iter()
        .filter(|s| {
            s.name.to_lowercase().contains(&filter) || s.description.to_lowercase().contains(&filter)
        })
        .collect();
    services.sort_by(|a, b| {
        let ord = match sort {
            SortKey::Status => a.status.cmp(&b.status),
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        };
        apply_dir(ord, desc)
    });

    let rows = services
        .iter()
        .map(|s| ViewRow {
            key: s.name.clone(),
            label: s.name.clone(),
            pids: Vec::new(),
            toggle: Toggle::None,
            cells: vec![
                text(s.name.clone()),
                Cell::from(s.description.clone()).style(Style::new().fg(Color::Gray)),
                Cell::from(s.status.clone()).style(status_style(&s.status)),
            ],
            style: Style::new(),
        })
        .collect();

    View {
        title: format!("Services · {}", services.len()),
        columns: vec![
            col("Name", Constraint::Fill(2), Some(SortKey::Name), false),
            col("Description", Constraint::Fill(3), None, false),
            col("Status", Constraint::Length(9), Some(SortKey::Status), false),
        ],
        rows,
    }
}
