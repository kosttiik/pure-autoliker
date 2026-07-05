# Pure Auto-Liker

A Chromium browser extension (Chrome, Brave, Edge, Opera, Vivaldi, Yandex
Browser, etc.) that auto-likes profiles in the [pure.app](https://pure.app)
feed. It skips profiles you've already liked, likes only new ones, keeps a
human-like pace, and can set the distance filter — or an arbitrary city — for
you.

**Landing page:** https://kosttiik.github.io/pure-autoliker/ (bilingual RU/EN).

The popup UI and the on-site labels it looks for both switch between English
and Russian automatically, based on the browser's locale.

## Features

- Likes only **un-liked** profiles; already-liked ones are scrolled past quickly.
- Remembers who you've liked across runs. A like on Pure lasts 24 hours — after
  that the profile becomes available again.
- Rate limiting: three speed presets (Calm / Normal / Turbo) plus manual
  min/max delays, a periodic long pause, and an optional daily cap.
- Location filter: Nearby / Neighbors / … / Anywhere, a handful of built-in
  cities, or **any city** — typed in and found via the site's own location
  search.
- Runs in the background — you can close the popup and switch tabs; the like
  counter shows on the toolbar icon.
- Dry-run: highlights the hearts without clicking, handy to check that it
  finds the right buttons.
- Bilingual (en/ru) UI, picked automatically from the browser locale.

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
class names (styled-component classes are hashed). All selectors and on-site
text live in [`src/selectors.js`](src/selectors.js); if Pure changes its
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
4. You can close the popup; liking continues in the background. To stop, open
   it again and hit **Stop**.

For the first run, turn on **Dry-run**: confirm the hearts get highlighted and
get a feel for the pace.

## Settings

| Option | What it does |
|---|---|
| Location | Distance preset, a built-in city, or **✏️ Other city…** to type any city — it's found via the site's own location search. "Keep" leaves the site's current filter untouched. |
| Auto-apply filter | Let the extension set the location filter on the site; otherwise the current one on the site is used as-is. |
| Speed preset | Calm (1.5–3 s), Normal (0.8–1.2 s), or Turbo (0.35–0.7 s) delay between likes. |
| Fine tuning → Min/Max delay | Manual override for the delay between likes, ms. |
| Fine tuning → Long pause every | Take a long pause after N likes. |
| Fine tuning → Daily cap | Stop after N likes per day (0 = no limit). |
| Fine tuning → Scroll pause min/max | Pause between scroll steps over already-liked profiles, ms. |
| Dry-run | Highlight only, no clicks. |

## Troubleshooting

- **No debugging banner, no likes.** Close DevTools on the pure.app tab — the
  debugger can't attach while DevTools is open. Then restart.
- **Highlights but doesn't like.** Most likely DevTools is open (see above), or
  the debugging banner was dismissed.
- **Doesn't find profiles / won't scroll.** Pure may have changed its markup.
  Open the console (clicks won't work with it open, but logs are visible), hit
  Start and check the pass-over-feed log line. If it reports zero un-liked
  hearts, fix `likeHeartPathPrefixes` in [`src/selectors.js`](src/selectors.js).
- **Custom city not found.** The English distance/city labels in
  [`src/i18n.js`](src/i18n.js) are best-effort translations of Pure's own UI
  text — if a label doesn't match what's actually on the site, the location
  popup search will fail; fix the label there.

## Layout

```
manifest.json            — MV3 manifest
src/i18n.js               — en/ru dictionaries for the popup UI and on-site labels
src/selectors.js          — DOM selectors and on-site text (edit here when markup changes)
src/content.js            — core logic: search, scroll, timing, location filter
src/background.js         — trusted clicks and scroll via chrome.debugger (CDP)
src/inject.js             — fetch hook to detect blocks/captchas
src/popup.html/.css/.js   — settings UI
icons/                    — toolbar and store icons
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

[GPL-3.0](LICENSE).
