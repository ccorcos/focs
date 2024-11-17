import { ChromaClient } from "chromadb";
import * as fs from "fs/promises";
import * as path from "path";

async function findFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentPath: string) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".md") ||
          entry.name.endsWith(".txt") ||
          entry.name.endsWith(".html"))
      ) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

// Chunk files 20 pages at a time. Splitting by <!-- Page # --> page numbers.
function chunkContent(content: string): string[] {
  // Split on page markers
  const chunks = content.split(/<!--\s*Page\s+\d+\s*-->/);

  // Filter out empty chunks and trim whitespace
  const validChunks = chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  // Combine chunks into groups of 20 pages
  const groupedChunks: string[] = [];
  for (let i = 0; i < validChunks.length; i += 20) {
    const chunk = validChunks.slice(i, i + 20).join("\n\n");
    if (chunk.length > 0) {
      groupedChunks.push(chunk);
    }
  }

  return groupedChunks;
}

async function indexFiles(
  files: string[],
  collection: Collection
): Promise<void> {
  for (const file of files) {
    try {
      console.log(`Processing ${file}...`);
      const content = await fs.readFile(file, "utf-8");
      const chunks = chunkContent(content);

      // Generate unique IDs for each chunk
      const chunkIds = chunks.map((_, i) => `${file}_chunk${i}`);

      await collection.add({
        ids: chunkIds,
        documents: chunks,
      });

      console.log(`Split ${file} into ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
}
const chroma = new ChromaClient({ path: __dirname + "/../embeddings.db" });
type Collection = Awaited<ReturnType<typeof chroma.createCollection>>;

async function main() {
  const directory = process.argv[2];
  if (!directory) {
    console.error("Please provide a directory path");
    process.exit(1);
  }

  try {
    const collection = await chroma.createCollection({
      name: path.basename(directory),
    });
    const files = await findFiles(directory);
    await indexFiles(files, collection);
    console.log(`Processed ${files.length} documents into ChromaDB`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
