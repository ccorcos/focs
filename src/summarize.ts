import { Anthropic } from "@anthropic-ai/sdk";
import { MessageParam as ClaudeMessage } from "@anthropic-ai/sdk/resources/index.mjs";
import "dotenv/config";
import fs from "fs/promises";
import { OpenAI } from "openai";
import { encoding_for_model, TiktokenModel } from "tiktoken";

// Initialize the client
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Message = { role: string; content: string };
type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const OpenAiModel = "gpt-4o-mini";
const ClaudeModel = "claude-3-5-sonnet-latest";

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
  systemPrompt: string,
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
          system: systemPrompt,
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

async function recurPromptOpenAI(
  systemPrompt: string,
  prompts: string[]
): Promise<OpenAIMessage[]> {
  const messages: OpenAIMessage[] = [];

  messages.push({
    role: "system",
    content: systemPrompt,
  });

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];

    console.error("USER> ", prompt, "\n\n");
    messages.push({
      role: "user",
      content: prompt,
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
  }

  return messages;
}

async function summarizeDoc(doc: string) {
  const prompts = await loadPrompts(__dirname + "/summarize.md");

  const messages = await recurPromptClaude(
    `Given the following documents:\n\n${doc}`,
    prompts
  );

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

  // Max tokens is 128000
  const gpt4oMaxTokens = 128000;
  const claudeSonnetMaxTokens = 200000;
  const maxTokens = claudeSonnetMaxTokens * 0.8;

  if (tokenLength > maxTokens) {
    const numChunks = Math.ceil(tokenLength / maxTokens);
    const chunkSize = Math.ceil(documents.length / numChunks);
    const chunks: string[] = [];

    for (let i = 0; i < documents.length; i += chunkSize) {
      chunks.push(documents.slice(i, i + chunkSize));
    }

    console.log("Summarizing with", chunks.length, "chunks");

    // Process each chunk separately
    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        const messages = await summarizeDoc(chunk);
        return messages;
      })
    );

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
        : 10 + 2 ** tries * 10; // Or 10ms + 2^n * 10ms backoff.

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
