# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tools for the Fair Oaks Civic Society (FOCS) — downloads and processes board meeting documents from 8 Sacramento-area public organizations: FORPD, FOWD, SMUD, SMFD, SJUSD, LRCCD, SJWD, SCOE.

## Running Scripts

All orchestration scripts are in `src/` and run directly (shebangs, no npm scripts). TypeScript files run via `npx tsx`.

```sh
# Full pipeline
src/all-download        # Scrape & download meeting PDFs for all orgs
src/r2-upload           # Upload local PDFs to R2 and update focs.md manifest
src/all-process         # Convert PDFs to text (poppler) and HTML to markdown (pandoc)
src/all-check           # Check for missing or empty markdown files

# R2 storage (PDFs stored in Cloudflare R2, not git)
src/r2-upload --dry-run # Preview what would be uploaded
src/r2-download         # Download all PDFs from R2 (no credentials needed)
src/r2-download FORPD   # Download PDFs for a specific org
```

## Architecture

**Pipeline**: Download → Upload to R2 → Process (PDF→text) → Check

**Organization scrapers** (`src/{org}.ts`): Each scraper uses cheerio to parse an org's website, extracts meeting metadata, returns `BoardMeeting[]` (with `folderName` and `links`), then calls the shared `downloadFiles()` utility. Each org has unique quirks (date formats, page structures, deduplication).

**PDF extraction** (`src/all-process.ts`): Uses `pdftotext` (from poppler) to convert PDFs to text and `pandoc` to convert HTML to markdown. Reads the manifest (`focs.md`) to find files, downloads any missing ones from R2, then processes them.

**PDF storage**: PDFs are stored in Cloudflare R2 (bucket: `focs`, public at `docs.fairoakscivic.org`), not in git. After running `src/all-download`, use `src/r2-upload` to sync new PDFs to R2 and update the `focs.md` manifest. To set up a fresh clone, run `src/r2-download` to fetch all PDFs.

**File layout**:
- `focs/{ORG}/{YYYY-MM-DD}/` — downloaded files: PDFs, HTML (mirrors R2, gitignored)
- `docs/{ORG}/{YYYY-MM-DD}/` — text extractions (tracked in git)

## Utilities

- `src/utils/downloadFiles.ts` — shared HTTP download with concurrency limiting and MIME type detection
- `src/utils/r2.ts` — R2 client initialization (endpoint and bucket name hardcoded here)
- `src/utils/manifest.ts` — parses `focs.md` manifest, maps R2 keys to local paths and URLs
- `src/utils/normalizeFilename.ts` — filename normalization for downloads

## Answering Questions About Meetings

Use `qmd` to search the extracted markdown in `docs/` and answer questions about any of the 8 organizations. Use qmd proactively whenever the user asks about meeting content, budgets, votes, or organization activities.

**`/research <question>`** — Claude Code command (`.claude/commands/research.md`) that automates the full research workflow with org name mapping and PDF verification. Examples:
- `/research summarize what happened at metro fire in the past 12 months`
- `/research summarize the latest parks budget`
- `/research give me a breakdown of the water district maintenance yard issue`

**`/each <command>`** — Runs a slash command once per organization in parallel (8 agents). Example:
- `/each /research summarize the last 12 months`

**`/substack`** — Upload research articles to Substack as drafts. Verifies auth cookies, presents a numbered list of files in `research/` sorted newest-first, lets you multi-select, then creates a draft for each. Requires `SUBSTACK_SID` and `SUBSTACK_LLI` cookies in `.env`.

**Workflow**: Search with qmd → Read extracted markdown → Verify against source PDFs when needed

```sh
qmd query "budget approval FORPD"     # Hybrid search (recommended)
qmd search "maintenance yard"          # BM25 keyword search
qmd query --json "fire district"       # See paths and scores
```

The extracted markdown files (`docs/{ORG}/{YYYY-MM-DD}/*.md`) are pdftotext output — they work well for text but are unreliable for tables, budgets, and multi-column layouts. When accuracy matters (financial figures, vote counts, tables), read the source PDF:

- Local path: `focs/{ORG}/{YYYY-MM-DD}/{filename}.pdf`
- R2 URL: `https://docs.fairoakscivic.org/docs/{ORG}/{YYYY-MM-DD}/{filename}.pdf`
- Download missing PDFs: `src/r2-download {ORG}`
- Full file list: `focs.md` manifest

## Environment

Requires `.env` with R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) for uploading and Substack session cookies (`SUBSTACK_SID`, `SUBSTACK_LLI`) for draft creation. R2 endpoint and bucket name are hardcoded in `src/utils/r2.ts`. R2 credentials are not needed for downloading (public bucket). Node.js 22+, pdftotext (poppler), pandoc, qmd (`npm install -g @tobilu/qmd`).

## Setup

```sh
npm install                    # Install dependencies
npm install -g @tobilu/qmd     # Install qmd for document search
brew install poppler           # Install pdftotext
brew install pandoc            # Install pandoc (HTML→markdown)
qmd collection add docs docs/  # Index extracted markdown
qmd embed                      # Generate vector embeddings (optional, improves search)
src/r2-download                # Download PDFs from R2 (for verifying extractions)
```

## Known Issues

- SCOE minutes from previous meetings appear in future meeting packets
