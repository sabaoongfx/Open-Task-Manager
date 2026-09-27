//! `otm` — Open Task Manager in the terminal. Uses the same `otm-core` data collection as the
//! Tauri app, so every number here matches the GUI.

mod app;
#[cfg(test)]
mod demo;
mod format;
mod ui;
mod views;

use app::App;
use ratatui::crossterm::event::{self, DisableMouseCapture, EnableMouseCapture};
use ratatui::crossterm::execute;
use std::io;
use std::time::{Duration, Instant};

const USAGE: &str = "\
otm — Open Task Manager in the terminal

Usage: otm [options]

Options:
  -i, --interval <ms>  refresh interval in milliseconds (default 1500, min 250)
  -h, --help           show this help
  -V, --version        show version

Press ? inside the app for key bindings.";

fn parse_args() -> Result<Duration, String> {
    let mut interval = Duration::from_millis(1500);
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "-h" | "--help" => {
                println!("{USAGE}");
                std::process::exit(0);
            }
            "-V" | "--version" => {
                println!("otm {}", env!("CARGO_PKG_VERSION"));
                std::process::exit(0);
            }
            "-i" | "--interval" => {
                let value = args.next().ok_or("--interval needs a value in milliseconds")?;
                let ms: u64 = value.parse().map_err(|_| format!("invalid interval: {value}"))?;
                interval = Duration::from_millis(ms.max(250));
            }
            other => return Err(format!("unknown option: {other}\n\n{USAGE}")),
        }
    }
    Ok(interval)
}

fn run(terminal: &mut ratatui::DefaultTerminal, app: &mut App) -> io::Result<()> {
    let mut last_tick = Instant::now();
    while !app.should_quit {
        app.poll_disk_scan();
        terminal.draw(|frame| ui::draw(frame, app))?;
        let mut timeout = app.interval.saturating_sub(last_tick.elapsed());
        if app.busy() {
            timeout = timeout.min(Duration::from_millis(200)); // keep the scan's file count moving
        }
        if event::poll(timeout)? {
            app.handle_event(event::read()?);
        }
        if last_tick.elapsed() >= app.interval {
            app.tick();
            last_tick = Instant::now();
        }
    }
    Ok(())
}

