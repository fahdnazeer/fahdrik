// Norskkurs: shared word list plus flashcard practice (kan / nesten / nei).
(function () {
  const KEY = "fahdrik.norsk";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => Date.now() + Math.floor(Math.random() * 1000);
  const DAY = 864e5;
  const CATS = [
    ["verb", "Verb"],
    ["noun", "Noun"],
    ["adj", "Adjective"],
    ["adv", "Adverb"],
    ["pron", "Pronoun"],
    ["prep", "Preposition"],
    ["phrase", "Phrase"],
    ["other", "Other"],
  ];
  const catName = (id) => (CATS.find(([k]) => k === id) || [])[1] || "";
  const catOpts = (sel) =>
    `<option value="">Category</option>` +
    CATS.map(([k, n]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${n}</option>`).join("");

  const mapPos = (s) => {
    const t = String(s || "").toLowerCase();
    if (/verb/.test(t)) return "verb";
    if (/noun|substantiv/.test(t)) return "noun";
    if (/adverb/.test(t)) return "adv";
    if (/adj/.test(t)) return "adj";
    if (/pron/.test(t)) return "pron";
    if (/prep/.test(t)) return "prep";
    if (/phrase|uttrykk|locution/.test(t)) return "phrase";
    return "";
  };

  const headword = (w) => String(w || "").trim().toLowerCase().replace(/^å\s+/, "").replace(/[.!?]+$/, "");

  const GENDER = {
    m: { art: "en", name: "hankjønn" },
    f: { art: "ei", name: "hunkjønn" },
    n: { art: "et", name: "intetkjønn" },
    c: { art: "en/ei", name: "hankjønn eller hunkjønn" },
  };
  const nounArt = (it) => (GENDER[it && it.gender] || {}).art || "";
  const nounName = (it) => (GENDER[it && it.gender] || {}).name || "";
  const nounSg = (it) => [nounArt(it), it && it.no].filter(Boolean).join(" ");
  const nounMeta = (it) => {
    if (!it || it.cat !== "noun") return "";
    return [nounArt(it), it.def, it.pl ? "flertall " + it.pl : ""].filter(Boolean).join(" · ");
  };
  const needsNoun = (it) => it && it.cat === "noun" && it.nounVer !== 3;

  const wikiJson = (params) =>
    fetch("https://en.wiktionary.org/w/api.php?" + new URLSearchParams({ format: "json", origin: "*", ...params })).then((r) => (r.ok ? r.json() : null));

  const bokmal = (t) => {
    const m = String(t || "").match(/==Norwegian Bokmål==([\s\S]+?)(?:\n==[^=]|\s*$)/);
    return m ? m[1] : "";
  };

  const stripWiki = (s) =>
    String(s || "")
      .replace(/\{\{g\|([^}]+)\}\}/g, " $1 ")
      .replace(/\{\{[^}]+\}\}/g, "")
      .replace(/'{2,}/g, "")
      .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const wikiForm = (t, label) => {
    const m = String(t || "").match(new RegExp("(?:^|[^a-z])" + label + "\\s+([^,)]+)", "i"));
    if (!m) return "";
    return m[1]
      .split(/\s+or\s+/)
      .map((s) => s.replace(/['\[\]]/g, "").trim())
      .filter(Boolean)
      .join("/");
  };

  const parseNounHead = (expanded) => {
    const t = stripWiki(expanded);
    if (!t) return null;
    let g = "";
    if (/\bf or m\b/i.test(t) || /\bm or f\b/i.test(t)) g = "c";
    else {
      const gm = t.match(/(?:^|[^\w])([mfn])(?:[^\w]|$)/i);
      if (gm) g = gm[1].toLowerCase();
    }
    const pl = wikiForm(t, "indefinite plural");
    const def = wikiForm(t, "definite singular");
    const defPl = wikiForm(t, "definite plural");
    if (!g && !pl && !def) return null;
    return { gender: g, pl, def, defPl };
  };

  const localNoun = (word, inner) => {
    const parts = String(inner || "").split("|").map((s) => s.trim());
    const kind = (parts[0] || "").replace(/^nb-noun-?/i, "").toLowerCase();
    const p1 = parts[1] || "";
    const p2 = parts[2] || "";
    const defStem = p1 || word;
    const plStem = p2 || p1 || word;
    let gender = "m";
    let pl = plStem + "er";
    let def = defStem + "en";
    let defPl = plStem + "ene";
    if (kind.startsWith("n1") || kind === "n") {
      gender = "n";
      pl = word;
      def = word + "et";
      defPl = word + "ene";
    } else if (kind.startsWith("n")) {
      gender = "n";
      def = defStem + "et";
    } else if (kind.startsWith("f")) {
      gender = "f";
      def = defStem + "a";
    } else if (kind.startsWith("c") || kind.startsWith("mf") || kind === "m-f") {
      gender = "c";
      def = defStem + "a/" + defStem + "en";
    } else if (kind.startsWith("m")) gender = "m";
    return { gender, pl, def, defPl };
  };

  async function guessNoun(word) {
    const q = headword(word);
    if (!q || /\s/.test(q)) return null;
    try {
      const d = await wikiJson({ action: "parse", page: q, prop: "wikitext" });
      const sec = bokmal(d && d.parse && d.parse.wikitext && d.parse.wikitext["*"]);
      if (!sec) return null;
      const tmpl = (sec.match(/\{\{nb-noun[^}]*\}\}/) || [])[0] || "";
      const head = (sec.match(/\{\{head\|nb\|noun[^}]*\}\}/) || [])[0] || "";
      let expanded = "";
      const src = tmpl || head;
      if (src) {
        const ex = await wikiJson({ action: "expandtemplates", title: q, text: src, prop: "wikitext" });
        expanded = (ex && ex.expandtemplates && ex.expandtemplates.wikitext) || "";
      }
      const parsed = parseNounHead(expanded);
      if (parsed) return parsed;
      if (tmpl) return localNoun(q, tmpl.slice(2, -2));
    } catch (_) {}
    return null;
  }

  const skipGloss = /^(inflection of|alternative (form|spelling) of|plural of|present tense|past tense|simple past|past participle|imperative of|definite (singular|plural) of|indefinite (singular|plural) of)/i;

  const collectGlosses = (blocks) => {
    const seen = new Set();
    const all = [];
    for (const b of blocks || []) {
      const pos = mapPos(b.partOfSpeech);
      for (const def of b.definitions || []) {
        let s = stripWiki(def.definition || "").replace(/^[\d.)\s]+/, "").trim();
        if (!s || skipGloss.test(s)) continue;
        if (s.length > 110) s = s.slice(0, 107).replace(/\s+\S*$/, "") + "…";
        const key = s.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        all.push({ s, pos });
        if (all.length >= 5) return all;
      }
    }
    return all;
  };

  const senseLine = (item, mainPos) => {
    const posName = catName(item.pos);
    if (item.pos && mainPos && item.pos !== mainPos && posName) return posName + ": " + item.s;
    return item.s;
  };

  async function guessCatAndEn(word) {
    const bits = headword(word).split(/\s+/).filter(Boolean);
    if (!bits.length) return { cat: "", en: "", also: [] };
    const phrase = bits.length > 1;
    const q = bits.join(" ");
    let cat = phrase ? "phrase" : "";
    let en = "";
    let also = [];
    try {
      const d = await fetch("https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(q), { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null));
      const blocks = Object.values(d || {}).flat().filter((b) => b && b.partOfSpeech);
      const nb = blocks.filter((b) => /norwegian/i.test(b.language || ""));
      const use = nb.length ? nb : blocks;
      const found = collectGlosses(use);
      if (!cat) cat = mapPos((nb[0] || blocks[0] || {}).partOfSpeech) || (found[0] && found[0].pos) || "";
      if (found.length) {
        en = found[0].s;
        also = found.slice(1).map((x) => senseLine(x, found[0].pos));
      }
    } catch (_) {}
    if (!cat && !phrase) {
      try {
        const d = await fetch("https://no.wiktionary.org/w/api.php?action=parse&page=" + encodeURIComponent(bits[0]) + "&prop=categories&format=json&origin=*").then((r) => (r.ok ? r.json() : null));
        const cats = ((d && d.parse && d.parse.categories) || []).map((c) => c["*"] || "").join(" ");
        cat = mapPos(cats);
      } catch (_) {}
    }
    return { cat, en, also };
  }

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const state = window.store.get(KEY, { items: [] });
  if (!Array.isArray(state.items)) state.items = [];
  state.items.forEach((i) => {
    if (!i.enManual && i.enTried && i.en && i.en.includes("; ")) {
      i.en = "";
      i.enTried = false;
    }
  });
  const save = () => window.store.save(KEY, state);
  window.store.watchState(KEY, state);

  const withEn = () => state.items.filter((i) => i.en);
  const dueNow = () => {
    const now = Date.now();
    return withEn().filter((i) => !i.due || i.due <= now);
  };

  window.renderNorsk = function (root) {
    if (root._ac) root._ac.abort();
    root._ac = new AbortController();
    const signal = root._ac.signal;
    root._storeKey = KEY;
    const ui = { tab: "learn", id: null, practice: false, queue: [], i: 0, flipped: false };

    const endPractice = () => {
      ui.practice = false;
      ui.queue = [];
      ui.i = 0;
      ui.flipped = false;
      render();
    };

    const startPractice = () => {
      const pool = dueNow();
      const cards = shuffle(pool.length ? pool : withEn().filter((i) => !i.known)).slice(0, 20);
      if (!cards.length) return;
      ui.practice = true;
      ui.id = null;
      ui.queue = cards.map((i) => i.id);
      ui.i = 0;
      ui.flipped = false;
      if (window.goInner) window.goInner(endPractice);
      render();
    };

    const grade = (it, kind) => {
      const now = Date.now();
      if (kind === "nei") {
        it.box = 0;
        it.due = now + 15 * 60 * 1000;
        ui.queue.push(it.id);
      } else if (kind === "nesten") {
        it.box = Math.max(1, it.box || 0);
        it.due = now + 12 * 3600 * 1000;
      } else {
        it.box = Math.min(5, (it.box || 0) + 1);
        const days = [1, 3, 7, 14, 30][it.box - 1] || 30;
        it.due = now + days * DAY;
      }
      it.last = now;
      save();
      ui.i += 1;
      ui.flipped = false;
      render();
    };

    function render() {
      const keepName = window.stashFocus ? window.stashFocus(root) : "";
      if (ui.practice) {
        while (ui.i < ui.queue.length && !state.items.some((x) => x.id === ui.queue[ui.i])) ui.i += 1;
        const it = state.items.find((x) => x.id === ui.queue[ui.i]);
        const total = ui.queue.length;
        const n = Math.min(ui.i + (it ? 1 : 0), total);
        if (!it) {
          root.innerHTML = `
            <div class="nk-drill">
              <button type="button" class="r-back" data-act="end">← Word list</button>
              <h3>Ferdig</h3>
              <p class="s-empty">That’s this round. Missed words will come back sooner.</p>
              <button type="button" class="nk-know" data-act="end">Back to the list</button>
            </div>`;
          return;
        }
        root.innerHTML = `
          <div class="nk-drill">
            <div class="nk-drill-bar">
              <button type="button" class="r-back" data-act="end">← Word list</button>
              <span>${n} / ${total}</span>
            </div>
            <button type="button" class="nk-card${ui.flipped ? " on" : ""}" data-act="flip">
              <small>${ui.flipped ? "English" : "Norsk"}${catName(it.cat) ? " · " + catName(it.cat) : ""}${!ui.flipped && nounName(it) ? " · " + nounName(it) : ""}</small>
              <b>${esc(ui.flipped ? it.en : nounSg(it) || it.no)}</b>
              ${!ui.flipped && (it.pl || it.def) ? `<span>${[it.def ? "bestemt " + it.def : "", it.pl ? "flertall " + it.pl : "", it.defPl ? "bestemt flertall " + it.defPl : ""].filter(Boolean).join(" · ")}</span>` : ""}
              ${ui.flipped && it.also && it.also.length ? `<span>Also ${esc(it.also.join(" · "))}</span>` : ""}
              ${ui.flipped && it.note ? `<span>${esc(it.note)}</span>` : `<em>${ui.flipped ? "Tap for Norwegian" : "Tap to flip"}</em>`}
            </button>
            ${
              ui.flipped
                ? `<div class="nk-grades">
                    <button type="button" data-grade="nei">Nei</button>
                    <button type="button" data-grade="nesten">Nesten</button>
                    <button type="button" data-grade="kan">Kan</button>
                  </div>`
                : `<p class="nk-grade-hint">Flip the card, then say how well you knew it.</p>`
            }
          </div>`;
        return;
      }

      const learn = state.items.filter((i) => !i.known);
      const known = state.items.filter((i) => i.known);
      const shown = ui.tab === "known" ? known : learn;
      shown.sort((a, b) => b.added - a.added);
      const n = state.items.length;
      const pct = n ? Math.round((known.length / n) * 100) : 0;
      const editing = state.items.find((i) => i.id === ui.id) || null;
      if (ui.id && !editing) ui.id = null;
      const due = dueNow().length;
      const canPractice = withEn().length > 0;

      root.innerHTML = `
        ${
          n
            ? `<div class="nk-stats">
                <div class="nk-ring" style="--p:${pct}"><b>${pct}%</b></div>
                <div class="nk-statt">
                  <b>${known.length} of ${n} known</b>
                  <span>${learn.length ? "Eirik teaches, Fahd practices." : "Alt kan du! Add more words."}</span>
                </div>
                ${canPractice ? `<button type="button" class="nk-go" data-act="practice">${due ? `Practice · ${due}` : "Practice"}</button>` : ""}
              </div>`
            : `<p class="s-empty">Add a Norwegian word and what it means. Eirik can teach, Fahd can tick them off.</p>`
        }
        <form class="nk-add">
          <input name="no" placeholder="På norsk…" autocomplete="off" required />
          <input name="en" placeholder="In English…" autocomplete="off" />
          <button>Add</button>
        </form>
        <div class="wi-seg nk-tabs">
          <button type="button" data-tab="learn" class="${ui.tab === "learn" ? "on" : ""}">Learning <span>${learn.length}</span></button>
          <button type="button" data-tab="known" class="${ui.tab === "known" ? "on" : ""}">Kan det <span>${known.length}</span></button>
        </div>
        ${
          shown.length
            ? `<ul class="nk-list">${shown
                .map(
                  (it) => `<li class="${it.known ? "done" : ""}" data-id="${it.id}">
                    <button type="button" class="check" data-act="toggle" aria-label="${it.known ? "Still learning" : "I know this"}">${it.known ? "✓" : ""}</button>
                    <button type="button" class="nk-txt" data-act="open">
                      <b>${esc(it.no)}</b>
                      ${it.en ? `<span>${esc(it.en)}</span>` : ""}
                      ${it.cat || it.note || it.pl || it.gender || (it.also && it.also.length) ? `<small>${[catName(it.cat), nounMeta(it), it.also && it.also.length ? it.also.length + " more meaning" + (it.also.length > 1 ? "s" : "") : "", it.note ? "Has a note" : ""].filter(Boolean).join(" · ")}</small>` : ""}
                    </button>
                    <button type="button" class="del" data-act="del" aria-label="Delete">✕</button>
                  </li>`
                )
                .join("")}</ul>`
            : n
              ? `<p class="s-empty">${ui.tab === "known" ? "None marked yet. Tick a word when Fahd knows it." : "Nothing left to learn — nice."}</p>`
              : ""
        }
        ${
          editing
            ? `<div class="cal-overlay">
                <div class="cal-sheet nk-sheet" role="dialog" aria-labelledby="nk-word">
                  <button type="button" class="cal-sheet-x" data-act="close" aria-label="Close">✕</button>
                  <h3 id="nk-word">${esc(nounSg(editing) || editing.no)}</h3>
                  ${editing.en ? `<p>${esc(editing.en)}</p>` : `<p>No translation yet</p>`}
                  ${
                    editing.also && editing.also.length
                      ? `<div class="nk-also">
                          <p class="set-label">Also means</p>
                          <ul>${editing.also.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
                        </div>`
                      : ""
                  }
                  ${
                    editing.cat === "noun" && (editing.gender || editing.pl || editing.def)
                      ? `<div class="nk-forms">
                          ${nounName(editing) ? `<p class="nk-forms-g">${esc(nounName(editing))}</p>` : ""}
                          <div class="nk-decl">
                            <span></span><span>Ubestemt</span><span>Bestemt</span>
                            <span>Entall</span><b>${esc(nounSg(editing))}</b><b>${esc(editing.def || "—")}</b>
                            <span>Flertall</span><b>${esc(editing.pl || "—")}</b><b>${esc(editing.defPl || "—")}</b>
                          </div>
                        </div>`
                      : ""
                  }
                  <p class="set-label">Category</p>
                  <select name="cat">${catOpts(editing.cat || "")}</select>
                  <p class="nk-cat-hint">Filled in from the dictionary. Change it if it’s wrong.</p>
                  <p class="set-label">Notes</p>
                  <textarea name="note" rows="5" placeholder="A hint, an example, or how to use this word…">${esc(editing.note || "")}</textarea>
                  <button type="button" class="nk-know" data-act="close">Save</button>
                </div>
              </div>`
            : ""
        }`;
      if (window.unstashFocus) window.unstashFocus(root, keepName);
      state.items.filter((i) => (!i.cat && !i.catTried) || (!i.en && !i.enTried && !i.enManual) || i.senseVer !== 1 || needsNoun(i)).slice(0, 4).forEach((i) => classify(i));
    }

    const fillNoun = async (it) => {
      if (!needsNoun(it)) return;
      it.nounTried = true;
      it.nounVer = 3;
      const info = await guessNoun(it.no);
      const cur = state.items.find((x) => x.id === it.id);
      if (!cur) return;
      cur.nounVer = 3;
      if (info) {
        if (info.gender) cur.gender = info.gender;
        if (info.pl) cur.pl = info.pl;
        if (info.def) cur.def = info.def;
        if (info.defPl) cur.defPl = info.defPl;
      }
      save();
      if (!ui.practice && (!ui.id || ui.id === cur.id)) render();
    };

    const classify = async (it) => {
      if (!it) return;
      const needCat = !it.cat && !it.catTried && !it.catManual;
      const needEn = !it.en && !it.enTried && !it.enManual;
      const needSense = it.senseVer !== 1;
      if (needCat || needEn || needSense) {
        if (needCat) it.catTried = true;
        if (needEn) it.enTried = true;
        it.senseVer = 1;
        const info = await guessCatAndEn(it.no);
        const cur = state.items.find((x) => x.id === it.id);
        if (cur) {
          cur.senseVer = 1;
          if (needCat && !cur.catManual && info.cat) cur.cat = info.cat;
          if (needEn && !cur.en && !cur.enManual && info.en) cur.en = info.en;
          const extra = (info.also || []).filter((s) => s && s.toLowerCase() !== String(cur.en || "").toLowerCase());
          cur.also = extra;
          save();
        }
      }
      const cur = state.items.find((x) => x.id === it.id);
      if (needsNoun(cur)) return fillNoun(cur);
      if (!ui.practice && (!ui.id || ui.id === (cur && cur.id))) render();
    };

    root._rerender = render;
    render();

    root.onsubmit = (e) => {
      e.preventDefault();
      const no = e.target.no.value.trim();
      if (!no) return;
      const en = e.target.en.value.trim();
      const it = { id: uid(), no, en, enManual: !!en, cat: "", known: false, added: Date.now() };
      state.items.unshift(it);
      save();
      ui.tab = "learn";
      render();
      classify(it);
      const inp = root.querySelector("input[name=no]");
      if (inp) inp.focus();
    };

    root.oninput = (e) => {
      if (e.target.name !== "note") return;
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) return;
      it.note = e.target.value;
      save();
    };

    root.onchange = (e) => {
      if (e.target.name !== "cat" || !e.target.closest(".nk-sheet")) return;
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) return;
      it.cat = e.target.value;
      it.catManual = true;
      if (needsNoun(it)) fillNoun(it);
      save();
    };

    root.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      const gradeBtn = e.target.closest("[data-grade]");
      if (gradeBtn && ui.practice) {
        const it = state.items.find((x) => x.id === ui.queue[ui.i]);
        if (it) grade(it, gradeBtn.dataset.grade);
        return;
      }
      if (act === "practice") return startPractice();
      if (act === "flip") {
        ui.flipped = !ui.flipped;
        return render();
      }
      if (act === "end") {
        if (window.dropInner) window.dropInner();
        return endPractice();
      }
      if (e.target.classList && e.target.classList.contains("cal-overlay")) {
        ui.id = null;
        return render();
      }
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        ui.tab = tab.dataset.tab;
        return render();
      }
      if (act === "close") {
        ui.id = null;
        return render();
      }
      const row = e.target.closest("[data-id]");
      const it = row ? state.items.find((x) => x.id === +row.dataset.id) : state.items.find((x) => x.id === ui.id);
      if (!it) return;
      if (act === "open") {
        ui.id = it.id;
        render();
        if (needsNoun(it)) fillNoun(it);
        return;
      }
      if (act === "toggle") {
        it.known = !it.known;
        save();
        return render();
      }
      if (act === "del") {
        state.items = state.items.filter((x) => x.id !== it.id);
        if (ui.id === it.id) ui.id = null;
        save();
        return render();
      }
    }, { signal });
  };
})();
