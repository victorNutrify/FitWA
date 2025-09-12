import { adminDb } from "./firebase.admin";

// replica a API do client SDK, mas ignora o db passado
export function doc(db: any, ...pathSegments: string[]) {
  let ref: any = adminDb;
  for (let i = 0; i < pathSegments.length; i++) {
    if (i % 2 === 0) {
      ref = ref.collection(pathSegments[i]); // collection
    } else {
      ref = ref.doc(pathSegments[i]); // doc
    }
  }
  return ref;
}

export function collection(db: any, ...pathSegments: string[]) {
  let ref: any = adminDb;
  for (let i = 0; i < pathSegments.length; i++) {
    if (i % 2 === 0) {
      ref = ref.collection(pathSegments[i]);
    } else {
      ref = ref.doc(pathSegments[i]);
    }
  }
  return ref;
}

export async function setDoc(ref: any, data: any, options?: { merge?: boolean }) {
  return options?.merge ? ref.set(data, { merge: true }) : ref.set(data);
}

export async function getDoc(ref: any) {
  return await ref.get();
}

export async function getDocs(q: any) {
  return await q.get();
}

export async function deleteDoc(ref: any) {
  return await ref.delete();
}

export async function runTransaction(db: any, fn: (tx: any) => Promise<any>) {
  return adminDb.runTransaction(fn);
}

// exporta para manter compatibilidade
export const db = adminDb;
