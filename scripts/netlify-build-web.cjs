const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");

const command = existsSync("web/package.json") ? "npm --prefix web run build" : "npm run build";
execSync(command, { stdio: "inherit" });
