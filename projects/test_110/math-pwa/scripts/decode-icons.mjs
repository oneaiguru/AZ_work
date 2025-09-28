import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, "../public/icons");

const iconFiles = [
  { source: "icon-192.base64", target: "icon-192.png" },
  { source: "icon-512.base64", target: "icon-512.png" },
];

function sanitize(content) {
  return content.replace(/\s+/g, "");
}

async function decodeIcon({ source, target }) {
  const sourcePath = path.join(iconsDir, source);
  const targetPath = path.join(iconsDir, target);
  const base64 = await fs.readFile(sourcePath, "utf8");
  const buffer = Buffer.from(sanitize(base64), "base64");
  await fs.writeFile(targetPath, buffer);
}

async function main() {
  await Promise.all(iconFiles.map(decodeIcon));
}

main().catch((error) => {
  console.error("Failed to decode icons:", error);
  process.exit(1);
});
