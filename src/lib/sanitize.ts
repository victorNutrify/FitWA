// src/lib/sanitize.ts
export function stripAccents(input: string) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugify(input: string) {
  const s = stripAccents(input.toLowerCase().trim());
  return s
    .replace(/[^a-z0-9]+/g, "-") // tudo que não for a-z0-9 vira "-"
    .replace(/^-+|-+$/g, "") // remove traços extremos
    .slice(0, 120); // limite de tamanho seguro
}

/** Doc IDs do Firestore não podem conter "/" */
export function toDocId(input: string) {
  const s = stripAccents(input.toLowerCase().trim());
  return s
    .replace(/\//g, "-")
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}
