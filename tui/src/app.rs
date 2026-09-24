use crate::views::{self, Toggle, View, ViewRow};
use otm_core::{Monitor, ServiceInfo, Snapshot, StartupAppInfo};
use ratatui::crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};
use ratatui::layout::{Position, Rect};
use ratatui::widgets::TableState;
use std::collections::{HashMap, HashSet, VecDeque};
use std::time::{Duration, Instant};

/// Same length as the GUI's Performance graphs (`HISTORY_LEN` in Performance.tsx).
pub const HISTORY_LEN: usize = 60;

/// How long a status message ("Ended Firefox", "Reloaded", ...) stays in the footer.
const STATUS_TIMEOUT: Duration = Duration::from_secs(4);

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Tab {
    Processes,
    Performance,
    AppHistory,
    Startup,
    Users,
    Details,
    Services,
}

impl Tab {
    pub const ALL: [Tab; 7] = [
        Tab::Processes,
        Tab::Performance,
        Tab::AppHistory,
        Tab::Startup,
        Tab::Users,
        Tab::Details,
        Tab::Services,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Tab::Processes => "Processes",
            Tab::Performance => "Performance",
            Tab::AppHistory => "App history",
            Tab::Startup => "Startup apps",
            Tab::Users => "Users",
            Tab::Details => "Details",
            Tab::Services => "Services",
        }
    }

    fn index(self) -> usize {
        Tab::ALL.iter().position(|&t| t == self).unwrap()
    }

    fn default_sort(self) -> (SortKey, bool) {
        match self {
            Tab::Processes | Tab::Users | Tab::Details | Tab::AppHistory => (SortKey::Cpu, true),
            _ => (SortKey::Name, false),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SortKey {
    Name,
    Pid,
    Status,
    User,
    Cpu,
    Memory,
    Disk,
}

impl SortKey {
    /// Text columns read naturally A→Z; numeric columns are most useful biggest-first.
    fn default_desc(self) -> bool {
        matches!(self, SortKey::Cpu | SortKey::Memory | SortKey::Disk)
    }
}

pub struct TabState {
    pub table: TableState,
    pub selected_key: Option<String>,
    pub filter: String,
    pub sort: SortKey,
    pub desc: bool,
}

pub enum Popup {
    Help,
    ConfirmKill { label: String, pids: Vec<u32> },
}

#[derive(Default)]
pub struct History {
    pub cpu: VecDeque<f64>,
    pub memory: VecDeque<f64>,
    pub disk: VecDeque<f64>,
    pub network: VecDeque<f64>,
}

fn push_capped(buf: &mut VecDeque<f64>, value: f64) {
    buf.push_back(value);
    while buf.len() > HISTORY_LEN {
        buf.pop_front();
    }
}

/// Screen regions recorded during the last draw, used to route mouse clicks.
#[derive(Default)]
pub struct Areas {
    pub tabs: Vec<(Rect, Tab)>,
    pub table_header: Rect,
    pub table_body: Rect,
    pub header_columns: Vec<Rect>,
}

pub struct App {
    monitor: Monitor,
    pub snapshot: Snapshot,
    pub services: Vec<ServiceInfo>,
    pub startup_apps: Vec<StartupAppInfo>,
    pub history: History,
    pub tab: Tab,
    tabs: HashMap<Tab, TabState>,
    pub editing_filter: bool,
    /// Group rows (process name groups, users) the user has expanded.
    pub expanded: HashSet<String>,
    /// Section headers ("Apps", "Background processes") the user has collapsed.
    pub collapsed: HashSet<String>,
    pub popup: Option<Popup>,
    status: Option<(String, Instant)>,
    pub areas: Areas,
    pub should_quit: bool,
    pub interval: Duration,
}

impl App {
    pub fn new(interval: Duration) -> Self {
        let mut monitor = Monitor::new();
        let snapshot = monitor.snapshot();
        let tabs = Tab::ALL
            .iter()
            .map(|&t| {
                let (sort, desc) = t.default_sort();
                (t, TabState { table: TableState::default(), selected_key: None, filter: String::new(), sort, desc })
            })
            .collect();
        let mut app = App {
            monitor,
            snapshot,
            services: otm_core::get_services(),
            startup_apps: otm_core::get_startup_apps(),
            history: History::default(),
            tab: Tab::Processes,
            tabs,
            editing_filter: false,
            expanded: HashSet::new(),
            collapsed: HashSet::new(),
            popup: None,
            status: None,
            areas: Areas::default(),
            should_quit: false,
            interval,
        };
        app.record_history();
        app
    }

    pub fn tick(&mut self) {
        self.snapshot = self.monitor.snapshot();
        self.record_history();
    }

    fn record_history(&mut self) {
        let s = &self.snapshot.stats;
        push_capped(&mut self.history.cpu, s.cpu_usage as f64);
        push_capped(&mut self.history.memory, s.used_memory as f64 / s.total_memory.max(1) as f64 * 100.0);
        push_capped(&mut self.history.disk, s.disk_bytes_per_sec);
        push_capped(&mut self.history.network, s.network_rx_bytes_per_sec + s.network_tx_bytes_per_sec);
    }

    pub fn tab_state(&self, tab: Tab) -> &TabState {
        &self.tabs[&tab]
    }

    pub fn tab_state_mut(&mut self, tab: Tab) -> &mut TabState {
        self.tabs.get_mut(&tab).unwrap()
    }

    pub fn sort_for(&self, tab: Tab) -> (SortKey, bool) {
        let s = self.tab_state(tab);
        (s.sort, s.desc)
    }

    pub fn status(&self) -> Option<&str> {
        self.status
            .as_ref()
            .filter(|(_, at)| at.elapsed() < STATUS_TIMEOUT)
            .map(|(msg, _)| msg.as_str())
    }

    fn set_status(&mut self, msg: impl Into<String>) {
        self.status = Some((msg.into(), Instant::now()));
    }

    /// Builds the current tab's table **and** re-resolves the selection against it (a side
    /// effect), so the highlighted row follows the same process/item as the list re-sorts
    /// every refresh. Build it once per event and pass it down rather than calling it again.
    pub fn synced_view(&mut self) -> View {
        let view = views::build(self, self.tab);
        let state = self.tab_state_mut(self.tab);
        if view.rows.is_empty() {
            state.table.select(None);
            return view;
        }
        let by_key = state
            .selected_key
            .as_ref()
            .and_then(|k| view.rows.iter().position(|r| &r.key == k));
        let idx = by_key.unwrap_or_else(|| state.table.selected().unwrap_or(0).min(view.rows.len() - 1));
        state.table.select(Some(idx));
        state.selected_key = Some(view.rows[idx].key.clone());
        view
    }

    fn selected_index(&self) -> Option<usize> {
        self.tab_state(self.tab).table.selected()
    }

    /// Selects row `idx`, clamped to the last row.
    fn select_index(&mut self, view: &View, idx: usize) {
        if view.rows.is_empty() {
            return;
        }
        let idx = idx.min(view.rows.len() - 1);
        let state = self.tab_state_mut(self.tab);
        state.table.select(Some(idx));
        state.selected_key = Some(view.rows[idx].key.clone());
    }

    fn move_selection(&mut self, delta: isize) {
        let view = self.synced_view();
        let current = self.selected_index().unwrap_or(0);
        self.select_index(&view, current.saturating_add_signed(delta));
    }

    fn select_first(&mut self) {
        let view = self.synced_view();
        self.select_index(&view, 0);
    }

    fn select_last(&mut self) {
        let view = self.synced_view();
        self.select_index(&view, usize::MAX);
    }

    fn page_size(&self) -> isize {
        self.areas.table_body.height.max(1) as isize
    }

    fn set_tab(&mut self, tab: Tab) {
        self.tab = tab;
        self.editing_filter = false;
    }

    fn cycle_tab(&mut self, delta: isize) {
        let n = Tab::ALL.len() as isize;
        let idx = (self.tab.index() as isize + delta).rem_euclid(n) as usize;
        self.set_tab(Tab::ALL[idx]);
    }

    fn sort_by(&mut self, key: SortKey) {
        let state = self.tab_state_mut(self.tab);
        if state.sort == key {
            state.desc = !state.desc;
        } else {
            state.sort = key;
            state.desc = key.default_desc();
        }
    }

    fn cycle_sort(&mut self) {
        let view = views::build(self, self.tab);
        let keys: Vec<SortKey> = view.columns.iter().filter_map(|c| c.sort).collect();
        if keys.is_empty() {
            return;
        }
        let current = self.tab_state(self.tab).sort;
        let next = keys
            .iter()
            .position(|&k| k == current)
            .map(|i| keys[(i + 1) % keys.len()])
            .unwrap_or(keys[0]);
        self.sort_by(next);
    }

    /// Expand/collapse the selected row. `want`: Some(true) = open, Some(false) = close, None = flip.
    fn toggle_selected(&mut self, want: Option<bool>) {
        let view = self.synced_view();
        if let Some(row) = self.selected_index().map(|idx| &view.rows[idx]) {
            self.toggle_row(row, want);
        }
    }

    fn toggle_row(&mut self, row: &ViewRow, want: Option<bool>) {
        match row.toggle {
            Toggle::Expand => {
                let open = self.expanded.contains(&row.key);
                if want.unwrap_or(!open) {
                    self.expanded.insert(row.key.clone());
                } else {
                    self.expanded.remove(&row.key);
                }
            }
            Toggle::Section => {
                let open = !self.collapsed.contains(&row.key);
                if want.unwrap_or(!open) {
                    self.collapsed.remove(&row.key);
                } else {
                    self.collapsed.insert(row.key.clone());
                }
            }
            Toggle::Leaf => {}
        }
    }

    fn request_kill(&mut self) {
        let view = self.synced_view();
        let Some(row) = self.selected_index().map(|idx| &view.rows[idx]) else { return };
        if row.pids.is_empty() {
            self.set_status("Nothing to end here — select a process");
            return;
        }
        self.popup = Some(Popup::ConfirmKill { label: row.label.clone(), pids: row.pids.clone() });
    }

    fn confirm_kill(&mut self, label: &str, pids: &[u32]) {
        let killed: HashSet<u32> = pids.iter().copied().filter(|&pid| self.monitor.kill_process(pid)).collect();
        if killed.len() == pids.len() {
            self.set_status(format!("Ended {label}"));
        } else {
            self.set_status(format!(
                "Ended {} of {} process(es) for {label} (others may need higher privileges)",
                killed.len(),
                pids.len()
            ));
        }
        // Hide them right away instead of refreshing early: an off-schedule snapshot would add an
        // unevenly spaced sample to the graphs and shorten the next CPU measuring window.
        self.snapshot.processes.retain(|p| !killed.contains(&p.pid));
    }

    fn reset_app_history(&mut self) {
        self.monitor.reset_app_history();
        self.snapshot.app_history.clear(); // same reason as confirm_kill: no early refresh
        self.set_status("App history reset");
    }

    fn reload_lists(&mut self) {
        self.services = otm_core::get_services();
        self.startup_apps = otm_core::get_startup_apps();
        self.set_status("Reloaded");
    }

    pub fn handle_event(&mut self, event: Event) {
        match event {
            Event::Key(key) if key.kind != KeyEventKind::Release => self.handle_key(key),
            Event::Mouse(mouse) => self.handle_mouse(mouse),
            _ => {}
        }
    }

    fn handle_popup_key(&mut self, popup: Popup, key: KeyEvent) {
        match popup {
            Popup::ConfirmKill { label, pids } => match key.code {
                KeyCode::Char('y' | 'Y') | KeyCode::Enter => self.confirm_kill(&label, &pids),
                KeyCode::Char('n' | 'N' | 'q') | KeyCode::Esc => {}
                _ => self.popup = Some(Popup::ConfirmKill { label, pids }),
            },
            Popup::Help => {} // any key closes it
        }
    }

    fn handle_key(&mut self, key: KeyEvent) {
        if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
            self.should_quit = true;
            return;
        }

        if let Some(popup) = self.popup.take() {
            self.handle_popup_key(popup, key);
            return;
        }

        if self.editing_filter {
            match key.code {
                KeyCode::Enter => self.editing_filter = false,
                KeyCode::Esc => {
                    self.tab_state_mut(self.tab).filter.clear();
                    self.editing_filter = false;
                }
                KeyCode::Backspace => {
                    self.tab_state_mut(self.tab).filter.pop();
                }
                KeyCode::Char(c) => self.tab_state_mut(self.tab).filter.push(c),
                _ => {}
            }
            return;
        }

        match key.code {
            KeyCode::Char('q') => self.should_quit = true,
            KeyCode::Char('?') | KeyCode::F(1) => self.popup = Some(Popup::Help),
            KeyCode::Esc => self.tab_state_mut(self.tab).filter.clear(),
            KeyCode::Tab => self.cycle_tab(1),
            KeyCode::BackTab => self.cycle_tab(-1),
            KeyCode::Char(c @ '1'..='7') => self.set_tab(Tab::ALL[c as usize - '1' as usize]),
            KeyCode::Char('/' | 'f') if self.tab != Tab::Performance => self.editing_filter = true,
            KeyCode::Down | KeyCode::Char('j') => self.move_selection(1),
            KeyCode::Up | KeyCode::Char('k') => self.move_selection(-1),
            KeyCode::PageDown => self.move_selection(self.page_size()),
            KeyCode::PageUp => self.move_selection(-self.page_size()),
            KeyCode::Home | KeyCode::Char('g') => self.select_first(),
            KeyCode::End | KeyCode::Char('G') => self.select_last(),
            KeyCode::Enter | KeyCode::Char(' ') => self.toggle_selected(None),
            KeyCode::Right | KeyCode::Char('l') => self.toggle_selected(Some(true)),
            KeyCode::Left | KeyCode::Char('h') => self.toggle_selected(Some(false)),
            KeyCode::Char('s') => self.cycle_sort(),
            KeyCode::Char('S') => {
                let state = self.tab_state_mut(self.tab);
                state.desc = !state.desc;
            }
            KeyCode::Delete | KeyCode::Char('x') => self.request_kill(),
            KeyCode::Char('r') if self.tab == Tab::AppHistory => self.reset_app_history(),
            KeyCode::Char('r') if matches!(self.tab, Tab::Services | Tab::Startup) => self.reload_lists(),
            _ => {}
        }
    }

    fn handle_mouse(&mut self, mouse: MouseEvent) {
        if self.popup.is_some() {
            return;
        }
        let pos = Position::new(mouse.column, mouse.row);
        match mouse.kind {
            MouseEventKind::ScrollDown => self.move_selection(3),
            MouseEventKind::ScrollUp => self.move_selection(-3),
            MouseEventKind::Down(MouseButton::Left) => {
                if let Some(&(_, tab)) = self.areas.tabs.iter().find(|(r, _)| r.contains(pos)) {
                    self.set_tab(tab);
                } else if self.areas.table_header.contains(pos) {
                    let view = views::build(self, self.tab);
                    let clicked = self.areas.header_columns.iter().position(|r| {
                        mouse.column >= r.x && mouse.column < r.x + r.width
                    });
                    if let Some(key) = clicked.and_then(|i| view.columns.get(i)).and_then(|c| c.sort) {
                        self.sort_by(key);
                    }
                } else if self.areas.table_body.contains(pos) {
                    let view = self.synced_view();
                    let idx = self.tab_state(self.tab).table.offset() + (mouse.row - self.areas.table_body.y) as usize;
                    let Some(row) = view.rows.get(idx) else { return };
                    // Clicking the already-selected row toggles it, like a double click.
                    if self.selected_index() == Some(idx) {
                        self.toggle_row(row, None);
                    } else {
                        self.select_index(&view, idx);
                    }
                }
            }
            _ => {}
        }
    }
}