fn main() -> io::Result<()> {
    let interval = match parse_args() {
        Ok(interval) => interval,
        Err(msg) => {
            eprintln!("{msg}");
            std::process::exit(2);
        }
    };

    // Collect the first snapshot before taking over the screen.
    // The Disk usage tab scans the folder otm was started in, like `du` or `ncdu`.
    let disk_root = std::env::current_dir().ok().or_else(otm_core::home_dir).unwrap_or_else(|| "/".into());
    let mut app = App::new(interval, disk_root);

    let mut terminal = ratatui::init();
    // ratatui::init's panic hook restores raw mode and the alternate screen but doesn't know
    // about mouse capture; without this, a panic leaves the shell printing escape codes on
    // every mouse move until the user runs `reset`.
    let restore_terminal = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let _ = execute!(io::stdout(), DisableMouseCapture);
        restore_terminal(info);
    }));
    execute!(io::stdout(), EnableMouseCapture)?;
    let result = run(&mut terminal, &mut app);
    let _ = execute!(io::stdout(), DisableMouseCapture);
    ratatui::restore();
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use app::Tab;
    use ratatui::backend::TestBackend;
    use ratatui::crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
    use ratatui::Terminal;

    fn render(app: &mut App) -> String {
        let mut terminal = Terminal::new(TestBackend::new(120, 32)).unwrap();
        terminal.draw(|frame| ui::draw(frame, app)).unwrap();
        let buffer = terminal.backend().buffer();
        (0..buffer.area.height)
            .map(|y| (0..buffer.area.width).map(|x| buffer[(x, y)].symbol()).collect::<String>())
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn press(app: &mut App, code: KeyCode) {
        app.handle_event(Event::Key(KeyEvent::new(code, KeyModifiers::NONE)));
    }

    // Renders every tab against the real live system and checks each shows its own content.
    #[test]
    fn renders_every_tab_with_live_data() {
        let mut app = App::new(Duration::from_millis(1500), std::env::temp_dir());
        app.tick();
        for (i, tab) in Tab::ALL.into_iter().enumerate() {
            press(&mut app, KeyCode::Char(char::from(b'1' + i as u8)));
            assert_eq!(app.tab, tab);
            let screen = render(&mut app);
            if std::env::var_os("OTM_PRINT").is_some() {
                println!("{screen}\n");
            }
            assert!(screen.contains("Open Task Manager"));
            let expected = match tab {
                Tab::Processes => "Apps",
                Tab::Performance => "Memory",
                Tab::AppHistory => "CPU time",
                Tab::Startup => "Publisher",
                Tab::Users => "User",
                Tab::Details => "User name",
                Tab::Services => "Description",
                Tab::DiskUsage => "% of folder",
            };
            assert!(screen.contains(expected), "{tab:?} tab missing {expected:?}:\n{screen}");
        }
    }

    #[test]
    fn filter_sort_and_kill_prompt() {
        let mut app = App::new(Duration::from_millis(1500), std::env::temp_dir());
        // Filter on this test process's own name, whatever the OS reports it as, so there is
        // always at least one row to act on.
        let me = std::process::id();
        let own_name = app.snapshot.processes.iter().find(|p| p.pid == me).expect("own process listed").name.clone();

        press(&mut app, KeyCode::Char('6')); // Details: one row per process
        press(&mut app, KeyCode::Char('/'));
        for c in own_name.chars() {
            press(&mut app, KeyCode::Char(c));
        }
        press(&mut app, KeyCode::Enter);
        assert!(render(&mut app).contains(&format!("filter: {own_name}")));

        press(&mut app, KeyCode::Char('x'));
        let Some(app::Popup::ConfirmKill { label, .. }) = &app.popup else { panic!("no end-task prompt") };
        assert!(label.contains(&own_name), "{label}");
        assert!(render(&mut app).contains("End task"));
        press(&mut app, KeyCode::Char('n')); // cancel — never actually kill anything in tests
        assert!(app.popup.is_none());

        press(&mut app, KeyCode::Char('s'));
        let screen = render(&mut app);
        assert!(screen.contains('▲') || screen.contains('▼'), "{screen}");
    }

    #[test]
    fn home_end_and_no_hidden_kill_key() {
        let mut app = App::new(Duration::from_millis(1500), std::env::temp_dir());
        press(&mut app, KeyCode::Char('6'));
        let rows = app.synced_view().rows.len();
        let selected = |app: &App| app.tab_state(app.tab).table.selected();

        press(&mut app, KeyCode::Char('G'));
        assert_eq!(selected(&app), Some(rows - 1));
        press(&mut app, KeyCode::Char('j')); // already at the bottom: stays put
        assert_eq!(selected(&app), Some(rows - 1));
        press(&mut app, KeyCode::Char('g'));
        assert_eq!(selected(&app), Some(0));
        press(&mut app, KeyCode::Char('k')); // already at the top: stays put
        assert_eq!(selected(&app), Some(0));

        // Only the documented keys (x / Delete) may start ending a task.
        press(&mut app, KeyCode::Char('e'));
        assert!(app.popup.is_none());
    }

    #[test]
    fn disk_usage_scans_expands_filters_and_rescans() {
        let dir = std::env::temp_dir().join(format!("otm-tui-disk-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("videos/old")).unwrap();
        std::fs::write(dir.join("videos/movie.mkv"), vec![1u8; 300_000]).unwrap();
        std::fs::write(dir.join("videos/old/clip.mkv"), vec![1u8; 100_000]).unwrap();
        std::fs::write(dir.join("notes.txt"), vec![1u8; 10_000]).unwrap();

        let wait = |app: &mut App| {
            let start = Instant::now();
            while app.scanning() {
                assert!(start.elapsed() < Duration::from_secs(10), "scan never finished");
                std::thread::sleep(Duration::from_millis(10));
                app.poll_disk_scan();
            }
        };

        let mut app = App::new(Duration::from_millis(1500), dir.clone());
        assert!(!app.scanning(), "scan must not start before the tab is opened");
        press(&mut app, KeyCode::Char('8'));
        assert_eq!(app.tab, Tab::DiskUsage);
        wait(&mut app);
        let screen = render(&mut app);
        assert!(screen.contains("3 files"), "{screen}");
        assert!(screen.contains("▸ videos/"), "{screen}");
        assert!(!screen.contains("movie.mkv"), "folders start collapsed:\n{screen}");

        press(&mut app, KeyCode::Down); // videos/ (biggest first)
        press(&mut app, KeyCode::Right);
        let screen = render(&mut app);
        if std::env::var_os("OTM_PRINT").is_some() {
            println!("{screen}\n");
        }
        assert!(screen.contains("▾ videos/") && screen.contains("movie.mkv"), "{screen}");

        press(&mut app, KeyCode::Char('/'));
        for c in "clip".chars() {
            press(&mut app, KeyCode::Char(c));
        }
        press(&mut app, KeyCode::Enter);
        let screen = render(&mut app);
        assert!(screen.contains(&format!("videos{0}old{0}clip.mkv", std::path::MAIN_SEPARATOR)), "{screen}");
        press(&mut app, KeyCode::Esc);

        // `o` on videos/ rescans with it as the root; Backspace goes back up.
        press(&mut app, KeyCode::Char('g'));
        press(&mut app, KeyCode::Down);
        press(&mut app, KeyCode::Char('o'));
        wait(&mut app);
        assert!(app.disk.root.ends_with("videos"), "{:?}", app.disk.root);
        assert_eq!(app.disk.scan.as_ref().unwrap().root.files, 2);
        press(&mut app, KeyCode::Backspace);
        wait(&mut app);
        assert_eq!(app.disk.scan.as_ref().unwrap().root.files, 3);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
