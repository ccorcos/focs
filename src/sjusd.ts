import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

async function fetchHtml() {
  const response = await fetch(
    "https://sanjuan.granicus.com/ViewPublisher.php?view_id=1"
  );
  return response.text();
}

function parseMeetings(html: string): Array<BoardMeeting> {
  const $ = cheerio.load(html);
  const meetings: BoardMeeting[] = [];

  $("tr.listingRow").each((_i, row) => {
    const date = $(row)
      .find('td[headers^="Date"]')
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .replace(
        /(\w+) (\d+), (\d{4}) - (\d+):(\d+) (AM|PM)/,
        (_, month, day, year, hour, min, ampm) => {
          const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
          hour = parseInt(hour);
          if (ampm === "PM" && hour !== 12) hour += 12;
          if (ampm === "AM" && hour === 12) hour = 0;
          return (
            `${year}-${monthNum.toString().padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}T${hour.toString().padStart(2, "0")}:${min}:00` + "Z"
          );
        }
      );

    const agenda = $(row).find('a:contains("Agenda")').attr("href");
    const minutes = $(row).find('a:contains("Minutes")').attr("href");
    const video = $(row).find('a:contains("Video")').attr("onClick");
    const packet = $(row).find('a:contains("Agenda Packet")').attr("href");

    const links: { url: string; filename: string }[] = [];
    if (agenda) links.push({ url: `https:${agenda}`, filename: "agenda.pdf" });
    if (minutes)
      links.push({ url: `https:${minutes}`, filename: "minutes.pdf" });
    if (packet) links.push({ url: packet, filename: "agenda-packet.pdf" });

    const YYYYMMDD = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD format

    meetings.push({
      folderName: YYYYMMDD,
      links,
    });
  });

  return meetings;
}

async function main() {
  const args = process.argv.slice(2);
  const directory = args[0];

  if (!directory) {
    console.error("Error: Missing required output directory argument");
    console.error("Usage: sjusd.ts <output-directory>");
    process.exit(1);
  }

  const html = await fetchHtml();
  const meetings = parseMeetings(html);
  await downloadFiles(meetings, directory, true);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
