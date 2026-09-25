# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # install JS deps
npm run dev                 # frontend only, in a browser, against mock data (localhost:1420)
npm run tauri dev           # full app: compiles Rust + opens a native window with real sysinfo data
npm run build                # tsc typecheck + vite build -> dist/ (also runs automatically before `tauri build`)
npm run tauri build          # release binaries + installers in target/release/bundle/ (workspace root)

cargo run -p otm             # terminal UI (real data; no Node needed)

npx playwright test                          # full e2e suite (runs against mock data via a dev server Playwright starts itself)
npx playwright test tests/processes.spec.ts   # one file
npx playwright test -g "right-click"          # by test name

cargo test --workspace       # Rust tests: otm-core (prettify_process_name, get_services, get_startup_apps)
                             #   + otm (formatting, and TestBackend renders of every TUI tab against live data)
cargo check --workspace      # fast Rust compile check

cargo test -p otm export_website_demo -- --ignored   # regenerate the website's otm screens
python3 -m http.server -d website 8000               # preview the static website locally
appstreamcli validate --no-net packaging/linux/io.github.sabaoongfx.OpenTaskManager.appdata.xml
```

There is no linter configured; `npm run build`'s `tsc` step (or `npx tsc --noEmit`) is the typecheck/lint gate.

## Architecture

### Rust is a Cargo workspace: `core/` + `src-tauri/` + `tui/`

The root `Cargo.toml` is a workspace (one shared `Cargo.lock` and `target/` at the repo root).
All system data collection lives in **`core/` (`otm-core`)**: the `Monitor` struct (owns the
`sysinfo` handles and the rate/App-history state; `snapshot()`, `kill_process()`,
`reset_app_history()`) plus `get_services()`/`get_startup_apps()` and the serialized types.
`src-tauri/src/lib.rs` is only thin `#[tauri::command]` wrappers around it (`Mutex<Monitor>`
as Tauri state), and **`tui/` (`otm` binary, ratatui + crossterm)** calls the same functions
directly. Put new backend logic in `core/`, then expose it from both frontends.

