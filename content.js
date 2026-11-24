// Finite for YouTube
// Snapshots the first few videos (9 by default) YouTube serves on the home page each day
// (skipping any shown yesterday), then shows only that frozen list for the
// rest of the day.

// LIMIT and ROLLOVER_HOUR come from the settings popup (see settings.js).
let LIMIT = DEFAULT_SETTINGS.perDay; // videos per day
let ROLLOVER_HOUR = DEFAULT_SETTINGS.resetHour; // the "day" starts at this hour, local time
const MIN_ON_TIMEOUT = 5; // save fewer than LIMIT if the feed is slow/thin
const CAPTURE_TIMEOUT_MS = 20000;
const ROOT_ID = "yt10-root";

let snapshot = null; // { day, videos: [{id, title, channel}], limit: how many were asked for }
let previous = null; // { day, ids: [videoId] } from the last snapshot before today's
let loaded = false;
let captureStart = 0;

const dayKey = (daysAgo = 0) => dayKeyFor(ROLLOVER_HOUR, daysAgo);

// Videos shown yesterday can't be picked again today.
function excludedIds() {
  return previous && previous.day === dayKey(1) ? new Set(previous.ids) : new Set();
}

const isHome = () => location.pathname === "/";

async function load() {
  const stored = await browser.storage.local.get(["snapshot", "previous", "settings"]);
  snapshot = stored.snapshot || null;
  previous = stored.previous || null;
  applySettings(stored.settings);
  await rotateIfStale();
  await trimSnapshot();
  loaded = true;
}

function applySettings(raw) {
  const s = cleanSettings(raw);
  LIMIT = s.perDay;
  ROLLOVER_HOUR = s.resetHour;
  // The grid CSS reads these (content.css, subscriptions.css, responsive.css).
  const root = document.documentElement;
  root.style.setProperty("--yt10-max", String(s.maxAcross));
  root.setAttribute("data-yt10-max", String(s.maxAcross));
  root.setAttribute("data-yt10-comments", s.showComments ? "on" : "off"); // see distractions.css
  root.setAttribute("data-yt10-shorts", s.allowShorts ? "on" : "off");
}

// Asked for fewer videos than saved: drop the extras, so tomorrow's "no repeats"
// only counts videos that were actually shown. (Asking for more later tops the
// list up from the feed, see tryCapture.)
async function trimSnapshot() {
  if (!snapshot || snapshot.videos.length <= LIMIT) return;
  snapshot.videos = snapshot.videos.slice(0, LIMIT);
  snapshot.limit = LIMIT;
  await save();
}

// The popup changed a setting: re-read everything it may have touched, and
// redraw. (Our own snapshot saves don't include "settings", so they're ignored.)
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "local" || !changes.settings) return;
  const stored = await browser.storage.local.get(["snapshot", "previous", "settings"]);
  snapshot = stored.snapshot || null;
  previous = stored.previous || null;
  applySettings(stored.settings);
  await rotateIfStale();
  await trimSnapshot();
  captureStart = 0;
  schedule();
});

// If the saved snapshot is from an earlier day, remember its video IDs (so
// they can be excluded) and clear it so a fresh one gets captured. Runs on
// load and again whenever the day changes while a page is left open.
async function rotateIfStale() {
  if (!snapshot || snapshot.day === dayKey()) return;
  previous = { day: snapshot.day, ids: snapshot.videos.map((v) => v.id) };
  snapshot = null;
  captureStart = 0;
  await browser.storage.local.set({ previous });
  await browser.storage.local.remove("snapshot");
}

function save() {
  return browser.storage.local.set({ snapshot });
}

// ---- capture -------------------------------------------------------------

