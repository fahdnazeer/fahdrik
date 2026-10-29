// Public ICS feed for Google Calendar. JWT off — Google will not send a user token.
// Secret: FAHDRIK_ICS_TOKEN (same value as window.FAHDRIK_ICS_TOKEN in config.js)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WHO: Record<string, string> = { me: "Fahd", partner: "Eirik", both: "Both" };

function icsEscape(s: string) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  out.push(rest);
  return out.join("\r\n");
}

function ymdFromEvent(e: { ymd?: string; date?: number }) {
  if (e.ymd && /^\d{4}-\d{2}-\d{2}$/.test(e.ymd)) return e.ymd.replace(/-/g, "");
  if (!e.date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(e.date));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${g("year")}${g("month")}${g("day")}`;
}

function nextDay(yyyymmdd: string) {
  const y = +yyyymmdd.slice(0, 4);
  const m = +yyyymmdd.slice(4, 6) - 1;
  const d = +yyyymmdd.slice(6, 8);
  const dt = new Date(Date.UTC(y, m, d + 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}${p(dt.getUTCMonth() + 1)}${p(dt.getUTCDate())}`;
}

function utcStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function hmOf(t?: string) {
  return (t || "").replace(":", "").padEnd(4, "0").slice(0, 4);
}

function compactYmd(s?: string) {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "");
  return "";
}

function eventBlock(e: { id: number; title: string; time?: string; end?: string; endYmd?: string; who?: string; ymd?: string; date?: number }) {
  const day = ymdFromEvent(e);
  if (!day) return "";
  const last = compactYmd(e.endYmd) && compactYmd(e.endYmd)! > day ? compactYmd(e.endYmd)! : day;
  const uid = `fahdrik-${e.id}@fahdrik`;
  const summary = icsEscape(e.title || "(no title)");
  const who = WHO[e.who || "both"] || "Both";
  const desc = icsEscape(`Fahdrik · ${who}`);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStamp()}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
  ];
  const time = hmOf(e.time);
  if ((e.time || "").replace(":", "").length >= 4) {
    const start = `${day}T${time}00`;
    const endHm = (e.end || "").replace(":", "").length >= 4 ? hmOf(e.end) : "";
    let ed = last;
    let endClock = endHm;
    if (!endClock) {
      let eh = +time.slice(0, 2) + 1;
      const em = time.slice(2, 4);
      if (eh >= 24) {
        eh = 0;
        ed = nextDay(day);
      }
      endClock = `${String(eh).padStart(2, "0")}${em}`;
    } else if (endClock < time && ed === day) {
      // Overnight on the start day only — do not bump again if endYmd is already the morning.
      ed = nextDay(day);
    }
    const end = `${ed}T${endClock}00`;
    lines.push(`DTSTART;TZID=Europe/Oslo:${start}`);
    lines.push(`DTEND;TZID=Europe/Oslo:${end}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${day}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(last)}`);
  }
  lines.push("END:VEVENT");
  return lines.map(fold).join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const expected = Deno.env.get("FAHDRIK_ICS_TOKEN") || "";
  if (!expected || token !== expected) {
    return new Response("Not found", { status: 404 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.from("fahdrik").select("data").eq("id", "fahdrik.calendar").maybeSingle();
  if (error) return new Response("Error", { status: 500 });

  const events = Array.isArray(data?.data?.events) ? data.data.events : [];
  const blocks = events.map(eventBlock).filter(Boolean).join("\r\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fahdrik//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Fahdrik",
    "X-WR-TIMEZONE:Europe/Oslo",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Oslo",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    blocks,
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n") + "\r\n";

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
