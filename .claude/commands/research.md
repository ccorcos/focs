Research a topic across FOCS meeting documents and provide a thorough answer. Always save the research output to a file.

The user's question is: $ARGUMENTS

## Workflow

1. **Search with qmd** — Run multiple searches with different terms to get comprehensive coverage. Try org abbreviations, informal names, topic keywords, and related terms.

2. **Read the extracted markdown** — Files in `docs/{ORG}/{YYYY-MM-DD}/` are pdftotext output. Good for text, unreliable for tables and multi-column layouts.

3. **Verify against source PDFs when accuracy matters** — For financial figures, vote counts, or tables:
   - Local: `focs/{ORG}/{YYYY-MM-DD}/{filename}.pdf`
   - R2: `https://docs.fairoakscivic.org/docs/{ORG}/{YYYY-MM-DD}/{filename}.pdf`
   - Download: `src/r2-download {ORG}`
   - Manifest: `focs.md`

4. **Synthesize** — Reference specific meetings by date and org. Prefer data verified against source PDFs.

5. **Save to file** — After completing your research, write the full output to `research/YYYY-MM-DD-HHMM-<description>.md` where:
   - `YYYY-MM-DD-HHMM` is the current date and time (24h format)
   - `<description>` is a short kebab-case slug summarizing the topic (e.g., `metro-fire-summary`, `parks-budget`, `water-district-maintenance-yard`)
   - The file must start with a header block describing what was researched:
     ```
     # <Brief title of research topic>

     **Question:** <A natural-language summary of what was asked — doesn't need to be verbatim, just capture the intent>
     **Date:** YYYY-MM-DD
     **Organizations:** <list of orgs covered>

     ---

     <research content>
     ```

## Organization names

| Abbrev | Full Name | Informal |
|---|---|---|
| FORPD | Fair Oaks Recreation and Park District | parks, park district |
| FOWD | Fair Oaks Water District | water district (Fair Oaks) |
| SMUD | Sacramento Municipal Utility District | SMUD |
| SMFD | Sacramento Metropolitan Fire District | metro fire, fire district |
| SJUSD | San Juan Unified School District | school district |
| LRCCD | Los Rios Community College District | Los Rios |
| SJWD | San Juan Water District | water district (San Juan) |
| SCOE | Sacramento County Office of Education | county education |

If "water district" is ambiguous, check both FOWD and SJWD.

## Tips

- Meeting folders are `YYYY-MM-DD` dated
- For time-range questions, list the org's meeting folders to identify which dates fall in range
- For budgets, search for "budget", "financial", "fiscal" in filenames and content
