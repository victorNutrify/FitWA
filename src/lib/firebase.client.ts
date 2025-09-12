"use client";

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  type Auth,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
  enableIndexedDbPersistence,
} from "firebase/firestore";

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

function createClient() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  if (!getApps().length) {
    app = initializeApp(config);
  } else {
    app = getApps()[0]!;
  }

  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  db = getFirestore(app);

  // Persistência IndexedDB apenas no browser
  if (typeof window !== "undefined") {
    enableIndexedDbPersistence(db).catch(() => {
      // pode falhar em múltiplas abas; é ok em dev
    });
  }

  return { app, auth, db };
}

export function getFirebaseClient() {
  if (!app || !auth || !db) {
    return createClient();
  }
  return { app, auth, db };
}
