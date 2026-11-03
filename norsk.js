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
    if (/adverb/.test(t)) return "adv";
    if (/verb/.test(t)) return "verb";
    if (/noun|substantiv/.test(t)) return "noun";
    if (/adj/.test(t)) return "adj";
    if (/pron/.test(t)) return "pron";
    if (/prep/.test(t)) return "prep";
    if (/phrase|uttrykk|locution/.test(t)) return "phrase";
    return "";
  };

  const noWord = (w) => String(w || "").trim().toLocaleLowerCase("nb");
  const headword = (w) => noWord(w).replace(/^å\s+/, "").replace(/[.!?]+$/, "");
  const lemma = (it) => noWord(it && it.no);

  const GENDER = {
    m: { art: "en", name: "hankjønn" },
    f: { art: "ei", name: "hunkjønn" },
    n: { art: "et", name: "intetkjønn" },
    c: { art: "en/ei", name: "hankjønn eller hunkjønn" },
  };
  const nounArt = (it) => (GENDER[it && it.gender] || {}).art || "";
  const nounName = (it) => (GENDER[it && it.gender] || {}).name || "";
  const splitForms = (s) => String(s || "").split("/").map((x) => x.trim()).filter(Boolean);
  const artForDef = (def, gender) => {
    if (/a$/i.test(def) && !/ene$/i.test(def)) return "ei";
    if (/et$/i.test(def)) return "et";
    if (/en$/i.test(def)) return "en";
    if (gender === "f") return "ei";
    if (gender === "n") return "et";
    return "en";
  };
  const rankArt = (s) => (String(s).startsWith("en ") ? 0 : String(s).startsWith("ei ") ? 1 : 2);
  const nounSgPairs = (it) => {
    const word = lemma(it);
    if (!word) return [];
    const defs = splitForms(it.def);
    if (!defs.length) {
      if (it.gender === "c") return [["en " + word, ""], ["ei " + word, ""]];
      const art = nounArt(it);
      if (art.includes("/")) return [["en " + word, ""], ["ei " + word, ""]];
      return [[[art, word].filter(Boolean).join(" "), ""]];
    }
    return defs.map((d) => [artForDef(d, it.gender) + " " + word, d]).sort((a, b) => rankArt(a[0]) - rankArt(b[0]));
  };
  const nounPlPairs = (it) => {
    const pls = splitForms(it.pl);
    const defs = splitForms(it.defPl);
    const pl = pls[0] || lemma(it) || "";
    if (!pl && !defs.length) return [];
    if (!defs.length) return [[pl, ""]];
    return defs.map((d) => [pl, d]);
  };
  const declRows = (pairs, label) =>
    pairs.map((p, i) => `<span>${i ? "" : label}</span><b>${esc(p[0])}</b><b>${esc(p[1] || "—")}</b>`).join("");
  const nounSg = (it) => (nounSgPairs(it)[0] || [])[0] || lemma(it) || "";
  const nounMeta = (it) => {
    if (!it || it.cat !== "noun") return "";
    const sg = nounSgPairs(it)[0];
    const pl = nounPlPairs(it)[0];
    return [sg && sg.filter(Boolean).join(" · "), pl && pl[0] ? "flertall " + pl.filter(Boolean).join(" · ") : ""].filter(Boolean).join(" · ");
  };
  const adjMeta = (it) => {
    if (!it || (it.cat && it.cat !== "adj" && it.cat !== "adv") || (!it.comp && !it.sup)) return "";
    return [it.comp, it.sup].filter(Boolean).join(" · ");
  };
  const verbInf = (it) => {
    const h = headword(it && it.no);
    return h ? "å " + h : "";
  };
  const verbMeta = (it) => {
    if (!it || it.cat !== "verb" || (!it.pres && !it.pret && !it.perf)) return "";
    return [it.pres, it.pret, it.perf].filter(Boolean).join(" · ");
  };
  const adjFormsHtml = (it) =>
    `<div class="nk-deg">
      <span>Positiv</span><span>Komparativ</span><span>Superlativ</span>
      <b>${esc(lemma(it).replace(/^å\s+/, "") || headword(it.no))}</b><b>${esc(it.comp || "—")}</b><b>${esc(it.sup || "—")}</b>
    </div>`;
  const verbFormsHtml = (it) =>
    `<div class="nk-conj">
      <span>Infinitiv</span><b>${esc(verbInf(it))}</b>
      <span>Presens</span><b>${esc(it.pres || "—")}</b>
      <span>Preteritum</span><b>${esc(it.pret || "—")}</b>
      <span>Perfektum</span><b>${esc(it.perf || "—")}</b>
    </div>`;
  const nounFormsHtml = (it) =>
    `${nounName(it) ? `<p class="nk-forms-g">${esc(nounName(it))}</p>` : ""}
      <div class="nk-decl">
        <span></span><span>Ubestemt</span><span>Bestemt</span>
        ${declRows(nounSgPairs(it), "Entall")}
        ${declRows(nounPlPairs(it), "Flertall")}
      </div>`;
  const formsInner = (it) => {
    if (!it) return "";
    if (it.cat === "verb" && (it.pres || it.pret || it.perf)) return verbFormsHtml(it);
    if ((it.cat === "adj" || it.cat === "adv") && (it.comp || it.sup)) return adjFormsHtml(it);
    if (it.cat === "noun" && (it.gender || it.pl || it.def)) return nounFormsHtml(it);
    if (it.pres || it.pret || it.perf) return verbFormsHtml(it);
    if (it.comp || it.sup) return adjFormsHtml(it);
    return "";
  };
  const sheetTitle = (it) => {
    if (!it) return "";
    if (it.cat === "verb" && (it.pres || it.pret || it.perf)) return verbInf(it);
    if (it.cat === "noun" && (it.gender || it.def)) return nounSg(it) || lemma(it);
    return lemma(it);
  };
  const oneWord = (it) => it && it.no && !/\s/.test(headword(it.no));
  const needsBm = (it) => it && it.bmVer !== 1 && oneWord(it);
  const needsNoun = (it) => it && it.nounVer !== 3 && it.cat === "noun" && oneWord(it);
  const needsAdj = (it) => it && it.adjVer !== 1 && it.cat === "adj" && oneWord(it);
  const needsVerb = (it) => it && it.verbVer !== 1 && it.cat === "verb" && oneWord(it);
  const needsAdv = (it) => it && it.advVer !== 1 && it.cat === "adv" && oneWord(it);
  const nbBlock = (it) => {
    if (!it || (!it.nb && !(it.nbMore && it.nbMore.length) && !it.bmId)) return "";
    return `<div class="nk-bm">
      ${it.nb ? `<p class="set-label">På norsk</p><p class="nk-nb">${esc(it.nb)}</p>` : ""}
      ${it.nbMore && it.nbMore.length ? `<ul class="nk-also">${it.nbMore.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      ${it.bmId ? `<a class="nk-src" href="https://ordbokene.no/bm/${it.bmId}" target="_blank" rel="noopener">Bokmålsordboka · ordbokene.no</a>` : ""}
    </div>`;
  };

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

  const parseAdjHead = (expanded) => {
    const t = stripWiki(expanded);
    if (!t) return null;
    const comp = wikiForm(t, "comparative");
    const sup = wikiForm(t, "indefinite superlative") || wikiForm(t, "superlative");
    if (!comp && !sup) return null;
    return { comp, sup };
  };

  const parseAdjTmpl = (inner) => {
    const parts = String(inner || "")
      .replace(/^\{\{|\}\}$/g, "")
      .split("|")
      .map((s) => s.trim());
    let comp = "";
    let sup = "";
    const take = (k, v) => {
      k = String(k || "").toLowerCase();
      v = String(v || "")
        .replace(/[\[\]']/g, "")
        .replace(/\s+or\s+/g, "/")
        .trim();
      if (!v) return;
      if (k === "comp" || k === "comparative") comp = v;
      else if (/indefinite superlative|^sup$|^superl$/.test(k)) sup = v;
      else if (k === "superlative" && !sup) sup = v;
    };
    if ((parts[0] || "").startsWith("head")) {
      for (let i = 3; i + 1 < parts.length; i += 2) take(parts[i], parts[i + 1]);
    } else {
      parts.slice(1).forEach((p) => {
        const m = p.match(/^(comp|sup|superl|comparative|superlative)=(.*)$/i);
        if (m) take(m[1], m[2]);
      });
    }
    if (!comp && !sup) return null;
    return { comp, sup };
  };

  async function wikiTmpl(word, re) {
    const q = headword(word);
    if (!q || /\s/.test(q)) return null;
    const d = await wikiJson({ action: "parse", page: q, prop: "wikitext" });
    const sec = bokmal(d && d.parse && d.parse.wikitext && d.parse.wikitext["*"]);
    if (!sec) return null;
    const tmpl = (sec.match(re) || [])[0] || "";
    if (!tmpl) return null;
    const ex = await wikiJson({ action: "expandtemplates", title: q, text: tmpl, prop: "wikitext" });
    const expanded = (ex && ex.expandtemplates && ex.expandtemplates.wikitext) || "";
    return { tmpl, expanded };
  }

  async function guessAdj(word) {
    try {
      const got = await wikiTmpl(word, /\{\{(?:head\|nb\|adjective|nb-adj)[^}]*\}\}/i);
      if (!got) return null;
      return parseAdjHead(got.expanded) || parseAdjTmpl(got.tmpl);
    } catch (_) {}
    return null;
  }

  const parseVerbHead = (expanded) => {
    const t = stripWiki(expanded);
    if (!t) return null;
    const pres = wikiForm(t, "present tense");
    const both = wikiForm(t, "simple past and past participle");
    const pret = both || wikiForm(t, "simple past") || wikiForm(t, "past tense");
    const perf = wikiForm(t, "past participle") || wikiForm(t, "supine") || both;
    if (!pres && !pret && !perf) return null;
    return { pres, pret, perf };
  };

  const parseVerbTmpl = (inner) => {
    const parts = String(inner || "")
      .replace(/^\{\{|\}\}$/g, "")
      .split("|")
      .map((s) => s.trim());
    if (!(parts[0] || "").startsWith("head")) return null;
    const out = {};
    let last = [];
    const clean = (v) =>
      String(v || "")
        .replace(/[\[\]']/g, "")
        .replace(/\s+or\s+/g, "/")
        .trim();
    const put = (keys, v) => {
      if (!v) return;
      keys.forEach((k) => {
        out[k] = out[k] ? out[k] + "/" + v : v;
      });
    };
    const keysOf = (k) => {
      k = String(k || "").toLowerCase();
      if (k === "or") return last;
      if (/simple past and past participle/.test(k)) return ["pret", "perf"];
      if (/present tense|^present$/.test(k)) return ["pres"];
      if (/simple past|past tense/.test(k)) return ["pret"];
      if (/past participle|^supine$/.test(k)) return ["perf"];
      return [];
    };
    for (let i = 3; i + 1 < parts.length; i += 2) {
      const keys = keysOf(parts[i]);
      last = keys;
      put(keys, clean(parts[i + 1]));
    }
    if (!out.pres && !out.pret && !out.perf) return null;
    return { pres: out.pres || "", pret: out.pret || "", perf: out.perf || "" };
  };

  async function guessVerb(word) {
    try {
      const got = await wikiTmpl(word, /\{\{(?:head\|nb\|verb|nb-verb)[^}]*\}\}/i);
      if (!got) return null;
      return parseVerbHead(got.expanded) || parseVerbTmpl(got.tmpl);
    } catch (_) {}
    return null;
  }

  const ordGet = (path) =>
    fetch("https://ord.uib.no" + path).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const uniqJoin = (arr) => {
    const seen = new Set();
    const out = [];
    (arr || []).forEach((s) => {
      s = String(s || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out.join("/");
  };

  const fillDollars = (content, items) => {
    let i = 0;
    return String(content || "")
      .replace(/\$/g, () => {
        const it = (items || [])[i++] || {};
        if (it.text) return it.text;
        const lem = it.lemmas && it.lemmas[0];
        return (lem && lem.lemma) || "";
      })
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .trim();
  };

  const bmGlosses = (defs, out) => {
    if (!defs || out.length >= 5) return;
    const list = Array.isArray(defs) ? defs : [defs];
    for (const el of list) {
      if (!el || out.length >= 5) return;
      if (el.type_ === "sub_article") continue;
      if (el.type_ === "explanation") {
        const s = fillDollars(el.content, el.items);
        if (s && s.length > 1 && !/^brukt som adverb/i.test(s) && !/^jf\b/i.test(s)) out.push(s);
      }
      if (el.elements) bmGlosses(el.elements, out);
      if (el.definitions) bmGlosses(el.definitions, out);
    }
  };

  const formBy = (inf, pred) =>
    uniqJoin((inf || []).filter((x) => x && x.word_form && pred(x.tags || [])).map((x) => x.word_form));

  const posFromArt = (art) => {
    const tags = (((art.lemmas || [])[0] || {}).paradigm_info || []).flatMap((p) => p.tags || []);
    const g = ((((art.lemmas || [])[0] || {}).paradigm_info || [])[0] || {}).inflection_group || "";
    if (tags.includes("ADV") || /^ADV/.test(g)) return "adv";
    if (tags.includes("ADJ") || /^ADJ/.test(g)) return "adj";
    if (tags.includes("VERB") || /^VERB/.test(g)) return "verb";
    if (tags.includes("NOUN") || /^NOUN/.test(g)) return "noun";
    return "";
  };

  const parasOf = (art, tag) => {
    const all = ((art.lemmas || [])[0] || {}).paradigm_info || [];
    const match = all.filter((p) => (p.tags || []).includes(tag));
    const std = match.filter((p) => p.standardisation === "STANDARD");
    return std.length ? std : match;
  };

  const parseBmArt = (art) => {
    if (!art) return null;
    const pos = posFromArt(art);
    const glosses = [];
    bmGlosses(art.body && art.body.definitions, glosses);
    const info = { id: art.article_id, pos, glosses };
    if (pos === "noun") {
      const paras = parasOf(art, "NOUN");
      const defs = [];
      const pls = [];
      const defPls = [];
      let gender = "";
      paras.forEach((p) => {
        const t = p.tags || [];
        const joined = t.join(" ");
        if (/Neuter/.test(joined)) gender = !gender || gender === "n" ? "n" : "c";
        else if (/Fem/.test(joined) && /Masc/.test(joined)) gender = "c";
        else if (/Fem/.test(joined)) gender = gender === "m" ? "c" : gender || "f";
        else if (/Masc/.test(joined)) gender = gender === "f" ? "c" : gender || "m";
        const inf = p.inflection || [];
        const d = formBy(inf, (x) => x.includes("Sing") && x.includes("Def"));
        const pl = formBy(inf, (x) => x.includes("Plur") && x.includes("Ind"));
        const dp = formBy(inf, (x) => x.includes("Plur") && x.includes("Def"));
        if (d) defs.push(d);
        if (pl) pls.push(pl);
        if (dp) defPls.push(dp);
      });
      info.gender = gender;
      info.def = uniqJoin(defs);
      info.pl = uniqJoin(pls);
      info.defPl = uniqJoin(defPls);
    }
    if (pos === "adj" || pos === "adv") {
      const paras = parasOf(art, pos === "adv" ? "ADV" : "ADJ");
      const inf = (paras[0] && paras[0].inflection) || [];
      info.comp = formBy(inf, (x) => x.includes("Cmp"));
      info.sup = formBy(inf, (x) => x.includes("Sup") && !x.includes("Def")) || formBy(inf, (x) => x.includes("Sup"));
    }
    if (pos === "verb") {
      const pres = [];
      const pret = [];
      const perf = [];
      parasOf(art, "VERB").forEach((p) => {
        const inf = p.inflection || [];
        const a = formBy(inf, (x) => x.includes("Pres") && !x.includes("Pass"));
        const b = formBy(inf, (x) => x.includes("Past") && !x.includes("Pass"));
        const c = formBy(inf, (x) => x.includes("<PerfPart>") && !x.includes("Adj"));
        if (a) pres.push(a);
        if (b) pret.push(b);
        if (c) perf.push(c);
      });
      info.pres = uniqJoin(pres);
      info.pret = uniqJoin(pret);
      info.perf = uniqJoin(perf);
    }
    if (!info.pos && !info.glosses.length) return null;
    return info;
  };

  async function bmIds(word) {
    const q = headword(word);
    if (!q) return [];
    const d = await ordGet("/api/articles?w=" + encodeURIComponent(q) + "&dict=bm&scope=e");
    let ids = (d && d.articles && d.articles.bm) || [];
    if (ids.length) return ids;
    const s = await ordGet("/api/suggest?q=" + encodeURIComponent(q) + "&n=6&dict=bm&include=ei");
    const a = (s && s.a) || {};
    const lemma = ((a.inflect || [])[0] || (a.exact || [])[0] || [])[0];
    if (!lemma || lemma === q) return [];
    const d2 = await ordGet("/api/articles?w=" + encodeURIComponent(lemma) + "&dict=bm&scope=e");
    return (d2 && d2.articles && d2.articles.bm) || [];
  }

  async function guessBm(word, prefer) {
    try {
      const ids = await bmIds(word);
      const arts = [];
      for (const id of ids.slice(0, 4)) {
        const art = await ordGet("/bm/article/" + id + ".json");
        const parsed = parseBmArt(art);
        if (parsed) arts.push(parsed);
      }
      if (!arts.length) return null;
      const order = prefer ? [prefer, "adv", "adj", "verb", "noun"] : ["adv", "adj", "verb", "noun"];
      return order.map((p) => arts.find((a) => a.pos === p)).find(Boolean) || arts[0];
    } catch (_) {}
    return null;
  }

  async function guessAdv(word) {
    try {
      const got = await wikiTmpl(word, /\{\{(?:head\|nb\|adverb|nb-adv)[^}]*\}\}/i);
      if (!got) return null;
      return parseAdjHead(got.expanded) || parseAdjTmpl(got.tmpl);
    } catch (_) {}
    return null;
  }

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
      const posOrder = ["adv", "adj", "verb", "noun", "pron", "prep", "phrase"];
      const foundCats = [...new Set(use.map((b) => mapPos(b.partOfSpeech)).filter(Boolean))];
      if (!cat) cat = posOrder.find((c) => foundCats.includes(c)) || (found[0] && found[0].pos) || foundCats[0] || "";
      if (found.length) {
        const main = found.find((x) => x.pos === cat) || found[0];
        en = main.s;
        also = found.filter((x) => x !== main).map((x) => senseLine(x, main.pos));
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
  let dirty = false;
  state.items.forEach((i) => {
    if (!i.enManual && i.enTried && i.en && i.en.includes("; ")) {
      i.en = "";
      i.enTried = false;
      dirty = true;
    }
    if (!i.catManual && i.cat === "verb" && !i.pres && !i.pret && !i.perf) {
      i.cat = "";
      i.catTried = false;
      i.verbVer = 0;
      i.senseVer = 0;
      dirty = true;
    }
  });
  const save = () => window.store.save(KEY, state);
  if (dirty) save();
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

    function render(force) {
      if (!force && ui.id && !ui.practice && root.querySelector(".nk-sheet")) {
        const it = state.items.find((x) => x.id === ui.id);
        if (it) refreshSheet(it);
        return;
      }
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
              <small>${ui.flipped ? "English" : "Norsk"}${catName(it.cat) ? " · " + catName(it.cat) : ""}</small>
              <b>${esc(ui.flipped ? it.en : lemma(it))}</b>
              ${
                !ui.flipped && formsInner(it)
                  ? `<div class="nk-card-forms">${formsInner(it)}</div>`
                  : ""
              }
              ${
                ui.flipped && it.also && it.also.length
                  ? `<ul class="nk-also">${it.also.slice(0, 3).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
                  : ""
              }
              ${ui.flipped && it.note ? `<span class="nk-card-note">${esc(it.note)}</span>` : ""}
              <em>${ui.flipped ? "Tap for Norwegian" : "Tap to flip"}</em>
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
                      <b>${esc(lemma(it))}</b>
                      ${it.en ? `<span>${esc(it.en)}</span>` : ""}
                      ${it.cat || it.note || it.pl || it.gender || it.comp || it.sup || it.pres || (it.also && it.also.length) ? `<small>${[catName(it.cat), nounMeta(it), adjMeta(it), verbMeta(it), it.also && it.also.length ? it.also.length + " more meaning" + (it.also.length > 1 ? "s" : "") : "", it.note ? "Has a note" : ""].filter(Boolean).join(" · ")}</small>` : ""}
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
                  <h3 id="nk-word">${esc(sheetTitle(editing))}</h3>
                  <p class="set-label">English</p>
                  <input name="en" type="text" autocomplete="off" placeholder="In English…" value="${esc(editing.en || "")}" />
                  ${nbBlock(editing)}
                  ${
                    editing.also && editing.also.length
                      ? `<div class="nk-also">
                          <p class="set-label">Also means</p>
                          <ul>${editing.also.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
                        </div>`
                      : ""
                  }
                  ${formsInner(editing) ? `<div class="nk-forms">${formsInner(editing)}</div>` : ""}
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
      state.items.filter((i) => (!i.cat && !i.catTried) || (!i.en && !i.enTried && !i.enManual) || i.senseVer !== 1 || needsBm(i) || needsNoun(i) || needsAdj(i) || needsVerb(i) || needsAdv(i)).slice(0, 4).forEach((i) => classify(i));
    }

    const sheetTyping = () => {
      const el = document.activeElement;
      return !!(el && el.closest && el.closest(".nk-sheet") && (el.name === "note" || el.name === "cat" || el.name === "en"));
    };

    const refreshSheet = (it) => {
      const sheet = root.querySelector(".nk-sheet");
      if (!sheet || !it || it.id !== ui.id) return false;
      const h3 = sheet.querySelector("#nk-word");
      if (h3) h3.textContent = sheetTitle(it);
      const enInp = sheet.querySelector("input[name=en]");
      if (enInp && document.activeElement !== enInp && !it.enManual) enInp.value = it.en || "";
      const catLabel = [...sheet.querySelectorAll(".set-label")].find((el) => /category/i.test(el.textContent || "")) || sheet.querySelector(".set-label");
      let bmEl = sheet.querySelector(".nk-bm");
      let also = sheet.querySelector(".nk-also");
      let forms = sheet.querySelector(".nk-forms");
      const nbh = nbBlock(it);
      if (nbh) {
        const wrap = document.createElement("div");
        wrap.innerHTML = nbh;
        const next = wrap.firstElementChild;
        if (bmEl) bmEl.replaceWith(next);
        else {
          const before = also || forms || catLabel;
          if (before) before.parentNode.insertBefore(next, before);
        }
      } else if (bmEl) bmEl.remove();
      if (it.also && it.also.length) {
        if (!also) {
          also = document.createElement("div");
          also.className = "nk-also";
        }
        also.innerHTML = `<p class="set-label">Also means</p><ul>${it.also.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
        const before = forms || catLabel;
        if (before) before.parentNode.insertBefore(also, before);
      } else if (also) also.remove();
      const inner = formsInner(it);
      if (inner) {
        if (!forms) {
          forms = document.createElement("div");
          forms.className = "nk-forms";
        }
        forms.innerHTML = inner;
        if (catLabel) catLabel.parentNode.insertBefore(forms, catLabel);
      } else if (forms) forms.remove();
      const sel = sheet.querySelector("select[name=cat]");
      if (sel && document.activeElement !== sel) sel.value = it.cat || "";
      return true;
    };

    const afterDict = (cur) => {
      if (ui.practice) return;
      if (ui.id) {
        if (cur && ui.id === cur.id) refreshSheet(cur);
        return;
      }
      render();
    };

    const fillBm = async (it) => {
      if (!needsBm(it)) return;
      it.bmTried = true;
      it.bmVer = 1;
      const info = await guessBm(it.no, it.catManual ? it.cat : "");
      const cur = state.items.find((x) => x.id === it.id);
      if (!cur) return;
      cur.bmVer = 1;
      if (info) {
        cur.bmId = info.id;
        if (info.pos && !cur.catManual) cur.cat = info.pos;
        if (info.pos === "noun") {
          if (info.gender) cur.gender = info.gender;
          if (info.pl) cur.pl = info.pl;
          if (info.def) cur.def = info.def;
          if (info.defPl) cur.defPl = info.defPl;
          cur.nounVer = 3;
        }
        if (info.pos === "adj" || info.pos === "adv") {
          if (info.comp) cur.comp = info.comp;
          if (info.sup) cur.sup = info.sup;
          if (info.pos === "adj") cur.adjVer = 1;
          if (info.pos === "adv") cur.advVer = 1;
        }
        if (info.pos === "verb") {
          if (info.pres) cur.pres = info.pres;
          if (info.pret) cur.pret = info.pret;
          if (info.perf) cur.perf = info.perf;
          cur.verbVer = 1;
        }
        if (info.glosses && info.glosses.length) {
          cur.nb = info.glosses[0];
          cur.nbMore = info.glosses.slice(1, 4);
        }
      }
      save();
    };

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
        if (!cur.catManual && (!cur.cat || cur.cat === "other")) cur.cat = "noun";
      }
      save();
      afterDict(cur);
    };

    const fillAdj = async (it) => {
      if (!needsAdj(it)) return;
      it.adjTried = true;
      it.adjVer = 1;
      const info = await guessAdj(it.no);
      const cur = state.items.find((x) => x.id === it.id);
      if (!cur) return;
      cur.adjVer = 1;
      if (info) {
        if (info.comp) cur.comp = info.comp;
        if (info.sup) cur.sup = info.sup;
        if (!cur.catManual && !cur.cat) cur.cat = "adj";
      }
      save();
      afterDict(cur);
    };

    const fillVerb = async (it) => {
      if (!needsVerb(it)) return;
      it.verbTried = true;
      it.verbVer = 1;
      const info = await guessVerb(it.no);
      const cur = state.items.find((x) => x.id === it.id);
      if (!cur) return;
      cur.verbVer = 1;
      if (info) {
        if (info.pres) cur.pres = info.pres;
        if (info.pret) cur.pret = info.pret;
        if (info.perf) cur.perf = info.perf;
        if (!cur.catManual && !cur.cat) cur.cat = "verb";
      }
      save();
      afterDict(cur);
    };

    const fillAdv = async (it) => {
      if (!needsAdv(it)) return;
      it.advTried = true;
      it.advVer = 1;
      const info = await guessAdv(it.no);
      const cur = state.items.find((x) => x.id === it.id);
      if (!cur) return;
      cur.advVer = 1;
      if (info) {
        if (info.comp) cur.comp = info.comp;
        if (info.sup) cur.sup = info.sup;
        if (!cur.catManual && !cur.cat) cur.cat = "adv";
      }
      save();
      afterDict(cur);
    };

    const fillForms = (it) => {
      if (needsAdj(it)) return fillAdj(it);
      if (needsVerb(it)) return fillVerb(it);
      if (needsAdv(it)) return fillAdv(it);
      if (needsNoun(it)) return fillNoun(it);
    };

    const classify = async (it) => {
      if (!it) return;
      if (needsBm(it)) await fillBm(it);
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
          if (needCat && !cur.catManual && !cur.cat && info.cat) cur.cat = info.cat;
          if (needEn && !cur.en && !cur.enManual && info.en) cur.en = info.en;
          const extra = (info.also || []).filter((s) => s && s.toLowerCase() !== String(cur.en || "").toLowerCase());
          cur.also = extra;
          save();
        }
      }
      const cur = state.items.find((x) => x.id === it.id);
      if (fillForms(cur)) return;
      afterDict(cur);
    };

    root._rerender = () => render();
    render();

    root.onsubmit = (e) => {
      e.preventDefault();
      const no = noWord(e.target.no.value);
      if (!no) return;
      const en = e.target.en.value.trim();
      const it = { id: uid(), no, en, enManual: !!en, cat: "", known: false, added: Date.now() };
      state.items.unshift(it);
      save();
      ui.tab = "learn";
      ui.id = it.id;
      render(true);
      classify(it);
    };

    root.oninput = (e) => {
      const it = state.items.find((x) => x.id === ui.id);
      if (!it || !e.target.closest(".nk-sheet")) return;
      if (e.target.name === "note") {
        it.note = e.target.value;
        save();
      } else if (e.target.name === "en") {
        it.en = e.target.value;
        it.enManual = true;
        save();
      }
    };

    root.onchange = (e) => {
      if (e.target.name !== "cat" || !e.target.closest(".nk-sheet")) return;
      const it = state.items.find((x) => x.id === ui.id);
      if (!it) return;
      it.cat = e.target.value;
      it.catManual = true;
      it.bmVer = 0;
      fillBm(it).then(() => fillForms(it));
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
        render(true);
        if (needsBm(it)) fillBm(it).then(() => afterDict(it));
        else fillForms(it);
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
