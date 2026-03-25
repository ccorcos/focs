// https://losrios.edu/about-los-rios/board-of-trustees/board-of-trustees-agendas-and-minutes

import * as cheerio from "cheerio";
import { BoardMeeting, downloadFiles } from "./utils/downloadFiles";

async function fetchHtml() {
  const response = await fetch(
    "https://losrios.edu/about-los-rios/board-of-trustees/board-of-trustees-agendas-and-minutes"
  );
  return response.text();
}

// Parse date like "March 11, 2026" or "February 27 and 28, 2026" → "2026-03-11"
// For multi-day, uses the first day.
function parseDate(dateStr: string): string | null {
  const match = dateStr.match(
    /(\w+)\s+(\d{1,2})(?:\s+and\s+\d{1,2})?,?\s+(\d{4})/
  );
  if (!match) return null;
  const [, month, day, year] = match;
  const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
  return `${year}-${monthNum.toString().padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Also handle cross-month: "February 28 and March 1, 2025" → "2025-02-28"
function parseDateCrossMonth(dateStr: string): string | null {
  const match = dateStr.match(/(\w+)\s+(\d{1,2})\s+and\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) return null;
  const [, month, day, , , year] = match;
  const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
  return `${year}-${monthNum.toString().padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseMeetings(html: string): Array<BoardMeeting> {
  const $ = cheerio.load(html);
  const result: BoardMeeting[] = [];
  const baseUrl = "https://losrios.edu/";

  $("table.table-wrap").each((_, table) => {
    $(table)
      .find("tr")
      .slice(1) // skip header row
      .each((_, row) => {
        // Date is either in a <th> (2025-2026 tables) or <td data-th="Meeting Date"> (older)
        const thText = $(row).find("th").first().text().trim();
        const tdText = $(row)
          .find("td[data-th='Meeting Date']")
          .text()
          .trim();
        const dateStr = thText || tdText;
        if (!dateStr) return;

        const formattedDate =
          parseDateCrossMonth(dateStr) || parseDate(dateStr);
        if (!formattedDate) return;

        const links: string[] = [];
        $(row)
          .find("a")
          .each((_, link) => {
            const href = $(link).attr("href");
            if (href) {
              links.push(baseUrl + href.trim());
            }
          });

        if (links.length > 0) {
          result.push({ folderName: formattedDate, links });
        }
      });
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
