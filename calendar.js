// Shared household calendar (month + day agenda). Syncs like the other lists.
(function () {
  const KEY = "fahdrik.calendar";
  const WHO = { me: "Fahd", partner: "Eirik", both: "Both" };
  const COLOR = { me: "#60a5fa", partner: "#f472b6", both: "#a78bfa" };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const sameDay = (a, b) => startOfDay(a) === startOfDay(b);
  const icsUrl = () => {
    const token = window.FAHDRIK_ICS_TOKEN;
    const base = window.SUPABASE && window.SUPABASE.url;
    if (!token || !base) return "";
    return `${base.replace(/\/$/, "")}/functions/v1/fahdrik-cal?token=${encodeURIComponent(token)}`;
  };
  const fmtTime = (t) => {
    if (!t) return "All day";
    const [h, m] = t.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m || 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const state = window.store.get(KEY, { events: [] });
  if (!Array.isArray(state.events)) state.events = [];
  const ui = { month: new Date(), selected: new Date(), filter: "all", who: "both" };
  const save = () => window.store.save(KEY, state);
  window.store.watchState(KEY, state);

  const visible = () =>
    state.events.filter((e) => ui.filter === "all" || e.who === ui.filter);

  function eventsOn(day) {
    const t = startOfDay(day);
    const y = ymdOf(day);
    return visible()
      .filter((e) => e.ymd === y || (!e.ymd && e.date === t))
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || a.title.localeCompare(b.title));
  }

  window.renderCalendar = function (root) {
    if (root._ac) root._ac.abort();
    root._ac = new AbortController();
    const signal = root._ac.signal;
    root._storeKey = KEY;

    function render() {
      const keepName = window.stashFocus ? window.stashFocus(root) : "";
      const y = ui.month.getFullYear(), m = ui.month.getMonth();
      const first = new Date(y, m, 1);
      const offset = (first.getDay() + 6) % 7;
      const days = new Date(y, m + 1, 0).getDate();
      const today = new Date();

      let cells = "";
      for (let i = 0; i < offset; i++) cells += `<div class="cell empty"></div>`;
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, m, d);
        const evs = eventsOn(date);
        const dots = evs.slice(0, 4).map((e) => `<i style="background:${COLOR[e.who] || COLOR.both}"></i>`).join("");
        cells += `<button type="button" class="cell ${sameDay(date, today) ? "today" : ""} ${sameDay(date, ui.selected) ? "sel" : ""}" data-d="${d}">
          <span>${d}</span><div class="dots">${dots}</div></button>`;
      }

      const agenda = eventsOn(ui.selected);
      root.innerHTML = `
        <div class="cal-bar">
          <button type="button" data-nav="-1" aria-label="Previous">‹</button>
          <h3>${first.toLocaleDateString([], { month: "long", year: "numeric" })}</h3>
          <button type="button" data-nav="1" aria-label="Next">›</button>
          <button type="button" class="cal-today" data-act="today">Today</button>
        </div>
        <div class="weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="month">${cells}</div>
        <div class="todo-filter">${["all", "me", "partner", "both"]
          .map((f) => `<button type="button" data-filter="${f}" class="${ui.filter === f ? "on" : ""}">${f === "all" ? "All" : WHO[f]}</button>`)
          .join("")}</div>
        <h4 class="agenda-title">${ui.selected.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h4>
        <form class="cal-add">
          <input name="title" placeholder="Add a plan…" autocomplete="off" required />
          <input name="time" type="time" title="Leave empty for all day" />
          <select name="who">${Object.entries(WHO)
            .map(([k, v]) => `<option value="${k}" ${k === ui.who ? "selected" : ""}>${v}</option>`)
            .join("")}</select>
          <button>Add</button>
        </form>
        <ul class="agenda">${
          agenda.length
            ? agenda
                .map(
                  (e) => `<li class="cal-item" data-id="${e.id}" style="--c:${COLOR[e.who] || COLOR.both}">
                    <b>${fmtTime(e.time)}</b>
                    <span class="txt">${esc(e.title)}</span>
                    <button type="button" class="who ${e.who}" data-act="who">${WHO[e.who]}</button>
                    <button type="button" class="del" data-act="del" aria-label="Delete">✕</button>
                  </li>`
                )
                .join("")
            : `<li class="none">Nothing planned — add something above.</li>`
        }</ul>
        ${icsUrl() ? `<button type="button" class="cal-ics" data-act="ics">Copy Google Calendar link</button><p class="cal-ics-hint">Google Calendar → Other calendars → From URL. Updates can take a few hours.</p>` : ""}`;
      if (window.unstashFocus) window.unstashFocus(root, keepName);
    }

    root.onsubmit = (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      if (!title) return;
      ui.who = e.target.who.value;
      const time = e.target.time.value || "";
      state.events.push({ id: uid(), title, date: startOfDay(ui.selected), ymd: ymdOf(ui.selected), time, who: ui.who });
      save();
      render();
      const inp = root.querySelector("input[name=title]");
      if (inp) inp.focus();
    };

    root.onclick = (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) {
        ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + +nav.dataset.nav, 1);
        return render();
      }
      const cell = e.target.closest("[data-d]");
      if (cell) {
        ui.selected = new Date(ui.month.getFullYear(), ui.month.getMonth(), +cell.dataset.d);
        return render();
      }
      const filter = e.target.closest("[data-filter]");
      if (filter) { ui.filter = filter.dataset.filter; return render(); }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "today") {
        const n = new Date();
        ui.month = new Date(n.getFullYear(), n.getMonth(), 1);
        ui.selected = n;
        return render();
      }
      if (act === "ics") {
        const url = icsUrl();
        const b = e.target.closest("[data-act=ics]");
        const done = () => { if (b) { b.textContent = "Copied — paste in Google Calendar"; setTimeout(render, 1800); } };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => prompt("Copy this link", url));
        else prompt("Copy this link", url);
        return;
      }
      const item = e.target.closest(".cal-item");
      const ev = item && state.events.find((x) => x.id === +item.dataset.id);
      if (act === "who" && ev) {
        const k = Object.keys(WHO);
        ev.who = k[(k.indexOf(ev.who) + 1) % k.length];
        save();
        return render();
      }
      if (act === "del" && ev) {
        state.events = state.events.filter((x) => x !== ev);
        save();
        return render();
      }
    };

    root.ondblclick = (e) => {
      const span = e.target.closest(".cal-item .txt");
      if (!span) return;
      const ev = state.events.find((x) => x.id === +span.closest(".cal-item").dataset.id);
      const input = document.createElement("input");
      input.className = "edit";
      input.value = ev.title;
      span.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (ok && v) { ev.title = v; save(); }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (evn) => {
        if (evn.key === "Enter") finish(true);
        if (evn.key === "Escape") finish(false);
      };
    };

    root._rerender = () => render();
    render();
  };
})();
