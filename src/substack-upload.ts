import "dotenv/config";
import * as fs from "fs/promises";
import MarkdownIt from "markdown-it";

// --- Config ---

const SUBSTACK_URL = "https://focs.substack.com";
const SUBSTACK_SID = process.env.SUBSTACK_SID;
const SUBSTACK_LLI = process.env.SUBSTACK_LLI;

if (!SUBSTACK_SID || !SUBSTACK_LLI) {
  console.error("Missing env vars: SUBSTACK_SID, SUBSTACK_LLI");
  process.exit(1);
}

const cookies = `substack.sid=${SUBSTACK_SID}; substack.lli=${SUBSTACK_LLI}`;

// --- Strip metadata header ---

function stripMetadataHeader(markdown: string): string {
  // Remove the block after the title heading that contains Question/Date/Organizations + ---
  // Pattern: line starting with ** (bold metadata), repeated, then a --- separator
  return markdown.replace(
    /\n\n\*\*Question:\*\*[\s\S]*?\n---\n/,
    "\n"
  );
}

// --- ProseMirror types ---

type PmMark = { type: string; attrs?: Record<string, string> };
type PmNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: PmMark[];
};

// --- Markdown → ProseMirror JSON via markdown-it tokens ---

const md = new MarkdownIt();

function markdownToProsemirror(markdown: string): PmNode {
  const tokens = md.parse(markdown, {});
  const doc: PmNode = { type: "doc", content: [] };
  doc.content = processTokens(tokens, 0, tokens.length);
  if (!doc.content.length) {
    doc.content = [{ type: "paragraph" }];
  }
  return doc;
}

function processTokens(tokens: MarkdownIt.Token[], start: number, end: number): PmNode[] {
  const nodes: PmNode[] = [];
  let i = start;

  while (i < end) {
    const token = tokens[i];

    if (token.type === "heading_open") {
      const level = parseInt(token.tag.slice(1));
      const inline = tokens[i + 1]; // inline content
      const content = processInlineToken(inline);
      nodes.push({
        type: "heading",
        attrs: { level },
        content: content.length ? content : undefined,
      });
      i += 3; // heading_open, inline, heading_close
    } else if (token.type === "paragraph_open") {
      const inline = tokens[i + 1];
      const content = processInlineToken(inline);
      nodes.push({
        type: "paragraph",
        content: content.length ? content : undefined,
      });
      i += 3; // paragraph_open, inline, paragraph_close
    } else if (token.type === "bullet_list_open") {
      const closeIdx = findClose(tokens, i, "bullet_list_close");
      const items = processListItems(tokens, i + 1, closeIdx);
      nodes.push({ type: "bulletList", content: items });
      i = closeIdx + 1;
    } else if (token.type === "ordered_list_open") {
      const closeIdx = findClose(tokens, i, "ordered_list_close");
      const items = processListItems(tokens, i + 1, closeIdx);
      nodes.push({ type: "orderedList", content: items });
      i = closeIdx + 1;
    } else if (token.type === "blockquote_open") {
      const closeIdx = findClose(tokens, i, "blockquote_close");
      const content = processTokens(tokens, i + 1, closeIdx);
      nodes.push({ type: "blockquote", content });
      i = closeIdx + 1;
    } else if (token.type === "fence" || token.type === "code_block") {
      nodes.push({
        type: "codeBlock",
        content: [{ type: "text", text: token.content }],
      });
      i++;
    } else if (token.type === "hr") {
      nodes.push({ type: "horizontal_rule" });
      i++;
    } else if (token.type === "html_block") {
      // Try to extract table content from HTML blocks
      const text = token.content.replace(/<[^>]+>/g, " ").trim();
      if (text) {
        nodes.push({
          type: "paragraph",
          content: [{ type: "text", text }],
        });
      }
      i++;
    } else if (token.type === "table_open") {
      const closeIdx = findClose(tokens, i, "table_close");
      const tableNodes = processTable(tokens, i + 1, closeIdx);
      nodes.push(...tableNodes);
      i = closeIdx + 1;
    } else {
      i++;
    }
  }

  return nodes;
}

function findClose(tokens: MarkdownIt.Token[], start: number, closeType: string): number {
  let depth = 1;
  const openType = closeType.replace("_close", "_open");
  for (let i = start + 1; i < tokens.length; i++) {
    if (tokens[i].type === openType) depth++;
    else if (tokens[i].type === closeType) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length - 1;
}

function processListItems(tokens: MarkdownIt.Token[], start: number, end: number): PmNode[] {
  const items: PmNode[] = [];
  let i = start;

  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const closeIdx = findClose(tokens, i, "list_item_close");
      const content = processTokens(tokens, i + 1, closeIdx);
      items.push({ type: "listItem", content: content.length ? content : [{ type: "paragraph" }] });
      i = closeIdx + 1;
    } else {
      i++;
    }
  }

  return items;
}

