import { PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";
import * as fs from "fs/promises";
import pLimit from "p-limit";
import * as path from "path";
import { R2_BUCKET, getR2Client } from "./utils/r2";

const UPLOAD_CONCURRENCY = 200;
const MANIFEST_PATH = "upload.md";
const R2_PUBLIC_BASE = "https://docs.fairoakscivic.org";

async function findPdfs(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findPdfs(full)));
    } else if (entry.name.toLowerCase().endsWith(".pdf")) {
      results.push(full);
    }
  }
  return results.sort();
}

// Parse uploaded.md to get the set of already-uploaded keys
async function readManifest(): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const content = await fs.readFile(MANIFEST_PATH, "utf-8");
    // Each uploaded file appears as a markdown link: - [filename](url)
    // The key is encoded in the URL after the base
    for (const line of content.split("\n")) {
      const match = line.match(/^\- \[.*?\]\(.*?\/(docs\/.*?)\)$/);
      if (match) keys.add(decodeURIComponent(match[1]));
    }
  } catch {
    // No manifest yet
  }
  return keys;
}

// Build uploaded.md content from a set of keys
function buildManifest(keys: Set<string>): string {
  // Parse keys into { org, date, filename } and group by org then date
  type Entry = { org: string; date: string; filename: string; key: string };
  const entries: Entry[] = [];

  for (const key of keys) {
    // key format: docs/ORG/YYYY-MM-DD/filename.pdf
    const parts = key.split("/");
    if (parts.length >= 4) {
      entries.push({
        org: parts[1],
        date: parts[2],
        filename: parts.slice(3).join("/"),
        key,
      });
    }
  }

  entries.sort((a, b) =>
    a.org.localeCompare(b.org) || a.date.localeCompare(b.date) || a.filename.localeCompare(b.filename)
  );

  const lines: string[] = ["# Uploaded Documents", ""];

  let currentOrg = "";
  let currentDate = "";
  for (const entry of entries) {
    if (entry.org !== currentOrg) {
      if (currentOrg) lines.push(""); // blank line before new org
      currentOrg = entry.org;
      currentDate = "";
      lines.push(`## ${entry.org}`);
    }
    if (entry.date !== currentDate) {
      currentDate = entry.date;
      lines.push("", `**${entry.date}**`);
    }
    const url = `${R2_PUBLIC_BASE}/${encodeURIComponent(entry.key).replace(/%2F/g, "/")}`;
    lines.push(`- [${entry.filename}](${url})`);
  }

  lines.push("");
  return lines.join("\n");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--")) || "docs";

  const client = getR2Client();
  const bucket = R2_BUCKET;

  console.log(`Scanning ${dir} for PDFs...`);
  const files = await findPdfs(dir);
  console.log(`Found ${files.length} PDFs`);

  if (files.length === 0) return;

  // Read existing manifest to skip already-uploaded files
  const alreadyUploaded = await readManifest();
  console.log(`Manifest has ${alreadyUploaded.size} already-uploaded files`);

  // Build task list, skipping already-uploaded
  type UploadTask = { localPath: string; key: string; size: number };
  const tasks: UploadTask[] = [];

  for (const localPath of files) {
    if (alreadyUploaded.has(localPath)) continue;
    const stat = await fs.stat(localPath);
    tasks.push({ localPath, key: localPath, size: stat.size });
  }

  console.log(`${tasks.length} files to upload`);

  if (dryRun) {
    console.log("Dry run:");
    for (const t of tasks) console.log(`  ${t.key} (${formatSize(t.size)})`);
    return;
  }

  if (tasks.length === 0) {
    console.log("Everything is up to date");
  } else {
    let completed = 0;
    let errors = 0;
    const totalBytes = tasks.reduce((sum, t) => sum + t.size, 0);
    const startTime = Date.now();
    const limit = pLimit(UPLOAD_CONCURRENCY);

    // Serialize manifest writes so concurrent uploads don't clobber each other
    let writeChain = Promise.resolve();
    function queueManifestWrite() {
      writeChain = writeChain.then(() =>
        fs.writeFile(MANIFEST_PATH, buildManifest(alreadyUploaded))
      );
    }

    await Promise.all(
      tasks.map((task) =>
        limit(async () => {
          try {
            console.log(`uploading ${task.key} (${formatSize(task.size)})`);
            const body = await fs.readFile(task.localPath);
            await client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: task.key,
                Body: body,
                ContentType: "application/pdf",
              })
            );
            completed++;
            alreadyUploaded.add(task.key);
            queueManifestWrite();
            console.log(`complete (${completed}/${tasks.length}) ${task.key}`);
          } catch (err) {
            errors++;
            console.error(`error ${task.key}:`, err);
          }
        })
      )
    );

    // Wait for any pending manifest write to finish
    await writeChain;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const mb = (totalBytes / 1024 / 1024).toFixed(0);
    console.log(`\nUploaded ${completed} files (${mb} MB) in ${elapsed}s`);
    if (errors > 0) {
      console.log(`${errors} error${errors === 1 ? "" : "s"}`);
    }
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
