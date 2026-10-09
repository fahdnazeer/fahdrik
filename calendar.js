// Calendar section: month view + agenda, merging multiple Google accounts.
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const KEY = "fahdrik.gtokens";

const cal = {
  month: new Date(),
  selected: new Date(),
  events: [], // {id,title,start:Date,end:Date,allDay,color,cal,account}
  hidden: new Set(JSON.parse(localStorage.getItem("fahdrik.hiddenCals") || "[]")),
  calendars: [], // {id,name,color,account}
  status: "",
};

const loadTokens = () =>
  JSON.parse(localStorage.getItem(KEY) || "[]").filter((t) => t.expires > Date.now());
const saveTokens = (t) => localStorage.setItem(KEY, JSON.stringify(t));

const sameDay = (a, b) => a.toDateString() === b.toDateString();
const fmtTime = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function connect() {
  if (!window.GOOGLE_CLIENT_ID) return alert("Add your Google Client ID to config.js first.");
  if (!window.google) return alert("Google script not loaded yet — check your connection.");
  google.accounts.oauth2
    .initTokenClient({
      client_id: window.GOOGLE_CLIENT_ID,
      scope: SCOPE,
      prompt: "select_account",
      callback: (res) => {
        if (res.error) return;
        const tokens = loadTokens();
        tokens.push({ token: res.access_token, expires: Date.now() + (res.expires_in - 60) * 1000 });
        saveTokens(tokens);
        refresh();
      },
    })
    .requestAccessToken();
}

async function gget(token, url) {
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function refresh() {
  const tokens = loadTokens();
  saveTokens(tokens);
  cal.events = [];
  cal.calendars = [];
  if (!tokens.length) return render();
  cal.status = "Loading…";
  render();
  const min = new Date(cal.month.getFullYear(), cal.month.getMonth() - 1, 1).toISOString();
  const max = new Date(cal.month.getFullYear(), cal.month.getMonth() + 2, 1).toISOString();
  const seen = new Set();
  for (const [i, t] of tokens.entries()) {
    try {
      const list = await gget(t.token, "https://www.googleapis.com/calendar/v3/users/me/calendarList");
      for (const c of list.items) {
        if (seen.has(c.id)) continue; // same calendar shared across both accounts
        seen.add(c.id);
        const calInfo = { id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor, account: i };
        cal.calendars.push(calInfo);
        const ev = await gget(
          t.token,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=500&timeMin=${min}&timeMax=${max}`
        );
        for (const e of ev.items || []) {
          const allDay = !!e.start.date;
          const start = new Date(e.start.dateTime || e.start.date + "T00:00");
          let end = new Date(e.end.dateTime || e.end.date + "T00:00");
          if (allDay) end = new Date(end - 1);
          cal.events.push({ id: e.id, title: e.summary || "(no title)", start, end, allDay, color: c.backgroundColor, cal: c.id });
        }
      }
    } catch (err) {
      cal.status = "Session expired — tap Connect to sign in again.";
    }
  }
  cal.status = "";
  render();
}

function eventsOn(day) {
  const s = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const e = new Date(s.getTime() + 864e5 - 1);
  return cal.events
    .filter((x) => !cal.hidden.has(x.cal) && x.start <= e && x.end >= s)
    .sort((a, b) => a.start - b.start);
}

let root;
function render() {
  if (!root) return;
  const y = cal.month.getFullYear(), m = cal.month.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // week starts Monday
  const days = new Date(y, m + 1, 0).getDate();
  const connected = loadTokens().length;

  let cells = "";
  for (let i = 0; i < offset; i++) cells += `<div class="cell empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    const evs = eventsOn(date);
    const dots = evs.slice(0, 4).map((e) => `<i style="background:${e.color}"></i>`).join("");
    cells += `<button class="cell ${sameDay(date, new Date()) ? "today" : ""} ${sameDay(date, cal.selected) ? "sel" : ""}" data-d="${d}">
      <span>${d}</span><div class="dots">${dots}</div></button>`;
  }

  const agenda = eventsOn(cal.selected)
    .map(
      (e) => `<li style="--c:${e.color}"><b>${e.allDay ? "All day" : fmtTime(e.start)}</b><span>${esc(e.title)}</span></li>`
    )
    .join("");

  root.innerHTML = `
    <div class="cal-bar">
      <button data-nav="-1" aria-label="Previous">‹</button>
      <h3>${first.toLocaleDateString([], { month: "long", year: "numeric" })}</h3>
      <button data-nav="1" aria-label="Next">›</button>
      <button class="connect" data-connect>${connected ? "+ Add account" : "Connect Google"}</button>
    </div>
    ${cal.status ? `<p class="cal-status">${cal.status}</p>` : ""}
    <div class="weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="month">${cells}</div>
    <div class="legend">${cal.calendars
      .map((c) => `<label style="--c:${c.color}"><input type="checkbox" data-cal="${esc(c.id)}" ${cal.hidden.has(c.id) ? "" : "checked"}>${esc(c.name)}</label>`)
      .join("")}</div>
    <h4 class="agenda-title">${cal.selected.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h4>
    <ul class="agenda">${agenda || `<li class="none">${connected ? "Nothing planned" : "Connect Google Calendar to see your events"}</li>`}</ul>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

window.renderCalendar = function (el) {
  root = el;
  root.onclick = (ev) => {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.connect !== undefined) return connect();
    if (t.dataset.nav) {
      cal.month = new Date(cal.month.getFullYear(), cal.month.getMonth() + +t.dataset.nav, 1);
      return refresh();
    }
    if (t.dataset.d) {
      cal.selected = new Date(cal.month.getFullYear(), cal.month.getMonth(), +t.dataset.d);
      render();
    }
  };
  root.onchange = (ev) => {
    const id = ev.target.dataset.cal;
    if (!id) return;
    ev.target.checked ? cal.hidden.delete(id) : cal.hidden.add(id);
    localStorage.setItem("fahdrik.hiddenCals", JSON.stringify([...cal.hidden]));
    render();
  };
  render();
  refresh();
};
