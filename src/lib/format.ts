import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...c: ClassValue[]) => twMerge(clsx(c));

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function duration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60 ? `${min % 60}m` : ""}`.trim();
}

// Server components render on Vercel in UTC; format everything in one display zone so server and
// client agree (no hydration drift) and seeded "9am standups" read as 9am.
export const DISPLAY_TZ = "America/Los_Angeles";

const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: DISPLAY_TZ });

export function dayLabel(isoDate: string, now = new Date()) {
  const d = new Date(isoDate);
  const day = 86400000;
  const key = ymd(d);
  if (key === ymd(now)) return "Today";
  if (key === ymd(new Date(now.getTime() - day))) return "Yesterday";
  if (key === ymd(new Date(now.getTime() + day))) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: DISPLAY_TZ });
}

export const timeLabel = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DISPLAY_TZ });

export const shortDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: DISPLAY_TZ });

export function initials(name: string) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?";
}

export function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

export function thumbFor(m: { sourceUrl: string | null }) {
  const yt = m.sourceUrl?.match(/[?&]v=([\w-]{11})/)?.[1];
  return yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : null;
}

export const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
