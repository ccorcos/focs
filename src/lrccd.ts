// https://losrios.edu/about-los-rios/board-of-trustees/board-agendas-and-minutes

import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import path from "path";

async function fetchHtml() {
  const response = await fetch(
    "https://losrios.edu/about-los-rios/board-of-trustees/board-agendas-and-minutes"
  );
  return response.text();
}

type BoardMeeting = {
  date: string;
  links: string[];
};

function parseMeetings(html: string): Array<BoardMeeting> {
  const $ = cheerio.load(html);
  const rows = $("table.table-wrap tbody tr");

  const result: { date: string; links: string[] }[] = [];

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

    result.push({ date: formattedDate, links });
  });

  return result;
}

async function downloadMeetings(meetings: BoardMeeting[], dir: string) {
  // Calculate total number of links
  const totalLinks = meetings.reduce(
    (sum, meeting) => sum + meeting.links.length,
    0
  );
  let downloadedCount = 0;
  let errorCount = 0;

  // Process each meeting
  for (const meeting of meetings) {
    // Create directory for this meeting
    const meetingDir = path.join(dir, meeting.date);
    await fs.mkdir(meetingDir, { recursive: true });

    // Download each linked file
    for (let i = 0; i < meeting.links.length; i++) {
      const link = meeting.links[i];
      const filename = link.split("/").pop() || `file-${i + 1}`;

      // Check if file already exists
      const existingFiles = await fs.readdir(meetingDir);
      if (existingFiles.includes(filename)) {
        downloadedCount++;
        console.log(`(${downloadedCount}/${totalLinks}) Skipping ${link}`);
        continue;
      }

      let response;
      try {
        response = await fetch(link);
      } catch (error) {
        console.error(`Error downloading ${link}:`, error);
        errorCount++;
        continue;
      }
      const buffer = await response.arrayBuffer();

      try {
        const filepath = path.join(meetingDir, filename);
        await fs.writeFile(filepath, Buffer.from(buffer));
        downloadedCount++;
        console.log(`(${downloadedCount}/${totalLinks}) Downloaded ${link}`);
      } catch (error) {
        console.error(`Error writing file ${filename}:`, error);
        errorCount++;
      }
    }
  }

  if (errorCount > 0) {
    console.log(
      `\nCompleted with ${errorCount} error${errorCount === 1 ? "" : "s"}`
    );
  } else {
    console.log("\nCompleted successfully with no errors");
  }
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
    (m) => parseInt(m.date.slice(0, 4)) >= startYear
  );
  // console.log(JSON.stringify(meetings, null, 2));
  await downloadMeetings(meetings, directory);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
