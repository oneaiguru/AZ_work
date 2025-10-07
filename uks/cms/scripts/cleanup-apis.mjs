import { readdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src", "api");
const allowList = new Set([
  "document",
  "news-article",
  "page",
  "procurement",
  "project",
]);

async function cleanup() {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const removals = entries
      .filter((entry) => entry.isDirectory() && !allowList.has(entry.name))
      .map(async (entry) => {
        const target = resolve(root, entry.name);
        try {
          const meta = await stat(target);
          if (meta.isDirectory()) {
            await rm(target, { recursive: true, force: true });
            console.info(`Removed orphaned API directory: ${entry.name}`);
          }
        } catch (error) {
          console.warn(`Failed to remove ${entry.name}:`, error);
        }
      });

    await Promise.all(removals);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    console.warn("Unable to inspect Strapi API directories:", error);
  }
}

cleanup();
