# Finite for YouTube

A Firefox extension that makes YouTube finite. You get **a small list of recommended videos each day** (nine by default, and you choose the number), and that's it. No infinite scroll, no endless feed: once you've seen your list, you find videos yourself by searching.

## What it does
- **Home page:** shows a frozen grid of the first nine videos YouTube recommends to you each day (you can change the number). Reloading doesn't change it. New picks arrive at 4am (you can change that too).
- **No repeats:** a video that was in yesterday's list can't come back today.
- **Subscriptions page:** same clean grid (thumbnail, title, channel) but with normal infinite scrolling.
- **Search:** videos only. Shorts, channels, playlists, shelves and ads are hidden.
- **Watch page:** player centered and a little smaller, with no suggestions, comments or live chat.
- **Cleaner top bar:** a slightly taller bar, and no "Ask" or Shorts buttons.
- **Responsive:** the grid shows up to 3 across (you can allow 4 or 5) and steps down to 2 and 1 as the window narrows.
- **Settings:** click the extension's icon in the Firefox toolbar to change how many videos you get per day (1–30, default 9), the most videos across (3, 4 or 5, default 3), and the hour new recommendations arrive (default 4:00 AM). Changes apply right away.

## Install (Firefox on desktop, version 140 or newer)
1. Download the latest signed file: [nine-a-day-1.0.0.xpi](https://github.com/lukejimenez/youtube-nine-per-day/raw/main/releases/nine-a-day-1.0.0.xpi). If Firefox installs it straight away, great. If it downloads instead, go to step 2.
2. Drag the downloaded `.xpi` onto an open Firefox window and click **Add**.

That's it. It's signed by Mozilla, so it installs on regular Firefox with no special settings.

It does **not** work in Chrome, Safari, Edge, or Firefox on phones.

### Updating
Updates aren't automatic. When there's a new version, download the new `.xpi` from the `releases` folder and install it the same way. It installs over the old one and keeps your data.

## Privacy
Everything stays in your browser. The extension only runs on `www.youtube.com`, saves your daily list in Firefox's local extension storage, and sends nothing anywhere. The one network request it makes is to YouTube itself (`/oembed`), to fill in a channel name or title that was missing from the page.

## Tweaking it
Everything is plain JavaScript and CSS, with no build step.

| What | Where |
|---|---|
| Videos per day, most across, reset hour | the toolbar icon (defaults in `settings.js`) |
| When the grid steps down to fewer columns | `responsive.css` |
| Top bar height (default 68px) | `searchbar.css` |
| Watch page player size | `watch.css` |

## Running from source
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json`
3. Open youtube.com (the add-on is removed when Firefox restarts)

## Caveats
This works by reading and restyling YouTube's page, which YouTube changes without notice, so parts of it may break over time. It was built with [Claude Code](https://claude.com/claude-code).

Finite for YouTube is an independent project. It is not affiliated with, endorsed by, or sponsored by YouTube or Google. YouTube is a trademark of Google LLC.
