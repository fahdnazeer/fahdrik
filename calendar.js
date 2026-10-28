// Shared household calendar (month + day agenda). Syncs like the other lists.
(function () {
  const KEY = "fahdrik.calendar";
  const WHO = { me: "Fahd", partner: "Eirik", both: "Both" };
  const COLOR = { me: "#f472b6", partner: "#2dd4bf", both: "#facc15" };
  const MAX_LANES = 3;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseYmd = (s) => {
    const [Y, M, D] = String(s || "").split("-").map(Number);
    return new Date(Y, (M || 1) - 1, D || 1);
  };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sameDay = (a, b) => startOfDay(a) === startOfDay(b);
  const eventStart = (e) => e.ymd || (e.date ? ymdOf(new Date(e.date)) : "");
  const eventEnd = (e) => {
    const a = eventStart(e);
    const b = e.endYmd || "";
    return b && b > a ? b : a;
  };
  const isSpan = (e) => eventEnd(e) > eventStart(e);
  const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
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
  const fmtRange = (e) => {
    if (!e.time) return "All day";
    if (!e.end || e.end === e.time) return fmtTime(e.time);
    return `${fmtTime(e.time)} – ${fmtTime(e.end)}`;
  };
  const fmtWhen = (e) => {
    const a = eventStart(e);
    const b = eventEnd(e);
    if (!a || a === b) return fmtRange(e);
    const opt = { day: "numeric", month: "short" };
    const fa = parseYmd(a).toLocaleDateString([], opt);
    const fb = parseYmd(b).toLocaleDateString([], opt);
    if (e.time) return `${fa} ${fmtTime(e.time)} – ${fb}${e.end ? " " + fmtTime(e.end) : ""}`;
    return `${fa} – ${fb}`;
  };

  const state = window.store.get(KEY, { events: [] });
  if (!Array.isArray(state.events)) state.events = [];
  const ui = { month: new Date(), selected: new Date(), filter: "all", who: "both", editId: null, sheetMode: "view", sheetFocus: false };
  const ICO = {
    edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  };
  let lastTap = { ymd: "", at: 0 };
  let selectTimer = 0;
  let ignoreBackdrop = 0;
  let swipe = null;
  let skipClick = false;
  let sliding = false;
  const save = () => window.store.save(KEY, state);
  window.store.watchState(KEY, state);

  const visible = () =>
    state.events.filter((e) => ui.filter === "all" || e.who === ui.filter);

  function eventsOn(day) {
    const y = ymdOf(day);
    return visible()
      .filter((e) => {
        const a = eventStart(e);
        return a && a <= y && y <= eventEnd(e);
      })
      .sort((a, b) => eventStart(a).localeCompare(eventStart(b)) || (a.time || "99").localeCompare(b.time || "99") || a.title.localeCompare(b.title));
  }

  function monthWeeks(y, m) {
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    const end = addDays(last, 6 - ((last.getDay() + 6) % 7));
    const weeks = [];
    for (let d = start; d <= end; d = addDays(d, 7)) {
      weeks.push([0, 1, 2, 3, 4, 5, 6].map((i) => addDays(d, i)));
    }
    return weeks;
  }

  function layoutWeek(week) {
    const w0 = ymdOf(week[0]);
    const w6 = ymdOf(week[6]);
    const evs = visible().filter((e) => {
      const a = eventStart(e);
      return a && a <= w6 && eventEnd(e) >= w0;
    });
    evs.sort((a, b) => {
      const pa = isSpan(a) || !a.time ? 0 : 1;
      const pb = isSpan(b) || !b.time ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return eventStart(a).localeCompare(eventStart(b)) || (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title);
    });
    const occ = [];
    const placed = [];
    for (const e of evs) {
      const c0 = Math.max(0, daysBetween(w0, eventStart(e)));
      const c1 = Math.min(6, daysBetween(w0, eventEnd(e)));
      let lane = 0;
      for (; lane < occ.length; lane++) {
        let ok = true;
        for (let c = c0; c <= c1; c++) if (occ[lane][c]) { ok = false; break; }
        if (ok) break;
      }
      if (!occ[lane]) occ[lane] = [];
      for (let c = c0; c <= c1; c++) occ[lane][c] = true;
      placed.push({ e, c0, span: c1 - c0 + 1, lane });
    }
    const extra = Array(7).fill(0);
    const show = [];
    for (const p of placed) {
      if (p.lane < MAX_LANES) show.push(p);
      else for (let c = p.c0; c < p.c0 + p.span; c++) extra[c]++;
    }
    return { show, extra, lanes: Math.min(MAX_LANES, occ.length) || 1 };
  }

  function chipLabel(p, week) {
    const ymd = ymdOf(week[p.c0]);
    const firstBit = ymd === eventStart(p.e) || p.c0 === 0;
    if (!firstBit) return "\u00a0";
    return p.e.title;
  }

  function monthPane(y, m, selY, today) {
    return monthWeeks(y, m)
      .map((week) => {
        const { show, extra, lanes } = layoutWeek(week);
        const days = week
          .map((date, i) => {
            const ymd = ymdOf(date);
            const out = date.getMonth() !== m ? "out" : "";
            const td = sameDay(date, today) ? "today" : "";
            const sel = ymd === selY ? "sel" : "";
            const more = extra[i] ? `<span class="cal-more" style="grid-column:${i + 1};grid-row:${lanes + 2}">+${extra[i]}</span>` : "";
            return `<button type="button" class="cell ${out} ${td} ${sel}${i === 6 ? " last" : ""}" data-ymd="${ymd}" style="grid-column:${i + 1}"><span class="num">${date.getDate()}</span></button>${more}`;
          })
          .join("");
        const chips = show
          .map((p) => `<button type="button" class="cal-chip bar" data-chip="${p.e.id}" style="grid-column:${p.c0 + 1} / span ${p.span};grid-row:${p.lane + 2};--c:${COLOR[p.e.who] || COLOR.both}">${esc(chipLabel(p, week))}</button>`)
          .join("");
        return `<div class="cal-week" style="--lanes:${lanes}">${days}${chips}</div>`;
      })
      .join("");
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
      const today = new Date();
      const selY = ymdOf(ui.selected);
      const prevM = new Date(y, m - 1, 1);
      const nextM = new Date(y, m + 1, 1);

      const agenda = eventsOn(ui.selected);
      const untilVal = ymdOf(ui.selected);
      const editing = ui.editId && ui.editId !== "new" ? state.events.find((x) => x.id === ui.editId) : null;
      const sheetOn = ui.editId != null;
      const sheetStart = editing ? eventStart(editing) : untilVal;
      const sheetUntil = editing ? eventEnd(editing) : untilVal;
      root.innerHTML = `
        <div class="cal-bar">
          <button type="button" data-nav="-1" aria-label="Previous">‹</button>
          <h3>${first.toLocaleDateString([], { month: "long", year: "numeric" })}</h3>
          <button type="button" data-nav="1" aria-label="Next">›</button>
          <button type="button" class="cal-today" data-act="today">Today</button>
        </div>
        <div class="weekdays">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span>${d}</span>`).join("")}</div>
        <div class="cal-board">
          <div class="cal-track">
            <div class="month">${monthPane(prevM.getFullYear(), prevM.getMonth(), selY, today)}</div>
            <div class="month">${monthPane(y, m, selY, today)}</div>
            <div class="month">${monthPane(nextM.getFullYear(), nextM.getMonth(), selY, today)}</div>
          </div>
        </div>
        <div class="todo-filter">${["all", "me", "partner", "both"]
          .map((f) => `<button type="button" data-filter="${f}" class="${ui.filter === f ? "on" : ""}">${f === "all" ? "All" : WHO[f]}</button>`)
          .join("")}</div>
        <h4 class="agenda-title">${ui.selected.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h4>
        <ul class="agenda">${
          agenda.length
            ? agenda
                .map(
                  (e) => `<li class="cal-item" data-id="${e.id}" style="--c:${COLOR[e.who] || COLOR.both}">
                    <div class="cal-item-main">
                      <span class="txt">${esc(e.title)}</span>
                      <b>${fmtWhen(e)}</b>
                    </div>
                    <button type="button" class="who ${e.who}" data-act="who">${WHO[e.who]}</button>
                    <button type="button" class="del" data-act="del" aria-label="Delete">✕</button>
                  </li>`
                )
                .join("")
            : `<li class="none">Nothing planned — tap + to add.</li>`
        }</ul>
        ${icsUrl() ? `<button type="button" class="cal-ics" data-act="ics">Copy Google Calendar link</button><p class="cal-ics-hint">Google Calendar → Other calendars → From URL. Updates can take a few hours.</p>` : ""}
        ${sheetOn ? "" : `<button type="button" class="cal-fab" data-act="add" aria-label="Add a plan"></button>`}
        ${
          sheetOn && editing && ui.sheetMode === "view"
            ? `<div class="cal-overlay">
                <div class="cal-sheet cal-view" role="dialog" aria-labelledby="cal-add-title">
                  <div class="cal-view-tools">
                    <button type="button" data-act="edit-plan" aria-label="Edit">${ICO.edit}</button>
                    <button type="button" data-act="del-plan" aria-label="Delete">${ICO.trash}</button>
                    <button type="button" data-act="close-add" aria-label="Close">✕</button>
                  </div>
                  <div class="cal-view-dot" style="background:${COLOR[editing.who] || COLOR.both}"></div>
                  <h3 id="cal-add-title">${esc(editing.title)}</h3>
                  <p>${esc(fmtWhen(editing))}</p>
                  <span class="who ${editing.who}">${WHO[editing.who]}</span>
                </div>
              </div>`
            : sheetOn
            ? `<div class="cal-overlay">
                <div class="cal-sheet" role="dialog" aria-labelledby="cal-add-title">
                  <button type="button" class="cal-sheet-x" data-act="close-add" aria-label="Close">✕</button>
                  <h3 id="cal-add-title">${editing ? "Edit plan" : "Add a plan"}</h3>
                  <form class="cal-add cal-add-stack">
                    <input name="title" placeholder="What are we doing?" autocomplete="off" required value="${editing ? esc(editing.title) : ""}" />
                    <div class="cal-add-row">
                      <label class="cal-time">From <input name="start" type="date" value="${sheetStart}" /></label>
                      <label class="cal-time">Until <input name="until" type="date" value="${sheetUntil}" /></label>
                    </div>
                    <div class="cal-add-row">
                      <label class="cal-time">Start <input name="time" type="time" title="Leave empty for all day" value="${editing ? esc(editing.time || "") : ""}" /></label>
                      <label class="cal-time">End <input name="end" type="time" value="${editing ? esc(editing.end || "") : ""}" /></label>
                      <select name="who">${Object.entries(WHO)
                        .map(([k, v]) => `<option value="${k}" ${(editing ? editing.who : ui.who) === k ? "selected" : ""}>${v}</option>`)
                        .join("")}</select>
                    </div>
                    <button>${editing ? "Save" : "Add"}</button>
                  </form>
                </div>
              </div>`
            : ""
        }`;
      if (sheetOn && ui.sheetMode !== "view" && ui.sheetFocus) {
        ui.sheetFocus = false;
        const inp = root.querySelector(".cal-overlay input[name=title]");
        if (inp) inp.focus();
      } else if (window.unstashFocus) window.unstashFocus(root, keepName);
      parkTrack();
    }

    function openSheet(id, mode) {
      const was = ui.editId != null;
      ui.editId = id;
      ui.sheetMode = mode || (id === "new" ? "edit" : "view");
      ui.sheetFocus = ui.sheetMode !== "view";
      ignoreBackdrop = Date.now() + 500;
      if (!was && window.goInner) window.goInner(() => { ui.editId = null; ui.sheetMode = "view"; render(); });
      render();
    }
    function openAdd() {
      if (ui.editId != null) return;
      openSheet("new", "edit");
    }
    function closeAdd() {
      if (ui.editId == null) return;
      if (window.appBack && window.appBack.length && window.goBack) window.goBack();
      else { ui.editId = null; ui.sheetMode = "view"; render(); }
    }

    function fillEvent(ev, form, fallbackStart) {
      const title = form.title.value.trim();
      if (!title) return null;
      ui.who = form.who.value;
      let start = (form.start && form.start.value) || fallbackStart;
      let until = (form.until && form.until.value) || start;
      if (until < start) until = start;
      ev.title = title;
      ev.ymd = start;
      ev.date = startOfDay(parseYmd(start));
      ev.time = form.time.value || "";
      ev.end = form.end.value || "";
      ev.who = ui.who;
      if (until > start) ev.endYmd = until;
      else delete ev.endYmd;
      pickDay(start);
      return ev;
    }

    function pickDay(ymd) {
      ui.selected = parseYmd(ymd);
      if (ui.selected.getMonth() !== ui.month.getMonth() || ui.selected.getFullYear() !== ui.month.getFullYear()) {
        ui.month = new Date(ui.selected.getFullYear(), ui.selected.getMonth(), 1);
      }
    }

    function boardW() {
      return root.querySelector(".cal-board")?.clientWidth || 0;
    }
    function trackEl() {
      return root.querySelector(".cal-track");
    }
    function parkTrack() {
      const t = trackEl();
      const w = boardW();
      if (!t || !w) return;
      t.style.transition = "none";
      t.style.transform = `translateX(${-w}px)`;
    }
    function animateMonth(dir) {
      if (sliding) return;
      const t = trackEl();
      const w = boardW();
      if (!t || !w) {
        ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + dir, 1);
        return render();
      }
      sliding = true;
      t.style.transition = "transform .32s cubic-bezier(.22,.72,.2,1)";
      t.style.transform = `translateX(${dir > 0 ? -2 * w : 0}px)`;
      let once = false;
      const done = () => {
        if (once) return;
        once = true;
        sliding = false;
        ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + dir, 1);
        render();
      };
      t.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 400);
    }

    root.onsubmit = (e) => {
      e.preventDefault();
      if (!e.target.closest(".cal-overlay")) return;
      if (ui.editId && ui.editId !== "new") {
        const ev = state.events.find((x) => x.id === ui.editId);
        if (!ev || !fillEvent(ev, e.target, eventStart(ev))) return;
      } else {
        const ev = fillEvent({ id: uid() }, e.target, ymdOf(ui.selected));
        if (!ev) return;
        state.events.push(ev);
        ui.editId = ev.id;
      }
      save();
      ui.sheetMode = "view";
      ui.sheetFocus = false;
      render();
    };

    root.addEventListener("click", (e) => {
      if (!skipClick) return;
      skipClick = false;
      e.stopPropagation();
    }, { capture: true, signal });

    root.addEventListener("pointerdown", (e) => {
      if (sliding || ui.editId != null) return;
      if (!e.target.closest(".cal-board")) return;
      swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, live: false };
    }, { signal });

    root.addEventListener("pointermove", (e) => {
      if (!swipe || e.pointerId !== swipe.id || sliding) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (!swipe.live) {
        if (Math.abs(dx) < 12) return;
        if (Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
        swipe.live = true;
        skipClick = true;
        try { e.target.setPointerCapture?.(swipe.id); } catch (_) {}
      }
      const t = trackEl();
      const w = boardW();
      if (!t || !w) return;
      t.style.transition = "none";
      t.style.transform = `translateX(${Math.max(-2 * w, Math.min(0, -w + dx))}px)`;
    }, { signal });

    root.addEventListener("pointerup", (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      const live = swipe.live;
      swipe = null;
      if (!live || sliding || ui.editId != null) return;
      lastTap = { ymd: "", at: 0 };
      clearTimeout(selectTimer);
      const w = boardW();
      if (Math.abs(dx) > Math.min(56, w * 0.18) && Math.abs(dx) > Math.abs(dy) * 0.85) {
        animateMonth(dx < 0 ? 1 : -1);
        return;
      }
      const t = trackEl();
      if (!t || !w) return;
      t.style.transition = "transform .22s ease";
      t.style.transform = `translateX(${-w}px)`;
    }, { signal });

    root.addEventListener("pointercancel", () => { swipe = null; parkTrack(); }, { signal });

    root.onclick = (e) => {
      if (e.target.closest(".cal-sheet")) {
        const sheetAct = e.target.closest("[data-act]")?.dataset.act;
        if (sheetAct === "close-add") return closeAdd();
        if (sheetAct === "edit-plan") {
          ui.sheetMode = "edit";
          ui.sheetFocus = true;
          return render();
        }
        if (sheetAct === "del-plan") {
          state.events = state.events.filter((x) => x.id !== ui.editId);
          save();
          return closeAdd();
        }
        return;
      }
      if (e.target.classList && e.target.classList.contains("cal-overlay")) {
        if (Date.now() < ignoreBackdrop) return;
        const active = document.activeElement;
        const picking = active && active.closest && active.closest(".cal-sheet") && (active.tagName === "SELECT" || active.type === "date" || active.type === "time");
        if (picking) {
          active.blur();
          return;
        }
        return closeAdd();
      }
      if (ui.editId != null) return;
      const nav = e.target.closest("[data-nav]");
      if (nav) return animateMonth(+nav.dataset.nav);
      const chip = e.target.closest("[data-chip]");
      if (chip) {
        lastTap = { ymd: "", at: 0 };
        clearTimeout(selectTimer);
        const ev = state.events.find((x) => x.id === +chip.dataset.chip);
        if (ev) pickDay(eventStart(ev));
        openSheet(+chip.dataset.chip);
        return;
      }
      const cell = e.target.closest("[data-ymd]");
      if (cell) {
        const ymd = cell.dataset.ymd;
        const now = Date.now();
        if (lastTap.ymd === ymd && now - lastTap.at < 500) {
          lastTap = { ymd: "", at: 0 };
          clearTimeout(selectTimer);
          pickDay(ymd);
          openAdd();
          return;
        }
        lastTap = { ymd, at: now };
        pickDay(ymd);
        root.querySelectorAll(".cell.sel").forEach((c) => c.classList.remove("sel"));
        cell.classList.add("sel");
        clearTimeout(selectTimer);
        selectTimer = setTimeout(() => {
          if (ui.editId == null) render();
        }, 280);
        return;
      }
      const filter = e.target.closest("[data-filter]");
      if (filter) { ui.filter = filter.dataset.filter; return render(); }
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "add") return openAdd();
      if (act === "close-add") return closeAdd();
      if (act === "today") {
        const n = new Date();
        ui.selected = n;
        const cur = ui.month.getFullYear() * 12 + ui.month.getMonth();
        const tgt = n.getFullYear() * 12 + n.getMonth();
        if (tgt === cur) return render();
        if (Math.abs(tgt - cur) === 1) return animateMonth(tgt > cur ? 1 : -1);
        ui.month = new Date(n.getFullYear(), n.getMonth(), 1);
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
      if (ev) {
        openSheet(ev.id);
        return;
      }
    };

    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ui.editId != null) closeAdd();
    }, { signal });

    root.ondblclick = (e) => {
      if (e.target.closest("[data-chip]")) return;
      const cell = e.target.closest("[data-ymd]");
      if (cell) {
        pickDay(cell.dataset.ymd);
        openAdd();
      }
    };

    root._rerender = () => render();
    render();
  };
})();
