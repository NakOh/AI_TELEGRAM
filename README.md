# New Telegram

A personal fork of [Telegram Web A](https://github.com/Ajaxy/telegram-tt), wrapped in Electron with custom quality-of-life features aimed at reducing channel-feed noise.

## Customizations

- **Hide forwarded messages** — global toggle in the left side menu (☰ → More → Hide Forwarded). Filters forwarded messages out of the message list and hides entire chats whose latest message is forwarded.
- **Stories ribbon removed** — the stories row at the top of the chat list is hidden.
- **Electron wrapper** — runs as a desktop app with its own persistent session directory (`%APPDATA%/telegram-custom` on Windows), separate from other Electron apps.
- **WebSocket timeouts relaxed** — `PromisedWebSockets` connection timeout raised for unstable networks.

## Requirements

- Node.js `^22.6 || ^24`
- npm `^10 || ^11`
- A working network path to Telegram servers. If your IP is blocked at the WebSocket handshake, use a VPN such as [Cloudflare WARP](https://1.1.1.1/).

## Running (development)

Two processes. Start the webpack dev server first, then launch Electron pointing at it:

```bash
npm install
npm run dev           # serves http://localhost:1234
npm run electron:dev  # opens Electron with DevTools detached
```

`electron:dev` passes `--dev` to the main process, which loads `http://localhost:1234/` and opens DevTools. Source edits hot-reload automatically.

## Running (production build)

```bash
npm run build:production
npm run electron:start
```

`electron:start` loads the built `dist/index.html` directly. Use `electron:build` to produce a packaged installer via electron-builder.

## Project layout

Only customization-related paths are listed — everything else mirrors upstream.

- `electron/main.cjs` — Electron main process. Picks dev vs prod entry point, pins `userData` to `telegram-custom`.
- `electron/preload.cjs` — preload script (currently minimal).
- `src/hooks/useHideForwarded.ts` — module-level store with per-instance subscriptions; exposes `isHideForwardedMessages` and `toggleHideForwarded`.
- `src/components/left/main/LeftSideMenuItems.tsx` — adds the toggle to the "More" submenu.
- `src/components/left/main/ChatList.tsx` — debounced filter that drops chats whose last message is forwarded when the toggle is on.
- `src/components/left/main/ChatFolders.tsx` — story ribbon render removed.
- `src/components/middle/MessageList.tsx` — filters forwarded messages out of the rendered list.

## Session persistence

Session data (IndexedDB, localStorage, cache) lives under `%APPDATA%/telegram-custom/` on Windows. Delete that folder to force a fresh login. Don't run multiple Electron-based apps against the default `Electron` userData dir — they clobber each other's sessions.

## Known limitations

- Filtering runs at the UI layer. Forwarded messages are still received and counted server-side; they are only hidden from the rendered view.
- Scrollbar behavior in the chat list jitters slightly when many forwarded messages arrive while the filter is on. A 300ms debounce mitigates this but does not eliminate it.

## Upstream

This repo tracks [Ajaxy/telegram-tt](https://github.com/Ajaxy/telegram-tt) as `upstream`. Rebase or merge from there to pull in Telegram Web A updates.

```bash
git remote add upstream https://github.com/Ajaxy/telegram-tt.git
git fetch upstream
git rebase upstream/master
```

## License

GPL-3.0-or-later, inherited from upstream.
