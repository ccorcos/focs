import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

function parseBoardMeetings(html: string): BoardMeeting[] {
  const $ = cheerio.load(html);

  const baseUrl = "https://www.forpd.org";
  const meetings: BoardMeeting[] = [];

  $("a[href*='/AgendaCenter/ViewFile/Agenda/']").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href?.includes("packet=true")) return;

    // Extract date from filename pattern _MMDDYYYY-NNN
    const match = href.match(/_(\d{2})(\d{2})(\d{4})-(\d+)/);
    if (!match) return;

    const [, month, day, year, n] = match;
    const folderName = `${year}-${month}-${day}`;
    const url = baseUrl + href;

    meetings.push({
      folderName,
      links: [{ url, filename: `${folderName}_${n}.pdf` }],
    });
  });

  return meetings;
}

async function main() {
  // Get directory from command line args
  const dir = process.argv[2];
  if (!dir) {
    console.error("Please provide an output directory");
    process.exit(1);
  }

  const html = await fetch("https://www.forpd.org/agendacenter").then((r) =>
    r.text()
  );
  const meetings = parseBoardMeetings(html);

  await downloadFiles(meetings, dir);
}

main().catch(console.error);
