# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                # install JS deps
npm run dev                 # frontend only, in a browser, against mock data (localhost:1420)
npm run tauri dev           # full app: compiles Rust + opens a native window with real sysinfo data
npm run build                # tsc typecheck + vite build -> dist/ (also runs automatically before `tauri build`)
npm run tauri build          # release binaries + installers in src-tauri/target/release/bundle/

npx playwright test                          # full e2e suite (runs against mock data via a dev server Playwright starts itself)
npx playwright test tests/processes.spec.ts   # one file
npx playwright test -g "right-click"          # by test name

cd src-tauri && cargo test    # Rust unit tests (prettify_process_name, get_services, get_startup_apps)
cd src-tauri && cargo check   # fast Rust compile check
```

There is no linter configured; `npm run build`'s `tsc` step (or `npx tsc --noEmit`) is the typecheck/lint gate.

## Architecture

### Every screen has a real path and a mock path

`isTauri()` (`src/mockData.ts`) checks for `window.__TAURI_INTERNALS__`. Every data-fetching
call in every tab branches on it:

```ts
const data = isTauri() ? await invoke("some_command") : mockSomething();
```

This is why the frontend runs standalone in a plain browser with no Rust toolchain at all —
`npm run dev` exercises the exact same components against `src/mockData.ts`'s generated data.
**When adding a new backend capability, add both the Tauri command (`src-tauri/src/lib.rs`) and
a matching mock function in `mockData.ts`**, or the tab will work in the real app but break (or
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

`get_services` and `get_startup_apps` in `lib.rs` are `#[cfg(target_os = "linux")]` with an
empty-Vec fallback on other platforms — on Windows/macOS those two tabs will show nothing when
run as the real Tauri app (mock data still works everywhere since it doesn't hit the OS).

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

`vercel.json` at the repo root deploys `website/` with no build step. Its `outputDirectory` is
resolved relative to whatever Vercel's dashboard "Root Directory" project setting is (currently
`website`), which is why `outputDirectory` is `"."` and not `"website"`.

### Version numbers

Kept in sync manually across three files: `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json`. `.github/workflows/release.yml` builds cross-platform installers
and creates a draft GitHub Release whenever a `v*` tag is pushed.
