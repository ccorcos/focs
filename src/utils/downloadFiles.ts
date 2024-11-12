import * as fs from "fs/promises";
import * as path from "path";
import { normalizeFilename } from "./normalizeFilename";

export type BoardMeeting = {
  folderName: string;
  links: string[];
};

export async function downloadFiles(meetings: BoardMeeting[], dir: string) {
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
    const meetingDir = path.join(dir, meeting.folderName);
    await fs.mkdir(meetingDir, { recursive: true });

    // Download each linked file
    for (let i = 0; i < meeting.links.length; i++) {
      const link = meeting.links[i];
      let filename = link.split("/").pop()!;

      // Normalize the current filename
      filename = normalizeFilename(filename);

      // Check if file already exists
      const existingFiles = await fs.readdir(meetingDir);
      const normalizedExistingFiles = existingFiles.map(normalizeFilename);

      if (normalizedExistingFiles.includes(filename)) {
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
