use crate::app::{App, Popup, Tab, HISTORY_LEN};
use crate::format;
use crate::views::View;
use ratatui::layout::{Alignment, Constraint, Flex, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::symbols::Marker;
use ratatui::text::{Line, Span};
use ratatui::widgets::{
    Axis, Block, BorderType, Cell, Chart, Clear, Dataset, GraphType, Paragraph, Row, Table, Wrap,
};
use ratatui::Frame;
use std::collections::VecDeque;

const ACCENT: Color = Color::Cyan;
const CPU_COLOR: Color = Color::Cyan;
const MEMORY_COLOR: Color = Color::Magenta;
const DISK_COLOR: Color = Color::Green;
const NETWORK_COLOR: Color = Color::Yellow;

// Column layout for the main tables. Mouse clicks on the header map back to columns by
// re-running this same layout (see `column_rects`), so the table and the click mapping must
// never be configured separately.
const COLUMN_FLEX: Flex = Flex::Start;
const COLUMN_SPACING: u16 = 1;

fn data_table<'a>(rows: Vec<Row<'a>>, widths: &[Constraint], header: Row<'a>) -> Table<'a> {
    Table::new(rows, widths.to_vec()).header(header).flex(COLUMN_FLEX).column_spacing(COLUMN_SPACING)
}

fn column_rects(widths: &[Constraint], area: Rect) -> Vec<Rect> {
    Layout::horizontal(widths.to_vec()).flex(COLUMN_FLEX).spacing(COLUMN_SPACING).split(area).to_vec()
}

pub fn draw(frame: &mut Frame, app: &mut App) {
    let [top, main, footer] =
        Layout::vertical([Constraint::Length(1), Constraint::Fill(1), Constraint::Length(1)]).areas(frame.area());

    draw_top_bar(frame, app, top);
    if app.tab == Tab::Performance {
        app.areas.table_header = Rect::default();
        app.areas.table_body = Rect::default();
        draw_performance(frame, app, main);
    } else {
        let view = app.synced_view();
        draw_table(frame, app, &view, main);
    }
    draw_footer(frame, app, footer);

    match &app.popup {
        Some(Popup::Help) => draw_help(frame),
        Some(Popup::ConfirmKill { label, pids }) => draw_confirm(frame, label, pids.len()),
        None => {}
    }
}

fn draw_top_bar(frame: &mut Frame, app: &mut App, area: Rect) {
    let mut spans = vec![Span::styled(" ◆ Open Task Manager ", Style::new().fg(ACCENT).bold())];
    let mut x = area.x + spans[0].width() as u16;
    app.areas.tabs.clear();
    for (i, &tab) in Tab::ALL.iter().enumerate() {
        let label = format!(" {} {} ", i + 1, tab.label());
        let width = label.chars().count() as u16;
        let style = if tab == app.tab {
            Style::new().fg(Color::Black).bg(ACCENT).bold()
        } else {
            Style::new().fg(Color::Gray)
        };
        app.areas.tabs.push((Rect::new(x, area.y, width, 1), tab));
        spans.push(Span::styled(label, style));
        x += width;
    }
    frame.render_widget(Line::from(spans), area);

    // Live summary on the right, only if it fits after the tabs.
    let s = &app.snapshot.stats;
    let summary = format!(
        "CPU {:>3.0}%  Mem {}/{}  Up {} ",
        s.cpu_usage,
        format::gb(s.used_memory),
        format::gb(s.total_memory),
        format::uptime(s.uptime_secs as f64)
    );
    let used = x - area.x;
    if used + summary.chars().count() as u16 + 2 <= area.width {
        frame.render_widget(Line::from(summary).alignment(Alignment::Right).fg(Color::Gray), area);
    }
}

fn panel(title: impl Into<Line<'static>>) -> Block<'static> {
    Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(Style::new().fg(Color::DarkGray))
        .title(title.into().fg(ACCENT).bold())
}

fn draw_table(frame: &mut Frame, app: &mut App, view: &View, area: Rect) {
    let tab = app.tab;
    let (sort, desc) = app.sort_for(tab);
    let filter = app.tab_state(tab).filter.clone();

    let mut block = panel(format!(" {} ", view.title));
    if !filter.is_empty() || app.editing_filter {
        block = block.title(Line::from(format!(" filter: {filter} ")).right_aligned().fg(Color::Yellow));
    }
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let widths: Vec<Constraint> = view.columns.iter().map(|c| c.width).collect();
    let header = Row::new(view.columns.iter().map(|c| {
        let arrow = match c.sort {
            Some(k) if k == sort => if desc { " ▼" } else { " ▲" },
            _ => "",
        };
        let line = Line::from(format!("{}{}", c.title, arrow));
        Cell::from(if c.right { line.right_aligned() } else { line })
    }))
    .style(Style::new().fg(Color::Gray).add_modifier(Modifier::BOLD | Modifier::UNDERLINED));

    // Recorded so mouse clicks can map back to a header column / body row.
    let [header_area, body_area] = Layout::vertical([Constraint::Length(1), Constraint::Fill(1)]).areas(inner);
    app.areas.table_header = header_area;
    app.areas.table_body = body_area;
    app.areas.header_columns = column_rects(&widths, header_area);

    if view.rows.is_empty() {
        let msg = if filter.is_empty() { "Nothing to show" } else { "No matches" };
        frame.render_widget(data_table(Vec::new(), &widths, header), inner);
        frame.render_widget(Paragraph::new(msg).fg(Color::DarkGray).centered(), body_area);
        return;
    }

    let rows = view.rows.iter().map(|r| Row::new(r.cells.clone()).style(r.style)).collect();
    let table = data_table(rows, &widths, header)
        .row_highlight_style(Style::new().bg(Color::Blue).fg(Color::White).add_modifier(Modifier::BOLD));
    frame.render_stateful_widget(table, inner, &mut app.tab_state_mut(tab).table);
}

fn draw_performance(frame: &mut Frame, app: &App, area: Rect) {
    let s = &app.snapshot.stats;
    let [charts, details] = Layout::vertical([Constraint::Min(10), Constraint::Length(10)]).areas(area);
    let [top, bottom] = Layout::vertical([Constraint::Fill(1); 2]).areas(charts);
    let [cpu_area, mem_area] = Layout::horizontal([Constraint::Fill(1); 2]).areas(top);
    let [disk_area, net_area] = Layout::horizontal([Constraint::Fill(1); 2]).areas(bottom);

    let mem_pct = s.used_memory as f64 / s.total_memory.max(1) as f64 * 100.0;
    draw_graph(
        frame,
        cpu_area,
        format!(" CPU  {:.0}% · {} ", s.cpu_usage, format::hz(s.cpu_info.frequency_mhz)),
        &app.history.cpu,
        CPU_COLOR,
        Some(100.0),
        |v| format!("{v:.0}%"),
    );
    draw_graph(
        frame,
        mem_area,
        format!(" Memory  {}/{} ({mem_pct:.0}%) ", format::gb(s.used_memory), format::gb(s.total_memory)),
        &app.history.memory,
        MEMORY_COLOR,
        Some(100.0),
        |v| format!("{v:.0}%"),
    );
    draw_graph(
        frame,
        disk_area,
        format!(" Disk  {} · {:.0}% active ", format::rate(s.disk_bytes_per_sec), s.disk_active_percent),
        &app.history.disk,
        DISK_COLOR,
        None,
        format::rate,
    );
    draw_graph(
        frame,
        net_area,
        format!(
            " Network  ↓ {}  ↑ {} ",
            format::rate(s.network_rx_bytes_per_sec),
            format::rate(s.network_tx_bytes_per_sec)
        ),
        &app.history.network,
        NETWORK_COLOR,
        None,
        format::rate,
    );

    let [sys_area, disks_area, nets_area] =
        Layout::horizontal([Constraint::Fill(2), Constraint::Fill(3), Constraint::Fill(2)]).areas(details);

    let label = |k: &str| Span::styled(format!("{k:<13}"), Style::new().fg(Color::Gray));
    let info = vec![
        Line::from(vec![label("Processor"), Span::raw(s.cpu_info.brand.clone())]),
        Line::from(vec![
            label("Cores"),
            Span::raw(format!("{} physical · {} logical", s.cpu_info.physical_cores, s.cpu_info.logical_cores)),
        ]),
        Line::from(vec![label("Speed"), Span::raw(format::hz(s.cpu_info.frequency_mhz))]),
        Line::from(vec![label("Processes"), Span::raw(s.process_count.to_string())]),
        Line::from(vec![label("Up time"), Span::raw(format::uptime(s.uptime_secs as f64))]),
        Line::from(vec![label("Swap"), Span::raw(format!("{} / {}", format::gb(s.used_swap), format::gb(s.total_swap)))]),
    ];
    frame.render_widget(Paragraph::new(info).wrap(Wrap { trim: true }).block(panel(" System ")), sys_area);

    let right = |s: String| Cell::from(Line::from(s).right_aligned());
    let disk_rows = s.disks.iter().map(|d| {
        let used = d.total_bytes.saturating_sub(d.available_bytes);
        Row::new(vec![
            Cell::from(d.mount_point.clone()),
            Cell::from(d.kind.clone()),
            right(format!("{} / {}", format::gb(used), format::gb(d.total_bytes))),
            right(format!("{:.0}%", d.active_percent)),
        ])
    });
    let disks = Table::new(
        disk_rows,
        [Constraint::Fill(1), Constraint::Length(7), Constraint::Length(19), Constraint::Length(7)],
    )
    .header(small_header(&["Mount", "Type", "Used", "Active"], &[false, false, true, true]))
    .block(panel(" Disks "));
    frame.render_widget(disks, disks_area);

    let mut ifaces: Vec<_> = s.network_interfaces.iter().collect();
    ifaces.sort_by(|a, b| a.name.cmp(&b.name));
    let net_rows = ifaces.iter().map(|n| {
        Row::new(vec![
            Cell::from(n.name.clone()),
            right(format::rate(n.rx_bytes_per_sec)),
            right(format::rate(n.tx_bytes_per_sec)),
        ])
    });
    let nets = Table::new(net_rows, [Constraint::Fill(1), Constraint::Length(10), Constraint::Length(10)])
        .header(small_header(&["Interface", "↓ Recv", "↑ Send"], &[false, true, true]))
        .block(panel(" Network "));
    frame.render_widget(nets, nets_area);
}

fn small_header(titles: &[&'static str], right: &[bool]) -> Row<'static> {
    Row::new(titles.iter().zip(right).map(|(t, &r)| {
        let line = Line::from(*t);
        Cell::from(if r { line.right_aligned() } else { line })
    }))
    .style(Style::new().fg(Color::Gray).add_modifier(Modifier::BOLD))
}

fn draw_graph(
    frame: &mut Frame,
    area: Rect,
    title: String,
    history: &VecDeque<f64>,
    color: Color,
    fixed_max: Option<f64>,
    fmt: impl Fn(f64) -> String,
) {
    // Right-align the history so the newest sample is always at the right edge, like the GUI.
    let start = HISTORY_LEN.saturating_sub(history.len());
    let points: Vec<(f64, f64)> = history.iter().enumerate().map(|(i, &v)| ((start + i) as f64, v)).collect();
    let max = fixed_max.unwrap_or_else(|| {
        let peak = history.iter().cloned().fold(0.0, f64::max);
        (peak * 1.25).max(1024.0 * 1024.0)
    });

    let dataset = Dataset::default()
        .marker(Marker::Braille)
        .graph_type(GraphType::Line)
        .style(Style::new().fg(color))
        .data(&points);
    let chart = Chart::new(vec![dataset])
        .block(panel(title).title_style(Style::new().fg(color).bold()))
        .x_axis(Axis::default().bounds([0.0, (HISTORY_LEN - 1) as f64]))
        .y_axis(
            Axis::default()
                .bounds([0.0, max])
                .labels([Line::from("0"), Line::from(fmt(max))])
                .style(Style::new().fg(Color::DarkGray)),
        );
    frame.render_widget(chart, area);
}

fn draw_footer(frame: &mut Frame, app: &App, area: Rect) {
    if app.editing_filter {
        let filter = &app.tab_state(app.tab).filter;
        let line = Line::from(vec![
            Span::styled(" Filter: ", Style::new().fg(Color::Yellow).bold()),
            Span::raw(filter.clone()),
            Span::styled("█", Style::new().fg(Color::Yellow)),
            Span::styled("   Enter apply · Esc clear", Style::new().fg(Color::DarkGray)),
        ]);
        frame.render_widget(line, area);
        return;
    }
    if let Some(status) = app.status() {
        frame.render_widget(Line::from(format!(" {status}")).fg(Color::Yellow), area);
        return;
    }

    let mut hints: Vec<(&str, &str)> = vec![("Tab", "switch")];
    match app.tab {
        Tab::Performance => {}
        Tab::Processes | Tab::Users => {
            hints.extend([("↑↓", "move"), ("←→", "expand"), ("/", "filter"), ("s", "sort"), ("x", "end task")])
        }
        Tab::Details => hints.extend([("↑↓", "move"), ("/", "filter"), ("s", "sort"), ("x", "end task")]),
        Tab::AppHistory => hints.extend([("↑↓", "move"), ("/", "filter"), ("s", "sort"), ("r", "reset")]),
        Tab::Startup | Tab::Services => {
            hints.extend([("↑↓", "move"), ("/", "filter"), ("s", "sort"), ("r", "reload")])
        }
    }
    hints.extend([("?", "help"), ("q", "quit")]);

    let mut spans = vec![Span::raw(" ")];
    for (key, action) in hints {
        spans.push(Span::styled(key, Style::new().fg(ACCENT).bold()));
        spans.push(Span::styled(format!(" {action}  "), Style::new().fg(Color::Gray)));
    }
    frame.render_widget(Line::from(spans), area);
}

fn centered(frame: &Frame, width: u16, height: u16) -> Rect {
    let area = frame.area();
    let [v] = Layout::vertical([Constraint::Length(height.min(area.height))]).flex(Flex::Center).areas(area);
    let [h] = Layout::horizontal([Constraint::Length(width.min(area.width))]).flex(Flex::Center).areas(v);
    h
}

fn draw_confirm(frame: &mut Frame, label: &str, count: usize) {
    let area = centered(frame, 56, 7);
    let detail = if count > 1 { format!("This ends all {count} processes.") } else { String::new() };
    let text = vec![
        Line::from(vec![Span::raw("End "), Span::styled(label.to_string(), Style::new().bold()), Span::raw("?")]),
        Line::from(detail).fg(Color::Gray),
        Line::from("Unsaved data in it will be lost.").fg(Color::Gray),
        Line::from(""),
        Line::from(vec![
            Span::styled("y", Style::new().fg(Color::LightRed).bold()),
            Span::raw(" end task    "),
            Span::styled("n", Style::new().fg(ACCENT).bold()),
            Span::raw(" cancel"),
        ]),
    ];
    frame.render_widget(Clear, area);
    frame.render_widget(
        Paragraph::new(text)
            .centered()
            .wrap(Wrap { trim: true })
            .block(panel(" End task ").border_style(Style::new().fg(Color::LightRed))),
        area,
    );
}

fn draw_help(frame: &mut Frame) {
    let keys: &[(&str, &str)] = &[
        ("Tab / Shift+Tab, 1–7", "switch tab"),
        ("↑↓ / j k", "move selection"),
        ("PgUp PgDn / g G", "page / jump to top, bottom"),
        ("→ ← / l h, Enter", "expand / collapse group"),
        ("/ or f", "filter by name"),
        ("Esc", "clear filter"),
        ("s / S", "next sort column / reverse order"),
        ("x / Delete", "end task (asks first)"),
        ("r", "reset App history · reload lists"),
        ("mouse", "click tabs, headers, rows; scroll"),
        ("q / Ctrl+C", "quit"),
    ];
    let mut lines: Vec<Line> = keys
        .iter()
        .map(|(k, v)| {
            Line::from(vec![
                Span::styled(format!("{k:>22}  "), Style::new().fg(ACCENT).bold()),
                Span::raw(*v),
            ])
        })
        .collect();
    lines.push(Line::from(""));
    lines.push(Line::from("Press any key to close").fg(Color::DarkGray).centered());

    let area = centered(frame, 62, lines.len() as u16 + 2);
    frame.render_widget(Clear, area);
    frame.render_widget(Paragraph::new(lines).block(panel(" Keys ")), area);
}
