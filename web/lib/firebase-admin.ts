import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) {
    return cachedApp;
  }

  const existing = getApps()[0];
  if (existing) {
    cachedApp = existing;
    return existing;
  }

  const env = getServerEnv();
  if (env.projectId && env.clientEmail && env.privateKey) {
    cachedApp = initializeApp({
      credential: cert({
        projectId: env.projectId,
        clientEmail: env.clientEmail,
        privateKey: env.privateKey
      })
    });
    return cachedApp;
  }

  cachedApp = initializeApp();
  return cachedApp;
}

export const adminAuth = getAuth(getAdminApp());
export const adminDb = getFirestore(getAdminApp());
