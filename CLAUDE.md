# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tools for the Fair Oaks Civic Society (FOCS) — downloads, processes, and summarizes board meeting documents from 8 Sacramento-area public organizations: FORPD, FOWD, SMUD, SMFD, SJUSD, LRCCD, SJWD, SCOE.

## Running Scripts

All orchestration scripts are in `src/` and run directly (shebangs, no npm scripts). TypeScript files run via `npx tsx`.

```sh
# Full pipeline
src/all-download        # Scrape & download meeting PDFs for all orgs
src/all-process         # Convert PDFs to markdown via opendataloader-pdf
src/all-summarize       # AI-summarize meetings (3-pass: summarize → refine → format)
src/all-gather          # Concatenate summaries by date range into aggregate files
src/all-inventory       # Generate file manifest (inventory.txt)

# Single org/meeting
src/summarize-meetings <org>   # Summarize all meetings for one org
src/summarize <meeting-dir>    # Summarize a single meeting folder

# R2 storage (PDFs stored in Cloudflare R2, not git)
src/r2-upload           # Upload local PDFs to R2 (requires R2 credentials)
src/r2-upload --dry-run # Preview what would be uploaded
src/r2-download         # Download all PDFs from R2 (no credentials needed)
src/r2-download FORPD   # Download PDFs for a specific org

# RAG (requires chroma running: `chroma run`)
npx tsx src/embedding.ts docs/FOWD
npx tsx src/ask.ts docs/FOWD "query"
```

The `src/process` and `src/summarize-meetings` scripts contain date filters (e.g. `2024-06`) that need periodic updating to process newer meetings.

## Architecture

**Pipeline**: Download → Process (PDF→MD) → Summarize (AI) → Gather

**Organization scrapers** (`src/{org}.ts`): Each scraper uses cheerio to parse an org's website, extracts meeting metadata, returns `BoardMeeting[]` (with `folderName` and `links`), then calls the shared `downloadFiles()` utility. Each org has unique quirks (date formats, page structures, deduplication).

**PDF extraction**: Uses `@opendataloader/pdf` (npm) to convert PDFs to markdown with deterministic layout analysis.

**Summarization** (`src/gpt.ts`): Core AI engine shared by all summarization. Loads files, counts tokens with tiktoken, chunks to fit model context, and runs multi-step prompt refinement. Has retry logic with exponential backoff for rate limits. Currently uses Claude (`claude-3-5-sonnet`) with OpenAI (`gpt-4o-mini`) as alternative.

**Prompts** (`prompts/`): Three-pass summarization — `summarize.md` → `refine.md` → `format.md`.

**PDF storage**: PDFs are stored in Cloudflare R2 (bucket: `focs`, public at `docs.fairoakscivic.org`), not in git. After running `src/all-download`, use `src/r2-upload` to sync new PDFs to R2. To set up a fresh clone, run `src/r2-download` to fetch all PDFs.

**File layout**:
- `docs/{ORG}/{YYYY-MM-DD}/` — downloaded documents + generated `summary.md`
- PDFs exist locally but are gitignored; markdown, summaries, and HTML are tracked in git
- `chroma/` — vector DB storage for RAG

## Environment

Requires `.env` with `OPENAI_API_KEY`, `CLAUDE_API_KEY`, and R2 credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`) for uploading. R2 credentials are not needed for downloading (public bucket). Node.js 22+, Java 11+.

## Known Issues

- SCOE minutes from previous meetings appear in future meeting packets, garbling summaries
