// Wish list: things we'd like to buy. Multiple lists, priorities, prices & totals,
// store links, photos, who it's for, who's buying it, and a "bought" archive.
(function () {
  const KEY = "fahdrik.wishes";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const PEOPLE = { me: "Fahd", partner: "Eirik", both: "Both" };
  const PRI = { must: { icon: "🔥", name: "Must have", n: 0 }, want: { icon: "⭐", name: "Want", n: 1 }, someday: { icon: "💭", name: "Someday", n: 2 } };
  const SORTS = { priority: "Priority", new: "Newest", low: "Price ↑", high: "Price ↓" };

  const state = window.store.get(KEY, {
    lists: [{ id: 1, name: "Wishes" }],
    current: 1,
    items: [],
  });
  const save = () => {
    try { window.store.save(KEY, state); }
    catch (e) { alert("Storage is full — try smaller photos or remove some wishes."); }
  };
  window.store.watchState(KEY, state);
  const curList = () => state.lists.find((l) => l.id === state.current) || state.lists[0];

  const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const domain = (url) => {
    try { return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
  };
  const fullUrl = (url) => (/^https?:\/\//i.test(url) ? url : "https://" + url);
  const money = (n) => {
    const v = Math.round(n * 100) / 100;
    const s = new Intl.NumberFormat([], { maximumFractionDigits: 2 }).format(v);
    return `${s} NOK`;
  };
  const total = (it) => (+it.price || 0) * (+it.qty || 1);
  const shortDate = (ms) => new Date(ms).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const ymd = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  const picture = (it) =>
    it.img
      ? `<img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
      : `<div class="wi-ph" style="--h:${hue(it.title)}"><span>🎁</span>${it.link ? `<small>${esc(domain(it.link))}</small>` : ""}</div>`;

  function resizeImage(file, max = 700) {
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

  // "Headphones 1500 NOK" -> { title: "Headphones", price: 1500 }. Only reads a price when it has a currency marker.
  function parseAdd(raw) {
    const m = raw.trim().match(/^(.+?)\s*(?:@|for)?\s*(\d[\d\s.,]*)\s*(kr|nok|,-|\$|€|£)\s*$/i) || raw.trim().match(/^(.+?)\s+(?:@|for)\s*(\d[\d\s.,]*)\s*$/i);
    if (!m) return { title: raw.trim(), price: "" };
    const price = parseFloat(m[2].replace(/\s/g, "").replace(",", "."));
    return price > 0 ? { title: m[1].trim(), price } : { title: raw.trim(), price: "" };
  }

  window.renderWish = function (root) {
    root._storeKey = KEY;
    const ui = { view: "list", id: null, who: "all", sort: "priority", status: "wish", sure: false, sureList: false };

    // ---------- list ----------
    function list() {
      const l = curList();
      const mine = state.items.filter((i) => i.list === l.id);
      const inScope = (i) => ui.who === "all" || i.who === ui.who;
      const wishes = mine.filter((i) => i.status !== "bought" && inScope(i));
      const bought = mine.filter((i) => i.status === "bought" && inScope(i));
      const shown = ui.status === "bought" ? bought : wishes;

      const sorters = {
        priority: (a, b) => PRI[a.priority].n - PRI[b.priority].n || b.added - a.added,
        new: (a, b) => b.added - a.added,
        low: (a, b) => (total(a) || 1e12) - (total(b) || 1e12),
        high: (a, b) => total(b) - total(a),
      };
      if (ui.status === "bought") shown.sort((a, b) => (b.boughtAt || 0) - (a.boughtAt || 0));
      else shown.sort(sorters[ui.sort]);

      const sum = shown.reduce((a, i) => a + total(i), 0);

      root.innerHTML = `
        <div class="s-tabs">
          ${state.lists.map((x) => `<button class="s-tab wi-tab ${x.id === l.id ? "on" : ""}" data-list="${x.id}">${esc(x.name)}</button>`).join("")}
          <button class="s-tab new" data-act="newlist" title="New list">+</button>
        </div>

        <form class="wi-add">
          <input name="title" placeholder="Add a wish… (e.g. “Headphones 1500 NOK”)" autocomplete="off" required />
          <button>Add</button>
        </form>

        <div class="wi-who">
          ${[["all", "All"], ["me", PEOPLE.me], ["partner", PEOPLE.partner], ["both", "Both"]]
            .map(([k, n]) => `<button data-who="${k}" class="${ui.who === k ? "on" : ""}">${n}</button>`)
            .join("")}
        </div>

        <div class="wi-bar">
          <div class="wi-seg">
            <button data-status="wish" class="${ui.status === "wish" ? "on" : ""}">Wishes <span>${wishes.length}</span></button>
            <button data-status="bought" class="${ui.status === "bought" ? "on" : ""}">Bought 🎁 <span>${bought.length}</span></button>
          </div>
          ${ui.status === "wish" ? `<button class="wi-sort" data-act="sort">Sort: ${SORTS[ui.sort]}</button>` : ""}
        </div>

        <p class="wi-sum">${shown.length} ${ui.status === "bought" ? "bought" : "wishes"}${sum ? ` · <b>${money(sum)}</b>` : ""}</p>

        ${
          shown.length
            ? `<div class="wi-grid">${shown
                .map(
                  (it) => `<article class="wi-card ${it.status === "bought" ? "bought" : ""}" data-open="${it.id}">
                    <div class="wi-img">${picture(it)}
                      <i class="wi-pri" title="${PRI[it.priority].name}">${PRI[it.priority].icon}</i>
                      ${it.buyer ? `<i class="wi-buyer">🎁 ${PEOPLE[it.buyer]}</i>` : ""}
                      ${it.status === "bought" ? `<i class="wi-done">✓</i>` : ""}
                    </div>
                    <h3>${esc(it.title)}${it.qty > 1 ? ` <small>×${it.qty}</small>` : ""}</h3>
                    <p>${total(it) ? `<b>${money(total(it))}</b>` : `<span class="dim">No price</span>`}${it.link ? ` · ${esc(domain(it.link))}` : ""}</p>
                    <span class="wi-for ${it.who}">${PEOPLE[it.who]}</span>
                  </article>`
                )
                .join("")}</div>`
            : `<p class="s-empty">${ui.status === "bought" ? "Nothing bought yet." : "No wishes yet. Add something you'd love to get."}</p>`
        }

        ${state.lists.length > 1 ? `<div class="s-footer"><button data-act="deletelist">${ui.sureList ? `⚠️ Tap again to delete “${esc(l.name)}”` : "🗑 Delete list"}</button></div>` : ""}`;
    }

    // ---------- detail ----------
    function seg(field, current, options) {
      return `<div class="wi-segs">${options
        .map(([k, n]) => `<button data-set="${field}:${k}" class="${current === k ? "on" : ""}">${n}</button>`)
        .join("")}</div>`;
    }

    function detail() {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) { ui.view = "list"; return render(); }
      const bought = it.status === "bought";
      root.innerHTML = `
        <button class="r-back" data-act="back">← Wish list</button>
        <label class="wi-hero" title="Change photo">${picture(it)}<input type="file" accept="image/*" hidden /></label>
        <h2 class="w-title" title="Double-click to edit">${esc(it.title)}</h2>

        <div class="wi-row">
          <label>Price<input data-f="price" type="number" min="0" step="any" inputmode="decimal" placeholder="0" value="${it.price || ""}" /></label>
          <label>Quantity<input data-f="qty" type="number" min="1" step="1" value="${it.qty || 1}" /></label>
        </div>
        ${total(it) && it.qty > 1 ? `<p class="w-hint">Total ${money(total(it))}</p>` : ""}

        <h4 class="r-h">Link</h4>
        <div class="wi-link">
          <input data-f="link" placeholder="Paste the store link…" value="${esc(it.link || "")}" />
          ${it.link ? `<a href="${esc(fullUrl(it.link))}" target="_blank" rel="noopener" class="wi-open">Open ↗</a>` : ""}
        </div>
        ${it.link ? `<p class="w-hint"><img class="wi-fav" src="https://www.google.com/s2/favicons?domain=${esc(domain(it.link))}&sz=32" alt="" /> ${esc(domain(it.link))}</p>` : ""}
        <input data-f="img" placeholder="Image URL (or tap the photo above to upload)" value="${esc(it.img && !it.img.startsWith("data:") ? it.img : "")}" style="margin-top:8px" />

        <h4 class="r-h">Priority</h4>
        ${seg("priority", it.priority, Object.entries(PRI).map(([k, p]) => [k, `${p.icon} ${p.name}`]))}
        <h4 class="r-h">Who is it for?</h4>
        ${seg("who", it.who, Object.entries(PEOPLE))}
        <h4 class="r-h">Who's buying it?</h4>
        ${seg("buyer", it.buyer || "", Object.entries(PEOPLE))}

        <h4 class="r-h">Notes</h4>
        <textarea data-f="note" rows="3" placeholder="Size, colour, model, where it's cheapest…">${esc(it.note || "")}</textarea>

        <h4 class="r-h">Bought?</h4>
        ${
          bought
            ? `<div class="wi-row">
                 <label>Date<input data-f="boughtAt" type="date" value="${ymd(it.boughtAt || Date.now())}" max="${ymd(Date.now())}" /></label>
                 <label>Paid<input data-f="paid" type="number" min="0" step="any" inputmode="decimal" placeholder="${it.price || 0}" value="${it.paid ?? ""}" /></label>
               </div>
               <button class="wi-btn ghost" data-act="unbuy">↩ Move back to wishes</button>`
            : `<button class="wi-btn" data-act="buy">🎁 Mark as bought</button>`
        }

        ${state.lists.length > 1 ? `<h4 class="r-h">List</h4><select data-f="list">${state.lists.map((l) => `<option value="${l.id}" ${l.id === it.list ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>` : ""}
        <button class="w-del" data-act="del">${ui.sure ? "Tap again to remove" : "🗑 Remove wish"}</button>`;
    }

    function render() { (ui.view === "detail" ? detail : list)(); }

    // ---------- events ----------
    root.onsubmit = (e) => {
      e.preventDefault();
      const { title, price } = parseAdd(e.target.title.value);
      if (!title) return;
      state.items.unshift({
        id: uid(), list: curList().id, title, price, qty: 1, link: "", img: "", note: "",
        priority: "want", who: ui.who === "all" ? "both" : ui.who, buyer: "", status: "wish", added: Date.now(),
      });
      save();
      render();
      root.querySelector("input[name=title]").focus();
    };

    root.onchange = async (e) => {
      const it = state.items.find((x) => x.id === ui.id);
      const t = e.target;
      if (!it) return;
      if (t.type === "file" && t.files[0]) {
        try { it.img = await resizeImage(t.files[0]); save(); render(); } catch (_) { alert("Couldn't read that image."); }
        return;
      }
      const f = t.dataset.f;
      if (!f) return;
      if (f === "price" || f === "qty" || f === "paid") {
        const v = parseFloat(t.value);
        it[f] = f === "qty" ? Math.max(1, Math.round(v) || 1) : v >= 0 ? v : "";
        if (f === "paid" && t.value === "") delete it.paid;
        save(); render();
      } else if (f === "boughtAt") {
        if (t.value) { it.boughtAt = new Date(t.value + "T12:00").getTime(); save(); }
      } else if (f === "list") {
        it.list = +t.value; save();
      } else {
        it[f] = t.value.trim();
        save();
        if (f === "link" || f === "img") render();
      }
    };

    root.ondblclick = (e) => {
      const tab = e.target.closest(".wi-tab");
      if (tab) {
        const l = state.lists.find((x) => x.id === +tab.dataset.list);
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
          if (ok && input.value.trim()) { l.name = input.value.trim(); save(); }
          render();
        };
        input.onblur = () => finish(true);
        input.onkeydown = (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); };
        return;
      }
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
      if (card) { ui.id = +card.dataset.open; ui.view = "detail"; ui.sure = false; window.scrollTo(0, 0); return render(); }

      const lst = e.target.closest("[data-list]");
      if (lst) { if (+lst.dataset.list !== state.current) { state.current = +lst.dataset.list; ui.sureList = false; save(); render(); } return; }
      const who = e.target.closest("[data-who]");
      if (who) { ui.who = who.dataset.who; return render(); }
      const st = e.target.closest("[data-status]");
      if (st) { ui.status = st.dataset.status; return render(); }

      const set = e.target.closest("[data-set]");
      if (set) {
        const it = state.items.find((x) => x.id === ui.id);
        const [field, val] = set.dataset.set.split(":");
        it[field] = field === "buyer" && it.buyer === val ? "" : val; // tap the selected buyer again to clear it
        save();
        return render();
      }

      const act = e.target.closest("[data-act]")?.dataset.act;
      if (!act) return;
      const it = state.items.find((x) => x.id === ui.id);
      if (act === "back") ui.view = "list";
      else if (act === "sort") { const k = Object.keys(SORTS); ui.sort = k[(k.indexOf(ui.sort) + 1) % k.length]; }
      else if (act === "buy") { it.status = "bought"; it.boughtAt = Date.now(); save(); }
      else if (act === "unbuy") { it.status = "wish"; it.boughtAt = null; save(); }
      else if (act === "del") {
        if (!ui.sure) { ui.sure = true; setTimeout(() => { ui.sure = false; if (ui.view === "detail") render(); }, 3000); }
        else { state.items = state.items.filter((x) => x !== it); save(); ui.view = "list"; ui.sure = false; }
      }
      else if (act === "newlist") {
        const input = document.createElement("input");
        input.className = "edit tab-edit";
        input.placeholder = "List name…";
        input.size = 12;
        e.target.closest("button").replaceWith(input);
        input.focus();
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          const v = input.value.trim();
          if (ok && v) { const nl = { id: uid(), name: v }; state.lists.push(nl); state.current = nl.id; save(); }
          render();
        };
        input.onblur = () => finish(true);
        input.onkeydown = (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); };
        return;
      }
      else if (act === "deletelist") {
        if (!ui.sureList) { ui.sureList = true; setTimeout(() => { ui.sureList = false; if (ui.view === "list") render(); }, 3000); }
        else {
          const l = curList();
          state.items = state.items.filter((i) => i.list !== l.id);
          state.lists = state.lists.filter((x) => x !== l);
          state.current = state.lists[0].id;
          ui.sureList = false;
          save();
        }
      }
      else return;
      render();
    };

    root._rerender = () => render();
    render();
  };
})();
