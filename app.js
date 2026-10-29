const sections = [
  { id: "calendar", name: "Calendar", emoji: "📅", color: "#522a6f", desc: "Plans & dates" },
  { id: "todo", name: "To-do", emoji: "✅", color: "#fbcf4f", desc: "Things to get done" },
  { id: "shopping", name: "Shopping", emoji: "🛒", color: "#faeadd", desc: "Groceries & more" },
  { id: "recipes", name: "Recipes", emoji: "🍳", color: "#f29cb7", desc: "What's for dinner" },
  { id: "budget", name: "Budget", emoji: "💰", color: "#fbcf4f", desc: "Money together" },
  { id: "watch", name: "Watch list", emoji: "🎬", color: "#f29cb7", desc: "Movies & shows" },
  { id: "reading", name: "Reading list", emoji: "📚", color: "#ddaaff", desc: "Books to read" },
  { id: "wish", name: "Wish list", emoji: "🎁", color: "#f29cb7", desc: "Things we want" },
  { id: "bucket", name: "Bucket list", emoji: "🌍", color: "#522a6f", desc: "Dreams & trips" },
];

const grid = document.getElementById("grid");
const detail = document.getElementById("detail");
const header = document.querySelector(".top");

sections.forEach((s) => {
  const b = document.createElement("button");
  b.className = "tile";
  b.style.setProperty("--c", s.color);
  b.innerHTML = `<span class="emoji">${s.emoji}</span>
    <span><span class="name">${s.name}</span><br><span class="desc">${s.desc}</span></span>`;
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
  syncTabStroke();
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
  const stroke = document.getElementById("tab-stroke");
  if (stroke) { stroke.setAttribute("hidden", ""); stroke.innerHTML = ""; }
}
function syncTabStroke() {
  requestAnimationFrame(() => {
    const svg = document.getElementById("tab-stroke");
    const btn = iconnav.querySelector("button.on");
    if (!svg) return;
    if (!btn || !document.body.classList.contains("in-section") || detail.hidden) {
      svg.setAttribute("hidden", "");
      svg.innerHTML = "";
      return;
    }
    const b = btn.getBoundingClientRect();
    const s = detail.getBoundingClientRect();
    const pad = 12, tr = 16, sr = 22;
    const join = b.bottom;
    const top = b.top - 3;
    const left = s.left;
    const width = Math.max(1, s.width);
    const height = Math.max(1, join - top + 6);
    svg.removeAttribute("hidden");
    svg.style.transform = `translate(${left}px, ${top}px)`;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const x = (n) => n - left;
    const y = (n) => n - top;
    const yJ = y(join), yT = y(b.top);
    const xL = x(b.left), xR = x(b.right);
    const x0 = x(s.left), x1 = x(s.right);
    const d = [
      `M ${x0 + sr} ${yJ}`,
      `H ${xL - pad}`,
      `A ${pad} ${pad} 0 0 0 ${xL} ${yJ - pad}`,
      `V ${yT + tr}`,
      `A ${tr} ${tr} 0 0 1 ${xL + tr} ${yT}`,
      `H ${xR - tr}`,
      `A ${tr} ${tr} 0 0 1 ${xR} ${yT + tr}`,
      `V ${yJ - pad}`,
      `A ${pad} ${pad} 0 0 0 ${xR + pad} ${yJ}`,
      `H ${x1 - sr}`,
    ].join(" ");
    const tl = Math.max(0.02, (xL - pad) / width);
    const trp = Math.min(0.98, (xR + pad) / width);
    svg.innerHTML = `<defs><linearGradient id="tabStrokeFade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f29cb7" stop-opacity="0"/><stop offset="${tl}" stop-color="#f29cb7" stop-opacity="1"/><stop offset="${trp}" stop-color="#f29cb7" stop-opacity="1"/><stop offset="1" stop-color="#f29cb7" stop-opacity="0"/></linearGradient></defs><path d="${d}" fill="none" stroke="url(#tabStrokeFade)" stroke-width="1.5" stroke-linejoin="round"/>`;
  });
}
window.addEventListener("resize", syncTabStroke);
window.addEventListener("scroll", syncTabStroke, { passive: true });
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

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=115", { updateViaCache: "none" }).then((r) => r.update());

