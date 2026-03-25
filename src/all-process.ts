import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import pLimit from "p-limit";
import { promisify } from "util";
import { MANIFEST_PATH, r2KeyToLocal, r2KeyToUrl, readManifestKeys } from "./utils/manifest";

const execFileAsync = promisify(execFile);
const DOWNLOAD_CONCURRENCY = 50;
const PROCESS_CONCURRENCY = 8;

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

// Check pdftotext is available
async function checkPdftotext(): Promise<void> {
  try {
    await execFileAsync("pdftotext", ["-v"]);
  } catch (err: any) {
    // pdftotext -v exits with 0 on some versions and non-zero on others,
    // but it prints version info to stderr either way
    if (err.code === "ENOENT") {
      console.error("pdftotext not found. Install with: brew install poppler");
      process.exit(1);
    }
  }
}

type Task = {
  r2Key: string;
  localPath: string; // focs/ORG/date/file
  docsPath: string; // docs/ORG/date/file (for HTML) or docs/ORG/date/file.md (for PDF)
  type: "pdf" | "html";
  needsDownload: boolean;
};

async function main() {
  const orgFilter = process.argv[2]; // optional, e.g. "FORPD"

  await checkPdftotext();

  console.log(`Reading ${MANIFEST_PATH}...`);
  const allKeys = await readManifestKeys();
  let keys = [...allKeys];
  console.log(`Found ${keys.length} files in manifest`);

  if (orgFilter) {
    keys = keys.filter((k) => k.startsWith(`docs/${orgFilter}/`));
    console.log(`Filtered to ${keys.length} files for ${orgFilter}`);
  }

  // Build task list: figure out what needs processing
  const tasks: Task[] = [];
  let skipped = 0;

  for (const key of keys) {
    const ext = path.extname(key).toLowerCase();
    const localPath = r2KeyToLocal(key);

    if (ext === ".pdf") {
      // docs/ORG/date/file.pdf → docs/ORG/date/file.md
      const docsPath = key.replace(/\.pdf$/i, ".md");
      if (await fileExists(docsPath)) {
        skipped++;
        continue;
      }
      tasks.push({
        r2Key: key,
        localPath,
        docsPath,
        type: "pdf",
        needsDownload: !(await fileExists(localPath)),
      });
    } else if (ext === ".html") {
      // docs/ORG/date/file.html → docs/ORG/date/file.html (just copy)
      const docsPath = key; // key is already docs/ORG/date/file.html
      if (await fileExists(docsPath)) {
        skipped++;
        continue;
      }
      tasks.push({
        r2Key: key,
        localPath,
        docsPath,
        type: "html",
        needsDownload: !(await fileExists(localPath)),
      });
    }
    // Skip other file types (e.g. .PDF attachments with non-standard names)
  }

  const toDownload = tasks.filter((t) => t.needsDownload);
  const pdfs = tasks.filter((t) => t.type === "pdf");
  const htmls = tasks.filter((t) => t.type === "html");

  console.log(`${skipped} already processed, ${tasks.length} to process`);
  console.log(`  ${pdfs.length} PDFs, ${htmls.length} HTMLs`);
  if (toDownload.length > 0) {
    console.log(`  ${toDownload.length} need downloading from R2 first`);
  }

  if (tasks.length === 0) {
    console.log("Everything is up to date");
    return;
  }

  // Phase 1: Download missing files from R2
  if (toDownload.length > 0) {
    console.log(`\nDownloading ${toDownload.length} files from R2...`);
    let completed = 0;
    let errors = 0;
    const limit = pLimit(DOWNLOAD_CONCURRENCY);

    await Promise.all(
      toDownload.map((task) =>
        limit(async () => {
          try {
            const url = r2KeyToUrl(task.r2Key);
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const buffer = await res.arrayBuffer();

            await fs.mkdir(path.dirname(task.localPath), { recursive: true });
            await fs.writeFile(task.localPath, Buffer.from(buffer));

            completed++;
            if (completed % 50 === 0 || completed === toDownload.length) {
              console.log(`  downloaded ${completed}/${toDownload.length}`);
            }
          } catch (err) {
            errors++;
            console.error(`  error downloading ${task.r2Key}:`, err);
          }
        })
      )
    );

    if (errors > 0) {
      console.log(`  ${errors} download error(s)`);
    }
  }

  // Phase 2: Process files
  console.log(`\nProcessing ${tasks.length} files...`);
  let completed = 0;
  let errors = 0;
  const startTime = Date.now();
  const limit = pLimit(PROCESS_CONCURRENCY);

  await Promise.all(
    tasks.map((task) =>
      limit(async () => {
        try {
          await fs.mkdir(path.dirname(task.docsPath), { recursive: true });

          if (task.type === "pdf") {
            await execFileAsync("pdftotext", ["-layout", task.localPath, task.docsPath]);
          } else {
            // HTML: just copy
            await fs.copyFile(task.localPath, task.docsPath);
          }

          completed++;
          if (completed % 50 === 0 || completed === tasks.length) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`  processed ${completed}/${tasks.length} in ${elapsed}s`);
          }
        } catch (err) {
          errors++;
          console.error(`  error processing ${task.localPath}:`, err);
        }
      })
    )
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone: ${completed} files processed in ${elapsed}s`);
  if (errors > 0) {
    console.log(`${errors} error(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
