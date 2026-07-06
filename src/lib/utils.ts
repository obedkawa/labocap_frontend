import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCFA(amount: number): string {
  return new Intl.NumberFormat("fr-BJ", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-BJ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-BJ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Génère un code patient au format identique au projet Laravel :
 * `substr(md5(rand(0, 1000000)), 0, 10)` → 10 caractères hexadécimaux
 * (base 16) en minuscules (`[0-9a-f]`).
 *
 * On utilise ici l'entropie complète de `crypto` (et non un simple
 * `rand(0, 1000000)`) pour éviter toute collision avec l'index unique global
 * `patients_code_key` (la base contient déjà des milliers de codes 10-hex).
 */
export function generatePatientCode(): string {
  const cryptoObj =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(5); // 5 octets = 10 caractères hex
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Repli (environnements sans Web Crypto)
  let code = "";
  while (code.length < 10) {
    code += Math.floor(Math.random() * 16).toString(16);
  }
  return code.slice(0, 10);
}
