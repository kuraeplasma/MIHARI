export function getServerEnv() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    dispatcherUrl: process.env.MONITOR_DISPATCHER_URL ?? "",
    dispatcherSecret: process.env.MONITOR_DISPATCHER_SECRET ?? ""
  };
}
