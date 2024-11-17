import { ChromaClient } from "chromadb";
import fs from "fs/promises";
import path from "path";

async function search(
  query: string,
  collection: Collection
): Promise<string[]> {
  try {
    const results = await collection.query({
      queryTexts: [query],
      nResults: 5,
    });

    if (!results.documents?.[0]) {
      return [];
    }

    return results.documents[0].filter((doc) => doc !== null);
  } catch (error) {
    console.error("Error performing similarity search:", error);
    return [];
  }
}

const chroma = new ChromaClient({ path: __dirname + "/../embeddings.db" });
type Collection = Awaited<ReturnType<typeof chroma.createCollection>>;

async function main() {
  if (process.argv.length < 4) {
    console.error("Usage: tsx ask.ts <directory> <search query>");
    console.error("Example: tsx ask.ts ./docs 'how to install'");
    process.exit(1);
  }

  const directory = process.argv[2];
  const query = process.argv[3];

  try {
    const dirStats = await fs.stat(directory);
    if (!dirStats.isDirectory()) {
      console.error(`Error: '${directory}' is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: Directory '${directory}' does not exist`);
    process.exit(1);
  }

  if (!query.trim()) {
    console.error("Error: Search query cannot be empty");
    process.exit(1);
  }

  const collection = await chroma.createCollection({
    name: path.basename(directory),
  });

  const results = await search(query, collection);

  if (results.length === 0) {
    console.log("No relevant documents found");
    process.exit(0);
  }

  results.forEach((doc, i) => {
    console.log(`\nResult ${i + 1}:`);
    console.log("Content:", doc);
  });
}

main().catch(console.error);
