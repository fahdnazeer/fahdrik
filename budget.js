// Read-only Samboer dashboard from finance_manager (Peach).
const BKEY = "fahdrik.samboer";
const SKIP_CF = new Set(["Transfer", "IOU - I owe them", "IOU - They owe me", "Debt payments"]);
const BUDGET_GROUPS = [
  { name: "Income", income: true, cats: ["Income", "Extra money"] },
  { name: "Side hustle", income: true, cats: ["Side hustle"] },
  { name: "Everyday", cats: ["Groceries", "Samboer spending", "Transport", "Personal care", "Health"] },
  { name: "Lifestyle", cats: ["Eating out", "Entertainment", "Shopping", "Gambling", "Bills - Personal"] },
  { name: "Home", cats: ["Housing", "Bills - Household", "Apartment upgrade / Renovations", "Reimbursment - Flatmates"] },
  { name: "Goals", cats: ["Travel - London March 2026", "Travel - Hive Festival", "Travel - Berlin", "Monument Festival", "Savings", "Savings - Housing", "Invest"] },
  { name: "Other", cats: ["Education / Learning", "Services fees / government", "Interest & Fees", "Bills Work", "Misc/Unknown"] },
];
const CATS = {
  Income: ["💰", "#d9f3e4"], "Extra money": ["💵", "#d9f3e4"], "Side hustle": ["🧰", "#d9f3e4"],
  Groceries: ["🛒", "#e3f1d3"], "Samboer spending": ["🫶", "#e3f1d3"], "Eating out": ["🍽️", "#fde6cf"],
  Transport: ["🚗", "#dde8fb"], Shopping: ["🛍️", "#f6dcf0"], Entertainment: ["🎬", "#e6e0fa"],
  Housing: ["🏠", "#f2e3d5"], "Bills - Personal": ["🧾", "#fff3c4"], "Bills - Household": ["💡", "#fff3c4"],
  "Bills Work": ["💼", "#fff3c4"], Health: ["🩺", "#fbdada"], "Personal care": ["💇", "#fbdada"],
  "Debt payments": ["⛓️", "#fbdada"], "Interest & Fees": ["🏦", "#e7e7e7"],
  "Services fees / government": ["🏛️", "#e7e7e7"], "Education / Learning": ["📚", "#dde8fb"],
  Gambling: ["🎲", "#e7e7e7"], Invest: ["📈", "#d9f3e4"], Savings: ["🐖", "#d8f0f5"],
  "Savings - Housing": ["🏡", "#d8f0f5"], "Apartment upgrade / Renovations": ["🔨", "#f2e3d5"],
  "Travel - London March 2026": ["✈️", "#d8f0f5"], "Travel - Hive Festival": ["✈️", "#d8f0f5"],
  "Travel - Berlin": ["✈️", "#d8f0f5"], "Monument Festival": ["🎵", "#e6e0fa"],
  Transfer: ["🔄", "#e7e7e7"], "IOU - I owe them": ["📤", "#eeeeee"], "IOU - They owe me": ["📥", "#eeeeee"],
  "Reimbursment - Flatmates": ["🤝", "#eeeeee"], "Misc/Unknown": ["❓", "#eeeeee"],
};
const FUN_CAT = {
  Income: "#b8f0c8", "Extra money": "#c6f5d4", "Side hustle": "#9ee7c8", Transfer: "#7ed4c8",
  Groceries: "#d4f07a", "Samboer spending": "#ffc2d4", "Eating out": "#ffd6a5",
  Transport: "#a8d4ff", Shopping: "#e8b4f8", Entertainment: "#c9b6ff",
  Housing: "#ffd6c0", "Bills - Personal": "#ffe566", "Bills - Household": "#ffef9a", "Bills Work": "#ffe08a",
  Health: "#ffb3c1", "Personal care": "#ffc9d6", "Apartment upgrade / Renovations": "#f5c6a0",
  Savings: "#9ee0ea", "Savings - Housing": "#b5ebe8",
};
const TYPES = {
  checking: { group: "Cash", icon: "🏦", color: "#dde8fb", label: "Checking" },
  savings: { group: "Savings", icon: "🐖", color: "#d8f0f5", label: "Savings" },
  credit: { group: "Credit Cards", icon: "💳", color: "#fbdada", label: "Credit card" },
  cash: { group: "Cash", icon: "💵", color: "#d9f3e4", label: "Cash" },
  other: { group: "Other", icon: "📁", color: "#e7e7e7", label: "Other" },
};
const GROUPS = ["Cash", "Savings", "Credit Cards", "Other"];
const nok = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" });
const money = (n) => nok.format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const PAY_RE = /sosolo|employ\s*kultur/i;