function processTable(tokens: MarkdownIt.Token[], start: number, end: number): PmNode[] {
  // Convert tables to readable text paragraphs since Substack's table support is limited
  const rows: string[] = [];
  let i = start;

  while (i < end) {
    if (tokens[i].type === "tr_open") {
      const cells: string[] = [];
      i++;
      while (i < end && tokens[i].type !== "tr_close") {
        if (tokens[i].type === "th_open" || tokens[i].type === "td_open") {
          i++;
          if (i < end && tokens[i].type === "inline") {
            cells.push(tokens[i].content.trim());
          }
        }
        i++;
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
    i++;
  }

  if (rows.length) {
    return [{
      type: "paragraph",
      content: [{ type: "text", text: rows.join("\n"), marks: [{ type: "code" }] }],
    }];
  }
  return [];
}

function processInlineToken(token: MarkdownIt.Token): PmNode[] {
  if (!token || !token.children) return [];
  return processInlineChildren(token.children);
}

function processInlineChildren(children: MarkdownIt.Token[]): PmNode[] {
  const nodes: PmNode[] = [];
  const markStack: PmMark[] = [];

  for (const child of children) {
    if (child.type === "text") {
      if (!child.content) continue;
      const node: PmNode = { type: "text", text: child.content };
      if (markStack.length) node.marks = [...markStack];
      nodes.push(node);
    } else if (child.type === "code_inline") {
      const node: PmNode = { type: "text", text: child.content };
      node.marks = [...markStack, { type: "code" }];
      nodes.push(node);
    } else if (child.type === "softbreak") {
      // Soft breaks are just spaces in rendered output — skip them
      // This prevents unwanted newlines in the Substack output
    } else if (child.type === "hardbreak") {
      nodes.push({ type: "hardBreak" });
    } else if (child.type === "strong_open") {
      markStack.push({ type: "bold" });
    } else if (child.type === "strong_close") {
      removeLastMark(markStack, "bold");
    } else if (child.type === "em_open") {
      markStack.push({ type: "italic" });
    } else if (child.type === "em_close") {
      removeLastMark(markStack, "italic");
    } else if (child.type === "link_open") {
      const href = child.attrGet("href");
      if (href) markStack.push({ type: "link", attrs: { href } });
    } else if (child.type === "link_close") {
      removeLastMark(markStack, "link");
    } else if (child.type === "s_open") {
      markStack.push({ type: "strikethrough" });
    } else if (child.type === "s_close") {
      removeLastMark(markStack, "strikethrough");
    } else if (child.type === "html_inline") {
      // Handle inline HTML tags
      const tag = child.content.toLowerCase();
      if (tag === "<strong>" || tag === "<b>") markStack.push({ type: "bold" });
      else if (tag === "</strong>" || tag === "</b>") removeLastMark(markStack, "bold");
      else if (tag === "<em>" || tag === "<i>") markStack.push({ type: "italic" });
      else if (tag === "</em>" || tag === "</i>") removeLastMark(markStack, "italic");
      else if (tag === "<br>" || tag === "<br/>") nodes.push({ type: "hardBreak" });
    } else if (child.type === "image") {
      // Skip images — Substack handles them separately
    }
  }

  return nodes;
}

function removeLastMark(marks: PmMark[], type: string) {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i].type === type) {
      marks.splice(i, 1);
      return;
    }
  }
}

// --- Substack API ---

async function createDraft(
  title: string,
  subtitle: string,
  bodyJson: PmNode
): Promise<{ id: number; slug: string }> {
  // Step 1: Create empty draft
  const createRes = await fetch(`${SUBSTACK_URL}/api/v1/drafts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({ type: "newsletter", draft_bylines: [{ id: 254621399, is_guest: false }] }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create draft: ${createRes.status} ${text}`);
  }

  const draft = (await createRes.json()) as { id: number; slug: string };

  // Step 2: Update draft with content
  const updateRes = await fetch(`${SUBSTACK_URL}/api/v1/drafts/${draft.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
    },
    body: JSON.stringify({
      draft_title: title,
      draft_subtitle: subtitle,
      draft_body: JSON.stringify(bodyJson),
    }),
  });

  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Failed to update draft: ${updateRes.status} ${text}`);
  }

  const updated = (await updateRes.json()) as { id: number; slug: string };
  return updated;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: src/substack-upload <markdown-file> [title] [subtitle]");
    console.error("");
    console.error("  markdown-file  Path to a markdown file (e.g. research/2025-03-25-parks-budget.md)");
    console.error("  title          Draft title (default: first heading from file)");
    console.error("  subtitle       Draft subtitle (optional)");
    process.exit(1);
  }

  const filePath = args[0];
  const overrideTitle = args[1];
  const subtitle = args[2] || "";

  // Read markdown
  let markdown = await fs.readFile(filePath, "utf-8");

  // Extract title from first heading if not provided
  let title = overrideTitle;
  if (!title) {
    const match = markdown.match(/^#\s+(.+)$/m);
    title = match ? match[1] : filePath.replace(/.*\//, "").replace(/\.md$/, "");
  }

  // Strip metadata header (Question/Date/Organizations block)
  markdown = stripMetadataHeader(markdown);

  console.log(`Converting ${filePath} to Substack format...`);
  const bodyJson = markdownToProsemirror(markdown);

  console.log(`Creating draft: "${title}"`);
  const draft = await createDraft(title, subtitle, bodyJson);

  const draftUrl = `${SUBSTACK_URL}/publish/post/${draft.id}`;
  console.log(`\nDraft created successfully!`);
  console.log(`Edit: ${draftUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
