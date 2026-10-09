// Recipes: photo cards, search, favorites, servings scaler, add ingredients to shopping list.
(function () {
  const KEY = "fahdrik.recipes";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);

  const state = window.store.get(KEY, { items: [] });
  const save = () => {
    try { window.store.save(KEY, state); }
    catch (e) { alert("Storage is full — try a smaller photo or delete some recipes."); }
  };
  window.store.watchState(KEY, state);

  // Sample recipes the first time, so the page isn't empty
  if (!state.items.length && !localStorage.getItem(KEY + ".seeded")) {
    state.items = [
      {
        id: uid(), title: "Creamy tomato pasta", img: "", time: 25, servings: 4, tags: ["Dinner", "Vegetarian"],
        ingredients: ["400 g pasta", "2 tbsp olive oil", "3 cloves garlic", "1 can chopped tomatoes", "2 dl cream", "1 onion", "Parmesan", "Salt"],
        steps: ["Boil the pasta in salted water.", "Fry the onion and garlic in olive oil until soft.", "Add the tomatoes and simmer for 10 minutes.", "Stir in the cream, season, and toss with the pasta.", "Serve with Parmesan."],
        notes: "", fav: true,
      },
      {
        id: uid(), title: "Fluffy pancakes", img: "", time: 20, servings: 4, tags: ["Breakfast"],
        ingredients: ["3 dl flour", "2 tbsp sugar", "2 tsp baking powder", "3 dl milk", "2 eggs", "50 g butter"],
        steps: ["Whisk the dry ingredients together.", "Add milk, eggs and melted butter and mix until smooth.", "Fry small pancakes in a buttered pan, about 2 minutes per side."],
        notes: "Great with berries and syrup.", fav: false,
      },
    ];
    localStorage.setItem(KEY + ".seeded", "1");
    save();
  }

  // ---------- ingredient parsing / scaling ----------
  const UNITS = "g kg mg ml cl dl l tsp tbsp cup cups oz lb lbs pinch clove cloves can cans pcs stk ss ts pk slice slices".split(" ");
  const FR = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

  function parseIng(line) {
    const m = line.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[¼½¾⅓⅔])\s*(.*)$/);
    if (!m) return { qty: null, unit: "", name: line.trim() };
    let qty;
    const q = m[1];
    if (FR[q]) qty = FR[q];
    else if (/^\d+\s+\d+\/\d+$/.test(q)) { const [w, f] = q.split(/\s+/); const [a, b] = f.split("/"); qty = +w + a / b; }
    else if (q.includes("/")) { const [a, b] = q.split("/"); qty = a / b; }
    else qty = parseFloat(q.replace(",", "."));
    let rest = m[2], unit = "";
    const w = rest.split(/\s+/)[0];
    if (UNITS.includes(w.toLowerCase())) { unit = w; rest = rest.slice(w.length).trim(); }
    return { qty, unit, name: rest || (unit ? "" : "") };
  }

  function fmtQty(n) {
    if (n == null) return "";
    const whole = Math.floor(n + 1e-9), frac = n - whole;
    const nice = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [1, "+1"]];
    for (const [v, ch] of nice) {
      if (Math.abs(frac - v) < 0.04) {
        if (ch === "+1") return String(whole + 1);
        return whole ? whole + ch : ch || "0";
      }
    }
    return String(Math.round(n * 10) / 10);
  }

  const scaled = (line, ratio) => {
    const p = parseIng(line);
    if (p.qty == null) return { ...p, qty: null, display: p.name };
    const q = p.qty * ratio;
    return { ...p, qty: q, display: `${fmtQty(q)}${p.unit ? " " + p.unit : ""} ${p.name}`.trim() };
  };

  // Pantry staples are unticked by default when adding to the shopping list
  const STAPLES = [
    "spices?", "salt", "sugar", "oil", "flour", "rice", "black pepper", "white pepper",
    "cinnamon", "card(?:a|e)mom", "baking powder", "baking soda", "cumin", "nutmeg", "curry",
    "chil+i flakes", "turmeric", "tumeric", "rosemary", "oregano", "garam masala", "msg", "old bay", "soy sauce",
    // Norwegian
    "krydder", "sukker", "olje", "mel", "ris", "kanel", "kardemomme", "spisskummen", "muskat", "gurkemeie",
    "rosmarin", "bakepulver", "natron", "soyasaus", "soyasaus",
  ];
  const STAPLE = new RegExp("\\b(" + STAPLES.join("|") + ")\\b|^pepper\\b", "i");
  const isStaple = (line) => {
    const p = parseIng(line);
    if (STAPLE.test(p.name)) return true;
    // Paprika is only a spice when measured by the spoon (otherwise it's a fresh bell pepper)
    return /\bpaprika\b/i.test(p.name) && ["tsp", "tbsp", "ts", "ss"].includes(p.unit.toLowerCase());
  };
  const defaultOff = (r) => new Set(r.ingredients.map((l, i) => (isStaple(l) ? i : -1)).filter((i) => i >= 0));

  // ---------- photo helpers ----------
  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const cover = (r) =>
    r.img
      ? `<img src="${esc(r.img)}" alt="" loading="lazy" />`
      : `<div class="r-ph" style="--h:${hue(r.title)}"><span>🍽️</span></div>`;

  function resizeImage(file, max = 900) {
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
        resolve(c.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ---------- UI ----------
  window.renderRecipes = function (root) {
    root._storeKey = KEY;
    const ui = { view: "list", id: null, q: "", tag: "all", servings: null, off: new Set(), done: new Set(), draft: null, added: false, sure: false };

    const allTags = () => [...new Set(state.items.flatMap((r) => r.tags))].sort();

    function list() {
      const q = ui.q.trim().toLowerCase();
      const shown = state.items.filter((r) => {
        if (ui.tag === "fav" && !r.fav) return false;
        if (ui.tag !== "all" && ui.tag !== "fav" && !r.tags.includes(ui.tag)) return false;
        if (!q) return true;
        return (r.title + " " + r.tags.join(" ") + " " + r.ingredients.join(" ")).toLowerCase().includes(q);
      });
      root.innerHTML = `
        <div class="r-top">
          <input class="r-search" type="search" placeholder="Search recipes or ingredients…" value="${esc(ui.q)}" />
          <button class="r-new" data-act="new">+ New</button>
        </div>
        <div class="r-chips">
          ${[["all", "All"], ["fav", "♥ Favorites"], ...allTags().map((t) => [t, t])]
            .map(([k, n]) => `<button data-tag="${esc(k)}" class="${ui.tag === k ? "on" : ""}">${esc(n)}</button>`)
            .join("")}
        </div>
        ${
          shown.length
            ? `<div class="r-grid">${shown
                .map(
                  (r) => `<article class="r-card" data-open="${r.id}">
                    <div class="r-img">${cover(r)}${r.fav ? `<i class="r-heart">♥</i>` : ""}</div>
                    <h3>${esc(r.title)}</h3>
                    <p>${r.time ? `⏱ ${r.time} min` : ""}${r.time && r.servings ? " · " : ""}${r.servings ? `👥 ${r.servings}` : ""}</p>
                  </article>`
                )
                .join("")}</div>`
            : `<p class="s-empty">${state.items.length ? "No recipes match." : "No recipes yet. Add your first one!"}</p>`
        }`;
    }

    function detail() {
      const r = state.items.find((x) => x.id === ui.id);
      if (!r) { ui.view = "list"; return render(); }
      const base = r.servings || 1;
      const sv = ui.servings || base;
      const ratio = sv / base;
      const ings = r.ingredients.map((l) => scaled(l, ratio));
      const picked = ings.filter((_, i) => !ui.off.has(i)).length;
      root.innerHTML = `
        <button class="r-back" data-act="back">← Recipes</button>
        <div class="r-hero">${cover(r)}</div>
        <div class="r-head">
          <h2 class="r-title">${esc(r.title)}</h2>
          <div class="r-actions">
            <button data-act="fav" class="${r.fav ? "fav" : ""}" title="Favorite">♥</button>
            <button data-act="edit" title="Edit">✎</button>
            <button data-act="del" title="Delete">${ui.sure ? "Tap again" : "🗑"}</button>
          </div>
        </div>
        <div class="r-meta">
          ${r.time ? `<span>⏱ ${r.time} min</span>` : ""}
          ${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </div>

        <h4 class="r-h">Ingredients
          <span class="r-serv"><button data-act="sv-" aria-label="Fewer">−</button>👥 <b>${sv}</b><button data-act="sv+" aria-label="More">+</button></span>
        </h4>
        <ul class="r-ings">
          ${ings
            .map(
              (g, i) => `<li data-ing="${i}" class="${ui.off.has(i) ? "off" : ""}">
                <span class="box">${ui.off.has(i) ? "" : "✓"}</span>
                <span>${esc(g.display)}</span></li>`
            )
            .join("")}
        </ul>
        <button class="r-shop" data-act="shop" ${picked ? "" : "disabled"}>${ui.added ? "✓ Added to your grocery list" : `🛒 Add ${picked} to shopping list`}</button>
        <p class="r-hint">Staples like salt, sugar, oil, flour, rice and spices are left unticked. Tap any ingredient to include or leave it out.</p>

        <h4 class="r-h">Steps</h4>
        <ol class="r-steps">
          ${r.steps.map((st, i) => `<li data-step="${i}" class="${ui.done.has(i) ? "done" : ""}"><span class="n">${i + 1}</span><span>${esc(st)}</span></li>`).join("")}
        </ol>
        ${r.notes ? `<h4 class="r-h">Notes</h4><p class="r-notes">${esc(r.notes)}</p>` : ""}`;
    }

    function form() {
      const d = ui.draft;
      root.innerHTML = `
        <button class="r-back" data-act="back">← ${ui.id ? "Cancel" : "Recipes"}</button>
        <form class="r-form">
          <label class="r-photo">
            <div class="r-hero">${d.img ? `<img src="${esc(d.img)}" alt="" />` : `<div class="r-ph" style="--h:${hue(d.title || "x")}"><span>📷</span><small>Add a photo</small></div>`}</div>
            <input type="file" accept="image/*" hidden />
          </label>
          ${d.img ? `<button type="button" class="r-link" data-act="rmphoto">Remove photo</button>` : ""}
          <input name="title" placeholder="Recipe name" value="${esc(d.title)}" required />
          <div class="r-row">
            <input name="time" type="number" min="0" placeholder="Minutes" value="${d.time || ""}" />
            <input name="servings" type="number" min="1" placeholder="Servings" value="${d.servings || ""}" />
          </div>
          <input name="tags" placeholder="Tags, comma separated (Dinner, Quick)" value="${esc(d.tags.join(", "))}" />
          <label>Ingredients <small>one per line, e.g. “200 g flour”</small></label>
          <textarea name="ingredients" rows="6">${esc(d.ingredients.join("\n"))}</textarea>
          <label>Steps <small>one per line</small></label>
          <textarea name="steps" rows="6">${esc(d.steps.join("\n"))}</textarea>
          <label>Notes</label>
          <textarea name="notes" rows="2">${esc(d.notes)}</textarea>
          <button class="r-save">Save recipe</button>
        </form>`;
    }

    function render() {
      ({ list, detail, form })[ui.view]();
    }

    const blank = () => ({ title: "", img: "", time: "", servings: 4, tags: [], ingredients: [], steps: [], notes: "" });
    const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

    // ---- events ----
    root.oninput = (e) => {
      if (e.target.classList.contains("r-search")) {
        ui.q = e.target.value;
        const pos = e.target.selectionStart;
        list();
        const inp = root.querySelector(".r-search");
        inp.focus();
        inp.setSelectionRange(pos, pos);
      }
    };

    root.onchange = async (e) => {
      if (e.target.type === "file" && e.target.files[0]) {
        try {
          captureDraft();
          ui.draft.img = await resizeImage(e.target.files[0]);
          form();
        } catch (_) { alert("Couldn't read that image."); }
      }
    };

    function captureDraft() {
      const f = root.querySelector(".r-form");
      if (!f) return;
      Object.assign(ui.draft, {
        title: f.title.value, time: f.time.value, servings: f.servings.value,
        tags: f.tags.value.split(",").map((t) => t.trim()).filter(Boolean),
        ingredients: lines(f.ingredients.value), steps: lines(f.steps.value), notes: f.notes.value,
      });
    }

    root.onsubmit = (e) => {
      e.preventDefault();
      captureDraft();
      const d = ui.draft;
      const rec = { ...d, title: d.title.trim(), time: +d.time || 0, servings: +d.servings || 0 };
      if (ui.id) Object.assign(state.items.find((x) => x.id === ui.id), rec);
      else { rec.id = uid(); rec.fav = false; state.items.unshift(rec); ui.id = rec.id; }
      save();
      ui.view = "detail"; ui.servings = null; ui.off = defaultOff(rec.id ? state.items.find((x) => x.id === ui.id) : rec); ui.done.clear(); ui.added = false;
      render();
    };

    root.onclick = (e) => {
      const card = e.target.closest("[data-open]");
      if (card) {
        ui.id = +card.dataset.open; ui.view = "detail";
        ui.servings = null; ui.off = defaultOff(state.items.find((x) => x.id === ui.id)); ui.done.clear(); ui.added = false; ui.sure = false;
        window.scrollTo(0, 0);
        return render();
      }
      const tag = e.target.closest("[data-tag]");
      if (tag) { ui.tag = tag.dataset.tag; return render(); }
      const ing = e.target.closest("[data-ing]");
      if (ing) { const i = +ing.dataset.ing; ui.off.has(i) ? ui.off.delete(i) : ui.off.add(i); ui.added = false; return render(); }
      const step = e.target.closest("[data-step]");
      if (step) { const i = +step.dataset.step; ui.done.has(i) ? ui.done.delete(i) : ui.done.add(i); return render(); }
      if (e.target.closest(".r-photo")) return; // opens file picker

      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      const r = state.items.find((x) => x.id === ui.id);
      if (act === "new") { ui.id = null; ui.draft = blank(); ui.view = "form"; }
      else if (act === "back") { ui.view = ui.id && ui.view === "form" && r ? "detail" : "list"; ui.sure = false; }
      else if (act === "edit") { ui.draft = JSON.parse(JSON.stringify(r)); ui.view = "form"; }
      else if (act === "fav") { r.fav = !r.fav; save(); }
      else if (act === "del") {
        if (!ui.sure) { ui.sure = true; setTimeout(() => { ui.sure = false; if (ui.view === "detail") render(); }, 3000); }
        else { state.items = state.items.filter((x) => x !== r); save(); ui.view = "list"; ui.sure = false; }
      }
      else if (act === "sv+") ui.servings = (ui.servings || r.servings || 1) + 1;
      else if (act === "sv-") ui.servings = Math.max(1, (ui.servings || r.servings || 1) - 1);
      else if (act === "rmphoto") { captureDraft(); ui.draft.img = ""; }
      else if (act === "shop") {
        const ratio = (ui.servings || r.servings || 1) / (r.servings || 1);
        const items = r.ingredients
          .map((l) => scaled(l, ratio))
          .filter((_, i) => !ui.off.has(i))
          .map((g) =>
            g.unit || (g.qty != null && !Number.isInteger(Math.round(g.qty * 100) / 100))
              ? { text: g.qty != null ? `${g.name} (${fmtQty(g.qty)}${g.unit ? " " + g.unit : ""})` : g.name, qty: 1 }
              : { text: g.name, qty: g.qty ? Math.round(g.qty) : 1 }
          );
        window.addToGroceries(items);
        ui.added = true;
      }
      else return;
      render();
    };

    root._rerender = () => render();
    render();
  };
})();
