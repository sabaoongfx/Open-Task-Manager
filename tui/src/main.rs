//! `otm` — Open Task Manager in the terminal. Uses the same `otm-core` data collection as the
//! Tauri app, so every number here matches the GUI.

mod app;
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
        terminal.draw(|frame| ui::draw(frame, app))?;
        let timeout = app.interval.saturating_sub(last_tick.elapsed());
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
    let mut app = App::new(interval);

    let mut terminal = ratatui::init();
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
        let mut app = App::new(Duration::from_millis(1500));
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
            };
            assert!(screen.contains(expected), "{tab:?} tab missing {expected:?}:\n{screen}");
        }
    }

    #[test]
    fn filter_sort_and_kill_prompt() {
        let mut app = App::new(Duration::from_millis(1500));
        press(&mut app, KeyCode::Char('6')); // Details: one row per process
        press(&mut app, KeyCode::Char('/'));
        for c in "otm".chars() {
            press(&mut app, KeyCode::Char(c));
        }
        press(&mut app, KeyCode::Enter);
        let screen = render(&mut app);
        assert!(screen.contains("filter: otm"), "{screen}");

        // The test binary itself matches "otm" by name, so there is a row to act on.
        press(&mut app, KeyCode::Char('x'));
        assert!(matches!(app.popup, Some(app::Popup::ConfirmKill { .. })));
        assert!(render(&mut app).contains("End task"));
        press(&mut app, KeyCode::Char('n')); // cancel — never actually kill anything in tests
        assert!(app.popup.is_none());

        press(&mut app, KeyCode::Char('s'));
        assert!(render(&mut app).contains('▲') || render(&mut app).contains('▼'));
    }
}
