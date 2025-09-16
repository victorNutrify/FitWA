// src/lib/firestore.admin.compat.ts
import { adminDb } from "./firebase.admin";

// Aceita como base o Firestore (adminDb) ou um DocumentReference (para subcoleções)
function getBase(base: any) {
  return base && typeof base.collection === "function" ? base : adminDb;
}

/**
 * Retorna um DocumentReference.
 * Ex.: doc(db, "chatfit", userEmail, "planos", "dieta")
 * Alterna: collection -> doc -> collection -> doc ...
 */
export function doc(base: any, ...pathSegments: string[]) {
  let ref: any = getBase(base);
  for (let i = 0; i < pathSegments.length; i++) {
    ref = i % 2 === 0 ? ref.collection(pathSegments[i]) : ref.doc(pathSegments[i]);
  }
  return ref;
}

/**
 * Retorna um CollectionReference (ou o que resultar do caminho informado).
 * Ex.: collection(db, "chatfit", userEmail, "metasusuario")
 * Alterna: collection -> doc -> collection -> doc ...
 * Obs.: Para coleções, normalmente o número de segmentos é ímpar.
 */
export function collection(base: any, ...pathSegments: string[]) {
  let ref: any = getBase(base);
  for (let i = 0; i < pathSegments.length; i++) {
    ref = i % 2 === 0 ? ref.collection(pathSegments[i]) : ref.doc(pathSegments[i]);
  }
  return ref;
}

export async function setDoc(ref: any, data: any, opts?: { merge?: boolean }) {
  return opts?.merge ? ref.set(data, { merge: true }) : ref.set(data);
}

export async function getDoc(ref: any) {
  const snap = await ref.get();
  return {
    exists: snap.exists,
    data: () => (snap.exists ? snap.data() : undefined),
    ref,
    id: ref.id,
  };
}

export async function getDocs(q: any) {
  return await q.get();
}

export async function deleteDoc(ref: any) {
  return await ref.delete();
}

export async function runTransaction(_db: any, fn: (tx: any) => Promise<any>) {
  return adminDb.runTransaction(fn);
}

// Exporta o db (Firestore admin) para manter a interface
export const db = adminDb;
