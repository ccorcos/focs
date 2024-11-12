// https://losrios.edu/about-los-rios/board-of-trustees/board-agendas-and-minutes

import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

async function fetchHtml() {
  const response = await fetch(
    "https://losrios.edu/about-los-rios/board-of-trustees/board-agendas-and-minutes"
  );
  return response.text();
}

function parseMeetings(html: string): Array<BoardMeeting> {
  const $ = cheerio.load(html);
  const rows = $("table.table-wrap tbody tr");

  const result: BoardMeeting[] = [];

  const baseUrl = "https://losrios.edu/";
  rows.each((_, row) => {
    const date = $(row).find("td[data-th='Meeting Date']").text().trim();

    // Convert date from "June 12, 2013" to YYYY-MM-DD format
    const [month, day, year] = date.split(/[\s,]+/); // Split on whitespace and comma
    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    const formattedDate = `${year}-${monthNum
      .toString()
      .padStart(2, "0")}-${day.padStart(2, "0")}`;

    const links: string[] = [];

    // Parse all links within the row
    $(row)
      .find("a")
      .each((_, link) => {
        const href = $(link).attr("href");
        if (href) {
          links.push(baseUrl + href.trim());
        }
      });

    result.push({ folderName: formattedDate, links });
  });

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const directory = args[0];

  if (!directory) {
    console.error("Error: Missing required output directory argument");
    console.error("Usage: lrccd.ts <output-directory>");
    process.exit(1);
  }

  const html = await fetchHtml();

  const startYear = 2020;
  const meetings = parseMeetings(html).filter(
    (m) => parseInt(m.folderName.slice(0, 4)) >= startYear
  );
  // console.log(JSON.stringify(meetings, null, 2));

  await downloadFiles(meetings, directory);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
