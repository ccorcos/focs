# Tools for the Fair Oaks Civic Society

https://platform.openai.com/usage
https://console.anthropic.com/settings/usage

## Setup

Requires Node.js 22+ and Java 11+.

```sh
npm install
```

Requires `.env` with `OPENAI_API_KEY` and `CLAUDE_API_KEY`.

For uploading PDFs to R2, also add `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. R2 credentials are not needed for downloading (public bucket).

## Download, Process, Summarize

```sh
src/all-download
src/all-inventory
src/r2-upload

src/all-process
src/all-inventory

src/all-summarize
src/all-inventory

src/all-gather

find docs/SCOE  -type f -name "summary.md" | sort | xargs cat
```

Inside `src/process` and `src/summarize-meetings` we filter for 2024 which we'll want to update periodically.

### PDF Storage (Cloudflare R2)

PDFs are stored in [Cloudflare R2](https://dash.cloudflare.com/8f543a54ad9a48c6984d00e7fbf0bc44/r2/default/buckets/focs) (bucket: `focs`, public at `docs.fairoakscivic.org`), not in git. The `upload.md` manifest tracks what's been uploaded.


```sh
# Upload new PDFs to R2 (requires R2 credentials in .env)
src/r2-upload
src/r2-upload --dry-run  # Preview what would be uploaded

# Download all PDFs from R2 (no credentials needed, public bucket)
src/r2-download
src/r2-download FORPD    # Download PDFs for a specific org
```

After running `src/all-download`, use `src/r2-upload` to sync new PDFs to R2. To set up a fresh clone, run `src/r2-download` to fetch all PDFs.

### RAG Answer

```sh
pipx install chromadb
chroma run

npx tsx src/embedding.ts docs/FOWD
npx tsx src/ask.ts docs/FOWD "How much did the district spend in 2024?
```

### Keyword Search

```sh
# List which files contain the keyword
find docs/FOWD -type f -name "*.md" | sort | xargs grep -Ril "corporate yard"

# List the files along with context where the keyword appears.
find docs/FOWD -type f -name "*.md" | sort | xargs grep -Rin --color=always -C 3 "corporate yard"
```

Or [search directly on Github](https://github.com/search?q=repo%3Accorcos%2Ffocs+path%3A%2F%5Edocs%5C%2FFOWD%5C%2F%2F+corporate+yard).

## Find incomplete summaries

Summaries should keep track of summarized files list so we can tell if they change.
Find all the most recent documents we've summarized and delete those summaries.
