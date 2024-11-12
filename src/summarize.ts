import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam as ClaudeMessage } from "@anthropic-ai/sdk/resources/index.mjs";
import "dotenv/config";
import fs from "fs/promises";
import MarkdownIt from "markdown-it";
import { OpenAI } from "openai";
import { encoding_for_model, TiktokenModel } from "tiktoken";

// Initialize the client
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Message = { role: string; content: string };
type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const model: "openai" | "claude" = "openai";
const OpenAiModel: OpenAI.Chat.ChatModel = "gpt-4o"; //"gpt-4o-mini";
const ClaudeModel: Anthropic.Model = "claude-3-5-sonnet-20240620";

async function loadPrompts(promptsPath: string): Promise<string[]> {
  const promptsFile = await fs.readFile(promptsPath, "utf-8");
  return promptsFile.split("\n---\n").map((p) => p.trim());
}

async function loadDocuments(dirPath: string): Promise<string> {
  // Get all files in directory
  const files = await fs.readdir(dirPath);

  // Filter for markdown, html and txt files
  const allowedExtensions = [".md", ".html", ".txt"];
  const filteredFiles = files.filter((file) =>
    allowedExtensions.some((ext) => file.toLowerCase().endsWith(ext))
  );

  // Log the files we're processing
  console.log("Loading documents:\n", filteredFiles.join("\n"));

  // Read and join all file contents with filename comments
  const fileContents = await Promise.all(
    filteredFiles.map(async (file) => {
      const content = await fs.readFile(`${dirPath}/${file}`, "utf-8");
      return `<!-- ${file} -->\n${content}`;
    })
  );

  return fileContents.join("\n\n");
}

async function recurPromptClaude(
  doc: string,
  prompts: string[]
): Promise<ClaudeMessage[]> {
  const messages: ClaudeMessage[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    console.error("USER> ", prompt, "\n\n");
    messages.push({
      role: "user",
      content: prompt,
    });

    const response = await retry(
      async () =>
        await anthropic.messages.create({
          model: ClaudeModel,
          max_tokens: 5000,
          system: `Here's the document to summarize:\n\n${doc}`,
          messages: messages,
        })
    );

    // @ts-ignore
    const result = response.content[0].text;

    console.error("ASSISTANT> ", result, "\n\n");
    messages.push({
      role: "assistant",
      content: result,
    });
  }

  return messages;
}

function fixDoc(doc: string) {
  // Remove empty markdown table rows that are mostly empty cells and have >20 columns
  const lines = doc.split("\n");
  const filteredLines = lines.filter((line) => {
    if (line.match(/(\|\s*){20,}/)) {
      const cells = line.split("|");
      if (cells.length <= 20) return true;
      const emptyCells = cells.filter((cell) => cell.trim() === "").length;
      const totalCells = cells.length;
      const remove = emptyCells / totalCells < 0.9;
      console.warn(`Removing line:\n${line}`);
      return !remove;
    }
    return true;
  });
  doc = filteredLines.join("\n");

  console.log(doc);
  return doc;
}

function md2html(markdown: string): string {
  const md = new MarkdownIt();
  return md.render(markdown);
}

async function recurPromptOpenAI(
  doc: string,
  prompts: string[]
): Promise<OpenAIMessage[]> {
  const messages: OpenAIMessage[] = [];

  // for (let i = 0; i < prompts.length; i++) {
  //   const prompt = prompts[i];

  //   if (i === 0) {
  //     console.error("SYSTEM> ", prompt, "\n\n");
  //     messages.push({
  //       role: "system",
  //       content: prompt,
  //     });
  //     messages.push({
  //       role: "user",
  //       content: `Here's the document to summarize:\n\n${doc}`,
  //     });
  //   } else {
  //     console.error("USER> ", prompt, "\n\n");
  //     messages.push({
  //       role: "user",
  //       content: prompt,
  //     });
  //   }

  messages.push({
    role: "user",
    content: `Summarize this document:\n\n${md2html(doc)}`,
  });

  const response = await retry(async () =>
    openai.chat.completions.create({
      model: OpenAiModel,
      messages: messages,
    })
  );

  const result = response.choices[0].message.content!;

  console.error("ASSISTANT> ", result, "\n\n");
  messages.push({
    role: "assistant",
    content: result,
  });
  // }

  return messages;
}

