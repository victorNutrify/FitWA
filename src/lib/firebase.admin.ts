import { getApps, initializeApp, cert, App, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccountFromEnv(): Parameters<typeof cert>[0] | null {
  // Opção A: JSON em base64
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try {
      const json = Buffer.from(b64, "base64").toString("utf8");
      const parsed = JSON.parse(json);
      return parsed;
    } catch (e) {
      console.error("[firebase.admin] service account BASE64 inválido:", e);
    }
  }

  // Opção B: chaves separadas
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  // Opção C: credencial padrão do ambiente (GCP)
  return null;
}

let app: App;
if (!getApps().length) {
  const svc = getServiceAccountFromEnv();
  if (svc) {
    app = initializeApp({ credential: cert(svc) });
  } else {
    // Tenta applicationDefault (ex.: se rodando no GCP/Emulador)
    app = initializeApp({ credential: applicationDefault() });
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
