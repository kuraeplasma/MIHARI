import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, GoogleAuthProvider, getAuth } from "firebase/auth";

const AUTH_CONFIG_MISSING_PREFIX = "AUTH_CONFIG_MISSING";

const rawFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim()
};

const firebaseConfig = {
  apiKey: rawFirebaseConfig.apiKey,
  // Firebase Auth can use the default project domain when explicit authDomain is omitted.
  authDomain: rawFirebaseConfig.authDomain || (rawFirebaseConfig.projectId ? `${rawFirebaseConfig.projectId}.firebaseapp.com` : undefined),
  projectId: rawFirebaseConfig.projectId,
  appId: rawFirebaseConfig.appId,
  messagingSenderId: rawFirebaseConfig.messagingSenderId
};

let cached:
  | {
    app: FirebaseApp;
    auth: Auth;
    googleProvider: GoogleAuthProvider;
  }
  | null = null;

function getMissingRequiredFirebaseConfigKeys() {
  const missing: string[] = [];
  if (!rawFirebaseConfig.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!rawFirebaseConfig.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  return missing;
}

export function extractMissingAuthConfigKeys(message: string) {
  if (!message.startsWith(AUTH_CONFIG_MISSING_PREFIX)) return [];
  const payload = message.slice(AUTH_CONFIG_MISSING_PREFIX.length).replace(/^:/, "");
  if (!payload) return [];
  return payload.split(",").map(part => part.trim()).filter(Boolean);
}

export function getFirebaseClient() {
  if (cached) {
    return cached;
  }

  const missingRequiredKeys = getMissingRequiredFirebaseConfigKeys();
  if (missingRequiredKeys.length > 0) {
    console.warn("Firebase configuration is missing. Dashboard authentication will not function.", {
      missingRequiredKeys
    });
    throw new Error(`${AUTH_CONFIG_MISSING_PREFIX}:${missingRequiredKeys.join(",")}`);
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();

  cached = {
    app,
    auth,
    googleProvider
  };
  return cached;
}
