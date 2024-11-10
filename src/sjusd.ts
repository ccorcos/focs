import * as cheerio from "cheerio";
import * as fs from "fs/promises";

async function fetchHtml() {
  const response = await fetch(
    "https://sanjuan.granicus.com/ViewPublisher.php?view_id=1"
  );
  return response.text();
}

type BoardMeeting = {
  date: string;
  agenda?: string;
  minutes?: string;
  video?: string;
  packet?: string;
};

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
          return `${year}-${monthNum
            .toString()
            .padStart(2, "0")}-${day.padStart(2, "0")}T${hour
            .toString()
            .padStart(2, "0")}:${min}:00`;
        }
      );

    const agenda = $(row).find('a:contains("Agenda")').attr("href");
    const minutes = $(row).find('a:contains("Minutes")').attr("href");
    const video = $(row).find('a:contains("Video")').attr("onClick");
    const packet = $(row).find('a:contains("Agenda Packet")').attr("href");

    meetings.push({
      date: date,
      agenda: agenda ? `https:${agenda}` : undefined,
      minutes: minutes ? `https:${minutes}` : undefined,
      video: video ? video.match(/'(.*?)'/)?.[1] : undefined,
      packet: packet,
    });
  });

  return meetings;
}

async function downloadFile(url: string, path: string) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(path, Buffer.from(buffer));
}
async function downloadMeetings(meetings: BoardMeeting[], directory: string) {
  const firstDate = new Date(meetings[meetings.length - 1].date);
  const lastDate = new Date(meetings[0].date);

  console.log(
    `Found ${
      meetings.length
    } meetings from ${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`
  );

  // Count total files to download
  const totalFiles = meetings.reduce((count, meeting) => {
    return (
      count +
      (meeting.agenda ? 1 : 0) +
      (meeting.minutes ? 1 : 0) +
      (meeting.packet ? 1 : 0)
    );
  }, 0);

  console.log(`Total files to download: ${totalFiles}`);

  let progress = 0;

  await fs.mkdir(directory, { recursive: true });

  for (const meeting of meetings) {
    const date = new Date(meeting.date);
    const folderName = `${directory}/${date.toISOString().split("T")[0]}`; // YYYY-MM-DD format

    try {
      await fs.mkdir(folderName, { recursive: true });

      const files = [
        { type: "agenda", url: meeting.agenda, filename: "agenda.pdf" },
        { type: "minutes", url: meeting.minutes, filename: "minutes.pdf" },
        {
          type: "agenda-packet",
          url: meeting.packet,
          filename: "agenda-packet.pdf",
        },
      ];

      for (const file of files) {
        const filePath = `${folderName}/${file.filename}`;

        if (file.url) {
          progress++;
          const prefix = `(${progress}/${totalFiles})`;
          const postfix = [
            date.toLocaleDateString(),
            file.filename,
            file.url,
          ].join(" ");
          try {
            await fs.access(filePath);
            console.log(`${prefix} skipping ${postfix}`);
          } catch {
            await downloadFile(file.url, filePath);
            console.log(`${prefix} downloading ${postfix}`);
          }
        } else {
          console.log(`Missing url for ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`Error saving files for meeting ${folderName}:`, error);
    }
  }

  console.log("Download complete");
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
  await downloadMeetings(meetings, directory);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
