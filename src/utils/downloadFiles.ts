import * as fs from "fs/promises";
import mime from "mime-types";
import pLimit from "p-limit";
import * as path from "path";
import { normalizeFilename } from "./normalizeFilename";

export type BoardMeeting = {
  folderName: string;
  links: string[] | { url: string; filename: string }[];
};

const DOWNLOAD_CONCURRENCY = 20;

function sortMeetings(meetings: BoardMeeting[]) {
  return meetings.sort((a, b) => a.folderName.localeCompare(b.folderName));
}

function checkForDuplicates(meetings: BoardMeeting[]) {
  const normalized = meetings.map((m) => m.folderName);
  const unique = new Set(normalized);
  if (normalized.length !== unique.size) {
    console.warn("Duplicate meetings found!!");
  }
}

function summarizeMeetings(meetings: BoardMeeting[]) {
  // Log meeting stats
  const totalMeetings = meetings.length;
  const totalLinks = meetings.reduce(
    (sum, meeting) => sum + meeting.links.length,
    0
  );

  const range =
    meetings.length > 0
      ? `${meetings[0].folderName} to ${
          meetings[meetings.length - 1].folderName
        }`
      : "no meetings found";

  console.log(`Found ${totalMeetings} meetings from ${range}`);
  console.log(`Total number of downloadable files: ${totalLinks}`);

  return { totalMeetings, totalLinks };
}

export async function downloadFiles(
  meetings: BoardMeeting[],
  dir: string,
  useMimeType = false
) {
  sortMeetings(meetings);
  const { totalLinks } = summarizeMeetings(meetings);
  checkForDuplicates(meetings);

  let downloadedCount = 0;
  let errorCount = 0;
  const limit = pLimit(DOWNLOAD_CONCURRENCY);

  // Build flat list of download tasks
  type DownloadTask = {
    meeting: BoardMeeting;
    link: string | { url: string; filename: string };
  };
  const tasks: DownloadTask[] = [];
  for (const meeting of meetings) {
    for (const link of meeting.links) {
      tasks.push({ meeting, link });
    }
  }

  // Ensure all meeting directories exist before parallel downloads
  const dirs = new Set(meetings.map((m) => path.join(dir, m.folderName)));
  await Promise.all([...dirs].map((d) => fs.mkdir(d, { recursive: true })));

  await Promise.all(
    tasks.map((task) =>
      limit(async () => {
        const meetingDir = path.join(dir, task.meeting.folderName);
        const link = task.link;

        let filename: string;
        if (typeof link === "string") {
          filename = link.split("/").pop()!;
          filename = normalizeFilename(filename);
        } else {
          filename = link.filename;
        }

        let url: string;
        if (typeof link === "string") {
          url = link;
        } else {
          url = link.url;
        }

        // Check if file already exists
        const existingFiles = await fs.readdir(meetingDir);
        const normalizedExistingFiles = existingFiles.map(normalizeFilename);

        const filenameToCompare = useMimeType
          ? filename.slice(0, filename.lastIndexOf("."))
          : filename;

        const fileExists = normalizedExistingFiles.some((existingFile) => {
          if (useMimeType) {
            const existingWithoutExt = existingFile.slice(
              0,
              existingFile.lastIndexOf(".")
            );
            return existingWithoutExt === filenameToCompare;
          }
          return existingFile === filename;
        });

        if (fileExists) {
          downloadedCount++;
          console.log(
            `(${downloadedCount}/${totalLinks}) Skipping ${url} from ${meetingDir}`
          );
          return;
        }

        let response;
        try {
          response = await fetch(url);
        } catch (error) {
          console.error(`Error downloading ${url}:`, error);
          errorCount++;
          return;
        }

        const buffer = await response.arrayBuffer();

        // Get content-type header and map to file extension using mime-types
        const contentType = response.headers.get("content-type");
        if (useMimeType) {
          const mimeType = contentType?.split(";")[0];
          if (mimeType) {
            const extension = mime.extension(mimeType);
            if (extension) {
              filename = `${filename.substring(
                0,
                filename.lastIndexOf(".")
              )}.${extension}`;
            }
          }
        }

        try {
          const filepath = path.join(meetingDir, filename);
          await fs.writeFile(filepath, Buffer.from(buffer));

          downloadedCount++;
          console.log(
            `(${downloadedCount}/${totalLinks}) Downloaded ${url} to ${meetingDir}`
          );
        } catch (error) {
          console.error(`Error writing file ${filename}:`, error);
          errorCount++;
        }
      })
    )
  );

  if (errorCount > 0) {
    console.log(
      `\nCompleted with ${errorCount} error${errorCount === 1 ? "" : "s"}`
    );
  } else {
    console.log("\nCompleted successfully with no errors");
  }
}
