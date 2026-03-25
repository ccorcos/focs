### Todo

- use better pdf extraction: https://github.com/opendataloader-project/opendataloader-pdf
	Alternative: https://github.com/landing-ai/ade-python
	- download audit. make it faster.

---


---

Lets create a plan to refactor this codebase. The way I think about it is:

(1) we download files from the organizations into focs directory, we clean them up and organize them by date, and try to fix some obvious things.

(2) we upload them to r2 so we can have an archive and keep track of that archive with focs.md

(3) we process those pdfs into markdown files in the docs directory. For now, lets just use `pdftotext -layout` so that its fast and simple. And lets get rid of the old system that uses the expensive api for doing this.

That's that foundational layer of the system. It needs to be simple, reliable, efficient and fast. We should parallelize work, and we should be able to stop and restart work without having to start all the way over.

Lets get rid of `src/all-inventory` and inventory.txt. We don't need that. These three steps are just three different programs:

1. src/all-download
2. src/r2-upload
3. src/all-process

I want all of this to work more cohesively together. I don't want to have to download every file locally in order to process a few new files. We should detect: has the file been processed? has it been uploaded? should we download it from r2 or from the web?


---

lets use github.com/tobi/qmd for searching throught the extracted markdown. Create a claude skill or using qmd to help you find answers to questions. lets get rid of the old chroma stuff.

---

clean up any code that is unused. I think prompts dir are ununsed right?

---


- download
- upload
- process

- summarize the past year
- summarize an issue
- summarize a budget


---



- automate downloads on a cron task somewhere.
- use an agent to review every run to check that things appear to have worked.




Sometime, it might make sense to download committee meetings
- Bond oversight: https://www.forpd.org/agendacenter
- https://www.sanjuan.edu/connect/committees
- https://metrofire.ca.gov/finance-and-audit-committee
- https://metrofire.ca.gov/policyx-committee
- https://metrofire.ca.gov/executive-committee
- https://www.sjwd.org/committees
