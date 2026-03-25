import * as fs from "fs/promises";
import * as path from "path";
import { readManifestKeys } from "./utils/manifest";

async function main() {
  const keys = await readManifestKeys();
  let missing = 0;
  let empty = 0;
  let ok = 0;

  for (const key of keys) {
    const ext = path.extname(key).toLowerCase();
    let checkPath: string;

    if (ext === ".pdf") {
      checkPath = key.replace(/\.pdf$/i, ".md");
    } else if (ext === ".html") {
      checkPath = key;
    } else {
      continue;
    }

    try {
      const stat = await fs.stat(checkPath);
      if (stat.size === 0) {
        console.log(`Empty:   ${checkPath}`);
        empty++;
      } else {
        ok++;
      }
    } catch {
      console.log(`Missing: ${checkPath}`);
      missing++;
    }
  }

  console.log(`\n${ok} ok, ${missing} missing, ${empty} empty`);
  if (missing > 0 || empty > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
