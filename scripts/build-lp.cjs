const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, "dist", "lp");

const files = [
  "index.html",
  "privacy.html",
  "terms.html",
  "law.html",
  "company.html",
  "mihari.html",
  "favicon.png",
  "apple-touch-icon.png",
  "ogp_image.png",
  "social_icon.png",
  "logo_transparent.png",
  "simple_loss_staff.png",
  "simple_loss_bugs.png",
  "simple_loss_form.png",
  "simple_loss_speed.png",
  "simple_concept.png"
];

const directories = ["css"];

function ensureCleanDirectory(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileRelative(relativePath) {
  const src = path.join(root, relativePath);
  if (!fs.existsSync(src)) {
    throw new Error(`Required file not found: ${relativePath}`);
  }
  const dest = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDirectoryRelative(relativePath) {
  const src = path.join(root, relativePath);
  if (!fs.existsSync(src)) {
    throw new Error(`Required directory not found: ${relativePath}`);
  }
  const dest = path.join(outDir, relativePath);
  fs.cpSync(src, dest, { recursive: true });
}

function writeRedirects() {
  const redirects = [
    "/privacy   /privacy.html   200",
    "/terms     /terms.html     200",
    "/law       /law.html       200",
    "/company   /company.html   200",
    "/mihari    /mihari.html    200"
  ].join("\n");

  fs.writeFileSync(path.join(outDir, "_redirects"), `${redirects}\n`, "utf8");
}

function main() {
  ensureCleanDirectory(outDir);

  for (const relativePath of files) {
    copyFileRelative(relativePath);
  }

  for (const relativePath of directories) {
    copyDirectoryRelative(relativePath);
  }

  writeRedirects();
  console.log(`LP build output: ${outDir}`);
}

main();