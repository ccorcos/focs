import * as fs from "fs/promises";
import { R2_PUBLIC_BASE } from "./r2";

export const MANIFEST_PATH = "focs.md";

// Parse focs.md → set of R2 keys (e.g. "docs/FORPD/2024-01-17/file.pdf")
export async function readManifestKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const content = await fs.readFile(MANIFEST_PATH, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\- \[.*?\]\(.*?\/(docs\/.*?)\)$/);
      if (match) keys.add(decodeURIComponent(match[1]));
    }
  } catch {
    // No manifest yet
  }
  return keys;
}

// Generate focs.md content from a set of R2 keys, grouped by org/date
export function buildManifest(keys: Set<string>): string {
  type Entry = { org: string; date: string; filename: string; key: string };
  const entries: Entry[] = [];

  for (const key of keys) {
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

  entries.sort(
    (a, b) =>
      a.org.localeCompare(b.org) ||
      a.date.localeCompare(b.date) ||
      a.filename.localeCompare(b.filename)
  );

  const lines: string[] = ["# Uploaded Documents", ""];
  let currentOrg = "";
  let currentDate = "";

  for (const entry of entries) {
    if (entry.org !== currentOrg) {
      if (currentOrg) lines.push("");
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

// docs/ORG/date/file → focs/ORG/date/file
export function r2KeyToLocal(key: string): string {
  return key.replace(/^docs\//, "focs/");
}

// focs/ORG/date/file → docs/ORG/date/file
export function localToR2Key(localPath: string): string {
  return localPath.replace(/^focs\//, "docs/");
}

// R2 key → public download URL
export function r2KeyToUrl(key: string): string {
  return `${R2_PUBLIC_BASE}/${key}`;
}
