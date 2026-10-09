// Shared Supabase store. Until config.js has a project URL + anon key, data stays on this device.
(function () {
  const cfg = window.SUPABASE || {};
  const emails = (window.FAHDRIK_EMAILS || []).map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  const enabled = !!(cfg.url && cfg.anonKey);
  const KEYS = ["fahdrik.todos", "fahdrik.shopping", "fahdrik.recipes", "fahdrik.watch", "fahdrik.reading", "fahdrik.wishes", "fahdrik.bucket"];
  const watchers = {};
  const timers = {};
  let ignore = {};
  let sb = null;
  let session = null;
  let channel = null;

  const localGet = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  };
  const localSet = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn(e); }
  };

  const userOf = () => session && session.user;
  const emailOf = (u) => (u && (u.email || u.user_metadata && u.user_metadata.email) || "").toLowerCase();
  const nameOf = (u) => (u && (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name) || u.email) || "").split(" ")[0];
  function allowed(u) {
    if (!u || !emailOf(u)) return false;
    if (!emails.length) return true;
    return emails.includes(emailOf(u));
  }

  function notify(key, data) {
    (watchers[key] || []).forEach((fn) => { try { fn(data); } catch (e) { console.warn(e); } });
  }
  function rerender(key) {
    const body = document.getElementById("detail-body");
    if (body && body._storeKey === key && typeof body._rerender === "function") {
      try { body._rerender(); } catch (_) {}
    }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function paintAuth() {
    const u = userOf() && allowed(userOf()) ? userOf() : null;
    const label = !enabled
      ? ""
      : !u
        ? `<button type="button" class="sync-btn" data-sync="in">Sign in to sync</button>`
        : `<button type="button" class="sync-btn on" data-sync="out" title="${esc(emailOf(u))}">Synced · ${esc(nameOf(u))}</button>`;
    document.querySelectorAll("[data-syncbar]").forEach((el) => {
      el.innerHTML = label;
      el.hidden = !label;
    });
  }

  async function upsert(key, data) {
    const u = userOf();
    if (!sb || !u || !allowed(u)) return;
    const { error } = await sb.from("fahdrik").upsert({
      id: key,
      data,
      updated_at: new Date().toISOString(),
      updated_by: emailOf(u),
    });
    if (error) {
      console.warn(error);
      if (/too large|payload|bytes/i.test(error.message || "")) {
        alert("This list is too big to sync (usually because of photos). Try smaller pictures.");
      }
    }
  }

  async function pullAll() {
    const u = userOf();
    if (!sb || !u) return;
    const { data: rows, error } = await sb.from("fahdrik").select("id, data");
    if (error) { console.warn(error); return; }
    const have = new Set((rows || []).map((r) => r.id));
    for (const row of rows || []) {
      const json = JSON.stringify(row.data);
      if (json === ignore[row.id] || json === localStorage.getItem(row.id)) continue;
      ignore[row.id] = json;
      localSet(row.id, row.data);
      notify(row.id, row.data);
    }
    for (const key of KEYS) {
      if (have.has(key)) continue;
      const local = localStorage.getItem(key);
      if (local) await upsert(key, JSON.parse(local));
    }
  }

  function listen() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    channel = sb
      .channel("fahdrik-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "fahdrik" }, (payload) => {
        const row = payload.new;
        if (!row || !row.id) return;
        const json = JSON.stringify(row.data);
        if (json === ignore[row.id] || json === localStorage.getItem(row.id)) return;
        ignore[row.id] = json;
        localSet(row.id, row.data);
        notify(row.id, row.data);
      })
      .subscribe();
  }

  async function onSession(next) {
    session = next;
    const u = userOf();
    if (u && !allowed(u)) {
      alert("That Google account isn’t on the Fahdrik household list. Add the email in config.js.");
      await sb.auth.signOut();
      session = null;
      paintAuth();
      return;
    }
    paintAuth();
    if (!u) {
      if (channel) { sb.removeChannel(channel); channel = null; }
      return;
    }
    await pullAll();
    listen();
  }

  window.store = {
    enabled,
    get: (key, fallback) => {
      const v = localGet(key, fallback);
      return v == null ? fallback : v;
    },
    save: (key, data) => {
      ignore[key] = JSON.stringify(data);
      localSet(key, data);
      if (!sb || !userOf() || !allowed(userOf())) return;
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => upsert(key, data), 350);
    },
    watchState: (key, state) => {
      (watchers[key] = watchers[key] || []).push((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        if (JSON.stringify(state) === JSON.stringify(data)) return;
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, data);
        rerender(key);
      });
    },
    watchArray: (key, setArr) => {
      (watchers[key] = watchers[key] || []).push((data) => {
        if (!Array.isArray(data)) return;
        setArr(data);
        rerender(key);
      });
    },
  };

  window.cloudSignIn = function () {
    if (!enabled || !sb) return alert("Add your Supabase URL and anon key in config.js first.");
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname.replace(/index\.html$/, "") },
    }).then(({ error }) => { if (error) alert(error.message); });
  };
  window.cloudSignOut = function () {
    if (sb) sb.auth.signOut();
  };

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sync]");
    if (!b) return;
    if (b.dataset.sync === "in") window.cloudSignIn();
    else window.cloudSignOut();
  });

  if (!enabled) {
    window.addEventListener("DOMContentLoaded", paintAuth);
    return;
  }

  const lib = window.supabase;
  if (!lib || !lib.createClient) {
    console.warn("Supabase library failed to load.");
    window.addEventListener("DOMContentLoaded", paintAuth);
    return;
  }
  sb = lib.createClient(cfg.url, cfg.anonKey);
  sb.auth.getSession().then(({ data }) => onSession(data.session));
  sb.auth.onAuthStateChange((_event, sess) => onSession(sess));
  window.addEventListener("DOMContentLoaded", paintAuth);
})();
