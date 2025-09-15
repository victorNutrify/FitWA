// src/lib/br-time.ts
import { stripAccents } from "@/lib/sanitize";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// BRT “fixo” (-03:00)
export function getBrasiliaDate(): Date {
  const now = new Date();
  const brasiliaOffsetMs = -3 * 60 * 60 * 1000;
  return new Date(now.getTime() + brasiliaOffsetMs);
}

export function getHorarioBrasilISO(): string {
  const d = getBrasiliaDate();
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hour = pad2(d.getUTCHours());
  const minute = pad2(d.getUTCMinutes());
  const second = pad2(d.getUTCSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}

export function getDiaAtual(): string {
  return getHorarioBrasilISO().slice(0, 10);
}

export function todayYMD_BRT(): string {
  const d = getBrasiliaDate();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function toBrasilISO(ymd: string, h = 12, m = 0, s = 0): string {
  return `${ymd}T${pad2(h)}:${pad2(m)}:${pad2(s)}-03:00`;
}

export function parseDiaFromText(input?: string): string | null {
  if (!input) return null;
  const raw = stripAccents(String(input).trim().toLowerCase());

  if (raw.includes("ontem")) return ymdAddDays(todayYMD_BRT(), -1);
  if (raw.includes("hoje")) return todayYMD_BRT();
  if (raw.includes("amanha")) return ymdAddDays(todayYMD_BRT(), +1);

  const mIso = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (mIso) return mIso[1];

  const mBr = raw.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (mBr) {
    const dd = pad2(Number(mBr[1]));
    const mm = pad2(Number(mBr[2]));
    const yyyy = mBr[3] ? String(Number(mBr[3])) : String(getBrasiliaDate().getUTCFullYear());
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export function parseHoraMin(str?: string): { h: number; m: number } | null {
  if (!str) return null;
  const m = String(str).match(/(^|\D)(\d{1,2}):(\d{2})(\D|$)/);
  if (!m) return null;
  const h = Number(m[2]), mi = Number(m[3]);
  if (h >= 0 && h < 24 && mi >= 0 && mi < 60) return { h, m: mi };
  return null;
}

export function inferMealFromText(txt?: string): string | null {
  if (!txt) return null;
  const r = stripAccents(txt.toLowerCase());
  if (r.includes("lanche da manha") || r.includes("lanche da manhã")) return "lanche da manhã";
  if (r.includes("lanche da tarde")) return "lanche da tarde";
  if (r.includes("cafe da manha") || r.includes("café da manhã") || r.includes("cafe ")) return "café da manhã";
  if (r.includes("almoco") || r.includes("almoço")) return "almoço";
  if (r.includes("jantar")) return "jantar";
  if (r.includes("ceia") || r.includes("noite")) return "ceia";
  return null;
}

export function defaultHourByMeal(ref: string): { h: number; m: number } {
  const r = stripAccents((ref || "").toLowerCase());
  if (r.includes("cafe")) return { h: 4,  m: 0 };  // 04:00
  if (r.includes("lanche da manha")) return { h: 10, m: 0 }; // 10:00
  if (r.includes("almoco")) return { h: 12, m: 0 }; // 12:00
  if (r.includes("lanche da tarde")) return { h: 16, m: 0 }; // 16:00
  if (r.includes("jantar")) return { h: 19, m: 0 }; // 19:00
  if (r.includes("ceia") || r.includes("noite") || r.includes("lanche da noite")) return { h: 21, m: 0 }; // 21:00
  return { h: 12, m: 0 };
}

export function periodoPorHorario(horarioISO: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(horarioISO)) return "Indefinido";
  const h = Number(horarioISO.slice(11, 13));
  const mi = Number(horarioISO.slice(14, 16));
  const t = h * 60 + mi;

  if (t >= 240 && t < 600)   return "café da manhã";    // 04:00–09:59
  if (t >= 600 && t < 720)   return "lanche da manhã";  // 10:00–11:59
  if (t >= 720 && t < 900)   return "almoço";           // 12:00–14:59
  if (t >= 900 && t < 1140)  return "lanche da tarde";  // 15:00–18:59
  if (t >= 1140 && t < 1260) return "jantar";           // 19:00–20:59
  if (t >= 1260 || t < 240)  return "ceia";             // 21:00–03:59
  return "Indefinido";
}

export function nowHM_BRT(): { h: number; m: number } {
  const d = getBrasiliaDate();
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}
