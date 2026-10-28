// To-do section. Multiple lists (same pattern as shopping). Drag a task onto another to make it a sub-item.
const TKEY = "fahdrik.todos";
const WHO = { me: "Fahd", partner: "Eirik", both: "Both" };
const tesc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tuid = () => Date.now() + Math.floor(Math.random() * 1000);

function migrateTodos(raw) {
  const wrap = (items) => {
    const list = { id: 1, name: "To-do", locked: true, items: Array.isArray(items) ? items : [] };
    return { lists: [list], current: 1 };
  };
  if (!raw) return wrap([]);
  if (Array.isArray(raw)) return wrap(raw);
  if (!raw.lists || !Array.isArray(raw.lists) || !raw.lists.length) return wrap([]);
  raw.lists.forEach((l, i) => {
    l.items = l.items || [];
    if (l.locked === undefined) l.locked = i === 0;
  });
  let main = raw.lists.find((l) => l.locked) || raw.lists.find((l) => /^to-?do$/i.test(l.name || "")) || raw.lists[0];
  main.locked = true;
  main.name = "To-do";
  raw.lists.forEach((l) => { if (l !== main) l.locked = false; });
  raw.lists = [main, ...raw.lists.filter((l) => l !== main)];
  if (!raw.lists.some((l) => l.id === raw.current)) raw.current = main.id;
  return raw;
}

const state = migrateTodos(window.store.get(TKEY, []));
const todo = { filter: "all", who: "both", archiveOpen: false, adding: null };
const cur = () => state.lists.find((l) => l.id === state.current) || state.lists[0];
(state.lists || []).forEach((l) => (l.items || []).forEach((t) => {
  t.subs = t.subs || [];
  if (t.done && !t.doneAt) t.doneAt = Date.now();
}));
const DAY = 864e5;
if (!localStorage.getItem("fahdrik.demoArchive")) {
  const ago = (d) => Date.now() - d * DAY - 1000;
  [
    ["Book dentist appointment", "me", 2],
    ["Pay the electricity bill", "both", 3],
    ["Buy a birthday gift for Mom", "partner", 5],
    ["Renew gym membership", "me", 8],
    ["Clean the balcony", "both", 12],
  ].forEach(([text, who, d], i) =>
    cur().items.push({ id: Date.now() + i, text, who, done: true, doneAt: ago(d), subs: [] })
  );
  localStorage.setItem("fahdrik.demoArchive", "1");
}
const isArchived = (t) => t.done && Date.now() - t.doneAt > DAY;
const tsave = () => window.store.save(TKEY, state);
window.store.watchState(TKEY, state);
window.store.watchArray(TKEY, (data) => {
  const next = migrateTodos(data);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  tsave();
});
tsave();

