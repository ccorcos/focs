// https://metrofire.ca.gov/board-meetings?lighthouse_scan=true&year=2024

import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import path from "path";

interface BoardMeeting {
  date: string;
  links: string[];
}

function parseFireBoard(html: string): BoardMeeting[] {
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

    meetings.push({ date, links });
  });

  return meetings;
}

async function downloadMeetingFiles(meetings: BoardMeeting[], dir: string) {
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

  const allMeetings = htmls.map((html) => parseFireBoard(html));
  const meetings = allMeetings
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date));

  // Log meeting stats
  const totalMeetings = meetings.length;
  const totalLinks = meetings.reduce(
    (sum, meeting) => sum + meeting.links.length,
    0
  );
  const dateRange =
    meetings.length > 0
      ? `${meetings[0].date} to ${meetings[meetings.length - 1].date}`
      : "no meetings found";

  console.log(`Found ${totalMeetings} meetings from ${dateRange}`);
  console.log(`Total number of downloadable files: ${totalLinks}`);

  // console.log(JSON.stringify(meetings, null, 2));
  // throw new Error("Stop here");

  // Get directory from command line args
  const dir = process.argv[2];
  if (!dir) {
    console.error("Please provide an output directory");
    process.exit(1);
  }

  await downloadMeetingFiles(meetings, dir);
}

main().catch(console.error);
