# Tools for the Fair Oaks Civic Society

Downloads and processes board meeting documents from 8 Sacramento-area public organizations: FORPD, FOWD, SMUD, SMFD, SJUSD, LRCCD, SJWD, SCOE.

## Setup

Requires Node.js 22+ and `pdftotext` (via poppler).

```sh
npm install
brew install poppler
```

For uploading PDFs to R2, create a `.env` with `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. R2 credentials are not needed for downloading (public bucket).

## Pipeline

```sh
# 1. Scrape & download meeting PDFs for all orgs
src/all-download

# 2. Upload new PDFs to R2
src/r2-upload

# 3. Convert PDFs to text (uses pdftotext)
src/all-process

# 4. Check for missing or empty markdown files
src/all-check
```

### PDF Storage (Cloudflare R2)

PDFs are stored in [Cloudflare R2](https://dash.cloudflare.com/8f543a54ad9a48c6984d00e7fbf0bc44/r2/default/buckets/focs) (bucket: `focs`, public at `docs.fairoakscivic.org`), not in git. The `focs.md` manifest tracks what's been uploaded. The local `focs/` directory mirrors R2 and is gitignored.

```sh
# Upload new PDFs to R2 (requires R2 credentials in .env)
src/r2-upload
src/r2-upload --dry-run  # Preview what would be uploaded

# Download all PDFs from R2 (no credentials needed, public bucket)
src/r2-download
src/r2-download FORPD    # Download PDFs for a specific org
```

After running `src/all-download`, use `src/r2-upload` to sync new PDFs to R2. To set up a fresh clone, run `src/r2-download` to fetch all PDFs.

### Keyword Search

```sh
# List which files contain the keyword
find docs/FOWD -type f -name "*.md" | sort | xargs grep -Ril "corporate yard"

# List the files along with context where the keyword appears
find docs/FOWD -type f -name "*.md" | sort | xargs grep -Rin --color=always -C 3 "corporate yard"
```

Or [search directly on Github](https://github.com/search?q=repo%3Accorcos%2Ffocs+path%3A%2F%5Edocs%5C%2FFOWD%5C%2F%2F+corporate+yard).
