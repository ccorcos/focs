import * as fs from "fs/promises";
import * as path from "path";
import pLimit from "p-limit";
import { readManifestKeys, r2KeyToLocal, r2KeyToUrl, MANIFEST_PATH } from "./utils/manifest";

const CONCURRENCY = 50;

async function main() {
  const orgFilter = process.argv[2]; // optional, e.g. "FORPD"

  console.log(`Reading ${MANIFEST_PATH}...`);
  const allKeys = await readManifestKeys();
  let keys = [...allKeys];
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
      await fs.stat(r2KeyToLocal(key));
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
          const url = r2KeyToUrl(key);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          const buffer = await res.arrayBuffer();

          const localPath = r2KeyToLocal(key);
          await fs.mkdir(path.dirname(localPath), { recursive: true });
          await fs.writeFile(localPath, Buffer.from(buffer));

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
