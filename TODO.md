### Todo

- use better pdf extraction: https://github.com/opendataloader-project/opendataloader-pdf
	Alternative: https://github.com/landing-ai/ade-python
	- download audit. make it faster.

---


I'd like to



use `pdftotext -layout` with sqlite for keyword search: https://claude.ai/chat/f32de814-3a73-4951-96c2-2d3152d7de7d

just ask claude code to summarize each of the pdfs directly. it seems to have done a good job.

Then ask it to generate news...

https://github.com/datalab-to/marker
https://github.com/docling-project/docling?tab=readme-ov-file


document where things are in Cloudflare
Create an r2 upload manifest with links to the files.

document the process of
r2-upload
r2-download


---

- Lets make all-process faster. Are we running a background server to do this hybrid mode stuff? Lets make sure we only boot it up when we run the program and then we shut it down. I don't want it always running or get orphaned if the program is killed or errors.





- Lets create a plan to refactor this codebase. The way I think about it is (1) we download files from the organizations, we clean them up and organize them by date, and try to fix some obvious things. (2) we upload them to r2 so we can have an archive and keep track of that archive with upload.md (3) we process those pdfs into markdown files. That's the main system here. Eventually, we want better support for searching and summarizing, but that's something for later. The inventory.txt file is just something for me to figure out what files are added and removed since there's so many, but perhaps that isnt needed anymore. However, the upload.md file seems like it could be reused more generally. For example, if we were to delete all of the pdfs that we don't need anymore, then we shouldn't have to re-download them when running the download script. I believe the download script looks for files in the filesystem rather than using the manifest. Meanwhile, we need to figure out what pdfs haven't been translated into markdown files yet. Regardless. I just want to rethink how all of this works so that its well organized and has a cohesive architecture that is efficient, performant, and reliable.


---




- run the latest processing.

- better summarizing strategy

- use qmd instead of chroma

---

- automate downloads on a cron task somewhere.
- use an agent to review every run to check that things appear to have worked.


- SMUD has some image 175 that 500s for OpenAI.
- SCOE has the minutes for previous meetings in future meetings which garbles up the summaries.


Sometime, it might make sense to download committee meetings
- Bond oversight: https://www.forpd.org/agendacenter
- https://www.sanjuan.edu/connect/committees
- https://metrofire.ca.gov/finance-and-audit-committee
- https://metrofire.ca.gov/policyx-committee
- https://metrofire.ca.gov/executive-committee
- https://www.sjwd.org/committees
