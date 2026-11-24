// Settings shared by the content script (content.js) and the toolbar popup
// (popup.js). Saved in the extension's local storage under the key "settings".

const DEFAULT_SETTINGS = {
  perDay: 9, // recommended videos per day
  maxAcross: 3, // most videos side by side (3, 4 or 5); fewer on narrow windows
  resetHour: 4, // the "day" starts at this hour, local time (0-23)
  showComments: true, // show the comments section under videos
  allowShorts: false, // show Shorts in search results
};
const PER_DAY_MIN = 1;
const PER_DAY_MAX = 30;
const ACROSS_OPTIONS = [3, 4, 5];

// Anything missing or out of range falls back to the default.
function cleanSettings(raw) {
  const r = raw || {};
  const perDay = Math.round(Number(r.perDay));
  const across = Number(r.maxAcross);
  const hour = Math.round(Number(r.resetHour));
  return {
    perDay: perDay >= PER_DAY_MIN && perDay <= PER_DAY_MAX ? perDay : DEFAULT_SETTINGS.perDay,
    maxAcross: ACROSS_OPTIONS.includes(across) ? across : DEFAULT_SETTINGS.maxAcross,
    resetHour: hour >= 0 && hour <= 23 ? hour : DEFAULT_SETTINGS.resetHour,
    // Only an explicit false turns comments off; missing or invalid means the default.
    showComments: typeof r.showComments === "boolean" ? r.showComments : DEFAULT_SETTINGS.showComments,
    // Only an explicit false turns Shorts off; missing or invalid means the default.
    allowShorts: typeof r.allowShorts === "boolean" ? r.allowShorts : DEFAULT_SETTINGS.allowShorts,
  };
}

// "2026-11-23"-style key for the current "day", where the day starts at
// resetHour (so at 2am with a 4am reset it is still yesterday).
function dayKeyFor(resetHour, daysAgo = 0) {
  const d = new Date(Date.now() - resetHour * 3600 * 1000 - daysAgo * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
