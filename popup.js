// Toolbar popup: edit the settings. Every change is saved straight away, and
// any open YouTube tab picks it up immediately (content.js listens for it).

const perDayInput = document.getElementById("perDay");
const acrossSelect = document.getElementById("maxAcross");
const hourSelect = document.getElementById("resetHour");
const commentsBox = document.getElementById("showComments");
const shortsBox = document.getElementById("allowShorts");
const statusEl = document.getElementById("status");

// 12-hour labels: "12:00 AM" ... "11:00 PM"
for (let h = 0; h < 24; h++) {
  const opt = document.createElement("option");
  opt.value = String(h);
  opt.textContent = `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
  hourSelect.append(opt);
}

function show(s) {
  perDayInput.value = s.perDay;
  acrossSelect.value = String(s.maxAcross);
  hourSelect.value = String(s.resetHour);
  commentsBox.checked = s.showComments;
  shortsBox.checked = s.allowShorts;
}

let statusTimer = null;
function flash(text) {
  statusEl.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (statusEl.textContent = ""), 1500);
}

async function save(next) {
  const stored = await browser.storage.local.get(["settings", "snapshot", "previous"]);
  const old = cleanSettings(stored.settings);
  const update = { settings: next };

  // Moving the reset time shifts where "today" starts. Re-label today's saved
  // list (and yesterday's) with the new boundary so it isn't thrown away and
  // re-picked just because the clock now counts as a different day.
  if (next.resetHour !== old.resetHour) {
    const { snapshot, previous } = stored;
    if (snapshot && snapshot.day === dayKeyFor(old.resetHour)) {
      update.snapshot = { ...snapshot, day: dayKeyFor(next.resetHour) };
      if (previous) update.previous = { ...previous, day: dayKeyFor(next.resetHour, 1) };
    }
  }
  await browser.storage.local.set(update);
  flash("Saved");
}

function readForm() {
  return cleanSettings({
    perDay: perDayInput.value,
    maxAcross: acrossSelect.value,
    resetHour: hourSelect.value,
    showComments: commentsBox.checked,
    allowShorts: shortsBox.checked,
  });
}

async function onChange() {
  const next = readForm();
  show(next); // snaps an empty or out-of-range number back into range
  await save(next);
}

perDayInput.addEventListener("change", onChange);
acrossSelect.addEventListener("change", onChange);
hourSelect.addEventListener("change", onChange);
commentsBox.addEventListener("change", onChange);
shortsBox.addEventListener("change", onChange);

document.getElementById("reset").addEventListener("click", async () => {
  show(DEFAULT_SETTINGS);
  await save({ ...DEFAULT_SETTINGS });
});

browser.storage.local.get("settings").then((stored) => show(cleanSettings(stored.settings)));
