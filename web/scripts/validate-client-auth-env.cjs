const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd());

const requiredVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
];

const optionalVars = [
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
];

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

const missingRequired = requiredVars.filter((name) => isBlank(process.env[name]));

if (missingRequired.length > 0) {
  console.error("[env-check] Missing required Firebase client env vars:");
  for (const key of missingRequired) {
    console.error(`- ${key}`);
  }
  console.error("[env-check] Configure them in Vercel Project Settings > Environment Variables, then redeploy.");
  process.exit(1);
}

const missingOptional = optionalVars.filter((name) => isBlank(process.env[name]));
if (missingOptional.length > 0) {
  console.warn("[env-check] Optional Firebase env vars are missing (auth can still work):");
  for (const key of missingOptional) {
    console.warn(`- ${key}`);
  }
}