window.renderTodo = function (root) {
  if (root._ac) root._ac.abort();
  root._ac = new AbortController();
  const signal = root._ac.signal;
  root._storeKey = TKEY;
  const subRow = (s) => `
    <li class="sub ${s.done ? "done" : ""}" data-sub="${s.id}">
      <button class="check small" data-act="subtoggle" aria-label="Toggle">${s.done ? "✓" : ""}</button>
      <span class="txt">${tesc(s.text)}</span>
      <button class="del" data-act="subdel" aria-label="Delete">✕</button>
    </li>`;

  const row = (t) => {
    const doneCount = t.subs.filter((s) => s.done).length;
    return `
      <li class="item ${t.done ? "done" : ""}" data-id="${t.id}">
        <div class="main">
          <button class="check" data-act="toggle" aria-label="Toggle">${t.done ? "✓" : ""}</button>
          <span class="txt">${tesc(t.text)}</span>
          ${t.subs.length ? `<span class="progress">${doneCount}/${t.subs.length}</span>` : ""}
          <button class="who ${t.who}" data-act="who" title="Change who">${WHO[t.who]}</button>
          <button class="plus" data-act="add" aria-label="Add sub-item" title="Add sub-item">+</button>
          <button class="del" data-act="del" aria-label="Delete">✕</button>
        </div>
        ${t.subs.length ? `<ul class="subs">${t.subs.map(subRow).join("")}</ul>` : ""}
        ${todo.adding === t.id ? `<form class="sub-add"><input name="sub" placeholder="Add sub-item…" autocomplete="off" required /></form>` : ""}
      </li>`;
  };

  function render() {
    const keepName = window.stashFocus ? window.stashFocus(root) : "";
    const list = cur();
    const items = list.items;
    const shown = items.filter((t) => todo.filter === "all" || t.who === todo.filter);
    const open = shown.filter((t) => !t.done);
    const done = shown.filter((t) => t.done && !isArchived(t));
    const archived = shown.filter(isArchived);
    root.innerHTML = `
      <div class="s-tabs">
        ${state.lists
          .map((l) => `<button class="s-tab ${l.id === list.id ? "on" : ""}" data-list="${l.id}" ${l.locked ? 'data-locked="1" title="To-do stays here"' : ""}>${tesc(l.name)}</button>`)
          .join("")}
        <button class="s-tab new" data-act="newlist" title="New list">+</button>
      </div>
      <form class="todo-add">
        <input name="text" placeholder="Add a to-do…" autocomplete="off" required />
        <select name="who">${Object.entries(WHO)
          .map(([k, v]) => `<option value="${k}" ${k === todo.who ? "selected" : ""}>${v}</option>`)
          .join("")}</select>
        <button>Add</button>
      </form>
      <div class="todo-filter">${["all", "me", "partner", "both"]
        .map((f) => `<button data-filter="${f}" class="${todo.filter === f ? "on" : ""}">${f === "all" ? "All" : WHO[f]}</button>`)
        .join("")}</div>
      <ul class="todo-list" data-root>${open.map(row).join("") || `<li class="empty">All clear 🎉</li>`}</ul>
      ${done.length ? `<h4 class="agenda-title">Done (${done.length}) <button class="clear" data-act="clear">Clear</button></h4><ul class="todo-list">${done.map(row).join("")}</ul>` : ""}
      ${
        archived.length
          ? `<button class="archive-toggle" data-act="archive">${todo.archiveOpen ? "▾" : "▸"} Archive (${archived.length})</button>
             ${todo.archiveOpen ? `<ul class="todo-list archive">${archived.map(row).join("")}</ul><button class="clear" data-act="clear-archive">Delete all archived</button>` : ""}`
          : ""
      }
      ${items.length > 1 ? `<p class="hint">Tip: drag a task onto another to make it a sub-item. Drag a sub-item out of its card to turn it back into a task.</p>` : ""}
      <div class="s-footer">
        ${state.lists.length > 1 && !list.locked ? `<button data-act="deletelist">🗑 Delete list</button>` : ""}
      </div>`;
    if (window.unstashFocus) window.unstashFocus(root, keepName);
  }

  const focusSub = () => {
    const el = root.querySelector(".sub-add input");
    if (el) el.focus();
  };

  root.onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    const items = cur().items;
    if (f.matches(".sub-add")) {
      const t = items.find((x) => x.id === todo.adding);
      t.subs.push({ id: Date.now(), text: f.sub.value.trim(), done: false });
      tsave();
      render();
      focusSub();
      return;
    }
    todo.who = f.who.value;
    items.unshift({ id: Date.now(), text: f.text.value.trim(), who: todo.who, done: false, subs: [] });
    tsave();
    render();
    root.querySelector("input[name=text]").focus();
  };

  root.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const list = cur();
    if (b.dataset.list) {
      if (+b.dataset.list === state.current) return;
      state.current = +b.dataset.list;
      todo.adding = null;
      tsave();
      return render();
    }
    if (b.dataset.filter) { todo.filter = b.dataset.filter; return render(); }
    const item = b.closest("li.item");
    const id = item && +item.dataset.id;
    const t = id && list.items.find((x) => x.id === id);
    const subEl = b.closest("li.sub");
    const sid = subEl && +subEl.dataset.sub;
    const act = b.dataset.act;
    if (act === "who") { const k = Object.keys(WHO); t.who = k[(k.indexOf(t.who) + 1) % k.length]; }
    else if (act === "add") { todo.adding = todo.adding === id ? null : id; render(); focusSub(); return; }
    else if (act === "archive") { todo.archiveOpen = !todo.archiveOpen; render(); return; }
    else if (act === "clear-archive") list.items = list.items.filter((x) => !isArchived(x));
    else if (act === "toggle") { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; }
    else if (act === "del") list.items = list.items.filter((x) => x.id !== id);
    else if (act === "subtoggle") { const s = t.subs.find((x) => x.id === sid); s.done = !s.done; }
    else if (act === "subdel") t.subs = t.subs.filter((x) => x.id !== sid);
    else if (act === "clear") list.items = list.items.filter((x) => !x.done || isArchived(x));
    else if (act === "newlist") {
      const input = document.createElement("input");
      input.className = "edit tab-edit";
      input.placeholder = "List name…";
      input.size = 12;
      b.replaceWith(input);
      input.focus();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (ok && v) {
          const l = { id: tuid(), name: v, locked: false, items: [] };
          state.lists.push(l);
          state.current = l.id;
          todo.adding = null;
          tsave();
        }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") finish(true);
        if (ev.key === "Escape") finish(false);
      };
      return;
    } else if (act === "deletelist") {
      if (list.locked) return;
      if (!b.dataset.sure) {
        b.dataset.sure = "1";
        b.textContent = `⚠️ Tap again to delete “${list.name}”`;
        setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "🗑 Delete list"; } }, 3000);
        return;
      }
      state.lists = state.lists.filter((l) => l !== list);
      state.current = state.lists[0].id;
      todo.adding = null;
    } else return;
    tsave();
    render();
  };

  root.ondblclick = (e) => {
    const tab = e.target.closest(".s-tab[data-list]");
    if (tab) {
      const l = state.lists.find((x) => x.id === +tab.dataset.list);
      if (!l || l.locked) return;
      const input = document.createElement("input");
      input.className = "edit tab-edit";
      input.value = l.name;
      input.size = Math.max(6, l.name.length);
      tab.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (ok && v) { l.name = v; tsave(); }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") finish(true);
        if (ev.key === "Escape") finish(false);
      };
      return;
    }
    const span = e.target.closest(".txt");
    if (!span) return;
    const item = span.closest("li.item");
    const subEl = span.closest("li.sub");
    const t = cur().items.find((x) => x.id === +item.dataset.id);
    const target = subEl ? t.subs.find((x) => x.id === +subEl.dataset.sub) : t;
    const input = document.createElement("input");
    input.className = "edit";
    input.value = target.text;
    span.replaceWith(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      const v = input.value.trim();
      if (save && v) { target.text = v; tsave(); }
      render();
    };
    input.onblur = () => finish(true);
    input.onkeydown = (ev) => {
      if (ev.key === "Enter") finish(true);
      if (ev.key === "Escape") finish(false);
    };
  };

  root.addEventListener("focusout", (e) => {
    if (!e.target.matches || !e.target.matches(".sub-add input") || e.target.value.trim()) return;
    const next = e.relatedTarget;
    if (next && next.closest && next.closest("li.item") === e.target.closest("li.item") && next.dataset.act === "add") return;
    todo.adding = null;
    if (!next) render();
  }, { signal });

  root.onkeydown = (e) => {
    if (e.key === "Escape" && todo.adding) { todo.adding = null; render(); }
  };

  let drag = null;
  const cancelTouchScroll = (e) => drag && drag.active && e.cancelable && e.preventDefault();
  root.addEventListener("touchmove", cancelTouchScroll, { passive: false, signal });

  root.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest("button, input, select")) return;
    const subEl = e.target.closest("li.sub");
    const itemEl = e.target.closest("li.item");
    if (!itemEl) return;
    drag = {
      kind: subEl ? "sub" : "item",
      id: +(subEl ? subEl.dataset.sub : itemEl.dataset.id),
      parent: +itemEl.dataset.id,
      el: subEl || itemEl,
      x: e.clientX, y: e.clientY,
      active: false,
      touch: e.pointerType === "touch",
      timer: null,
    };
    if (drag.touch) drag.timer = setTimeout(() => drag && startDrag(), 300);
  };

  function startDrag() {
    drag.active = true;
    drag.timer = null;
    drag.ghost = drag.el.cloneNode(true);
    drag.ghost.classList.add("ghost");
    drag.ghost.style.width = drag.el.offsetWidth + "px";
    document.body.appendChild(drag.ghost);
    drag.el.classList.add("dragging");
    if (navigator.vibrate) navigator.vibrate(15);
  }

  const targetAt = (x, y) => {
    drag.ghost.style.display = "none";
    const hit = document.elementFromPoint(x, y);
    drag.ghost.style.display = "";
    const item = hit && hit.closest("#detail-body li.item");
    if (item && +item.dataset.id !== drag.id && !(drag.kind === "sub" && +item.dataset.id === drag.parent)) return { type: "item", el: item };
    if (!item && drag.kind === "sub" && hit && !hit.closest("li.item")) return { type: "root" };
    return null;
  };

  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.active) {
      const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (drag.touch) { if (moved > 8) { clearTimeout(drag.timer); drag = null; } return; }
      if (moved > 6) startDrag(); else return;
    }
    drag.ghost.style.left = e.clientX + 8 + "px";
    drag.ghost.style.top = e.clientY + 8 + "px";
    root.querySelectorAll(".drop").forEach((n) => n.classList.remove("drop"));
    const t = targetAt(e.clientX, e.clientY);
    drag.target = t;
    if (t && t.type === "item") t.el.classList.add("drop");
    if (t && t.type === "root") root.querySelector("[data-root]").classList.add("drop");
  }, { signal });

  const endDrag = (e) => {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag;
    drag = null;
    if (!d.active) return;
    d.ghost.remove();
    const t = d.target;
    const items = cur().items;
    if (t) {
      const parent = items.find((x) => x.id === d.parent);
      let moved = [];
      if (d.kind === "item") {
        const src = items.find((x) => x.id === d.id);
        cur().items = items.filter((x) => x.id !== d.id);
        moved = [{ id: src.id, text: src.text, done: src.done }, ...src.subs];
      } else {
        const s = parent.subs.find((x) => x.id === d.id);
        parent.subs = parent.subs.filter((x) => x.id !== d.id);
        moved = [s];
      }
      if (t.type === "item") {
        cur().items.find((x) => x.id === +t.el.dataset.id).subs.push(...moved);
      } else {
        cur().items.unshift({ id: moved[0].id, text: moved[0].text, who: parent.who, done: moved[0].done, subs: [] });
      }
      tsave();
    }
    render();
    if (e && e.type === "pointerup") {
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      root.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => root.removeEventListener("click", stop, true), 0);
    }
  };
  document.addEventListener("pointerup", endDrag, { signal });
  document.addEventListener("pointercancel", endDrag, { signal });

  root._rerender = () => render();
  render();
};
