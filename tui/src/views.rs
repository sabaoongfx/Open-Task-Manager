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
    /// A plain row with nothing to expand.
    Leaf,
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

impl ViewRow {
    /// A non-killable, non-expandable row labelled by its key.
    fn plain(key: String, cells: Vec<Cell<'static>>) -> Self {
        ViewRow { label: key.clone(), key, pids: Vec::new(), toggle: Toggle::Leaf, cells, style: Style::new() }
    }
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

// Heat colouring. The GUI shades cells relative to the busiest visible row; a terminal only has
// a few distinct colours, so these use absolute thresholds instead: yellow = "noticeable",
// red = "this is what's making the machine busy".
fn heat(value: f64, warn: f64, hot: f64) -> Style {
    if value >= hot {
        Style::new().fg(Color::LightRed).add_modifier(Modifier::BOLD)
    } else if value >= warn {
        Style::new().fg(Color::Yellow)
    } else {
        Style::new()
    }
}

/// Percent of one core: 10% = noticeable, 50% = hot.
fn cpu_heat(cpu: f64) -> Style {
    heat(cpu, 10.0, 50.0)
}

/// Share of total RAM: 2% = noticeable, 10% = hot.
fn mem_heat(app: &App, memory: u64) -> Style {
    let pct = memory as f64 / app.snapshot.stats.total_memory.max(1) as f64 * 100.0;
    heat(pct, 2.0, 10.0)
}

/// Read + write rate: 1 MB/s = noticeable, 10 MB/s = hot.
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

fn cmp_name(a: &str, b: &str) -> Ordering {
    a.to_lowercase().cmp(&b.to_lowercase())
}

/// The items whose text (per `haystack`) contains the tab's filter, case-insensitively.
fn filtered<'a, T>(app: &App, tab: Tab, items: &'a [T], haystack: impl Fn(&T) -> String) -> Vec<&'a T> {
    let filter = app.tab_state(tab).filter.to_lowercase();
    items.iter().filter(|item| haystack(item).to_lowercase().contains(&filter)).collect()
}

/// Sorts by the tab's current sort column and direction.
fn sort_by_tab<T>(app: &App, tab: Tab, items: &mut [&T], cmp: impl Fn(&T, &T, SortKey) -> Ordering) {
    let (sort, desc) = app.sort_for(tab);
    items.sort_by(|a, b| apply_dir(cmp(a, b, sort), desc));
}

