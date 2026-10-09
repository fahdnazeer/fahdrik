// Bucket list: big things we want to do together. Categories, target dates with countdowns,
// cost estimates, step checklists, ideas to get inspired, and a memory journal when done.
(function () {
  const KEY = "fahdrik.bucket";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const CATS = {
    travel: { icon: "✈️", name: "Travel" },
    festival: { icon: "🎪", name: "Festivals" },
    adventure: { icon: "🏔️", name: "Adventure" },
    food: { icon: "🍜", name: "Food" },
    culture: { icon: "🎭", name: "Culture" },
    learn: { icon: "📚", name: "Learn" },
    life: { icon: "🏡", name: "Life goals" },
    other: { icon: "✨", name: "Other" },
  };
  const SORTS = { date: "Soonest", new: "Newest", cost: "Cost" };

  const IDEAS = [
    ["See the Northern Lights", "adventure"], ["Roskilde Festival", "festival"], ["Tomorrowland", "festival"],
    ["Road trip through Italy", "travel"], ["Cherry blossom season in Japan", "travel"], ["Hike to Machu Picchu", "adventure"],
    ["Learn to scuba dive", "adventure"], ["Hot air balloon ride", "adventure"], ["Safari in Tanzania", "adventure"],
    ["Sleep in a glass igloo", "travel"], ["Cooking class in Italy", "food"], ["Visit all the Nordic capitals", "travel"],
    ["Coachella", "festival"], ["Michelin star dinner", "food"], ["Run a half marathon together", "adventure"],
    ["Learn a new language together", "learn"], ["Watch a Champions League final", "culture"], ["Island hopping in Greece", "travel"],
    ["New York at Christmas", "travel"], ["Go to a Broadway show", "culture"],
  ];

  const dayOffset = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const toMs = (v) => {
    if (v == null || v === "") return null;
    const t = typeof v === "number" ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T12:00" : v).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const mk = (title, cat, o = {}) => ({ id: uid() + Math.random(), title, cat, status: "todo", added: Date.now(), steps: [], ...o });
  const st = (...a) => a.map(([text, done]) => ({ id: uid() + Math.random(), text, done: !!done }));
  const seed = () => ({
    items: [
      mk("Roskilde Festival", "festival", { date: dayOffset(265), location: "Roskilde, Denmark", cost: 9000, steps: st(["Buy tickets", 1], ["Book camping spot"], ["Pack rain gear"]) }),
      mk("Northern Lights in Tromsø", "travel", { date: dayOffset(95), location: "Tromsø, Norway", cost: 22000, note: "Best between Oct and Feb. Try a husky tour too!", steps: st(["Find flights", 1], ["Book hotel", 1], ["Book aurora tour"], ["Buy warm gear"]) }),
      mk("Cherry blossom season in Japan", "travel", { date: dayOffset(190), location: "Tokyo & Kyoto", cost: 45000, link: "https://www.japan-guide.com", steps: st(["Renew passports"], ["Plan route"]) }),
      mk("Hike to Machu Picchu", "adventure", { location: "Peru", cost: 30000 }),
      mk("Learn to scuba dive", "adventure", { cost: 5000, steps: st(["Find a dive school"], ["Open water course"]) }),
      mk("Cooking class in Italy", "food", { location: "Bologna", cost: 3500 }),
      mk("Run a half marathon together", "life", { date: dayOffset(150), steps: st(["Pick a race", 1], ["Start training plan"]) }),
      mk("Tomorrowland", "festival", { location: "Boom, Belgium", cost: 14000 }),
      mk("Weekend in Paris", "travel", { status: "done", doneAt: dayOffset(-120), date: dayOffset(-120), location: "Paris, France", cost: 8000, actual: 7400, rating: 4.5, memory: "Ate croissants every morning and got caught in the rain at the Eiffel Tower. Perfect.", steps: st(["Book train", 1], ["Reserve dinner", 1]) }),
      mk("Go to a Broadway show", "culture", { status: "done", doneAt: dayOffset(-400), location: "New York", cost: 2500, actual: 3100, rating: 5, memory: "Front-row seats. Still singing the songs.", steps: [] }),
    ],
  });
  const state = window.store.get(KEY, null) || seed();
  state.items.forEach((it) => {
    if (it.date != null) it.date = toMs(it.date);
    if (it.doneAt != null) it.doneAt = toMs(it.doneAt);
  });
  const save = () => {
    try { window.store.save(KEY, state); }
    catch (e) { alert("Storage is full — try smaller photos or remove some items."); }
  };
  window.store.watchState(KEY, state);

  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const money = (n) => {
    const s = new Intl.NumberFormat([], { maximumFractionDigits: 0 }).format(Math.round(n));
    return `${s} NOK`;
  };
  const shortDate = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dayMs = 864e5;

  // "in 12 days" / "in 3 months" / "in 1 yr 2 mo" / "today" / "3 days ago"
  function countdown(ms) {
    const t = toMs(ms);
    if (t == null) return "";
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const days = Math.round((t - start.getTime()) / dayMs);
    if (days === 0) return "today! 🎉";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    if (days < 0) return `${-days} days ago`;
    if (days < 60) return `in ${days} days`;
    if (days < 365) return `in ${Math.round(days / 30)} months`;
    const y = Math.floor(days / 365), m = Math.round((days - y * 365) / 30);
    return `in ${y} yr${m ? " " + m + " mo" : ""}`;
  }

  const GUESS = [
    ["festival", /festival|concert|tomorrowland|roskilde|coachella|glastonbury|primavera|sziget|\bøya\b|\boya\b|gig\b/i],
    ["adventure", /hike|climb|dive|diving|\bski|surf|bungee|skydiv|safari|northern lights|aurora|balloon|camp|kayak|rafting|marathon|trek|snowboard|glacier/i],
    ["food", /\beat\b|dinner|restaurant|cook|food|wine|michelin|sushi|tasting|bake/i],
    ["learn", /learn|course|study|language|lesson|class\b|master|certificate/i],
    ["life", /\bbuy\b|house|\bhome\b|move to|wedding|baby|\bdog\b|business|retire|garden|renovat|apartment/i],
    ["culture", /museum|theat|opera|ballet|musical|exhibit|champions league|match|final\b|stadium|broadway/i],
    ["travel", /trip|visit|travel|city|island|country|road ?trip|tour|weekend|japan|italy|iceland|norway|usa|paris|rome|tokyo|bali|thailand|new york|london|spain|greece|nordic|croatia|portugal|mexico|peru/i],
  ];
  const guess = (t) => (GUESS.find(([, re]) => re.test(t)) || ["other"])[0];

  const pic = (it) =>
    it.img
      ? `<img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="bk-ph" style="--h:${hue(it.title)}"><span>${CATS[it.cat].icon}</span></div>`;

  const stars = (val) =>
    `<span class="stars bk-stars">${[1, 2, 3, 4, 5]
      .map((i) => `<span class="star" data-i="${i}"><i class="bg">★</i><i class="fg" style="width:${val >= i ? 100 : val >= i - 0.5 ? 50 : 0}%">★</i></span>`)
      .join("")}</span>`;

  function resizeImage(file, max = 800, q = 0.78) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", q));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  window.renderBucket = function (root) {
    root._storeKey = KEY;
    const ui = { view: "list", id: null, tab: "todo", cat: "all", sort: "date", ideas: false, sure: false };
    const steps = (it) => it.steps || [];

    // ---------- list ----------
    function list() {
      const todo = state.items.filter((i) => i.status !== "done");
      const done = state.items.filter((i) => i.status === "done");
      const pool = ui.tab === "done" ? done : todo;
      const cats = [...new Set(pool.map((i) => i.cat))];
      if (ui.cat !== "all" && !cats.includes(ui.cat)) ui.cat = "all";
      const shown = pool.filter((i) => ui.cat === "all" || i.cat === ui.cat);

      if (ui.tab === "done") shown.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      else if (ui.sort === "date") shown.sort((a, b) => (a.date || 9e15) - (b.date || 9e15) || b.added - a.added);
      else if (ui.sort === "cost") shown.sort((a, b) => (+b.cost || 0) - (+a.cost || 0));
      else shown.sort((a, b) => b.added - a.added);

      const pct = state.items.length ? Math.round((done.length / state.items.length) * 100) : 0;
      const remaining = todo.reduce((a, i) => a + (+i.cost || 0), 0);
      const next = todo.filter((i) => i.date && i.date >= Date.now() - dayMs).sort((a, b) => a.date - b.date)[0];
      const have = new Set(state.items.map((i) => i.title.toLowerCase()));
      const ideas = IDEAS.filter(([t]) => !have.has(t.toLowerCase()));

      root.innerHTML = `
        ${
          state.items.length
            ? `<div class="bk-stats">
                <div class="bk-ring" style="--p:${pct}"><b>${pct}%</b></div>
                <div class="bk-statt">
                  <b>${done.length} of ${state.items.length} done</b>
                  <span>${remaining ? `${money(remaining)} to dream about` : todo.length ? "Keep dreaming ✨" : "All done — add more dreams!"}</span>
                  ${next ? `<span class="bk-next" data-open="${next.id}">⏳ Next: <b>${esc(next.title)}</b> ${countdown(next.date)}</span>` : ""}
                </div>
              </div>`
            : ""
        }

        <form class="wi-add">
          <input name="title" placeholder="Add something we should do… (e.g. “Roskilde Festival”)" autocomplete="off" required />
          <button>Add</button>
        </form>
        <button class="bk-ideas-btn" data-act="ideas">💡 ${ui.ideas ? "Hide ideas" : "Need inspiration?"}</button>
        ${
          ui.ideas
            ? `<div class="bk-ideas">${ideas.length ? ideas.map(([t, c]) => `<button data-idea="${esc(t)}|${c}">${CATS[c].icon} ${esc(t)}</button>`).join("") : "<span>You've added every idea we had 🎉</span>"}</div>`
            : ""
        }

        <div class="wi-bar">
          <div class="wi-seg">
            <button data-tab="todo" class="${ui.tab === "todo" ? "on" : ""}">To do <span>${todo.length}</span></button>
            <button data-tab="done" class="${ui.tab === "done" ? "on" : ""}">Done ✓ <span>${done.length}</span></button>
          </div>
          ${ui.tab === "todo" ? `<button class="wi-sort" data-act="sort">Sort: ${SORTS[ui.sort]}</button>` : ""}
        </div>
        ${
          cats.length > 1
            ? `<div class="wi-who bk-cats" style="margin-top:12px">
                <button data-cat="all" class="${ui.cat === "all" ? "on" : ""}">All</button>
                ${cats.map((c) => `<button data-cat="${c}" class="${ui.cat === c ? "on" : ""}">${CATS[c].icon} ${CATS[c].name}</button>`).join("")}
              </div>`
            : ""
        }

        ${
          shown.length
            ? `<div class="bk-grid">${shown
                .map((it) => {
                  const st = steps(it), sd = st.filter((s) => s.done).length;
                  return `<article class="bk-card ${it.status === "done" ? "done" : ""}" data-open="${it.id}">
                    <div class="bk-img">${pic(it)}
                      <i class="bk-cat">${CATS[it.cat].icon}</i>
                      ${it.status === "done" ? `<i class="wi-done">✓</i>` : it.date ? `<i class="bk-when">${countdown(it.date)}</i>` : ""}
                    </div>
                    <h3>${esc(it.title)}</h3>
                    <p>${esc([it.location, it.status === "done" ? (it.doneAt ? shortDate(it.doneAt) : "") : it.date ? shortDate(it.date) : "", it.cost && it.status !== "done" ? money(it.cost) : ""].filter(Boolean).join(" · ")) || '<span class="dim">Someday</span>'}</p>
                    ${st.length && it.status !== "done" ? `<div class="bk-prog"><div style="width:${(sd / st.length) * 100}%"></div></div><small class="bk-sm">${sd}/${st.length} steps</small>` : ""}
                    ${it.status === "done" && it.rating ? `<small class="bk-sm gold">${"★".repeat(Math.floor(it.rating))}${it.rating % 1 ? "½" : ""}</small>` : ""}
                  </article>`;
                })
                .join("")}</div>`
            : `<p class="s-empty">${ui.tab === "done" ? "Nothing ticked off yet — go make some memories!" : "Nothing here yet. Add your first dream above."}</p>`
        }`;
    }

    // ---------- detail ----------
    function detail() {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) { ui.view = "list"; return render(); }
      const done = it.status === "done";
      const st = steps(it);
      root.innerHTML = `
        <button class="r-back" data-act="back">← Bucket list</button>
        <label class="wi-hero" title="Change photo">${pic(it)}<input type="file" accept="image/*" hidden data-role="cover" /></label>
        <h2 class="w-title" title="Double-click to edit">${esc(it.title)}</h2>

        <div class="wi-segs" style="margin-top:8px">
          ${Object.entries(CATS).map(([k, c]) => `<button data-set="cat:${k}" class="${it.cat === k ? "on" : ""}">${c.icon} ${c.name}</button>`).join("")}
        </div>

        <h4 class="r-h">Where</h4>
        <input data-f="location" placeholder="Country, city or venue…" value="${esc(it.location || "")}" />

        ${
          done
            ? ""
            : `<h4 class="r-h">When ${it.date ? `<span class="bk-cd">${countdown(it.date)}</span>` : ""}</h4>
               <div class="wi-link">
                 <input data-f="date" type="date" value="${it.date ? ymd(it.date) : ""}" />
                 ${it.date ? `<button class="wi-open" data-act="someday" style="border:0;cursor:pointer;color:var(--text)">Someday</button>` : ""}
               </div>
               ${it.date ? "" : `<p class="w-hint">No date yet — it's a “someday” dream.</p>`}`
        }

        <div class="wi-row">
          <label>Estimated cost<input data-f="cost" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${it.cost || ""}" /></label>
          <label>Link<input data-f="link" placeholder="Tickets, info…" value="${esc(it.link || "")}" /></label>
        </div>
        ${it.link ? `<a class="wi-open" style="display:inline-block;margin-top:8px;text-decoration:none" href="${esc(/^https?:\/\//i.test(it.link) ? it.link : "https://" + it.link)}" target="_blank" rel="noopener">Open link ↗</a>` : ""}

        <h4 class="r-h">Steps ${st.length ? `<span class="bk-cd">${st.filter((s) => s.done).length}/${st.length}</span>` : ""}</h4>
        ${
          st.length
            ? `<ul class="bk-steps">${st
                .map(
                  (s) => `<li class="${s.done ? "done" : ""}" data-step="${s.id}">
                    <button class="check small" data-act="steptoggle" aria-label="Toggle">${s.done ? "✓" : ""}</button>
                    <span class="txt">${esc(s.text)}</span>
                    <button class="del" data-act="stepdel" aria-label="Delete">✕</button></li>`
                )
                .join("")}</ul>`
            : ""
        }
        <form class="bk-step-add"><input name="step" placeholder="Add a step (book flights, get passport…)" autocomplete="off" required /><button>+</button></form>

        <h4 class="r-h">Notes</h4>
        <textarea data-f="note" rows="3" placeholder="Ideas, places to stay, who to bring…">${esc(it.note || "")}</textarea>

        <h4 class="r-h">${done ? "Memories" : "Done?"}</h4>
        ${
          done
            ? `<div class="bk-done">
                <div class="wi-row">
                  <label>Date<input data-f="doneAt" type="date" value="${ymd(it.doneAt || Date.now())}" max="${ymd(Date.now())}" /></label>
                  <label>What it cost<input data-f="actual" type="number" min="0" step="any" inputmode="decimal" placeholder="${it.cost || 0}" value="${it.actual ?? ""}" /></label>
                </div>
                <div class="w-who" style="margin:12px 0 6px"><b style="width:auto">Our rating</b>${stars(it.rating || 0)}<em>${it.rating ? it.rating : ""}</em></div>
                <textarea data-f="memory" rows="4" placeholder="What did we love? Favourite moment…">${esc(it.memory || "")}</textarea>
                <div class="bk-photos">
                  ${(it.photos || []).map((p, i) => `<div class="bk-photo"><img src="${esc(p)}" alt="" /><button data-act="photodel" data-i="${i}" aria-label="Remove photo">✕</button></div>`).join("")}
                  ${(it.photos || []).length < 6 ? `<label class="bk-add-photo">＋<input type="file" accept="image/*" hidden data-role="memory" /></label>` : ""}
                </div>
                <button class="wi-btn ghost" data-act="undone">↩ Move back to the to-do list</button>
              </div>`
            : `<button class="wi-btn" data-act="done">🎉 We did it!</button>`
        }
        <button class="w-del" data-act="del">${ui.sure ? "Tap again to remove" : "🗑 Remove from list"}</button>`;
    }

    function render() { (ui.view === "detail" ? detail : list)(); }

    function addItem(title, cat) {
      const it = { id: uid(), title: title.trim(), cat: cat || guess(title), status: "todo", added: Date.now(), steps: [] };
      state.items.unshift(it);
      save();
      return it;
    }

    // ---------- events ----------
    let pan = null;
    root.onwheel = (e) => {
      const row = e.target.closest(".wi-who");
      if (!row || row.scrollWidth <= row.clientWidth + 1) return;
      row.scrollLeft += e.deltaY + e.deltaX;
      e.preventDefault();
    };
    root.onpointerdown = (e) => {
      const row = e.target.closest(".wi-who");
      if (!row || row.scrollWidth <= row.clientWidth + 1) return;
      pan = { row, x: e.clientX, left: row.scrollLeft, moved: false };
    };
    root.onpointermove = (e) => {
      if (!pan) return;
      const dx = e.clientX - pan.x;
      if (Math.abs(dx) > 6) pan.moved = true;
      if (pan.moved) pan.row.scrollLeft = pan.left - dx;
    };
    root.onpointerup = root.onpointercancel = () => {
      if (pan?.moved) root._skipCat = true;
      pan = null;
    };

    root.onsubmit = (e) => {
      e.preventDefault();
      if (e.target.classList.contains("bk-step-add")) {
        const it = state.items.find((x) => x.id === ui.id);
        it.steps = steps(it);
        it.steps.push({ id: uid(), text: e.target.step.value.trim(), done: false });
        save(); render();
        root.querySelector("input[name=step]").focus();
        return;
      }
      const t = e.target.title.value.trim();
      if (!t) return;
      addItem(t);
      render();
      root.querySelector("input[name=title]").focus();
    };

    root.onchange = async (e) => {
      const it = state.items.find((x) => x.id === ui.id);
      const t = e.target;
      if (!it) return;
      if (t.type === "file" && t.files[0]) {
        try {
          if (t.dataset.role === "memory") { it.photos = it.photos || []; it.photos.push(await resizeImage(t.files[0], 700, 0.7)); }
          else it.img = await resizeImage(t.files[0]);
          save(); render();
        } catch (_) { alert("Couldn't read that image."); }
        return;
      }
      const f = t.dataset.f;
      if (!f) return;
      if (f === "date" || f === "doneAt") {
        if (t.value) it[f] = new Date(t.value + "T12:00").getTime();
        else if (f === "date") it.date = null;
        save(); render();
      } else if (f === "cost" || f === "actual") {
        const v = parseFloat(t.value);
        if (t.value === "" || !(v >= 0)) delete it[f]; else it[f] = v;
        save();
      } else {
        it[f] = t.value.trim();
        save();
        if (f === "link") render();
      }
    };

    root.ondblclick = (e) => {
      const h = e.target.closest(".w-title");
      if (!h) return;
      const it = state.items.find((x) => x.id === ui.id);
      const input = document.createElement("input");
      input.className = "edit";
      input.value = it.title;
      h.replaceWith(input);
      input.focus();
      input.select();
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        if (ok && input.value.trim()) { it.title = input.value.trim(); save(); }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); };
    };

    root.onclick = (e) => {
      if (root._skipCat) { root._skipCat = false; return; }
      const star = e.target.closest(".star");
      if (star) {
        const it = state.items.find((x) => x.id === ui.id);
        const i = +star.dataset.i;
        const half = e.clientX - star.getBoundingClientRect().left < star.offsetWidth / 2;
        let val = half ? i - 0.5 : i;
        if (it.rating === val) val = 0;
        it.rating = val;
        save();
        return render();
      }
      const open = e.target.closest("[data-open]");
      if (open) { ui.id = +open.dataset.open; ui.view = "detail"; ui.sure = false; window.scrollTo(0, 0); return render(); }

      const idea = e.target.closest("[data-idea]");
      if (idea) { const [t, c] = idea.dataset.idea.split("|"); addItem(t, c); return render(); }
      const tab = e.target.closest("[data-tab]");
      if (tab) { ui.tab = tab.dataset.tab; ui.cat = "all"; return render(); }
      const cat = e.target.closest("[data-cat]");
      if (cat) { ui.cat = cat.dataset.cat; return render(); }
      const set = e.target.closest("[data-set]");
      if (set) {
        const it = state.items.find((x) => x.id === ui.id);
        const [field, val] = set.dataset.set.split(":");
        it[field] = val;
        save();
        return render();
      }

      const btn = e.target.closest("[data-act]");
      const act = btn?.dataset.act;
      if (!act) return;
      const it = state.items.find((x) => x.id === ui.id);
      const stepId = e.target.closest("[data-step]")?.dataset.step;

      if (act === "back") ui.view = "list";
      else if (act === "ideas") ui.ideas = !ui.ideas;
      else if (act === "sort") { const k = Object.keys(SORTS); ui.sort = k[(k.indexOf(ui.sort) + 1) % k.length]; }
      else if (act === "someday") { it.date = null; save(); }
      else if (act === "steptoggle") { const s = it.steps.find((x) => x.id === +stepId); s.done = !s.done; save(); }
      else if (act === "stepdel") { it.steps = it.steps.filter((x) => x.id !== +stepId); save(); }
      else if (act === "done") { it.status = "done"; it.doneAt = Date.now(); save(); }
      else if (act === "undone") { it.status = "todo"; it.doneAt = null; save(); }
      else if (act === "photodel") { it.photos.splice(+btn.dataset.i, 1); save(); }
      else if (act === "del") {
        if (!ui.sure) { ui.sure = true; setTimeout(() => { ui.sure = false; if (ui.view === "detail") render(); }, 3000); }
        else { state.items = state.items.filter((x) => x !== it); save(); ui.view = "list"; ui.sure = false; }
      }
      else return;
      render();
    };

    root._rerender = () => render();
    render();
  };
})();
