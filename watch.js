// Watch list: want to watch / watching / watched, with separate ratings for Fahd and Eirik.
// Optional: add a free TMDB key in config.js (window.TMDB_KEY) for search + automatic posters.
(function () {
  const KEY = "fahdrik.watch";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const PEOPLE = { me: "Fahd", partner: "Eirik" };
  const STATUS = { want: "Want to watch", watching: "Watching", watched: "Watched" };
  const TYPE = { movie: "🎬", show: "📺" };

  const state = window.store.get(KEY, { items: [] });
  const save = () => {
    try { window.store.save(KEY, state); }
    catch (e) { alert("Storage is full — try smaller posters or remove some titles."); }
  };
  window.store.watchState(KEY, state);

  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const poster = (it) =>
    it.poster
      ? `<img src="${esc(it.poster)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="w-ph" style="--h:${hue(it.title)}"><span>${TYPE[it.type]}</span><small>${esc(it.title)}</small></div>`;

  const avg = (it) => {
    const v = [it.rating?.me, it.rating?.partner].filter((x) => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const shortDate = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

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

  // IMDb has no public API. OMDb serves IMDb's own data and posters (free key), TMDB is an alternative.
  const hasKey = () => !!(window.OMDB_KEY || window.TMDB_KEY);
  // Lower-case, drop accents and apostrophes, turn other punctuation into spaces
  const norm = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  // OMDb only matches whole words exactly ("oceans" misses "Ocean's"), so try a few forgiving variants
  function omdbVariants(q) {
    const t = norm(q).split(" ").filter(Boolean);
    const out = new Set();
    const add = (tokens) => {
      if (!tokens.length) return;
      out.add(tokens.join(" "));
      const poss = tokens.map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) + "'s" : w)); // oceans -> ocean's
      out.add(poss.join(" "));
    };
    add(t);
    if (t.length > 1) add(t.slice(0, -1)); // last word may still be half-typed
    if (t.length > 2) add(t.slice(0, -2));
    if (t.length > 2) add(t.slice(1)); // first word may be glued ("spiderman" vs "Spider-Man")
    return [...out].slice(0, 7);
  }

  async function search(q) {
    if (window.OMDB_KEY) {
      const qt = norm(q).split(" ").filter(Boolean);
      const pages = await Promise.all(
        omdbVariants(q).map((v) =>
          fetch(`https://www.omdbapi.com/?apikey=${window.OMDB_KEY}&s=${encodeURIComponent(v)}`)
            .then((r) => r.json())
            .then((d) => d.Search || [])
            .catch(() => [])
        )
      );
      const seen = new Set();
      const all = pages.flat().filter((x) => (x.Type === "movie" || x.Type === "series") && !seen.has(x.imdbID) && seen.add(x.imdbID));
      // Keep titles where every typed word starts a word in the title
      const compactQ = qt.join("");
      const matches = all.filter((x) => {
        const words = norm(x.Title).split(" ");
        const compactT = words.join("");
        return compactT.startsWith(compactQ) || qt.every((w) => words.some((tw) => tw.startsWith(w)));
      });
      const rank = (x) => { const c = norm(x.Title).replace(/ /g, ""); return c === compactQ ? 0 : c.startsWith(compactQ) ? 1 : 2; };
      return matches
        .map((x, i) => [x, i])
        .sort((a, b) => rank(a[0]) - rank(b[0]) || (a[0].Poster === "N/A") - (b[0].Poster === "N/A") || a[1] - b[1])
        .slice(0, 6)
        .map(([x]) => ({
          type: x.Type === "series" ? "show" : "movie",
          title: x.Title,
          year: (x.Year || "").slice(0, 4),
          poster: x.Poster && x.Poster !== "N/A" ? x.Poster : "",
          overview: "",
          imdb: x.imdbID,
        }));
    }
    const d = await (await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${window.TMDB_KEY}&query=${encodeURIComponent(q)}`)).json();
    return (d.results || [])
      .filter((x) => x.media_type === "movie" || x.media_type === "tv")
      .slice(0, 6)
      .map((x) => ({
        type: x.media_type === "tv" ? "show" : "movie",
        title: x.title || x.name,
        year: (x.release_date || x.first_air_date || "").slice(0, 4),
        poster: x.poster_path ? "https://image.tmdb.org/t/p/w342" + x.poster_path : "",
        overview: x.overview || "",
      }));
  }

  // Short plot + genre from OMDb (looked up by IMDb id, or by title/year when we don't have one)
  async function loadPlot(it) {
    if (!window.OMDB_KEY) return false;
    const q = it.imdb
      ? `i=${it.imdb}`
      : `t=${encodeURIComponent(it.title)}${it.year ? "&y=" + it.year : ""}&type=${it.type === "show" ? "series" : "movie"}`;
    const d = await (await fetch(`https://www.omdbapi.com/?apikey=${window.OMDB_KEY}&${q}&plot=short`)).json();
    if (d.Response === "False") return false;
    if (d.Plot && d.Plot !== "N/A") it.overview = d.Plot;
    if (d.Genre && d.Genre !== "N/A") it.genre = d.Genre.split(", ").slice(0, 3).join(", ");
    it.imdb = it.imdb || d.imdbID;
    if (!it.poster && d.Poster && d.Poster !== "N/A") it.poster = d.Poster;
    return !!it.overview;
  }

  window.renderWatch = function (root) {
    if (root._ac) root._ac.abort(); // drop listeners from earlier visits
    root._ac = new AbortController();
    const signal = root._ac.signal;
    root._storeKey = KEY;
    const ui = { view: "list", tab: "want", type: "all", sort: "added", id: null, addType: "movie", results: [], sure: false };
    const hasTmdb = hasKey;

    // ---------- list ----------
    function list() {
      const count = (s) => state.items.filter((i) => i.status === s).length;
      let shown = state.items.filter((i) => i.status === ui.tab && (ui.type === "all" || i.type === ui.type));
      if (ui.tab === "watched") {
        shown.sort(ui.sort === "rating" ? (a, b) => avg(b) - avg(a) : (a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
      } else shown.sort((a, b) => b.added - a.added);

      root.innerHTML = `
        <div class="w-tabs">
          ${Object.entries(STATUS)
            .map(([k, n]) => `<button data-tab="${k}" class="${ui.tab === k ? "on" : ""}">${n} <span>${count(k)}</span></button>`)
            .join("")}
        </div>

        <form class="w-add">
          <input name="title" placeholder="${hasTmdb() ? "Search a movie or show…" : "Add a movie or show…"}" autocomplete="off" required />
          ${hasTmdb() ? "" : `<button type="button" class="w-type" data-act="addtype" title="Movie or show">${TYPE[ui.addType]}</button>`}
          <button class="w-addbtn">Add</button>
          <div class="s-suggest w-suggest" hidden></div>
        </form>
        ${hasTmdb() ? "" : `<p class="w-hint">Tip: add a free OMDb key (IMDb posters) in <code>config.js</code> to search titles and get posters automatically. Until then, tap the icon to switch movie/show and add a poster yourself on the title page.</p>`}

        <div class="w-filters">
          ${[["all", "All"], ["movie", "🎬 Movies"], ["show", "📺 Shows"]]
            .map(([k, n]) => `<button data-type="${k}" class="${ui.type === k ? "on" : ""}">${n}</button>`)
            .join("")}
          ${ui.tab === "watched" ? `<button class="sort" data-act="sort">Sort: ${ui.sort === "rating" ? "rating" : "date"}</button>` : ""}
          ${ui.tab === "want" && shown.length > 1 ? `<button class="sort" data-act="random">🎲 Surprise us</button>` : ""}
        </div>

        ${
          shown.length
            ? `<div class="w-grid">${shown
                .map(
                  (it) => `<article class="w-card" data-open="${it.id}">
                    <div class="w-poster">${poster(it)}<i class="w-type-badge">${TYPE[it.type]}</i>
                      ${it.status === "watched" && avg(it) ? `<i class="w-score">★ ${fmt(avg(it))}</i>` : ""}
                      ${it.status === "watching" && it.type === "show" && it.season ? `<i class="w-score">S${it.season} E${it.episode || 1}</i>` : ""}
                    </div>
                    <h3>${esc(it.title)}</h3>
                    <p>${it.status === "watched" && it.watchedAt ? "Watched " + shortDate(it.watchedAt) : esc([it.year, it.platform].filter(Boolean).join(" · "))}</p>
                  </article>`
                )
                .join("")}</div>`
            : `<p class="s-empty">${
                { want: "Nothing on the list yet. Add something you both want to see.", watching: "Nothing in progress.", watched: "Nothing watched yet." }[ui.tab]
              }</p>`
        }`;
    }

    // ---------- detail ----------
    function detail() {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) { ui.view = "list"; return render(); }
      const rated = it.status !== "want";
      root.innerHTML = `
        <button class="r-back" data-act="back">← Watch list</button>
        <div class="w-top">
          <div class="w-bigwrap"><label class="w-big" title="Change poster">${poster(it)}<input type="file" accept="image/*" hidden /></label>
            ${hasKey() ? `<button class="w-find" data-act="find">${ui.finding ? "Searching…" : ui.notFound ? "No poster found" : "🔍 Find poster"}</button>` : ""}</div>
          <div class="w-info">
            <h2 class="w-title" title="Double-click to edit">${esc(it.title)}</h2>
            <div class="w-typesw">
              <button data-settype="movie" class="${it.type === "movie" ? "on" : ""}">🎬 Movie</button>
              <button data-settype="show" class="${it.type === "show" ? "on" : ""}">📺 Show</button>
            </div>
            ${it.year || it.genre ? `<p class="w-meta">${esc([it.year, it.genre].filter(Boolean).join(" · "))}</p>` : ""}
            ${avg(it) ? `<p class="w-avg">★ ${fmt(avg(it))} <small>together</small></p>` : ""}
            <div class="w-status">
              ${Object.entries(STATUS).map(([k, n]) => `<button data-status="${k}" class="${it.status === k ? "on" : ""}">${n}</button>`).join("")}
            </div>
          </div>
        </div>

        ${it.overview ? `<p class="w-desc">${esc(it.overview)}</p>` : ""}

        ${
          it.type === "show" && it.status === "watching"
            ? `<div class="w-progress">Season <button data-act="s-">−</button><b>${it.season || 1}</b><button data-act="s+">+</button>
               Episode <button data-act="e-">−</button><b>${it.episode || 1}</b><button data-act="e+">+</button></div>`
            : ""
        }

        ${
          rated
            ? `<h4 class="r-h">Ratings</h4>
          ${["me", "partner"]
            .map(
              (w) => `<div class="w-rate">
              <div class="w-who"><b>${PEOPLE[w]}</b>${stars(it.rating?.[w] || 0, w)}<em>${it.rating?.[w] ? fmt(it.rating[w]) : ""}</em></div>
              <input class="w-note" data-note="${w}" placeholder="${PEOPLE[w]}'s thoughts…" value="${esc(it.note?.[w] || "")}" />
            </div>`
            )
            .join("")}
`
            : ""
        }

        ${
          it.status === "watched"
            ? `<h4 class="r-h">Date watched</h4>
               <input class="w-date" type="date" value="${ymd(it.watchedAt || Date.now())}" max="${ymd(Date.now())}" />`
            : ""
        }

        <h4 class="r-h">Where to watch</h4>
        <input class="w-plat" placeholder="Netflix, HBO, cinema…" value="${esc(it.platform || "")}" />
        <button class="w-del" data-act="del">${ui.sure ? "Tap again to remove" : "🗑 Remove from list"}</button>`;
      // Older titles: fetch the description the first time they are opened
      if (!it.overview && !it.descTried && window.OMDB_KEY) {
        it.descTried = true;
        loadPlot(it).then((ok) => { save(); if (ok && ui.view === "detail" && ui.id === it.id) render(); }).catch(() => save());
      }
    }

    function render() { (ui.view === "detail" ? detail : list)(); }

    // ---------- adding ----------
    function add(partial) {
      const it = {
        id: uid(), type: partial.type || ui.addType, title: partial.title.trim(), year: partial.year || "",
        poster: partial.poster || "", overview: partial.overview || "", imdb: partial.imdb || "", platform: "",
        status: ui.tab, added: Date.now(), rating: {}, note: {},
      };
      if (it.status === "watched") it.watchedAt = Date.now();
      state.items.unshift(it);
      save();
      if (!it.overview) { it.descTried = true; loadPlot(it).then(save).catch(() => {}); }
    }

    let timer;
    const box = () => root.querySelector(".w-suggest");
    const hide = () => { const b = box(); if (b) { b.hidden = true; b.innerHTML = ""; } };

    root.oninput = (e) => {
      if (e.target.name !== "title" || !hasTmdb()) return;
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
            .map((x, i) => `<button type="button" data-pick="${i}">${x.poster ? `<img src="${esc(x.poster)}" alt="" onerror="this.style.visibility='hidden'" />` : `<i>${TYPE[x.type]}</i>`}<span><b>${esc(x.title)}</b><small>${TYPE[x.type]} ${esc(x.year)}</small></span></button>`)
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
      add({ title, type: ui.addType });
      render();
      root.querySelector("input[name=title]").focus();
    };

    // ---------- edits ----------
    root.onchange = async (e) => {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) return;
      if (e.target.type === "file" && e.target.files[0]) {
        try { it.poster = await resizeImage(e.target.files[0]); save(); render(); } catch (_) { alert("Couldn't read that image."); }
      } else if (e.target.dataset.note) {
        it.note = it.note || {};
        it.note[e.target.dataset.note] = e.target.value.trim();
        save();
      } else if (e.target.classList.contains("w-date")) {
        if (e.target.value) { it.watchedAt = new Date(e.target.value + "T12:00").getTime(); save(); }
      } else if (e.target.classList.contains("w-plat")) {
        it.platform = e.target.value.trim();
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

      const tab = e.target.closest("[data-tab]");
      if (tab) { ui.tab = tab.dataset.tab; return render(); }
      const type = e.target.closest("[data-type]");
      if (type) { ui.type = type.dataset.type; return render(); }
      const ty = e.target.closest("[data-settype]");
      if (ty) {
        const it = state.items.find((x) => x.id === ui.id);
        it.type = ty.dataset.settype;
        if (it.type === "movie") { it.season = it.episode = null; }
        save();
        return render();
      }
      const st = e.target.closest("[data-status]");
      if (st) {
        const it = state.items.find((x) => x.id === ui.id);
        it.status = st.dataset.status;
        if (it.status === "watched" && !it.watchedAt) it.watchedAt = Date.now();
        if (it.status !== "watched") it.watchedAt = null;
        if (it.status === "watching" && it.type === "show") { it.season = it.season || 1; it.episode = it.episode || 1; }
        ui.tab = it.status;
        save();
        return render();
      }

      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      const it = state.items.find((x) => x.id === ui.id);
      if (act === "back") ui.view = "list";
      else if (act === "addtype") ui.addType = ui.addType === "movie" ? "show" : "movie";
      else if (act === "sort") ui.sort = ui.sort === "rating" ? "date" : "rating";
      else if (act === "random") {
        const pool = state.items.filter((i) => i.status === "want" && (ui.type === "all" || i.type === ui.type));
        ui.id = pool[Math.floor(Math.random() * pool.length)].id;
        ui.view = "detail";
        window.scrollTo(0, 0);
      }
      else if (act === "find") {
        ui.finding = true; ui.notFound = false;
        render();
        search(it.title).then((res) => {
          const m = res.find((x) => x.poster && x.type === it.type) || res.find((x) => x.poster);
          if (m) { it.poster = m.poster; it.year = it.year || m.year; it.overview = it.overview || m.overview; it.imdb = it.imdb || m.imdb; save(); } else ui.notFound = true;
          return it.overview ? null : loadPlot(it).then(save);
        }).catch(() => (ui.notFound = true)).finally(() => { ui.finding = false; if (ui.view === "detail") render(); });
        return;
      }
      else if (act === "s+") { it.season = (it.season || 1) + 1; it.episode = 1; save(); }
      else if (act === "s-") { it.season = Math.max(1, (it.season || 1) - 1); save(); }
      else if (act === "e+") { it.episode = (it.episode || 1) + 1; save(); }
      else if (act === "e-") { it.episode = Math.max(1, (it.episode || 1) - 1); save(); }
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