`tui/` is structured as `app.rs` (state + key/mouse handling), `views.rs` (one table-builder
per tab, mirroring each GUI pane's grouping/columns), `ui.rs` (rendering), `format.rs`
(ports of `src/format.ts`). Selection is tracked by a stable row key, not index, so it
follows the same process as rows re-sort each refresh.

### Every screen has a real path and a mock path

`isTauri()` (`src/mockData.ts`) checks for `window.__TAURI_INTERNALS__`. Every data-fetching
call in every tab branches on it:

```ts
const data = isTauri() ? await invoke("some_command") : mockSomething();
```

This is why the frontend runs standalone in a plain browser with no Rust toolchain at all —
`npm run dev` exercises the exact same components against `src/mockData.ts`'s generated data.
**When adding a new backend capability, add the logic to `core/`, a Tauri command wrapper
(`src-tauri/src/lib.rs`), and a matching mock function in `mockData.ts`**, or the tab will work in the real app but break (or
silently do nothing) in the browser-only dev flow and in Playwright (which always runs against
mock data).

Processes/Performance/App history data flows through one poll loop in `App.tsx` (a single
`get_snapshot` invoke every 1.5s, feeding `processes`/`stats`/`appHistory` state that's passed
down as props). Startup apps and Services instead self-fetch once on mount via their own
one-shot commands (`get_startup_apps`, `get_services`) since that data doesn't need 1.5s polling.

### Real vs. mock data per tab

Only Processes/Performance/Details/Users are backed by real `sysinfo` data end-to-end. Startup
apps (real `.desktop` autostart entries) and Services (real `systemctl` output) are real reads
but their Enable/Disable/Start/Stop actions only mutate local component state — they do not
touch the real system (`kill_process`/task-ending is the only real system mutation the app
performs). App history's CPU time is real and live but resets on restart (no persistence). See
`README.md`'s Roadmap section for what's intentionally left as UI-only.

`get_services` and `get_startup_apps` in `core/src/lib.rs` are `#[cfg(target_os = "linux")]` with an
empty-Vec fallback on other platforms — on Windows/macOS those two tabs will show nothing when
run as the real Tauri app (mock data still works everywhere since it doesn't hit the OS).

Known issue, not yet fixed: on Linux, `sysinfo` lists every **thread** as its own process, each
reporting its whole process's memory. That inflates the process count and summed memory (the
Users tab can show more memory than the machine has) in both the GUI and `otm`. The fix belongs in
`Monitor::snapshot()` (skip entries whose `thread_kind()` is set); it changes the GUI's numbers
too, and `otm`'s kill-prompt test relies on finding its own process by PID, not on threads.

### Shared UI conventions are copy-pasted per tab, not abstracted

`Details.tsx`, `Services.tsx`, `StartupApps.tsx`, and the Processes view in `App.tsx` each
re-implement the same two patterns rather than sharing a component:
- The `.process-table` / `.table-head` / `.table-body` / `.row` / `.col` CSS class family
  (`App.css`) for every table in the app, including the non-process tabs.
- A local `contextMenu` state + `useEffect` `window.addEventListener("click", close)` for
  right-click menus (`.context-menu` / `.context-menu-item` classes).

This duplication is intentional (kept these small and independent rather than introducing a
shared abstraction two features in) — match the existing pattern when adding a table or a
context menu rather than inventing a new one.

### The scrollbar-width CSS variable

`App.tsx` measures the real scrollbar width on mount (a hidden throwaway `div`) and sets it as
`--scrollbar-width` on `.process-table`. `.row`/`.group-header` use it in a `margin-right: calc(-20px - var(--scrollbar-width, 0px))` to make row backgrounds reach the card's true right
edge despite `.table-body`'s vertical scrollbar eating into the layout width. Without this,
row highlights visibly stop short of the card edge. `.process-table`/`.table-body` also need
`overflow-x: hidden` explicitly — leaving it unset lets it silently compute to `auto` whenever
`overflow-y` is non-`visible`, which reintroduces a (subtle, easy-to-miss) horizontal scrollbar.

### `website/` is a separate static site, not part of the Vite app

`website/index.html` is a hand-written marketing page that embeds a **real, separately-built
copy of this app** via `<iframe src="app/index.html">` (not a mockup). `website/app/` must be
regenerated any time `src/` changes meaningfully:

```bash
npx vite build --base=./ --outDir dist-embed
rm -rf website/app && mkdir website/app
cp -r dist-embed/* website/app/
rm -rf dist-embed
```

`--base=./` is required so the built asset URLs are relative (`./assets/...`) instead of root-
absolute, since this copy is served nested under `website/app/`, not at a domain root. Any
hardcoded root-absolute asset path in app source (e.g. `src="/foo.svg"`) will silently 404 in
this embed even though it works fine in the real Tauri app and in plain `npm run dev` — use
relative paths for anything in `public/` that's referenced by a literal string in source.

The terminal section's `otm` screens are **real renderer output**, not a mockup: an ignored test
(`tui/src/demo.rs`) fills `otm` with curated demo data (never the real machine's processes or user
names), renders the Processes and Performance tabs, and rewrites the block between
`<!-- otm-demo:start -->` and `<!-- otm-demo:end -->` in `website/index.html`. Re-run it after
changing the TUI's look: `cargo test -p otm export_website_demo -- --ignored`. Braille graph
characters are wrapped in `<i>` pinned to `1ch` by the site CSS, because IBM Plex Mono lacks
Braille glyphs and the fallback font's width otherwise skews every graph row.

Page sections, top to bottom: hero, `#full-demo` (the iframe), `#features`, `#terminal` (otm
screens + key cheat sheet), `#install` (tabs: apt, pacman, Windows, macOS, other Linux, terminal
only), `#download` (every direct download as cards), `#specs`, `#roadmap`. The top-left logo links
to `/`. One inline script at the bottom detects the visitor's OS from the user agent and uses it
three ways: preselects the install tab, marks the matching `#download` card "Your system", and
turns the hero's plain "Download" button (which scrolls to `#download`, also the no-JS and phone
behaviour) into a direct "Download for Windows/Mac/Linux" link with a note underneath. Macs get the
Apple Silicon `.dmg` unless a Chromium browser's `userAgentData` reports an `x86` chip (Safari and
Firefox can't tell). Every download link is a versionless `releases/latest/download/<name>` URL
(see Releasing). The site has no tests: preview it with a static server and check it in a browser
at desktop and ~390px widths.

SEO lives in `website/index.html`'s `<head>` (description, canonical, Open Graph/Twitter tags
pointing at `website/og.png`, JSON-LD `SoftwareApplication`), plus `website/robots.txt` and
`website/sitemap.xml`. All of them hardcode the production URL `https://opentaskmanager.vercel.app/`.

`vercel.json` at the repo root deploys `website/` with no build step. Its `outputDirectory` is
resolved relative to whatever Vercel's dashboard "Root Directory" project setting is (currently
`website`), which is why `outputDirectory` is `"."` and not `"website"`.

### Linux packaging (`packaging/`, `.github/workflows/publish-linux.yml`)

The package/binary name is `open-task-manager` (renamed from `task-manager` after v0.2.0; the
deb/rpm declare `Conflicts`/`Replaces` on the old name). Every Linux package ships **both**
binaries: `tauri.conf.json`'s `beforeBundleCommand` builds `otm`, and `bundle.linux.deb.files` /
`rpm.files` add it as `/usr/bin/otm` — so the `.deb`/`.rpm` from `npm run tauri build` already
contain both.