function videoIdFromHref(href) {
  try {
    const u = new URL(href, location.origin);
    if (u.pathname !== "/watch" || u.searchParams.has("list")) return null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

function extractCard(card) {
  if (card.querySelector("ytd-ad-slot-renderer, ad-badge-view-model, [aria-label='Sponsored']")) return null;
  const link = card.querySelector('a[href^="/watch"]');
  if (!link) return null;
  const id = videoIdFromHref(link.getAttribute("href"));
  if (!id) return null;

  const titleEl = card.querySelector("#video-title, h3, [title]");
  const title =
    (titleEl && (titleEl.getAttribute("title") || titleEl.textContent)) ||
    link.getAttribute("title") ||
    link.getAttribute("aria-label") ||
    "";
  return {
    id,
    title: title.trim().replace(/\s+/g, " "),
    channel: channelOf(card),
  };
}

// Where a card might keep the channel name, most reliable first. The old code
// took only the FIRST match of one combined selector, and the first match is
// often the channel's avatar link (same href, no text), which gave a blank name.
// So: try every candidate and use the first that actually has text.
const CHANNEL_SELECTORS = [
  "ytd-channel-name a",
  "ytd-channel-name #text",
  "ytd-channel-name",
  "a[href^='/@']",
  "a[href^='/channel/']",
  "a[href^='/c/']",
  "a[href^='/user/']",
  ".yt-content-metadata-view-model-wiz__metadata-text",
  ".yt-content-metadata-view-model__metadata-text",
];
const NOT_A_CHANNEL = /\b(views?|watching|ago|waiting|premieres?)\b|^\d[\d.,]*[KMB]?$/i;

function channelOf(card) {
  for (const sel of CHANNEL_SELECTORS) {
    for (const node of card.querySelectorAll(sel)) {
      const text = node.textContent.trim().replace(/\s+/g, " ");
      if (text && !NOT_A_CHANNEL.test(text)) return text;
    }
  }
  return "";
}

// New videos from the live feed, skipping yesterday's and any already in `have`,
// enough to bring the list up to LIMIT.
function collect(have = []) {
  const seen = excludedIds();
  for (const v of have) seen.add(v.id);
  const videos = [];
  for (const card of document.querySelectorAll("ytd-rich-item-renderer")) {
    if (have.length + videos.length >= LIMIT) break;
    const v = extractCard(card);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    videos.push(v);
  }
  return videos;
}

async function tryCapture() {
  await rotateIfStale();
  // A saved list is final, unless the user has since asked for more videos
  // than it was made with (older saves had no "limit": they were made with 9).
  if (snapshot && (snapshot.limit ?? DEFAULT_SETTINGS.perDay) >= LIMIT) return;
  if (!captureStart) captureStart = Date.now();
  const have = snapshot ? snapshot.videos : [];
  const videos = have.concat(collect(have));
  const timedOut = Date.now() - captureStart > CAPTURE_TIMEOUT_MS;
  // A top-up that can't find more in time keeps what it has.
  const enough = timedOut && (snapshot || videos.length >= Math.min(MIN_ON_TIMEOUT, LIMIT));
  if (videos.length >= LIMIT || enough) {
    snapshot = { day: dayKey(), videos, limit: LIMIT };
    await save();
  }
}

// ---- fill gaps -----------------------------------------------------------

// Some cards (e.g. collabs) don't expose a channel in the feed DOM, or haven't
// finished rendering it yet. YouTube's same-origin oEmbed endpoint gives us the
// channel and title by video ID. Results are cached; transient failures (network
// blips) are retried a few times, but "this video can't be looked up" answers
// (4xx, e.g. embedding disabled) are final.
const oembedCache = new Map(); // id -> in-flight/finished promise of {title, author_name} | null

function lookupOembed(id) {
  if (!oembedCache.has(id)) {
    oembedCache.set(
      id,
      (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(
              `/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
            );
            if (res.ok) return await res.json();
            if (res.status >= 400 && res.status < 500) return null;
          } catch {}
          await new Promise((r) => setTimeout(r, 1500));
        }
        return null;
      })()
    );
  }
  return oembedCache.get(id);
}

async function fillMissing() {
  if (!snapshot) return false;
  let changed = false;
  for (const v of snapshot.videos) {
    if (v.channel && v.title) continue;
    const data = await lookupOembed(v.id);
    if (!data) continue;
    if (!v.channel && data.author_name) { v.channel = data.author_name; changed = true; }
    if (!v.title && data.title) { v.title = data.title; changed = true; }
  }
  if (changed) await save();
  return changed;
}

// ---- rendering -----------------------------------------------------------

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// One card: thumbnail, title, channel name.
function buildCard(v) {
  const a = el("a", "yt10-card");
  a.href = `/watch?v=${encodeURIComponent(v.id)}`;
  const thumb = el("div", "yt10-thumb");
  const img = el("img");
  img.src = `https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg`;
  img.alt = "";
  thumb.append(img);
  a.append(thumb, el("div", "yt10-title", v.title || v.id), el("div", "yt10-channel", v.channel));
  return a;
}

function buildRoot() {
  const root = el("div");
  root.id = ROOT_ID;
  if (!snapshot) {
    root.append(
      el("div", "yt10-header", "Capturing today's recommendations…"),
      el("div", "yt10-sub", "Waiting for YouTube to load your feed.")
    );
    return root;
  }
  const videos = snapshot.videos.slice(0, LIMIT); // trims older 10-item snapshots
  const grid = el("div", "yt10-grid");
  for (const v of videos) {
    grid.append(buildCard(v));
  }
  root.append(grid);
  return root;
}

function render() {
  const existing = document.getElementById(ROOT_ID);
  if (!isHome()) {
    if (existing) existing.remove();
    return;
  }
  const browseEl = document.querySelector('ytd-browse[page-subtype="home"]');
  if (!browseEl) return;
  const root = buildRoot();
  // Skip DOM churn if nothing changed.
  if (existing && existing.parentElement === browseEl && existing.isEqualNode(root)) return;
  if (existing) existing.remove();
  browseEl.prepend(root);
}

// ---- subscriptions page --------------------------------------------------

// YouTube's own cards on the subscriptions page show avatars, view counts and
// dates. Instead of hiding those one by one (class names keep changing), swap
// each card's contents for our own card, built from the title/channel we read
// off it. The native cards stay in the grid, so infinite scroll keeps working.
const isSubscriptions = () => location.pathname === "/feed/subscriptions";

function restyleSubscriptions() {
  if (!isSubscriptions()) return;
  const cards = document.querySelectorAll(
    "ytd-browse[page-subtype='subscriptions'] ytd-rich-item-renderer:not(.yt10-done):not(.yt10-skip)"
  );
  for (const card of cards) {
    const v = extractCard(card);
    if (!v) {
      // Shorts, ads, playlists: drop. Cards with no links yet haven't rendered.
      if (card.querySelector("a[href]") || card.querySelector("ytd-ad-slot-renderer")) {
        card.classList.add("yt10-skip");
      }
      continue;
    }
    if (!v.title) continue; // not fully rendered yet; retry next pass
    card.classList.add("yt10-done");
    const ours = buildCard(v);
    card.append(ours);
    // Channel not in the page yet (or hidden, e.g. collabs): look it up.
    if (!v.channel) {
      lookupOembed(v.id).then((data) => {
        if (data && data.author_name) ours.querySelector(".yt10-channel").textContent = data.author_name;
      });
    }
  }
}

// ---- wiring --------------------------------------------------------------

function syncHomeClass() {
  document.documentElement.classList.toggle("yt10-home", isHome());
}

let timer = null;
function schedule() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    syncHomeClass();
    if (!loaded) return;
    if (isHome()) await tryCapture();
    restyleSubscriptions();
    render();
    if (await fillMissing()) render();
  }, 200);
}

syncHomeClass(); // synchronously at document_start so the feed never flashes

load().then(schedule);

new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
window.addEventListener("yt-navigate-finish", () => {
  captureStart = 0;
  schedule();
});
window.addEventListener("popstate", schedule);
// Re-check capture while the feed is still loading but nothing is mutating.
setInterval(schedule, 2000);

// ---- don't autoplay on entering fullscreen / theater mode ----------------

// On a freshly loaded watch page the video can sit paused (Firefox blocks
// autoplay), and then YouTube starts it the moment you go fullscreen or switch
// to theater mode. If the video was paused just before the switch, put it back
// to paused when it starts playing within 2 seconds. Any key press or click
// after the switch cancels the guard, so deliberately pressing play always works.
const mainVideo = () => document.querySelector("#movie_player video, video.html5-main-video");
const pausedSamples = []; // paused-state of the video over the last ~500ms
let guardUntil = 0;
let navAt = Date.now(); // when this page, or the last in-app navigation, started loading
window.addEventListener("yt-navigate-finish", () => { navAt = Date.now(); });

setInterval(() => {
  if (location.pathname !== "/watch") return;
  const v = mainVideo();
  if (!v) return;
  pausedSamples.push(v.paused);
  if (pausedSamples.length > 5) pausedSamples.shift();
}, 100);

function cancelPlayGuard() {
  guardUntil = 0;
}

// Called the moment the view mode changes (fullscreen or theater).
function armPlayGuard() {
  if (location.pathname !== "/watch" || pausedSamples.length === 0) return;
  // Ignore changes while the page is still loading (YouTube applies your saved
  // theater setting then, and normal autoplay must not be blocked).
  if (Date.now() - navAt < 2500) return;
  // Oldest sample = state from before the click/keypress that caused this.
  if (pausedSamples[0] !== true) return;
  guardUntil = Date.now() + 2000;
  // Wait a tick so the click that triggered the switch doesn't cancel the guard.
  setTimeout(() => {
    for (const type of ["keydown", "pointerdown"]) {
      document.addEventListener(type, cancelPlayGuard, { capture: true, once: true });
    }
  }, 100);
}

document.addEventListener("fullscreenchange", armPlayGuard);

// Theater mode is just an attribute on <ytd-watch-flexy>; there's no event for it.
new MutationObserver(armPlayGuard).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["theater"],
  subtree: true,
});

document.addEventListener(
  "play",
  (e) => {
    if (Date.now() < guardUntil && e.target === mainVideo()) e.target.pause();
  },
  true
);
