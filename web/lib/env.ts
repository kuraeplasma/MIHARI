export function getServerEnv() {
  return {
    projectId: (process.env.FIREBASE_PROJECT_ID ?? "").trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL ?? "").trim(),
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").trim().replace(/\\n/g, "\n"),
    dispatcherUrl: (process.env.MONITOR_DISPATCHER_URL ?? "").trim(),
    dispatcherSecret: (process.env.MONITOR_DISPATCHER_SECRET ?? "").trim()
  };
}
