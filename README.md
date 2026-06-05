# Pure Auto-Liker

A Chromium browser extension (Chrome, Yandex Browser, etc.) that auto-likes
profiles in the [pure.app](https://pure.app) feed. It skips profiles you've
already liked, likes only new ones, keeps a human-like pace, and can set the
the distance filter for you.

## Features

- Likes only **un-liked** profiles; already-liked ones are scrolled past quickly.
- Remembers who you've liked across runs. A like on Pure lasts 24 hours — after
  that the profile becomes available again.
- Rate limiting: configurable delays between likes and between scroll steps,
  plus a periodic "long pause" and an optional daily cap.
- Distance filter: Nearby / Neighbors / … / Whole universe, or a specific city.
- Runs in the background — you can close the popup and switch tabs.
- Dry-run: highlights the hearts without clicking, handy to check that it finds
  the right buttons.

## How it works

Pure ignores synthetic JS clicks (it checks `isTrusted`), so a plain
`element.click()` won't register a like. To make the click real, the extension
dispatches input through the **Chrome DevTools Protocol** (`chrome.debugger` →
`Input.dispatchMouseEvent`) from a background service worker. For the same
reason the feed is scrolled with a real wheel event — otherwise lazy loading
doesn't kick in.

While the extension is working, the browser shows a yellow "… is debugging this
browser" banner. That's expected — clicks won't go through without it.

The liked/un-liked state is told apart by the heart's SVG path, not by color or
class names (styled-component classes are hashed). All selectors live in a
single file — [`src/selectors.js`](src/selectors.js); if Pure changes its
markup, that's the only place to touch.

## Install

1. Open the extensions page:
   - Chrome — `chrome://extensions`
   - Yandex Browser — `browser://extensions`
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and pick the project folder.
4. Pin the heart icon from the extensions menu.

After editing the code, hit "Reload" on the extension card and refresh the
pure.app tab.

## Usage

1. Open the `pure.app/app/...` feed and log in.
2. Click the extension icon, tweak settings if needed, hit **Start**.
3. The debugging banner appears — don't close it, and don't open DevTools on
   this tab (DevTools blocks the debugger from attaching).
4. You can close the popup; liking continues in the background. To stop, open it
   again and hit **Stop**.

For the first run, turn on **Dry-run**: confirm the hearts get highlighted and
get a feel for the pace.

## Settings

| Option | What it does |
|---|---|
| Distance | Which radius/city to set in the location filter (or "don't change"). |
| Auto-set filters | Allow the extension to touch the filters on the site. |
| Delay min/max | Pause between likes, ms. |
| Long pause every | Take a long pause after N likes. |
| Daily cap | Stop after N likes per day (0 = no limit). |
| Scroll min/max | Pause between scroll steps over liked profiles, ms. |
| Dry-run | Highlight only, no clicks. |

## Troubleshooting

- **No debugging banner, no likes.** Close DevTools on the pure.app tab — the
  debugger can't attach while DevTools is open. Then restart.
- **Highlights but doesn't like.** Most likely DevTools is open (see above), or
  the debugging banner was dismissed.
- **Doesn't find profiles / won't scroll.** Pure may have changed its markup.
  Open the console (clicks won't work with it open, but logs are visible), hit
  Start and check the `[PureLiker] старт прохода | …` line. If
  `нелайкнутых-сердец=0`, fix `likeHeartPathPrefixes` in `src/selectors.js`.

## Layout

```
manifest.json           — MV3 manifest
src/selectors.js        — all selectors and texts (edit here when markup changes)
src/content.js          — core logic: search, scroll, timing
src/background.js       — trusted clicks and scroll via chrome.debugger (CDP)
src/inject.js           — fetch hook to detect blocks
src/popup.html/.css/.js — UI
```

## Disclaimer

This project is for educational purposes — exploring Manifest V3 extensions, the
Chrome DevTools Protocol, and common anti-bot patterns on your own account. It
doesn't break Pure, bypass payments, touch anyone else's data, or exploit
vulnerabilities: it just clicks the same buttons a user would, in their own
browser, under their own session.

Automating actions may go against Pure's terms of service. Use it at your own
risk and responsibility — any account limitations are on you. No warranty.

## License

[MIT](LICENSE).
