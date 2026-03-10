import { getServerEnv } from "@/lib/env";

export async function triggerMonitoringDispatch() {
  const { dispatcherUrl, dispatcherSecret } = getServerEnv();
  if (!dispatcherUrl) {
    return;
  }

  const url = `${dispatcherUrl.replace(/\/$/, "")}/dispatch`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(dispatcherSecret ? { "x-mihari-secret": dispatcherSecret } : {})
      },
      body: "{}",
      cache: "no-store"
    });
  } catch (error) {
    console.error("Failed to trigger dispatch after site registration", error);
  }
}
