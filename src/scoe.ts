import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";
import { downloadFiles } from "./utils/downloadFiles";

export type BoardMeeting = {
  folderName: string;
  links: string[];
};

type BoardMeetingItem = {
  numberdate: string;
  name: string;
  unique: string;
  current: string;
  preliveoak: string;
  unid: string;
};

const committeeId = "A4EP6J588C05";

async function getMeetingsList() {
  const response = await fetch(
    // "https://go.boarddocs.com/ca/scoe/Board.nsf/BD-GetMeetingsList?open&0.5408818487924805",
    "https://go.boarddocs.com/ca/scoe/Board.nsf/BD-GetMeetingsList?open",
    {
      body: `current_committee_id=${committeeId}`,
      method: "POST",
    }
  );

  const meetings: BoardMeetingItem[] = await response.json();

  return meetings.filter((meeting) => Boolean(meeting.unique));
}

// async function getMeetingAgenda(meetingId: string) {
//   const response = await fetch(
//     "https://go.boarddocs.com/ca/scoe/Board.nsf/BD-GetAgenda",
//     {
//       body: `id=${meetingId}&current_committee_id=${committeeId}`,
//       method: "POST",
//     }
//   );

//   return response.text();
// }

// async function getAgendaItem(meetingId: string) {
//   const response = await fetch(
//     "https://go.boarddocs.com/ca/scoe/Board.nsf/BD-GetAgendaItem",
//     {
//       body: `id=${meetingId}&current_committee_id=${committeeId}`,
//       method: "POST",
//     }
//   );
// }

// async function getAgendaItemFiles(meetingId: string) {
//   const response = await fetch(
//     "https://go.boarddocs.com/ca/scoe/Board.nsf/BD-GetPublicFiles",
//     {
//       body: `id=${meetingId}&current_committee_id=${committeeId}`,
//       method: "POST",
//     }
//   );
// }

async function getDetailedAgendaHtml(meetingId: string) {
  const response = await fetch(
    "https://go.boarddocs.com/ca/scoe/Board.nsf/PRINT-AgendaDetailed",
    {
      body: `id=${meetingId}&current_committee_id=${committeeId}`,
      method: "POST",
    }
  );

  return response.text();
}

function getMeetingLinks(agendaHtml: string) {
  const baseUrl = "https://go.boarddocs.com";
  const $ = cheerio.load(agendaHtml);

  const links: string[] = [];
  $("a").each((i, link) => {
    const href = $(link).attr("href");
    if (href && href.startsWith("/")) {
      links.push(baseUrl + href);
    }
  });

  return links;
}

async function loadAgendas(list: BoardMeetingItem[], directory) {
  // Load agendas
  const meetings: BoardMeeting[] = [];
  let progress = 0;
  for (const meeting of list) {
    progress++;
    // Create directory for this meeting
    let date = meeting.numberdate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    date += "-" + meeting.unique;

    const meetingDir = path.join(directory, date);
    await fs.mkdir(meetingDir, { recursive: true });

    const agendaPath = path.join(meetingDir, "agenda.html");

    let agenda;
    try {
      agenda = await fs.readFile(agendaPath, "utf-8");
      console.log(`(${progress}/${list.length} agendas) Loaded ${date}`);
    } catch {
      console.log(`(${progress}/${list.length} agendas) Downloaded ${date}`);
      agenda = await getDetailedAgendaHtml(meeting.unique);
      await fs.writeFile(agendaPath, agenda);
    }

    const links = getMeetingLinks(agenda);

    meetings.push({ folderName: date, links });
  }
  return meetings;
}

async function main() {
  const args = process.argv.slice(2);
  const directory = args[0];

  if (!directory) {
    console.error("Error: Missing required output directory argument");
    console.error("Usage: scoe.ts <output-directory>");
    process.exit(1);
  }

  const list = await getMeetingsList();

  // console.log(list);
  console.log(`Found ${list.length} meetings`);
  const meetings = await loadAgendas(list, directory);
  fixLinks(meetings);

  downloadFiles(meetings, directory);
}

function fixLinks(meetings: BoardMeeting[]) {
  // Fix meetings so that minutes are in the correct folder.

  for (const meeting of meetings) {
    const minutesLinks = meeting.links.filter((link) => {
      return /\d{2}\.\d{2}\.\d{2}.*Minutes.*/.test(decodeURIComponent(link));
    });

    for (const minutesLink of minutesLinks) {
      // Extract date from minutes filename (MM.DD.YY format)
      const match = minutesLink.match(/(\d{2})\.(\d{2})\.(\d{2})/);

      if (!match) continue;

      const [_, month, day, year] = match;
      // Convert to YYYY-MM-DD format
      const fullYear = `20${year}`; // Assuming 20xx years
      const datePrefix = `${fullYear}-${month}-${day}`;

      // Skip if already in the correct folder
      if (meeting.folderName.startsWith(datePrefix)) continue;

      // Find matching meeting
      const targetMeeting = meetings.find((m) =>
        m.folderName.startsWith(datePrefix)
      );

      // Remove from current meeting
      meeting.links = meeting.links.filter((l) => l !== minutesLink);

      if (!targetMeeting) {
        console.warn(`No target meeting found for ${minutesLink}`);
        continue;
      }

      console.error(
        "Fixing link for",
        minutesLink,
        "->",
        targetMeeting!.folderName
      );

      // Add to target meeting if not already there
      targetMeeting.links.push(minutesLink);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
