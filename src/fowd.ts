// https://www.fowd.com/board-meetings?year=2024

import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

function parseBoardMeetings(html: string): BoardMeeting[] {
  const $ = cheerio.load(html);

  const baseUrl = "https://www.fowd.com";

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

    // https://www.fowd.com/files/e841cc625/04-15-2024+FOWD+Board+Meeting+Regular+Agenda+TRG.pdf
    // https://www.fowd.com/files/c80ef297a/04-15-24+Regular+Board+Meeting+Minutes.pdf
    // https://www.fowd.com/files/0bd6602f0/04-15-2024+FOWD+Regular+Board+Meeting+Packet.pdf

    if (!links.some((link) => link.endsWith("Packet.pdf"))) {
      console.warn(`Missing packet for ${date}`);
    }
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

  const startYear = 2018;
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - startYear + 1 },
    (_, i) => currentYear - i
  );
  const htmls = await Promise.all(
    years.map((year) =>
      fetch(`https://www.fowd.com/board-meetings?year=${year}`).then((r) =>
        r.text()
      )
    )
  );

  const allMeetings = htmls.map((html) => parseBoardMeetings(html));
  const meetings = allMeetings.flat();

  // console.log(JSON.stringify(meetings, null, 2));
  // throw new Error("Stop here");

  await downloadFiles(meetings, dir);
}

main().catch(console.error);
