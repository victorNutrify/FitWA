import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge de classes Tailwind com clsx + tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse seguro de números (substitui qualquer tentativa de eval).
 * Aceita:  "120", "45.6", "-3.2", "12,5"
 * Retorna: number | NaN
 */
export function parseNumberSafe(input: unknown): number {
  if (typeof input === "number") return input;

  if (typeof input === "string") {
    const clean = input.replace(",", ".").trim();
    // apenas número simples
    if (/^-?\d+(\.\d+)?$/.test(clean)) {
      const v = parseFloat(clean);
      if (Number.isFinite(v)) return v;
    }
  }

  return NaN;
}
