const sections = [
  { id: "calendar", name: "Calendar", emoji: "📅", color: "#80b0e8", desc: "Plans & dates" },
  { id: "todo", name: "To-do", emoji: "✅", color: "#ffc0c0", desc: "Things to get done" },
  { id: "shopping", name: "Shopping", emoji: "🛒", color: "#008471", desc: "Groceries & more" },
  { id: "recipes", name: "Recipes", emoji: "🍳", color: "#d1caea", desc: "What's for dinner" },
  { id: "budget", name: "Budget", emoji: "💰", color: "#d6d35f", desc: "Money together" },
  { id: "watch", name: "Watch list", emoji: "🎬", color: "#c45f3f", desc: "Movies & shows" },
  { id: "reading", name: "Reading list", emoji: "📚", color: "#f5d243", desc: "Books to read" },
  { id: "wish", name: "Wish list", emoji: "🎁", color: "#898e46", desc: "Things we want" },
  { id: "bucket", name: "Bucket list", emoji: "🌍", color: "#f29cc3", desc: "Dreams & trips" },
];
const fgOn = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 145 ? "#f4f0ea" : "#111111";
};

const grid = document.getElementById("grid");
const detail = document.getElementById("detail");
const header = document.querySelector(".top");

sections.forEach((s) => {
  const b = document.createElement("button");
  b.className = "tile";
  b.style.setProperty("--c", s.color);
  b.style.setProperty("--fg", fgOn(s.color));
  b.innerHTML = `<span class="name">${s.name}</span><span class="desc">${s.desc}</span>
    <span class="emoji" aria-hidden="true">${s.emoji}</span>`;
  b.onclick = () => show(s.id);
  grid.appendChild(b);
});

const topbar = document.getElementById("topbar");
const iconnav = document.getElementById("iconnav");
sections.forEach((s) => {
  const b = document.createElement("button");
  b.textContent = s.emoji;
  b.title = s.name;
  b.setAttribute("aria-label", s.name);
  b.dataset.id = s.id;
  b.style.setProperty("--c", s.color);
  b.onclick = () => show(s.id);
  iconnav.appendChild(b);
});

let sectionId = "";
let skipHistory = false;
window.appBack = [];

window.goInner = function (undo) {
  window.appBack.push(undo);
  history.pushState({ s: sectionId, n: window.appBack.length }, "", "#" + sectionId);
};
window.goBack = function () {
  if (window.appBack.length) history.back();
};
window.dropInner = function () {
  if (!window.appBack.length) return;
  window.appBack.pop();
  history.replaceState({ s: sectionId }, "", "#" + sectionId);
};

function show(id) {
  const s = sections.find((x) => x.id === id);
  if (!s) return home();
  const fromHome = !sectionId;
  sectionId = id;
  window.appBack = [];
  document.getElementById("detail-title").textContent = s.name;
  const body = document.getElementById("detail-body");
  if (id === "calendar") window.renderCalendar(body);
  else if (id === "bucket") window.renderBucket(body);
  else if (id === "wish") window.renderWish(body);
  else if (id === "reading") window.renderReading(body);
  else if (id === "watch") window.renderWatch(body);
  else if (id === "recipes") window.renderRecipes(body);
  else if (id === "shopping") window.renderShopping(body);
  else if (id === "todo") window.renderTodo(body);
  else if (id === "budget") window.renderBudget(body);
  else body.innerHTML = "<p>Coming soon — we'll build this one next.</p>";
  grid.hidden = header.hidden = true;
  topbar.hidden = false;
  document.body.classList.add("in-section");
  iconnav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  detail.hidden = false;
  if (!skipHistory) {
    if (fromHome) history.pushState({ s: id }, "", "#" + id);
    else history.replaceState({ s: id }, "", "#" + id);
  }
}
function home() {
  sectionId = "";
  window.appBack = [];
  grid.hidden = header.hidden = false;
  topbar.hidden = true;
  detail.hidden = true;
  document.body.classList.remove("in-section");
}
document.getElementById("brand").onclick = (e) => {
  e.preventDefault();
  if (location.hash) history.pushState(null, "", location.pathname);
  home();
  window.scrollTo(0, 0);
};
window.addEventListener("popstate", () => {
  if (window.appBack.length) {
    const undo = window.appBack.pop();
    try { undo(); } catch (_) {}
    return;
  }
  const id = location.hash.slice(1);
  skipHistory = true;
  if (id) show(id);
  else home();
  skipHistory = false;
});
if (location.hash) {
  skipHistory = true;
  show(location.hash.slice(1));
  skipHistory = false;
  history.replaceState({ s: sectionId }, "", location.hash);
}

// Keep the add field focused when tapping Add (otherwise the button steals it).
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#detail-body form.todo-add button, #detail-body form.s-add button, #detail-body form.w-add button, #detail-body form.wi-add button, #detail-body form.bk-step-add button, #detail-body form.cal-add button")) {
    e.preventDefault();
  }
}, true);

const THEME_KEY = "fahdrik.theme";
const applyTheme = (mode) => {
  document.documentElement.classList.toggle("light", mode === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = mode === "light" ? "#e6e1d8" : "#2c2c2c";
  const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (bar) bar.content = mode === "light" ? "default" : "black-translucent";
  document.querySelectorAll("#theme-seg [data-theme]").forEach((b) => {
    b.classList.toggle("on", b.dataset.theme === mode);
  });
};
applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");

const settingsFab = document.getElementById("settings-fab");
const settingsOverlay = document.getElementById("settings-overlay");
const openSettings = () => { settingsOverlay.hidden = false; };
const closeSettings = () => { settingsOverlay.hidden = true; };
settingsFab.onclick = openSettings;
document.getElementById("settings-close").onclick = closeSettings;
settingsOverlay.onclick = (e) => { if (e.target === settingsOverlay) closeSettings(); };
document.getElementById("theme-seg").onclick = (e) => {
  const b = e.target.closest("[data-theme]");
  if (!b) return;
  localStorage.setItem(THEME_KEY, b.dataset.theme);
  applyTheme(b.dataset.theme);
};

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=182", { updateViaCache: "none" }).then((r) => r.update());

