const sections = [
  { id: "calendar", name: "Calendar", emoji: "📅", color: "#60a5fa", desc: "Plans & dates" },
  { id: "todo", name: "To-do", emoji: "✅", color: "#34d399", desc: "Things to get done" },
  { id: "shopping", name: "Shopping", emoji: "🛒", color: "#fbbf24", desc: "Groceries & more" },
  { id: "recipes", name: "Recipes", emoji: "🍳", color: "#fb923c", desc: "What's for dinner" },
  { id: "budget", name: "Budget", emoji: "💰", color: "#4ade80", desc: "Money together" },
  { id: "watch", name: "Watch list", emoji: "🎬", color: "#f87171", desc: "Movies & shows" },
  { id: "reading", name: "Reading list", emoji: "📚", color: "#a78bfa", desc: "Books to read" },
  { id: "wish", name: "Wish list", emoji: "🎁", color: "#f472b6", desc: "Things we want" },
  { id: "bucket", name: "Bucket list", emoji: "🌍", color: "#22d3ee", desc: "Dreams & trips" },
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

function show(id) {
  const s = sections.find((x) => x.id === id);
  if (!s) return home();
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
  else body.innerHTML = "<p>Coming soon — we'll build this one next.</p>";
  grid.hidden = header.hidden = true;
  topbar.hidden = false;
  iconnav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  detail.hidden = false;
  history.pushState(null, "", "#" + id);
}
function home() {
  grid.hidden = header.hidden = false;
  topbar.hidden = true;
  detail.hidden = true;
}
document.getElementById("brand").onclick = (e) => {
  e.preventDefault();
  if (location.hash) history.pushState(null, "", location.pathname);
  home();
  window.scrollTo(0, 0);
};
window.addEventListener("popstate", () => {
  const id = location.hash.slice(1);
  id ? show(id) : home();
});
if (location.hash) show(location.hash.slice(1));

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update());