fn cmp_process(a: &ProcessInfo, b: &ProcessInfo, key: SortKey) -> Ordering {
    match key {
        SortKey::Name => cmp_name(&a.name, &b.name),
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
            _ => cmp_name(&a.name, &b.name),
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

fn processes(app: &App) -> View {
    let procs = filtered(app, Tab::Processes, &app.snapshot.processes, |p| p.name.clone());
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
                toggle: if multi { Toggle::Expand } else { Toggle::Leaf },
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
                    rows.push(process_child_row(app, p, true));
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

/// One process nested under a group row. `pid_column`: whether the table has a PID column
/// (Processes) or the PID goes after the name instead (Users).
fn process_child_row(app: &App, p: &ProcessInfo, pid_column: bool) -> ViewRow {
    let cpu = p.cpu_usage as f64;
    let mut cells = Vec::with_capacity(5);
    if pid_column {
        cells.push(text(format!("      └ {}", p.name)));
        cells.push(num(p.pid.to_string(), Style::new().fg(Color::DarkGray)));
    } else {
        cells.push(text(format!("    └ {} ({})", p.name, p.pid)));
    }
    cells.extend([
        num(format!("{cpu:.1}%"), cpu_heat(cpu)),
        num(format::bytes(p.memory), mem_heat(app, p.memory)),
        num(format::rate(p.disk_bytes_per_sec), disk_heat(p.disk_bytes_per_sec)),
    ]);
    ViewRow {
        key: format!("pid:{}", p.pid),
        label: format!("{} (PID {})", p.name, p.pid),
        pids: vec![p.pid],
        toggle: Toggle::Leaf,
        cells,
        style: Style::new().fg(Color::Gray),
    }
}

fn details(app: &App) -> View {
    let mut procs = filtered(app, Tab::Details, &app.snapshot.processes, |p| p.name.clone());
    sort_by_tab(app, Tab::Details, &mut procs, cmp_process);

    let rows = procs
        .iter()
        .map(|p| {
            let cpu = p.cpu_usage as f64;
            ViewRow {
                key: format!("pid:{}", p.pid),
                label: format!("{} (PID {})", p.name, p.pid),
                pids: vec![p.pid],
                toggle: Toggle::Leaf,
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
    let procs = filtered(app, Tab::Users, &app.snapshot.processes, |p| p.name.clone());
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
            sort_by_tab(app, Tab::Users, &mut children, cmp_process);
            rows.extend(children.into_iter().map(|p| process_child_row(app, p, false)));
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
    let mut entries = filtered(app, Tab::AppHistory, &app.snapshot.app_history, |e| e.name.clone());
    sort_by_tab(app, Tab::AppHistory, &mut entries, |a, b, key| match key {
        SortKey::Name => cmp_name(&a.name, &b.name),
        _ => cmp_f64(a.cpu_seconds, b.cpu_seconds),
    });

    View {
        title: format!("App history · CPU time since launch · {}", entries.len()),
        columns: vec![
            col("Name", Constraint::Min(24), Some(SortKey::Name), false),
            col("CPU time", Constraint::Length(12), Some(SortKey::Cpu), true),
        ],
        rows: entries
            .iter()
            .map(|e| {
                ViewRow::plain(e.name.clone(), vec![text(e.name.clone()), num(format::uptime(e.cpu_seconds), Style::new())])
            })
            .collect(),
    }
}

fn startup(app: &App) -> View {
    let mut apps = filtered(app, Tab::Startup, &app.startup_apps, |a| a.name.clone());
    sort_by_tab(app, Tab::Startup, &mut apps, |a, b, key| match key {
        SortKey::Status => a.enabled.cmp(&b.enabled),
        _ => cmp_name(&a.name, &b.name),
    });

    View {
        title: format!("Startup apps · {}", apps.len()),
        columns: vec![
            col("Name", Constraint::Min(20), Some(SortKey::Name), false),
            col("Publisher", Constraint::Fill(2), None, false),
            col("Status", Constraint::Length(10), Some(SortKey::Status), false),
        ],
        rows: apps
            .iter()
            .map(|a| {
                let status = if a.enabled { "Enabled" } else { "Disabled" };
                ViewRow::plain(
                    a.name.clone(),
                    vec![
                        text(a.name.clone()),
                        Cell::from(a.publisher.clone()).style(Style::new().fg(Color::Gray)),
                        Cell::from(status).style(status_style(status)),
                    ],
                )
            })
            .collect(),
    }
}

fn services(app: &App) -> View {
    let mut services = filtered(app, Tab::Services, &app.services, |s| format!("{} {}", s.name, s.description));
    sort_by_tab(app, Tab::Services, &mut services, |a, b, key| match key {
        SortKey::Status => a.status.cmp(&b.status),
        _ => cmp_name(&a.name, &b.name),
    });

    View {
        title: format!("Services · {}", services.len()),
        columns: vec![
            col("Name", Constraint::Fill(2), Some(SortKey::Name), false),
            col("Description", Constraint::Fill(3), None, false),
            col("Status", Constraint::Length(9), Some(SortKey::Status), false),
        ],
        rows: services
            .iter()
            .map(|s| {
                ViewRow::plain(
                    s.name.clone(),
                    vec![
                        text(s.name.clone()),
                        Cell::from(s.description.clone()).style(Style::new().fg(Color::Gray)),
                        Cell::from(s.status.clone()).style(status_style(&s.status)),
                    ],
                )
            })
            .collect(),
    }
}
