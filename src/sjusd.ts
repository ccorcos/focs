// sanjuan.granicus.com/AgendaViewer.php?view_id=1&clip_id=295

import { scrapeHtml } from "@ccorcos/scrape-html";

const url =
  "https://www.sanjuan.edu/our-district/school-board/board-agendas-minutes";

async function main() {
  try {
    const html = scrapeHtml(url, { timeout: 200, debug: true });
    console.log(html);
  } catch (error) {
    console.error("Error fetching page:", error);
  }
}

main().catch(console.error);
