import * as fs from "fs/promises";
import * as path from "path";
import pLimit from "p-limit";

const R2_PUBLIC_BASE = "https://docs.fairoakscivic.org";
const MANIFEST_PATH = "upload.md";
const CONCURRENCY = 50;

// Parse upload.md to get list of keys (same format as r2-upload uses)
async function readManifest(): Promise<string[]> {
  const content = await fs.readFile(MANIFEST_PATH, "utf-8");
  const keys: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\- \[.*?\]\(.*?\/(docs\/.*?)\)$/);
    if (match) keys.push(decodeURIComponent(match[1]));
  }
  return keys;
}

async function main() {
  const orgFilter = process.argv[2]; // optional, e.g. "FORPD"

  console.log(`Reading ${MANIFEST_PATH}...`);
  let keys = await readManifest();
  console.log(`Found ${keys.length} files in manifest`);

  if (orgFilter) {
    keys = keys.filter((k) => k.startsWith(`docs/${orgFilter}/`));
    console.log(`Filtered to ${keys.length} files for ${orgFilter}`);
  }

  // Check which files need downloading
  const tasks: string[] = [];
  let skipped = 0;

  for (const key of keys) {
    try {
      await fs.stat(key);
      skipped++;
    } catch {
      tasks.push(key);
    }
  }

  console.log(`Skipped ${skipped} existing files`);
  console.log(`${tasks.length} files to download`);

  if (tasks.length === 0) {
    console.log("Everything is up to date");
    return;
  }

  let completed = 0;
  let errors = 0;
  const startTime = Date.now();
  const limit = pLimit(CONCURRENCY);

  await Promise.all(
    tasks.map((key) =>
      limit(async () => {
        try {
          const url = `${R2_PUBLIC_BASE}/${key}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const buffer = await res.arrayBuffer();

          await fs.mkdir(path.dirname(key), { recursive: true });
          await fs.writeFile(key, Buffer.from(buffer));

          completed++;
          if (completed % 50 === 0 || completed === tasks.length) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = completed / elapsed;
            const eta = Math.round((tasks.length - completed) / rate);
            console.log(
              `(${completed}/${tasks.length}) ${rate.toFixed(1)} files/s, ETA ${eta}s`
            );
          }
        } catch (err) {
          errors++;
          console.error(`Error downloading ${key}:`, err);
        }
      })
    )
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (errors > 0) {
    console.log(`\nCompleted in ${elapsed}s with ${errors} error${errors === 1 ? "" : "s"}`);
  } else {
    console.log(`\nAll ${completed} files downloaded in ${elapsed}s`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
