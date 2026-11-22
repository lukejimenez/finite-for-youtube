// YouTube Ten a Day
// Snapshots the first 9 videos YouTube serves on the home page each day
// (skipping any shown yesterday), then shows only that frozen list for the
// rest of the day.

const LIMIT = 9; // 3x3 grid
const MIN_ON_TIMEOUT = 5; // save fewer than LIMIT if the feed is slow/thin
const CAPTURE_TIMEOUT_MS = 20000;
const ROLLOVER_HOUR = 4; // the "day" starts at 4am local time
const ROOT_ID = "yt10-root";

let snapshot = null; // { day, videos: [{id, title, channel}] }
let previous = null; // { day, ids: [videoId] } from the last snapshot before today's
let loaded = false;
let captureStart = 0;
let lastDebug = "no data yet";

function dayKey(daysAgo = 0) {
  const d = new Date(Date.now() - ROLLOVER_HOUR * 3600 * 1000 - daysAgo * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Videos shown yesterday can't be picked again today.
function excludedIds() {
  return previous && previous.day === dayKey(1) ? new Set(previous.ids) : new Set();
}

const isHome = () => location.pathname === "/";

async function load() {
  const stored = await browser.storage.local.get(["snapshot", "previous"]);
  snapshot = stored.snapshot || null;
  previous = stored.previous || null;
  await rotateIfStale();
  loaded = true;
}

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

function collect() {
  const seen = excludedIds();
  const videos = [];
  for (const card of document.querySelectorAll("ytd-rich-item-renderer")) {
    const v = extractCard(card);
    if (!v || seen.has(v.id)) continue;
    seen.add(v.id);
    videos.push(v);
    if (videos.length === LIMIT) break;
  }
  return videos;
}

async function tryCapture() {
  await rotateIfStale();
  if (snapshot) return;
  if (!captureStart) captureStart = Date.now();
  const videos = collect();
  const timedOut = Date.now() - captureStart > CAPTURE_TIMEOUT_MS;
  lastDebug = `${document.querySelectorAll("ytd-rich-item-renderer").length} cards, ${
    document.querySelectorAll('ytd-rich-item-renderer a[href^="/watch"]').length
  } watch links, ${videos.length} valid`;
  if (videos.length >= LIMIT || (timedOut && videos.length >= MIN_ON_TIMEOUT)) {
    snapshot = { day: dayKey(), videos };
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
      el(
        "div",
        "yt10-sub",
        `Waiting for YouTube to load your feed. (debug: ${lastDebug})`
      )
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

// ---- don't autoplay on entering fullscreen -------------------------------

// On a freshly loaded watch page the video can sit paused (Firefox blocks
// autoplay), and then YouTube starts it the moment you go fullscreen. If the
// video was paused just before the switch, put it back to paused when it starts
// playing within 2 seconds. Any key press or click after the switch cancels the
// guard, so deliberately pressing play always works.
const mainVideo = () => document.querySelector("#movie_player video, video.html5-main-video");
const pausedSamples = []; // paused-state of the video over the last ~500ms (not fullscreen)
let guardUntil = 0;

setInterval(() => {
  if (document.fullscreenElement || location.pathname !== "/watch") return;
  const v = mainVideo();
  if (!v) return;
  pausedSamples.push(v.paused);
  if (pausedSamples.length > 5) pausedSamples.shift();
}, 100);

function cancelFullscreenGuard() {
  guardUntil = 0;
}

document.addEventListener("fullscreenchange", () => {
  if (location.pathname !== "/watch" || pausedSamples.length === 0) return;
  // Oldest sample = state from before the click/keypress that caused this.
  if (pausedSamples[0] !== true) return;
  guardUntil = Date.now() + 2000;
  // Wait a tick so the click that triggered fullscreen doesn't cancel the guard.
  setTimeout(() => {
    for (const type of ["keydown", "pointerdown"]) {
      document.addEventListener(type, cancelFullscreenGuard, { capture: true, once: true });
    }
  }, 100);
});

document.addEventListener(
  "play",
  (e) => {
    if (Date.now() < guardUntil && e.target === mainVideo()) e.target.pause();
  },
  true
);
