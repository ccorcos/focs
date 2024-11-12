// https://metrofire.ca.gov/board-meetings?lighthouse_scan=true&year=2024

import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

function parseBoardMeetings(html: string): BoardMeeting[] {
  const $ = cheerio.load(html);

  const baseUrl = "https://metrofire.ca.gov";

  const meetings: BoardMeeting[] = [];

  $(".poc-instance").each((_index, element) => {
    const date = $(element).find(".date time").attr("datetime")?.trim();
    if (!date) return;

    const links: string[] = [];

    $(element)
      .find(".attachments .attachment a")
      .each((_i, linkElement) => {
        const url = $(linkElement).attr("href") || "#";
        links.push(baseUrl + url);
      });

    meetings.push({ folderName: date, links });
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

  const startYear = 2020;
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - startYear + 1 },
    (_, i) => currentYear - i
  );
  const htmls = await Promise.all(
    years.map((year) =>
      fetch(
        `https://metrofire.ca.gov/board-meetings?lighthouse_scan=true&year=${year}`
      ).then((r) => r.text())
    )
  );

  const allMeetings = htmls.map((html) => parseBoardMeetings(html));
  const meetings = allMeetings.flat();

  // console.log(JSON.stringify(meetings, null, 2));
  // throw new Error("Stop here");

  await downloadFiles(meetings, dir);
}

main().catch(console.error);