const ui = { dashMonth: null, periodMode: "cycle" };
let snap = window.store.get(BKEY, null);

function emptySnap() {
  return { tx: [], staged: [], accMeta: {}, budgetMonths: {}, payDay: 15, periodMode: "cycle", cycleStarts: [], savedAt: 0 };
}
function asSnap(s) {
  if (!s || typeof s !== "object") return emptySnap();
  return {
    tx: Array.isArray(s.tx) ? s.tx : [],
    staged: Array.isArray(s.staged) ? s.staged : [],
    accMeta: s.accMeta && typeof s.accMeta === "object" ? s.accMeta : {},
    budgetMonths: s.budgetMonths && typeof s.budgetMonths === "object" ? s.budgetMonths : {},
    payDay: Math.min(28, Math.max(1, +s.payDay || 15)),
    periodMode: s.periodMode === "month" ? "month" : "cycle",
    cycleStarts: Array.isArray(s.cycleStarts) ? s.cycleStarts.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
    savedAt: s.savedAt || 0,
  };
}
function pickSamboer(d) {
  if (!d) return null;
  if (d.users && typeof d.users === "object") return d.users.Samboer || d.users.samboer || null;
  if (Array.isArray(d.tx)) return d;
  return d;
}

window.store.watchState(BKEY, { tx: [] });

function tx() { return asSnap(snap).tx; }
function accMeta() { return asSnap(snap).accMeta; }
function budgetMonths() { return asSnap(snap).budgetMonths; }
function payDay() { return asSnap(snap).payDay; }
function cycleStarts() { return asSnap(snap).cycleStarts; }
function periodMode() { return ui.periodMode || asSnap(snap).periodMode; }

