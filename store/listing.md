# Mozilla Add-ons listing (copy and paste into the developer hub)

Not part of the extension package (package.sh leaves this folder out).

## Name
Finite for YouTube

## Summary (max 250 characters)
Makes YouTube finite: a small daily list of recommended videos instead of an endless feed. No infinite scroll, a cleaner watch page, and everything stays on your device.

## Description
Finite for YouTube turns the endless YouTube home page into a short list you can finish.

**What it does**
- Home page: shows a frozen grid of your first recommended videos of the day (nine by default). Reloading doesn't change it. New picks arrive at the hour you choose (4:00 AM by default), and a video that was in yesterday's list can't come back.
- Subscriptions page: a clean grid (thumbnail, title, channel) with normal infinite scrolling.
- Search: videos only. Shorts, channels, playlists, shelves and ads are hidden.
- Watch page: player centered, with no suggestions, comments, live chat, end-screen suggestions, or ambient glow.
- Cleaner top bar and a responsive grid.

**Settings** (click the toolbar icon)
- Recommended videos per day (1 to 30, default 9)
- Most videos across (3, 4 or 5, default 3)
- Time new recommendations arrive (default 4:00 AM)
- Show comments under videos (on by default)

**Privacy**
Everything stays in your browser. The extension runs only on www.youtube.com, saves your daily list and settings in Firefox's local extension storage, and sends nothing anywhere. Its one network request goes to YouTube itself (/oembed), to fill in a channel name or title missing from the page.

**Good to know**
Works by reading and restyling YouTube's page, which YouTube changes without notice, so parts may break over time. Desktop Firefox 140 or newer only.

Finite for YouTube is an independent project. It is not affiliated with, endorsed by, or sponsored by YouTube or Google. YouTube is a trademark of Google LLC.

## Categories
Suggested: Photos, Music & Videos (primary), and Appearance.

## Tags (suggestions)
youtube, focus, productivity, distraction-free, feed

## Support
Support site: https://github.com/lukejimenez/finite-for-youtube/issues (or add an email)
Homepage: https://github.com/lukejimenez/finite-for-youtube

## Notes for the reviewer
- No build step, minification or bundling. The uploaded zip is the plain source.
- No remote code. No eval, no innerHTML: page content is built with createElement and textContent.
- Permissions: `storage` only. The content scripts run on https://www.youtube.com/* and nothing else.
- Network: one same-origin fetch to YouTube's /oembed endpoint, to fetch a video's title and channel name when the page didn't contain them. No third-party requests and no data collection (data_collection_permissions: none).
- Thumbnails are shown with <img> tags pointing at i.ytimg.com, the same host YouTube itself uses.
- To test: open youtube.com signed in or out; the home page shows the saved list; click the toolbar icon to change the settings.

## Upload checklist
1. Run `./package.sh` and upload `dist/finite-for-youtube-<version>.zip`.
2. Compatibility: tick Firefox for desktop only. Untick Firefox for Android (the add-on is built for desktop and the popup and layout aren't made for phones). The manifest still declares an Android minimum version only so the "no data collected" declaration validates.
3. Add a 128x128 or larger icon if the form asks for one, plus a few screenshots (home grid, subscriptions grid, watch page, settings popup).
4. Fill in support email/site and the homepage (the GitHub repo URL).
5. License: choose "MIT License" in the form (matches the LICENSE file in the repo).
