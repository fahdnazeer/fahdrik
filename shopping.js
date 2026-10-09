// Shopping section: multiple lists, aisle categories, quantities, quick-add, share.
(function () {
  const KEY = "fahdrik.shopping";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const CATS = {
    produce: { name: "Fruit & veg", emoji: "🥦" },
    dairy: { name: "Dairy & eggs", emoji: "🧀" },
    meat: { name: "Meat & fish", emoji: "🥩" },
    bakery: { name: "Bakery", emoji: "🍞" },
    pantry: { name: "Pantry", emoji: "🥫" },
    frozen: { name: "Frozen", emoji: "🧊" },
    drinks: { name: "Drinks", emoji: "🥤" },
    snacks: { name: "Snacks & sweets", emoji: "🍫" },
    household: { name: "Household", emoji: "🧴" },
    other: { name: "Other", emoji: "🛍️" },
  };
  const CAT_KEYS = Object.keys(CATS);

  // Keywords (English + Norwegian) used to guess the aisle
  const WORDS = {
    produce: "apple banana orange lemon lime tomato potato onion garlic carrot cucumber lettuce salad spinach pepper broccoli avocado berry strawberr blueberr grape mushroom fruit veg herb basil epl banan appelsin sitron tomat potet løk hvitløk gulrot agurk salat spinat paprika brokkoli avokado bær jordbær blåbær drue sopp frukt grønn",
    dairy: "milk cheese butter yogurt yoghurt cream egg melk ost smør yoghurt fløte egg rømme kefir skyr",
    meat: "chicken beef pork fish salmon tuna shrimp sausage bacon ham mince steak kylling biff svin fisk laks tunfisk reke pølse bacon skinke kjøtt karbonade",
    bakery: "bread bun roll bagel croissant cake tortilla brød rundstykke bolle kake lefse",
    pantry: "rice pasta flour sugar salt oil sauce beans soup cereal oats spice coffee tea honey jam ris mel sukker olje saus bønner suppe müsli havre krydder kaffe te honning syltetøy hermetikk",
    frozen: "frozen ice pizza fries frossen is pommes",
    drinks: "water juice soda cola beer wine drink vann juice brus øl vin drikke",
    snacks: "chips chocolate candy cookie biscuit snack nuts sjokolade godteri kjeks snacks nøtter",
    household: "soap shampoo toothpaste paper towel tissue detergent trash bag sponge cleaner battery bulb såpe tannkrem papir vaskemiddel søppelpose svamp batteri pære toalett",
  };
  const guess = (text) => {
    const t = text.toLowerCase();
    for (const [cat, list] of Object.entries(WORDS)) {
      if (list.split(" ").some((w) => w && t.includes(w))) return cat;
    }
    return "other";
  };

  const parse = (raw) => {
    raw = raw.trim();
    let m = raw.match(/^(\d+)\s*(?:x|stk)?\s+(.+)$/i);
    if (m) return { qty: +m[1], text: m[2].trim() };
    m = raw.match(/^(.+?)\s*x\s*(\d+)$/i);
    if (m) return { qty: +m[2], text: m[1].trim() };
    return { qty: 1, text: raw };
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const uid = () => Date.now() + Math.floor(Math.random() * 1000);

  const state = window.store.get(KEY, {
    lists: [{ id: 1, name: "Groceries", items: [], groceries: true, history: {} }], // history: name -> {cat,count}
    current: 1,
  });
  // Migration: only the first list is the "groceries" list (aisles + suggestions). History is per list.
  state.lists.forEach((l, i) => {
    if (l.groceries === undefined) l.groceries = i === 0;
    if (!l.history) l.history = l.groceries && state.history ? state.history : {};
  });
  delete state.history;
  const save = () => window.store.save(KEY, state);
  window.store.watchState(KEY, state);
  const cur = () => state.lists.find((l) => l.id === state.current) || state.lists[0];

  // Used by other sections (e.g. Recipes) to put items on the grocery list
  window.addToGroceries = function (items) {
    const list = state.lists.find((l) => l.groceries) || state.lists[0];
    items.forEach(({ text, qty }) => {
      const name = cap(String(text).trim());
      if (!name) return;
      const existing = list.items.find((i) => !i.done && i.text.toLowerCase() === name.toLowerCase());
      if (existing) existing.qty += qty || 1;
      else {
        const known = list.history[name];
        list.items.push({ id: uid(), text: name, qty: qty || 1, cat: list.groceries ? (known ? known.cat : guess(name)) : "other", done: false });
      }
    });
    save();
    return list.name;
  };

  window.renderShopping = function (root) {
    if (root._ac) root._ac.abort(); // drop listeners from earlier visits
    root._ac = new AbortController();
    const signal = root._ac.signal;
    root._storeKey = KEY;
    function render(focusInput) {
      const list = cur();
      const open = list.items.filter((i) => !i.done);
      const done = list.items.filter((i) => i.done);
      const total = list.items.length;

      const g = list.groceries;
      const groups = g
        ? CAT_KEYS.map((k) => [k, open.filter((i) => i.cat === k)]).filter(([, a]) => a.length)
        : open.length ? [[null, open]] : [];

      const row = (i) => `
        <li class="s-item ${i.done ? "done" : ""}" data-id="${i.id}">
          <button class="check" data-act="toggle" aria-label="Toggle">${i.done ? "✓" : ""}</button>
          <span class="txt">${esc(i.text)}</span>
          <span class="qty">
            <button data-act="dec" aria-label="Less">−</button><b>${i.qty}</b><button data-act="inc" aria-label="More">+</button>
          </span>
          ${g ? `<button class="cat-btn" data-act="cat" title="Change category: ${CATS[i.cat].name}">${CATS[i.cat].emoji}</button>` : ""}
          <button class="del" data-act="del" aria-label="Delete">✕</button>
        </li>`;

      // Quick-add suggestions: most used past items not currently on the list
      const onList = new Set(open.map((i) => i.text.toLowerCase()));
      const suggestions = !g ? [] : Object.entries(list.history)
        .filter(([n]) => !onList.has(n.toLowerCase()))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      root.innerHTML = `
        <div class="s-tabs">
          ${state.lists
            .map((l) => `<button class="s-tab ${l.id === list.id ? "on" : ""}" data-list="${l.id}">${esc(l.name)}</button>`)
            .join("")}
          <button class="s-tab new" data-act="newlist" title="New list">+</button>
        </div>

        <form class="s-add">
          <input name="text" placeholder="Add item… (try “2 milk”)" autocomplete="off" required />
          <button>Add</button>
          <div class="s-suggest" hidden></div>
        </form>

        ${
          suggestions.length
            ? `<div class="s-quick">${suggestions
                .map(([n, h]) => `<button data-quick="${esc(n)}">${CATS[h.cat].emoji} ${esc(n)}</button>`)
                .join("")}</div>`
            : ""
        }

        ${total ? `<div class="s-progress"><div style="width:${(done.length / total) * 100}%"></div></div><p class="s-count">${done.length} of ${total} in the cart</p>` : ""}

        ${
          groups.length
            ? groups
                .map(
                  ([k, items]) => `
            ${k ? `<h4 class="s-cat">${CATS[k].emoji} ${CATS[k].name} <span>${items.length}</span></h4>` : ""}
            <ul class="s-list">${items.map(row).join("")}</ul>`
                )
                .join("")
            : `<p class="s-empty">${total ? "Everything is in the cart 🎉" : "Your list is empty. Add your first item above."}</p>`
        }

        ${
          done.length
            ? `<h4 class="s-cat dim">🧺 In the cart <span>${done.length}</span> <button class="clear" data-act="clear">Remove</button></h4>
               <ul class="s-list">${done.map(row).join("")}</ul>`
            : ""
        }

        <div class="s-footer">
          ${open.length ? `<button data-act="uncheck-all" ${done.length ? "" : "hidden"}>↺ Uncheck all</button>` : ""}
          ${state.lists.length > 1 ? `<button data-act="deletelist">🗑 Delete list</button>` : ""}
        </div>`;
      if (focusInput) root.querySelector("input[name=text]").focus();
    }

    function addItem(raw) {
      const { qty, text } = parse(raw);
      if (!text) return;
      const list = cur();
      const name = cap(text);
      const existing = list.items.find((i) => !i.done && i.text.toLowerCase() === name.toLowerCase());
      if (existing) existing.qty += qty; // merge duplicates
      else {
        const known = list.history[name];
        list.items.push({ id: uid(), text: name, qty, cat: list.groceries ? (known ? known.cat : guess(text)) : "other", done: false });
      }
      const it = list.items.find((i) => i.text.toLowerCase() === name.toLowerCase());
      if (list.groceries) {
        const h = list.history[name] || { cat: it.cat, count: 0 };
        h.count++;
        h.cat = it.cat;
        list.history[name] = h;
      }
      save();
    }

    // Custom suggestion dropdown (sits right under the input)
    const box = () => root.querySelector(".s-suggest");
    const hideSuggest = () => { const b = box(); if (b) { b.hidden = true; b.innerHTML = ""; } };
    root.oninput = (e) => {
      if (e.target.name !== "text") return;
      const q = parse(e.target.value).text.toLowerCase();
      const b = box();
      if (!q || !cur().groceries) return hideSuggest();
      const matches = Object.entries(cur().history)
        .filter(([n]) => n.toLowerCase().includes(q) && n.toLowerCase() !== q)
        .sort((a, c) => (c[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q)) || c[1].count - a[1].count)
        .slice(0, 5);
      if (!matches.length) return hideSuggest();
      b.innerHTML = matches.map(([n, h]) => `<button type="button" data-pick="${esc(n)}">${CATS[h.cat].emoji} ${esc(n)}</button>`).join("");
      b.hidden = false;
    };
    root.addEventListener("focusout", (e) => { if (e.target.name === "text") hideSuggest(); }, { signal });
    root.addEventListener("pointerdown", (e) => {
      const pick = e.target.closest("[data-pick]");
      if (!pick) return;
      e.preventDefault(); // keep input focus
      const qtyPart = parse(root.querySelector("input[name=text]").value);
      addItem((qtyPart.qty > 1 ? qtyPart.qty + " " : "") + pick.dataset.pick);
      render(true);
    }, { signal });

    root.onsubmit = (e) => {
      e.preventDefault();
      addItem(e.target.text.value);
      render(true);
    };

    root.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const list = cur();
      if (b.dataset.list) { if (+b.dataset.list === state.current) return; state.current = +b.dataset.list; save(); return render(); }
      if (b.dataset.quick) { addItem(b.dataset.quick); return render(); }
      const li = b.closest("li.s-item");
      const item = li && list.items.find((i) => i.id === +li.dataset.id);
      const act = b.dataset.act;

      if (act === "toggle") item.done = !item.done;
      else if (act === "inc") item.qty++;
      else if (act === "dec") item.qty = Math.max(1, item.qty - 1);
      else if (act === "del") list.items = list.items.filter((i) => i !== item);
      else if (act === "cat") {
        item.cat = CAT_KEYS[(CAT_KEYS.indexOf(item.cat) + 1) % CAT_KEYS.length];
        if (list.history[item.text]) list.history[item.text].cat = item.cat; // remember the choice
      } else if (act === "clear") list.items = list.items.filter((i) => !i.done);
      else if (act === "uncheck-all") list.items.forEach((i) => (i.done = false));
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
            const l = { id: uid(), name: v, items: [], groceries: false, history: {} };
            state.lists.push(l);
            state.current = l.id;
            save();
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
        if (!b.dataset.sure) {
          b.dataset.sure = "1";
          b.textContent = `⚠️ Tap again to delete “${list.name}”`;
          setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "🗑 Delete list"; } }, 3000);
          return;
        }
        state.lists = state.lists.filter((l) => l !== list);
        state.current = state.lists[0].id;
      } else if (act === "share") {
        const plain = list.items.filter((i) => !i.done).map((i) => `• ${i.qty > 1 ? i.qty + "× " : ""}${i.text}`).join("\n");
        const text = !list.groceries ? `${list.name}\n\n${plain}` :
          `${list.name}\n` +
          CAT_KEYS.flatMap((k) => {
            const items = list.items.filter((i) => !i.done && i.cat === k);
            return items.length ? [`\n${CATS[k].emoji} ${CATS[k].name}`, ...items.map((i) => `• ${i.qty > 1 ? i.qty + "× " : ""}${i.text}`)] : [];
          }).join("\n");
        if (navigator.share) { try { await navigator.share({ title: list.name, text }); } catch (_) {} }
        else { await navigator.clipboard.writeText(text); b.textContent = "✓ Copied"; setTimeout(render, 1200); }
        return;
      } else return;
      save();
      render();
    };

    // Double-click an item to edit it
    root.ondblclick = (e) => {
      const tab = e.target.closest(".s-tab[data-list]");
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
          const v = input.value.trim();
          if (ok && v) { l.name = v; save(); }
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
      const li = span.closest("li.s-item");
      const item = cur().items.find((i) => i.id === +li.dataset.id);
      const input = document.createElement("input");
      input.className = "edit";
      input.value = item.text;
      span.replaceWith(input);
      input.focus();
      input.select();
      let finished = false;
      const finish = (ok) => {
        if (finished) return;
        finished = true;
        const v = input.value.trim();
        if (ok && v) { item.text = cap(v); save(); }
        render();
      };
      input.onblur = () => finish(true);
      input.onkeydown = (ev) => {
        if (ev.key === "Enter") finish(true);
        if (ev.key === "Escape") finish(false);
      };
    };

    root._rerender = () => render();
    render();
  };
})();