`publish-linux.yml` runs when a GitHub release is *published* (not when release.yml creates the
draft). Tags containing `-` (pre-releases) are skipped entirely, since `pkgver` can't contain `-`.
It publishes one GitHub Pages site, rebuilt from scratch each release (only the newest version is
kept), signed with one GPG key (`PACKAGES_GPG_PRIVATE_KEY` secret, UID "Open Task Manager
packages"; Pages source must be "GitHub Actions" and the `github-pages` environment must allow
`v*` tags):
- **pacman** (`/arch/x86_64/`): builds `packaging/aur/open-task-manager/PKGBUILD` from source in
  an `archlinux:base-devel` container, then `packaging/arch/make-repo.sh` signs it and runs
  `repo-add --sign --include-sigs`. Pages can't serve symlinks, so the script replaces
  repo-add's `.db`/`.files` links with copies. The script runs locally too.
- **apt** (`/`): downloads the release `.deb`, builds a signed repo with `reprepro`
  (`packaging/apt/distributions`). The Pages deploy `needs` the pacman job, so a failed Arch build
  leaves the previous site untouched rather than dropping the pacman repo.
- **AUR**: pushes `packaging/aur/open-task-manager` (source) and `open-task-manager-bin`
  (repackages the `.deb`). Skipped with a notice while the `AUR_SSH_PRIVATE_KEY` secret is unset
  (AUR registration was closed when this was set up).

CI rewrites `pkgver`/`sha256sums`, so the values committed in the PKGBUILDs are placeholders —
don't bump them by hand.

`packaging/linux/open-task-manager.desktop` is used only by the source PKGBUILD; the deb/rpm
generate theirs from `src-tauri/assets/open-task-manager.desktop.hbs` — keep the two in sync.

AppStream metadata (`packaging/linux/io.github.sabaoongfx.OpenTaskManager.appdata.xml`) goes into
the AppImage, `.deb` and `.rpm` via `bundle.linux.{appimage,deb,rpm}.files` in `tauri.conf.json`,
and into the pacman package via the source PKGBUILD. It keeps the older `.appdata.xml` suffix on
purpose: the AppImage catalog's `appdir-lint.sh` only detects that name. XML comments in it can't
contain `--`. Its screenshots point at `docs/*.png` on `main` via raw.githubusercontent.com, so
don't rename those files.

### Distribution channels: status and decisions

- **apt, pacman**: live, self-hosted on GitHub Pages (above).
- **AUR**: ready but unpublished; waiting for AUR account registration to reopen.
- **AppImage catalog** (`AppImage/appimage.github.io`): submit after v0.3.1 (the first AppImage
  with metainfo) as a one-line `data/Open-Task-Manager` file containing the repo URL. The owner
  opens that PR, not Claude. appimagehub.com is a separate Pling/OpenDesktop store with manual
  listing.
- **Flathub: not viable; don't write a Flathub manifest.** Flathub's rules forbid AI-generated
  or AI-assisted manifests and AI-opened submission PRs, and won't grant sandbox-escape exceptions
  (`--talk-name=org.freedesktop.Flatpak`, needed by any task manager to see host processes) when
  the software shows signs of LLM use, which this repo does. They also reject console apps, so
  `otm` is out either way. A self-hosted Flatpak remote would be allowed but needs a host-side
  helper run through `flatpak-spawn --host` (Mission Center's approach); deferred until users
  ask for it.

### Releasing

1. Bump the version in `package.json`, the root `Cargo.toml` (`[workspace.package] version`,
   inherited by all three crates) and `src-tauri/tauri.conf.json`, and add a `<release>` entry to
   the AppStream file above.
2. Push a `v*` tag. `.github/workflows/release.yml` builds every installer into a **draft** GitHub
   release, then a second job attaches standalone `otm` archives for each platform.
3. Publish the draft. That triggers `publish-linux.yml` (apt/pacman repos on Pages, AUR).

Every installer and `otm` archive is also uploaded under a **versionless** name
(`Open-Task-Manager-x64-setup.exe`, `-x64.msi`, `-aarch64.dmg`, `-x64.dmg`, `-amd64.deb`,
`-x86_64.rpm`, `-x86_64.AppImage`, `otm-<target>.tar.gz|.zip`). The website's and README's
`releases/latest/download/<name>` links rely on these names, so renaming any of them breaks
those links. The AppImage is additionally uploaded as `Open-Task-Manager-<version>-x86_64.AppImage`,
the AppImage catalog's naming.

Local AppImage builds fail on Arch (linuxdeploy's old `strip` and its GTK plugin's Ubuntu
paths); CI builds them on Ubuntu 22.04. `npx tauri build --bundles deb rpm` works locally.
