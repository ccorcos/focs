import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

function parseBoardMeetings(html: string): BoardMeeting[] {
  const baseURL = "https://www.smud.org";
  const $ = cheerio.load(html);

  const meetings: BoardMeeting[] = [];

  // Find each table with a header row and process its meetings
  $(".table-header-row").each((_, headerRow) => {
    // Extract the month and year from this table's header
    const monthYear = $(headerRow).text().trim();
    const [month, year] = monthYear.split(" ");
    // console.log(month, year);

    // Find all board-mtg-date rows within this table
    $(headerRow)
      .closest("table")
      .find(".board-mtg-date")
      .each((_, element) => {
        const date = $(element).text().trim().replace(/\s+/g, " "); // Extract and clean date
        const day = date.replace(/[^0-9]/g, ""); // Extract just the numeric day

        // Format date as YYYY-MM-DD
        const monthNum = String(
          new Date(`${month.trim()} 1, 2000`).getMonth() + 1
        ).padStart(2, "0");
        const fullDate = `${year.trim()}-${monthNum}-${day.padStart(2, "0")}`;

        // Find title from strong tag if it exists
        const title = $(element)
          .next(".board-mtg-def")
          .find("p > strong")
          .first()
          .text()
          .trim();

        // Find all links in the next 'board-mtg-def' cell
        const links = $(element)
          .next(".board-mtg-def")
          .find("a")
          .map((_, link) => {
            const href = $(link).attr("href");
            if (!href) {
              // console.warn("Link element missing href:", $(link).html());
              return null;
            }
            return `${baseURL}${href}`;
          })
          .get()
          .filter(Boolean);

        // const folderName = fullDate + (title ? ` - ${title}` : "");
        meetings.push({ folderName: fullDate, links });
      });
  });

  return meetings;
}

function deduplicateMeetings(allMeetings: BoardMeeting[]): BoardMeeting[] {
  // First create a Record mapping dates to arrays of links
  const meetingMap = allMeetings.flat().reduce((acc, meeting) => {
    if (!acc[meeting.folderName]) {
      acc[meeting.folderName] = [];
    }
    // @ts-ignore
    acc[meeting.folderName] = [
      ...new Set([...acc[meeting.folderName], ...meeting.links]),
    ];
    return acc;
  }, {} as Record<string, string[]>);

  // Convert back to BoardMeeting array format
  return Object.entries(meetingMap).map(([date, links]) => ({
    folderName: date,
    links,
  }));
}

async function main() {
  // Get directory from command line args
  const dir = process.argv[2];
  if (!dir) {
    console.error("Please provide an output directory");
    process.exit(1);
  }

  const htmls = [
    await fetch(
      "https://www.smud.org/Corporate/About-us/Company-Information/Board-Meetings"
    ).then((r) => r.text()),
    await fetch(
      "https://www.smud.org/Corporate/About-us/Company-Information/Board-Meetings/Board-Meeting-Archive"
    ).then((r) => r.text()),
  ];

  const allMeetings = htmls.map((html) => parseBoardMeetings(html));
  const meetings = deduplicateMeetings(allMeetings.flat());
  // console.log(JSON.stringify(meetings, null, 2));
  // throw new Error("Stop here");

  await downloadFiles(meetings, dir);
}

main().catch(console.error);
