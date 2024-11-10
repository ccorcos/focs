import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import mime from "mime-types";
import path from "path";

interface BoardMeeting {
  date: string;
  links: string[];
}

function parseSMUDBoard(html: string): BoardMeeting[] {
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

        meetings.push({ date: fullDate, links });
      });
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

      // Get filename from URL and replace .ashx with proper extension
      let filename = link.split("/").pop() || `file-${i + 1}`;

      // Strip extensions from both URL filename and local files for comparison
      const filenameBase = filename.replace(/\.[^/.]+$/, "");
      const existingFiles = await fs.readdir(meetingDir);
      const fileExists = existingFiles.some(
        (file) => file.replace(/\.[^/.]+$/, "") === filenameBase
      );

      if (fileExists) {
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

      // Get content-type header and map to file extension using mime-types
      const contentType = response.headers.get("content-type");
      if (filename.endsWith(".ashx")) {
        const mimeType = contentType?.split(";")[0]; // Get clean mime type
        if (mimeType) {
          const extension = mime.extension(mimeType);
          if (extension) {
            filename = filename.replace(".ashx", `.${extension}`);
          }
        }
      }

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

function deduplicateMeetings(allMeetings: BoardMeeting[]): BoardMeeting[] {
  // First create a Record mapping dates to arrays of links
  const meetingMap = allMeetings.flat().reduce((acc, meeting) => {
    if (!acc[meeting.date]) {
      acc[meeting.date] = [];
    }
    acc[meeting.date] = [...new Set([...acc[meeting.date], ...meeting.links])];
    return acc;
  }, {} as Record<string, string[]>);

  // Convert back to BoardMeeting array format
  return Object.entries(meetingMap).map(([date, links]) => ({
    date,
    links,
  }));
}

async function main() {
  const htmls = [
    await fetch(
      "https://www.smud.org/Corporate/About-us/Company-Information/Board-Meetings"
    ).then((r) => r.text()),
    await fetch(
      "https://www.smud.org/Corporate/About-us/Company-Information/Board-Meetings/Board-Meeting-Archive"
    ).then((r) => r.text()),
  ];

  const allMeetings = htmls.map((html) => parseSMUDBoard(html));
  const meetings = deduplicateMeetings(allMeetings.flat());

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