function inferType(name) {
  const n = (name || "").toLowerCase();
  if (/card|visa|mastercard|amex|gold|kreditt/.test(n)) return "credit";
  if (/saving|buffer|debt attack/.test(n)) return "savings";
  if (/cash|wallet/.test(n)) return "cash";
  return "checking";
}
function listAccounts() {
  const names = new Set([...Object.keys(accMeta()), ...tx().map((t) => t.account)].filter(Boolean));
  return [...names].map((name) => {
    const m = accMeta()[name] || {};
    if (m.removed && !tx().some((t) => t.account === name)) return null;
    const type = m.type || inferType(name);
    const opening = m.opening || 0;
    const rows = tx().filter((t) => t.account === name);
    const balance = opening + rows.reduce((s, t) => s + t.amount, 0);
    return { name, number: m.number || "", type, opening, hidden: !!m.hidden, balance };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}
function monthBounds(m) {
  return [m + "-01", ymd(new Date(+m.slice(0, 4), +m.slice(5, 7), 0))];
}
function paycheckDates() {
  return [...new Set(tx().filter((t) => t.amount > 0 && PAY_RE.test(t.desc || "")).map((t) => t.date))].sort();
}
function fallbackStart(key) {
  const ym = key.slice(0, 7);
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  return iso(y, m + 1, payDay());
}
function cycleStartDates() {
  const months = new Set();
  const now = ymd(new Date());
  for (let i = -18; i <= 18; i++) {
    const dt = new Date(+now.slice(0, 4), +now.slice(5, 7) - 1 + i, 1);
    months.add(dt.getFullYear() + "-" + pad2(dt.getMonth() + 1));
  }
  tx().forEach((t) => { if (t.date) months.add(t.date.slice(0, 7)); });
  cycleStarts().forEach((d) => months.add(d.slice(0, 7)));
  const pay = {}, custom = {};
  paycheckDates().forEach((d) => { pay[d.slice(0, 7)] = d; });
  cycleStarts().forEach((d) => { custom[d.slice(0, 7)] = d; });
  return [...months].sort().map((ym) => custom[ym] || pay[ym] || fallbackStart(ym));
}
function paycheckCycle(key) {
  const dates = cycleStartDates();
  let start;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) start = dates.filter((d) => d <= key).pop() || dates.find((d) => d >= key) || key;
  else start = dates.find((d) => d.startsWith(key.slice(0, 7))) || fallbackStart(key);
  const next = dates.find((d) => d > start);
  let end;
  if (next) {
    const d = new Date(next + "T12:00");
    d.setDate(d.getDate() - 1);
    end = ymd(d);
  } else {
    const d = new Date(start + "T12:00");
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    end = ymd(d);
  }
  return [start, end];
}
function periodBounds(key) {
  return periodMode() === "month" ? monthBounds((key || "").slice(0, 7)) : paycheckCycle(key);
}
function periodLabel(key) {
  if (periodMode() === "month") return new Date(key.slice(0, 7) + "-01T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const [from, to] = paycheckCycle(key);
  const f = new Date(from + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const t = new Date(to + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return f + " – " + t;
}
function cycleContaining(isoDate) {
  if (periodMode() === "month") {
    const key = isoDate.slice(0, 7);
    const [start, end] = monthBounds(key);
    return { start, end, key };
  }
  const dates = cycleStartDates();
  const start = [...dates].reverse().find((d) => d <= isoDate);
  if (start) {
    const [s, e] = paycheckCycle(start);
    return { start: s, end: e, key: s };
  }
  const d = new Date(isoDate + "T12:00");
  let y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() < payDay()) { m--; if (m < 0) { m = 11; y--; } }
  const key = iso(y, m + 1, payDay());
  const [s, e] = paycheckCycle(key);
  return { start: s, end: e, key: s };
}
function daysUntil(isoDate) {
  const a = new Date(isoDate + "T00:00"), b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}
function bdDefaultMonth() {
  const now = ymd(new Date());
  if (periodMode() === "cycle") return cycleContaining(now).key;
  const months = [...new Set(tx().map((t) => t.date.slice(0, 7)))].sort();
  const cur = now.slice(0, 7);
  return months.includes(cur) ? cur : (months[months.length - 1] || cur);
}
function bdShift(m, d) {
  if (periodMode() === "cycle") {
    const start = paycheckCycle(m)[0];
    const dates = cycleStartDates();
    const i = dates.indexOf(start);
    if (i >= 0 && dates[i + d]) return dates[i + d];
    const dt = new Date(start + "T12:00");
    dt.setMonth(dt.getMonth() + d);
    return ymd(dt);
  }
  const ym = (m || "").slice(0, 7);
  const dt = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + d, 1);
  return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1);
}
function bdAmt(m, cat) {
  const bm = budgetMonths();
  if (bm[m] && bm[m][cat] != null) return +bm[m][cat] || 0;
  const keys = Object.keys(bm).filter((k) => k < m).sort();
  for (let i = keys.length - 1; i >= 0; i--) {
    if (bm[keys[i]][cat] != null) return +bm[keys[i]][cat] || 0;
  }
  return 0;
}
function catFlow(rows, cat) {
  return rows.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
}
function isCf(t) {
  if (!t.category) return false;
  if (t.category === "Transfer") return t.amount > 0;
  return !SKIP_CF.has(t.category);
}
function isIncomeCat(c) {
  return c === "Income" || c === "Extra money" || c === "Side hustle" || c === "Transfer";
}
function isReimburseCat(c) {
  return c === "Reimbursment - Flatmates" || c === "IOU - They owe me";
}
function sumIncome(rows) {
  return rows.filter((t) => isIncomeCat(t.category)).reduce((s, t) => s + t.amount, 0);
}
function sumExpense(rows) {
  let s = 0;
  for (const t of rows) {
    if (isReimburseCat(t.category)) s += t.amount;
    else if (isCf(t) && !isIncomeCat(t.category)) s += t.amount;
  }
  return s;
}
function catColor(c) { return FUN_CAT[c] || (CATS[c] || CATS["Misc/Unknown"])[1]; }
function catIcon(c) { return (CATS[c] || CATS["Misc/Unknown"])[0]; }
function groupCats(rows, sign) {
  const m = {};
  for (const t of rows) {
    if (isReimburseCat(t.category) || !isCf(t)) continue;
    if (sign > 0 && (t.amount <= 0 || !isIncomeCat(t.category))) continue;
    if (sign < 0 && (t.amount >= 0 || isIncomeCat(t.category))) continue;
    m[t.category] = (m[t.category] || 0) + Math.abs(t.amount);
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
function netWorthAt(date) {
  return listAccounts().filter((a) => !a.hidden).reduce((s, a) => {
    const sum = tx().filter((t) => t.account === a.name && t.date <= date).reduce((x, t) => x + t.amount, 0);
    return s + a.opening + sum;
  }, 0);
}
function chartSvg(points) {
  if (points.length < 2) return "";
  const W = 1000, H = 132, pL = 12, pR = 16, pT = 10, pB = 24;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);
  const xs = points.map((_, i) => pL + i * (W - pL - pR) / (points.length - 1));
  const ys = vals.map((v) => pT + (1 - (v - min) / span) * (H - pT - pB));
  let d = "M" + xs[0] + "," + ys[0];
  for (let i = 1; i < xs.length; i++) d += " L" + xs[i] + "," + ys[i];
  const area = d + " L" + xs[xs.length - 1] + "," + (H - pB) + " L" + xs[0] + "," + (H - pB) + " Z";
  const last = points.length - 1;
  const labels = points.map((p, i) => {
    if (points.length > 10 && i !== 0 && i !== last && i % 2) return "";
    const lab = new Date(p.m + "-01T00:00").toLocaleDateString("en-GB", { month: "short" });
    return '<text x="' + xs[i] + '" y="' + (H - 6) + '" text-anchor="middle">' + lab + "</text>";
  }).join("");
  return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">'
    + '<path d="' + area + '" fill="#4ade80" fill-opacity=".15"/>'
    + '<path d="' + d + '" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linejoin="round"/>'
    + '<circle cx="' + xs[last] + '" cy="' + ys[last] + '" r="4.5" fill="#4ade80"/>'
    + labels + "</svg>";
}

function applyFile(d) {
  const s = pickSamboer(d);
  if (!s) return false;
  snap = { ...asSnap(s), savedAt: Date.now() };
  window.store.save(BKEY, snap);
  return true;
}

async function tryLocalPeach() {
  try {
    const r = await fetch("http://127.0.0.1:8765/data.json", { cache: "no-store" });
    if (!r.ok) return false;
    const d = await r.json();
    return applyFile(d);
  } catch (_) {
    return false;
  }
}

function fmtSaved(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

window.renderBudget = function (root) {
  snap = window.store.get(BKEY, snap);
  root._storeKey = BKEY;
  root._rerender = () => window.renderBudget(root);
  const s = asSnap(snap);
  const has = s.tx.length || Object.keys(s.accMeta).length;
  if (!has) {
    root.innerHTML = `<div class="bd-empty">
      <p>Budget shows the <b>Samboer</b> dashboard from Peach, read-only.</p>
      <p class="muted">It updates when Peach saves Samboer.</p>
    </div>`;
    tryLocalPeach().then((ok) => { if (ok) window.renderBudget(root); });
    return;
  }

  if (!ui.periodMode) ui.periodMode = s.periodMode;
  const month = ui.dashMonth || bdDefaultMonth();
  ui.dashMonth = month;
  const [from, to] = periodBounds(month);
  let sub = periodLabel(month);
  if (periodMode() === "cycle" && month === cycleContaining(ymd(new Date())).key) {
    const nxt = daysUntil(to) + 1;
    sub += nxt <= 0 ? " · payday today" : nxt === 1 ? " · payday tomorrow" : " · " + nxt + " days until payday";
  }
  const vis = listAccounts().filter((a) => !a.hidden);
  const net = vis.reduce((sum, a) => sum + a.balance, 0);
  const cash = vis.filter((a) => a.type !== "credit").reduce((sum, a) => sum + a.balance, 0);
  const credit = vis.filter((a) => a.type === "credit").reduce((sum, a) => sum + a.balance, 0);
  const prevM = bdShift(month, -1);
  const prevNet = netWorthAt(monthBounds(prevM)[1]);
  const delta = net - prevNet;
  const months = [...new Set(tx().map((t) => t.date.slice(0, 7)))].sort();
  const chart = chartSvg(months.filter((m) => m <= String(month).slice(0, 7)).map((m) => ({ m, v: netWorthAt(monthBounds(m)[1]) })));
  const rows = tx().filter((t) => t.date >= from && t.date <= to && (isCf(t) || isReimburseCat(t.category)));
  const inc = sumIncome(rows);
  const exp = sumExpense(rows);
  const cf = inc + exp;
  let expBd = 0, expAct = 0;
  for (const g of BUDGET_GROUPS) {
    if (g.income) continue;
    for (const cat of g.cats) {
      expBd += bdAmt(month, cat);
      expAct += -catFlow(rows, cat);
    }
  }
  const left = expBd - expAct;
  const rate = inc ? Math.round((cf / inc) * 100) : null;
  const leftTxt = expBd ? money(left) : (rate == null ? "—" : rate + "% saved");
  const leftCls = expBd ? (left < 0 ? "neg" : "pos") : (rate == null ? "" : (rate >= 0 ? "pos" : "neg"));
  const leftLab = expBd ? "Left to spend" : "Savings rate";
  const spend = groupCats(rows, -1).slice(0, 6);
  const spendMax = spend[0] ? spend[0][1] : 1;
  const spendHtml = spend.length ? spend.map((pair) => {
    const c = pair[0], v = pair[1], pct = Math.max(4, v / spendMax * 100);
    return '<div class="cf-row"><div class="ico" style="background:' + catColor(c) + '">' + catIcon(c) + '</div><div class="desc"><b>' + esc(c) + '</b><div class="cf-track"><i style="width:' + pct + "%;background:" + catColor(c) + '"></i></div></div><div class="amt">' + money(-v) + "</div></div>";
  }).join("") : '<div class="empty">No spending in this period.</div>';
  const bdRows = [];
  for (const g of BUDGET_GROUPS) {
    if (g.income) continue;
    for (const cat of g.cats) {
      const spent = -catFlow(rows, cat), budget = bdAmt(month, cat);
      if (budget || spent) bdRows.push({ cat, spent, budget });
    }
  }
  bdRows.sort((a, b) => b.spent - a.spent);
  const bdHtml = bdRows.length ? bdRows.slice(0, 6).map((x) => {
    const pct = x.budget > 0 ? Math.min(100, x.spent / x.budget * 100) : (x.spent ? 100 : 0);
    const over = x.budget > 0 && x.spent > x.budget;
    const bar = over ? "#c0392b" : "#4ade80";
    const leftT = x.budget ? (over ? money(x.spent - x.budget) + " over" : money(x.budget - x.spent) + " left") : "No budget";
    return '<div class="cf-row"><div class="ico" style="background:' + catColor(x.cat) + '">' + catIcon(x.cat) + '</div><div class="desc"><b>' + esc(x.cat) + '</b><div class="cf-track"><i style="width:' + pct + "%;background:" + bar + '"></i></div></div><div class="amt ' + (over ? "neg" : "") + '">' + leftT + "</div></div>";
  }).join("") : '<div class="empty">No category budgets in this period.</div>';
  const byGroup = {};
  vis.forEach((a) => { (byGroup[(TYPES[a.type] || TYPES.other).group] ||= []).push(a); });
  const accHtml = vis.length ? GROUPS.filter((g) => byGroup[g]).map((g) => {
    return '<div class="dash-g">' + g + "</div>" + byGroup[g].map((a) => {
      const t = TYPES[a.type] || TYPES.other;
      return '<div class="dash-item"><div class="acc-ico" style="background:' + t.color + '">' + t.icon + '</div><div class="desc"><b>' + esc(a.name) + "</b><small>" + esc(a.number || t.label) + '</small></div><div class="amt ' + (a.balance > 0 ? "pos" : a.balance < 0 ? "neg" : "") + '">' + money(a.balance) + "</div></div>";
    }).join("");
  }).join("") : '<div class="empty">No accounts yet.</div>';
  const cycleOn = periodMode() === "cycle" ? " on" : "";
  const monthOn = periodMode() === "month" ? " on" : "";

  root.innerHTML = `
    <p class="bd-note muted">Samboer · Peach · read only${s.savedAt ? " · updated " + fmtSaved(s.savedAt) : ""}</p>
    <div class="bd-nav">
      <button type="button" class="bd-arr" data-shift="-1" aria-label="Previous">‹</button>
      <div class="bd-title"><h3>Dashboard</h3><p class="muted">${esc(sub)}</p></div>
      <button type="button" class="bd-arr" data-shift="1" aria-label="Next">›</button>
    </div>
    <div class="bd-tabs">
      <button type="button" class="tab${cycleOn}" data-period="cycle">Pay cycle</button>
      <button type="button" class="tab${monthOn}" data-period="month">Calendar</button>
    </div>
    <section class="hero card-block">
      <div class="hero-top">
        <div>
          <span>Net worth</span>
          <b class="${net >= 0 ? "pos" : "neg"}">${money(net)}</b>
          <small class="${s.tx.length ? (delta >= 0 ? "pos" : "neg") : "muted"}">${s.tx.length ? ((delta >= 0 ? "▲ " : "▼ ") + money(Math.abs(delta)) + " vs " + new Date((/^\d{4}-\d{2}-\d{2}$/.test(prevM) ? prevM : prevM + "-01") + "T00:00").toLocaleDateString("en-GB", { month: "short" })) : "Waiting for Peach data"}</small>
        </div>
        <div class="hero-split">
          <div><span>Cash &amp; savings</span><b class="${cash >= 0 ? "pos" : "neg"}">${money(cash)}</b></div>
          <div><span>Credit cards</span><b class="${credit < 0 ? "neg" : ""}">${money(credit)}</b></div>
        </div>
      </div>
      <div class="bd-chart">${chart}</div>
    </section>
    <section class="summary">
      <div class="sum-btn"><span>${periodMode() === "cycle" ? "This cycle in" : "This month in"}</span><b class="pos">${money(inc)}</b></div>
      <div class="sum-btn"><span>${periodMode() === "cycle" ? "This cycle out" : "This month out"}</span><b>${money(exp)}</b></div>
      <div class="sum-btn"><span>Net cash flow</span><b class="${cf >= 0 ? "pos" : "neg"}">${money(cf)}</b></div>
      <div class="sum-btn"><span>${leftLab}</span><b class="${leftCls}">${leftTxt}</b></div>
    </section>
    <div class="cf-cols">
      <section class="card-block">
        <div class="card-head"><h3>${periodMode() === "cycle" ? "Spending this cycle" : "Spending this month"}</h3></div>
        ${spendHtml}
      </section>
      <section class="card-block">
        <div class="card-head"><h3>Budget</h3></div>
        ${bdHtml}
      </section>
    </div>
    <section class="card-block">
      <div class="card-head"><h3>Accounts</h3></div>
      ${accHtml}
    </section>`;

  root.querySelectorAll("[data-shift]").forEach((b) => {
    b.onclick = () => {
      ui.dashMonth = bdShift(ui.dashMonth || bdDefaultMonth(), +b.dataset.shift);
      window.renderBudget(root);
    };
  });
  root.querySelectorAll("[data-period]").forEach((b) => {
    b.onclick = () => {
      ui.periodMode = b.dataset.period;
      ui.dashMonth = null;
      window.renderBudget(root);
    };
  });
};

tryLocalPeach();
