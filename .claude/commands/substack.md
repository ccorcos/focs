Upload research articles to Substack as drafts.

The user's request is: $ARGUMENTS

## Instructions

1. **List research files** — Run `ls -1 research/ | sort -r` to see all available files.

2. **Match the user's request** — Based on what the user described, select the matching files. Show the user which files you picked and ask them to confirm before uploading.

3. **Upload confirmed files** — For each confirmed file, run:
   ```
   src/substack-upload research/<filename>
   ```
   Run uploads sequentially (not in parallel) to avoid rate limiting.

4. **Handle auth failures** — If an upload fails with a 403 or auth error, the Substack cookies have expired. Tell the user to refresh them:
   - Open https://focs.substack.com in your browser
   - Open DevTools → Application → Cookies → `focs.substack.com`
   - Copy the values of `substack.sid` and `substack.lli`
   - Update `SUBSTACK_SID` and `SUBSTACK_LLI` in the `.env` file
   - Then retry the upload

5. **Report results** — After all uploads complete, show a summary with each file and its draft edit URL.

## Notes

- The upload script extracts the title from the first `# heading` in each file
- Each draft is created as unpublished — the user reviews and publishes from Substack's editor
- If a non-auth error occurs, report it and continue with the remaining files
