# Finite for YouTube

A Firefox extension that makes YouTube finite. You get **a small list of recommended videos each day** (nine by default, and you choose the number), and that's it. No infinite scroll, no endless feed: once you've seen your list, you find videos yourself by searching.

## What it does
- **Home page:** shows a frozen grid of the first videos YouTube recommends to you each day. Reloading doesn't change it. New picks arrive at 4am by default.
- **No repeats:** a video that was in yesterday's list can't come back today.
- **Subscriptions page:** the same clean grid (thumbnail, title, channel), but with normal infinite scrolling.
- **Search:** videos, channels and playlists. Shorts can be allowed or hidden; shelves and ads are hidden.
- **Watch page:** player centered and a little smaller, with no suggestions, live chat, end-screen suggestions or ambient glow. Comments show by default (you can turn them off). The Ask and Picture-in-picture buttons and the fullscreen "More videos" arrow are hidden.
- **Cleaner chrome:** a slightly taller top bar, no Ask button, a configurable Shorts tab, and a soft highlight when you hover a video.
- **Responsive:** the grid steps down from your chosen maximum to fewer columns as the window narrows.

## Settings
Click the extension's icon in the Firefox toolbar. Changes apply right away, including in open YouTube tabs.

| Setting | Options | Default |
|---|---|---|
| Recommended videos per day | 1 to 30 | 9 |
| Most videos across | 3, 4 or 5 | 3 |
| New recommendations at | any hour of the day | 4:00 AM |
| Show comments under videos | on or off | on |
| Enable Shorts | on or off | off |

If you lower the number of videos, today's list is trimmed to match. If you raise it, today's list is topped up from your feed. Changing the reset hour keeps today's list rather than picking a new one.

## Install
Requires **Firefox on desktop, version 140 or newer**. It does not work in Chrome, Safari, Edge, or Firefox on phones.

You can install it from the Firefox Add-ons store once this release is listed. Until then, run it from source (below). An older signed build, 1.0.0 under the previous name "Nine a Day," is in the `releases` folder. It does not have the settings panel or the other changes listed here.

## Running from source
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and select `manifest.json`
3. Open youtube.com (a temporary add-on is removed when Firefox restarts)

To reload after changing a file, click **Reload** next to the add-on in `about:debugging`, then refresh the YouTube tab.

## Privacy
Everything stays in your browser. The extension only runs on `www.youtube.com`, saves your daily list and your settings in Firefox's local extension storage, and sends nothing anywhere. The one network request it makes itself is to YouTube (`/oembed`), to fill in a channel name or title that was missing from the page. Thumbnails load from YouTube's own image servers, just as they do on youtube.com.

## Tweaking it
Everything is plain JavaScript and CSS, with no build step.

| What | Where |
|---|---|
| Videos per day, most across, reset hour, comments, Shorts | the toolbar icon (defaults in `settings.js`) |
| Window widths where the grid steps down to fewer columns | `responsive.css` |
| Top bar height (default 68px) | `searchbar.css` |
| Watch page player size | `watch.css` |
| Which parts of YouTube are hidden | `distractions.css`, `search.css`, `watch.css` |

To build the zip that gets uploaded to Mozilla, run `./package.sh`. It writes `dist/finite-for-youtube-<version>.zip` containing only the files the extension needs. Listing text and reviewer notes are in `store/listing.md`.

## Caveats
This works by reading and restyling YouTube's page, which YouTube changes without notice, so parts of it may break over time. It was built with [Claude Code](https://claude.com/claude-code).

## License
MIT. See [LICENSE](LICENSE).

Finite for YouTube is an independent project. It is not affiliated with, endorsed by, or sponsored by YouTube or Google. YouTube is a trademark of Google LLC.
