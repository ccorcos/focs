import { PutObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";
import * as fs from "fs/promises";
import pLimit from "p-limit";
import * as path from "path";
import { MANIFEST_PATH, buildManifest, localToR2Key, readManifestKeys } from "./utils/manifest";
import { R2_BUCKET, getR2Client } from "./utils/r2";

const UPLOAD_CONCURRENCY = 200;

async function findFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findFiles(full)));
    } else if (!entry.name.startsWith(".")) {
      results.push(full);
    }
  }
  return results.sort();
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".html") return "text/html";
  return "application/octet-stream";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--")) || "focs";

  const client = getR2Client();
  const bucket = R2_BUCKET;

  console.log(`Scanning ${dir} for files...`);
  const files = await findFiles(dir);
  console.log(`Found ${files.length} files`);

  if (files.length === 0) return;

  // Read existing manifest to skip already-uploaded files
  const alreadyUploaded = await readManifestKeys();
  console.log(`Manifest has ${alreadyUploaded.size} already-uploaded files`);

  // Build task list, skipping already-uploaded
  type UploadTask = { localPath: string; key: string; size: number };
  const tasks: UploadTask[] = [];

  for (const localPath of files) {
    const key = localToR2Key(localPath);
    if (alreadyUploaded.has(key)) continue;
    const stat = await fs.stat(localPath);
    tasks.push({ localPath, key, size: stat.size });
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
                ContentType: contentType(task.localPath),
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