async function summarizeDoc(doc: string) {
  const prompts = await loadPrompts(__dirname + "/summarize.md");

  const recurPrompt =
    model === "openai" ? recurPromptOpenAI : recurPromptClaude;

  const messages = await recurPrompt(doc, prompts);

  return messages as Message[];
}

function formatMessages(messages: Message[]) {
  return messages
    .map(({ role, content }) => `${role}> ${content}`)
    .join("\n\n");
}

async function summarize(dirPath: string) {
  const documents = await loadDocuments(dirPath);

  const tokenLength = countTokens(documents);

  let maxTokens: number;
  const gptModel = model === "openai" ? OpenAiModel : ClaudeModel;
  if (gptModel.includes("gpt-4o")) maxTokens = 128000;
  // else if (gptModel.includes("claude")) maxTokens = 200000;
  else if (gptModel.includes("claude"))
    maxTokens = 30000; // only 30k tokens per minute
  else if (gptModel.includes("gpt-3.5")) maxTokens = 16385;
  else throw new Error(`Unknown model: ${gptModel}`);

  console.error("Using model", gptModel);
  maxTokens = maxTokens * 0.8;

  if (tokenLength > maxTokens) {
    const numChunks = Math.ceil(tokenLength / maxTokens);
    const chunkSize = Math.ceil(documents.length / numChunks);
    const chunks: string[] = [];

    for (let i = 0; i < documents.length; i += chunkSize) {
      chunks.push(documents.slice(i, i + chunkSize));
    }

    console.log("Summarizing with", chunks.length, "chunks");

    // Process each chunk separately
    const chunkResults: Message[][] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Summarizing chunk ${i + 1}`);
      const messages = await summarizeDoc(chunks[i]);
      chunkResults.push(messages);
    }

    // Logging
    // chunkResults.forEach((messages, i) => {
    //   console.log(`Chunk ${i + 1}:\n\n`, formatMessages(messages.slice(1)));
    // });

    // Combine results
    const chunkSummaries = chunkResults
      .map((messages) => messages[messages.length - 1].content!)
      .join("\n\n");

    const messages = await summarizeDoc(chunkSummaries);

    // console.log(formatMessages(messages));
    return;
  }

  const messages = await summarizeDoc(documents);
  // console.log(formatMessages(messages.slice(1)));
}

async function retry<T>(fn: () => Promise<T>, tries = 0) {
  try {
    // console.error("running")
    return await fn();
  } catch (error) {
    if (tries >= 10) throw error;

    if (error.status === 429) {
      // message: 'Rate limit reached for gpt-4o-mini in organization org-zt8czUs8Thn5aBD4n2Jf1kve on tokens per min (TPM): \
      // Limit 200000, Used 163084, Requested 62318. Please try again in 7.62s."
      const match = error.message.match(/try again in (\d+\.\d+)s/);
      const waitTimeMs = match
        ? parseFloat(match[1]) * 1000 + 300 // 300ms more than recommended in the error.
        : 60_000 + 10 + 2 ** tries * 10; // Or 1min + 10ms + 2^n * 10ms backoff.

      console.error(error);
      console.error(`RATE LIMIT, sleeping for ${waitTimeMs}ms`);
      await sleep(waitTimeMs);
      return retry(fn, tries + 1);
    }

    throw error;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function countTokens(text: string, model: TiktokenModel = "gpt-4o-mini") {
  // Get the encoding for the specific model
  const encoding = encoding_for_model(model);

  // Encode the string into tokens
  const tokens = encoding.encode(text);
  const n = tokens.length;

  // Free up memory after encoding
  encoding.free();

  // Return the number of tokens
  return n;
}

async function main() {
  // Get directory from command line args
  const dir = process.argv[2];
  if (!dir) {
    console.error("Please provide an input directory");
    process.exit(1);
  }

  await summarize(dir);
}

if (require.main === module) {
  main();
}
