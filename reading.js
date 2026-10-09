// Reading list: one shared library of books. Each book has its own status, progress,
// finish date, rating and thoughts for Fahd and for Eirik.
// Search and covers come from Open Library (free, no key needed).
(function () {
  const KEY = "fahdrik.reading";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const PEOPLE = { me: "Fahd", partner: "Eirik" };
  const WHO = Object.keys(PEOPLE);
  const STATUS = { want: "Want to read", reading: "Reading", read: "Read" };
  const TYPE = { book: "📖", audio: "🎧" };

  const state = window.store.get(KEY, { items: [] });
  // Migration from the single-status version: both people get the old status
  state.items.forEach((it) => {
    if (!it.st) {
      const s = ["want", "reading", "read"].includes(it.status) ? it.status : "want";
      it.st = { me: s, partner: s };
      it.pg = { me: it.page || 0, partner: 0 };
      it.fin = { me: it.finishedAt || null, partner: it.finishedAt || null };
    }
    it.pg = it.pg || {};
    it.fin = it.fin || {};
  });
  const save = () => {
    try { window.store.save(KEY, state); }
    catch (e) { alert("Storage is full — try smaller covers or remove some books."); }
  };
  window.store.watchState(KEY, state);

  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const poster = (it) =>
    it.poster
      ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="w-ph" style="--h:${hue(it.title)}"><span>${TYPE[it.type]}</span><small>${esc(it.title)}</small></div>`;

  const avg = (it, who) => {
    const v = (who && who !== "all" ? [it.rating?.[who]] : [it.rating?.me, it.rating?.partner]).filter((x) => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const shortDate = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const fmt = (n) => (Math.round(n * 10) / 10).toString();
  const pct = (it, w) => (it.pages && it.pg[w] ? Math.min(100, Math.round((it.pg[w] / it.pages) * 100)) : 0);
  const latestFin = (it, who) => Math.max(0, ...(who === "all" ? WHO : [who]).map((w) => (it.st[w] === "read" ? it.fin[w] || 0 : 0)));

  const stars = (val, who) =>
    `<span class="stars" data-who="${who}">${[1, 2, 3, 4, 5]
      .map((i) => `<span class="star" data-i="${i}"><i class="bg">★</i><i class="fg" style="width:${val >= i ? 100 : val >= i - 0.5 ? 50 : 0}%">★</i></span>`)
      .join("")}</span>`;

  function resizeImage(file, max = 500) {
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
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Lower-case, drop accents and apostrophes, turn other punctuation into spaces
  const norm = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  // Open Library: free book search + covers. (Goodreads closed its public API in 2020.)
  async function search(q) {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(norm(q))}&limit=14&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median`;
    const d = await (await fetch(url)).json();
    const seen = new Set();
    return (d.docs || [])
      .filter((x) => {
        const k = norm(x.title) + "|" + norm((x.author_name || [""])[0]);
        return !seen.has(k) && seen.add(k);
      })
      .sort((a, b) => !!b.cover_i - !!a.cover_i) // books with a cover first (stable)
      .slice(0, 6)
      .map((x) => ({
        type: "book",
        title: x.title,
        author: (x.author_name || [])[0] || "",
        year: x.first_publish_year ? String(x.first_publish_year) : "",
        pages: x.number_of_pages_median || "",
        poster: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : "",
        olkey: x.key || "",
      }));
  }

  // Tidy Open Library descriptions: drop markdown/links and extra sections, keep a short blurb
  function cleanDesc(raw) {
    let t = typeof raw === "string" ? raw : raw?.value || "";
    t = t.replace(/\r/g, "").split(/\n\s*-{3,}/)[0];
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\(\[source\][^)]*\)/gi, "").replace(/\[\d+\]:?\s*\S*/g, "").replace(/[*_]{1,2}/g, "");
    t = t.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
    if (t.length > 420) {
      const cut = t.slice(0, 420);
      const end = cut.lastIndexOf(". ");
      t = end > 150 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
    }
    return t;
  }

  // Short description from Open Library (find the work first if we don't have its key yet)
  async function loadDesc(it) {
    if (!it.olkey) {
      const res = await search(it.title);
      const m = res.find((x) => norm(x.title) === norm(it.title)) || res[0];
      if (!m || !m.olkey) return false;
      it.olkey = m.olkey;
      it.author = it.author || m.author;
      it.year = it.year || m.year;
      it.pages = it.pages || m.pages;
      if (!it.poster && m.poster) it.poster = m.poster;
    }
    const d = await (await fetch(`https://openlibrary.org${it.olkey}.json`)).json();
    const text = cleanDesc(d.description) || cleanDesc(d.first_sentence);
    if (text) it.overview = text;
    return !!it.overview;
  }

  window.renderReading = function (root) {
    if (root._ac) root._ac.abort(); // drop listeners from earlier visits
    root._ac = new AbortController();
    const signal = root._ac.signal;
    root._storeKey = KEY;
    const ui = { view: "list", tab: "want", who: "all", type: "all", sort: "added", id: null, addType: "book", results: [], sure: false };

    const inTab = (it, tab) => (ui.who === "all" ? WHO.some((w) => it.st[w] === tab) : it.st[ui.who] === tab);
    const chipIcon = (it, w) => {
      const s = it.st[w];
      if (!s) return "";
      const label = s === "read" ? "✓" : s === "reading" ? (pct(it, w) ? pct(it, w) + "%" : it.pg[w] ? "p." + it.pg[w] : "📖") : "🔖";
      return `<i class="b-chip ${s}"><b>${PEOPLE[w][0]}</b>${label}</i>`;
    };

    // ---------- list ----------
    function list() {
      const base = state.items.filter((i) => ui.type === "all" || i.type === ui.type);
      const count = (t) => base.filter((i) => inTab(i, t)).length;
      const shown = base.filter((i) => inTab(i, ui.tab));
      if (ui.tab === "read") {
        shown.sort(ui.sort === "rating" ? (a, b) => avg(b, ui.who) - avg(a, ui.who) : (a, b) => latestFin(b, ui.who) - latestFin(a, ui.who));
      } else shown.sort((a, b) => b.added - a.added);

      root.innerHTML = `
        <div class="b-who">
          ${[["all", "Both of us"], ["me", PEOPLE.me], ["partner", PEOPLE.partner]]
            .map(([k, n]) => `<button data-who="${k}" class="${ui.who === k ? "on" : ""}">${n}</button>`)
            .join("")}
        </div>
        <div class="w-tabs" style="margin-top:10px">
          ${Object.entries(STATUS)
            .map(([k, n]) => `<button data-tab="${k}" class="${ui.tab === k ? "on" : ""}">${n} <span>${count(k)}</span></button>`)
            .join("")}
        </div>

        <form class="w-add">
          <input name="title" placeholder="Search a book or author…" autocomplete="off" required />
          <button type="button" class="w-type" data-act="addtype" title="Book or audiobook">${TYPE[ui.addType]}</button>
          <button class="w-addbtn">Add</button>
          <div class="s-suggest w-suggest" hidden></div>
        </form>
        <p class="w-hint">New books go to “${STATUS[ui.tab]}” for ${ui.who === "all" ? "both of you" : PEOPLE[ui.who]}.</p>

        <div class="w-filters">
          ${[["all", "All"], ["book", "📖 Books"], ["audio", "🎧 Audiobooks"]]
            .map(([k, n]) => `<button data-type="${k}" class="${ui.type === k ? "on" : ""}">${n}</button>`)
            .join("")}
          ${ui.tab === "read" ? `<button class="sort" data-act="sort">Sort: ${ui.sort === "rating" ? "rating" : "date"}</button>` : ""}
          ${ui.tab === "want" && shown.length > 1 ? `<button class="sort" data-act="random">🎲 Surprise us</button>` : ""}
        </div>

        ${
          shown.length
            ? `<div class="w-grid">${shown
                .map(
                  (it) => `<article class="w-card" data-open="${it.id}">
                    <div class="w-poster">${poster(it)}<i class="w-type-badge">${TYPE[it.type]}</i>
                      ${avg(it, ui.who) ? `<i class="w-score top">★ ${fmt(avg(it, ui.who))}</i>` : ""}
                      <span class="b-chips">${WHO.map((w) => chipIcon(it, w)).join("")}</span>
                    </div>
                    <h3>${esc(it.title)}</h3>
                    <p>${ui.tab === "read" && latestFin(it, ui.who) ? "Finished " + shortDate(latestFin(it, ui.who)) : esc([it.author, it.year].filter(Boolean).join(" · "))}</p>
                  </article>`
                )
                .join("")}</div>`
            : `<p class="s-empty">${
                { want: "Nothing on the list yet. Add a book to read.", reading: "Nothing in progress.", read: "No finished books yet." }[ui.tab]
              }</p>`
        }`;
    }

    // ---------- detail ----------
    function person(it, w) {
      const s = it.st[w];
      return `
        <section class="b-person">
          <div class="b-ph"><b>${PEOPLE[w]}</b>
            <div class="b-st">
              ${[["", "—"], ...Object.entries(STATUS)]
                .map(([k, n]) => `<button data-pst="${w}:${k}" class="${s === k ? "on" : ""}">${n}</button>`)
                .join("")}
            </div>
          </div>
          ${
            s === "reading"
              ? `<div class="w-progress">${it.type === "audio" ? "Minutes" : "Page"}
                  <input class="w-num" type="number" min="0" data-field="pg" data-w="${w}" value="${it.pg[w] || ""}" placeholder="0" /> of
                  <input class="w-num" type="number" min="0" data-field="pages" value="${it.pages || ""}" placeholder="?" />
                  ${pct(it, w) ? `<span class="w-pct">${pct(it, w)}%</span>` : ""}</div>`
              : ""
          }
          ${
            s === "read"
              ? `<div class="w-who"><span class="b-lbl">Finished</span>
                   <input class="w-date" type="date" data-fin="${w}" value="${ymd(it.fin[w] || Date.now())}" max="${ymd(Date.now())}" /></div>
                 <div class="w-who">${stars(it.rating?.[w] || 0, w)}<em>${it.rating?.[w] ? fmt(it.rating[w]) : ""}</em></div>
                 <input class="w-note" data-note="${w}" placeholder="${PEOPLE[w]}'s thoughts…" value="${esc(it.note?.[w] || "")}" />`
              : ""
          }
        </section>`;
    }

    function detail() {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) { ui.view = "list"; return render(); }
      root.innerHTML = `
        <button class="r-back" data-act="back">← Reading list</button>
        <div class="w-top">
          <div class="w-bigwrap"><label class="w-big" title="Change cover">${poster(it)}<input type="file" accept="image/*" hidden /></label>
            <button class="w-find" data-act="find">${ui.finding ? "Searching…" : ui.notFound ? "No cover found" : "🔍 Find cover"}</button></div>
          <div class="w-info">
            <h2 class="w-title" title="Double-click to edit">${esc(it.title)}</h2>
            <div class="w-typesw">
              <button data-settype="book" class="${it.type === "book" ? "on" : ""}">📖 Book</button>
              <button data-settype="audio" class="${it.type === "audio" ? "on" : ""}">🎧 Audio</button>
            </div>
            ${it.author || it.year ? `<p class="w-meta">${esc([it.author, it.year].filter(Boolean).join(" · "))}</p>` : ""}
            ${avg(it) ? `<p class="w-avg">★ ${fmt(avg(it))} <small>together</small></p>` : ""}
          </div>
        </div>

        ${it.overview ? `<p class="w-desc">${esc(it.overview)}</p>` : ""}

        ${WHO.map((w) => person(it, w)).join("")}

        <h4 class="r-h">Where to read</h4>
        <input class="w-plat" placeholder="Library, Kindle, Audible, paper…" value="${esc(it.platform || "")}" />
        <button class="w-del" data-act="del">${ui.sure ? "Tap again to remove" : "🗑 Remove from list"}</button>`;
      // Older books: fetch the description the first time they are opened
      if (!it.overview && !it.descTried) {
        it.descTried = true;
        loadDesc(it).then((ok) => { save(); if (ok && ui.view === "detail" && ui.id === it.id) render(); }).catch(() => save());
      }
    }

    function render() { (ui.view === "detail" ? detail : list)(); }

    // ---------- adding ----------
    function add(partial) {
      const st = { me: "", partner: "" };
      (ui.who === "all" ? WHO : [ui.who]).forEach((w) => (st[w] = ui.tab));
      const it = {
        id: uid(), type: ui.addType, title: partial.title.trim(), author: partial.author || "", year: partial.year || "",
        pages: partial.pages || "", poster: partial.poster || "", olkey: partial.olkey || "", overview: "", platform: "",
        st, pg: {}, fin: {}, added: Date.now(), rating: {}, note: {},
      };
      WHO.forEach((w) => { if (st[w] === "read") it.fin[w] = Date.now(); });
      state.items.unshift(it);
      save();
      it.descTried = true;
      loadDesc(it).then(save).catch(() => {});
    }

    let timer;
    const box = () => root.querySelector(".w-suggest");
    const hide = () => { const b = box(); if (b) { b.hidden = true; b.innerHTML = ""; } };

    root.oninput = (e) => {
      if (e.target.name !== "title") return;
      clearTimeout(timer);
      const q = e.target.value.trim();
      if (q.length < 2) return hide();
      timer = setTimeout(async () => {
        try {
          const results = await search(q);
          const cur = root.querySelector("input[name=title]");
          if (!cur || cur.value.trim() !== q) return; // a newer search has taken over
          ui.results = results;
          const b = box();
          if (!b || !ui.results.length) return hide();
          b.innerHTML = ui.results
            .map((x, i) => `<button type="button" data-pick="${i}">${x.poster ? `<img src="${esc(x.poster)}" alt="" onerror="this.style.visibility='hidden'" />` : `<i>${TYPE[x.type]}</i>`}<span><b>${esc(x.title)}</b><small>${esc([x.author, x.year].filter(Boolean).join(" · "))}</small></span></button>`)
            .join("");
          b.hidden = false;
        } catch (_) { hide(); }
      }, 300);
    };
    root.addEventListener("focusout", (e) => { if (e.target.name === "title") hide(); }, { signal });
    root.addEventListener("pointerdown", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (!pick) return;
      e.preventDefault();
      add(ui.results[+pick.dataset.pick]);
      render();
    }, { signal });

    root.onsubmit = (e) => {
      e.preventDefault();
      const title = e.target.title.value.trim();
      if (!title) return;
      add({ title });
      render();
      root.querySelector("input[name=title]").focus();
    };

    // ---------- edits ----------
    root.onchange = async (e) => {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) return;
      const t = e.target;
      if (t.type === "file" && t.files[0]) {
        try { it.poster = await resizeImage(t.files[0]); save(); render(); } catch (_) { alert("Couldn't read that image."); }
      } else if (t.dataset.note) {
        it.note = it.note || {};
        it.note[t.dataset.note] = t.value.trim();
        save();
      } else if (t.dataset.field === "pg") {
        it.pg[t.dataset.w] = Math.max(0, parseInt(t.value, 10) || 0);
        save(); render();
      } else if (t.dataset.field === "pages") {
        it.pages = Math.max(0, parseInt(t.value, 10) || 0);
        save(); render();
      } else if (t.dataset.fin) {
        if (t.value) { it.fin[t.dataset.fin] = new Date(t.value + "T12:00").getTime(); save(); }
      } else if (t.classList.contains("w-plat")) {
        it.platform = t.value.trim();
        save();
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
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        if (ok && input.value.trim()) { it.title = input.value.trim(); save(); }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); };
    };

    root.onclick = (e) => {
      const card = e.target.closest("[data-open]");
      if (card) { ui.id = +card.dataset.open; ui.view = "detail"; ui.sure = false; ui.notFound = false; window.scrollTo(0, 0); return render(); }

      const star = e.target.closest(".star");
      if (star) {
        const it = state.items.find((x) => x.id === ui.id);
        const who = star.closest(".stars").dataset.who;
        const i = +star.dataset.i;
        const half = e.clientX - star.getBoundingClientRect().left < star.offsetWidth / 2;
        let val = half ? i - 0.5 : i;
        it.rating = it.rating || {};
        if (it.rating[who] === val) val = 0; // tap again to clear
        it.rating[who] = val;
        save();
        return render();
      }

      const who = e.target.closest("[data-who]:not(.stars)");
      if (who) { ui.who = who.dataset.who; return render(); }
      const tab = e.target.closest("[data-tab]");
      if (tab) { ui.tab = tab.dataset.tab; return render(); }
      const type = e.target.closest("[data-type]");
      if (type) { ui.type = type.dataset.type; return render(); }
      const ty = e.target.closest("[data-settype]");
      if (ty) {
        state.items.find((x) => x.id === ui.id).type = ty.dataset.settype;
        save();
        return render();
      }
      const pst = e.target.closest("[data-pst]");
      if (pst) {
        const it = state.items.find((x) => x.id === ui.id);
        const [w, s] = pst.dataset.pst.split(":");
        it.st[w] = s;
        if (s === "read" && !it.fin[w]) it.fin[w] = Date.now();
        if (s !== "read") it.fin[w] = null;
        save();
        return render();
      }

      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      const it = state.items.find((x) => x.id === ui.id);
      if (act === "back") ui.view = "list";
      else if (act === "addtype") ui.addType = ui.addType === "book" ? "audio" : "book";
      else if (act === "sort") ui.sort = ui.sort === "rating" ? "date" : "rating";
      else if (act === "random") {
        const pool = state.items.filter((i) => inTab(i, "want") && (ui.type === "all" || i.type === ui.type));
        ui.id = pool[Math.floor(Math.random() * pool.length)].id;
        ui.view = "detail";
        window.scrollTo(0, 0);
      }
      else if (act === "find") {
        ui.finding = true; ui.notFound = false;
        render();
        search(it.title).then((res) => {
          const m = res.find((x) => x.poster);
          if (m) { it.poster = m.poster; it.year = it.year || m.year; it.author = it.author || m.author; it.pages = it.pages || m.pages; it.olkey = it.olkey || m.olkey; save(); } else ui.notFound = true;
          return it.overview ? null : loadDesc(it).then(save);
        }).catch(() => (ui.notFound = true)).finally(() => { ui.finding = false; if (ui.view === "detail") render(); });
        return;
      }
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
