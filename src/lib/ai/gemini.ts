import { GoogleGenAI, ThinkingLevel } from "@google/genai";

// Free-tier quotas are per model, so on a rate limit, overload or retired model we move down a chain
// instead of waiting. Interactive work (template switch, Ask, uploads) leads with flash-lite: ~3s on an
// hour-long transcript vs 20-35s for flash under load. The offline seed script opts into "quality".
const CHAINS = {
  fast: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3-flash-preview"],
  quality: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-flash-lite-latest"],
};
export type Tier = keyof typeof CHAINS;

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Notes and Q&A are extraction, not reasoning puzzles: low thinking cuts latency from ~25s to a few seconds.
const thinkingFor = (model: string) =>
  /gemini-3|latest/.test(model) ? { thinkingLevel: /lite/.test(model) ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW } : { thinkingBudget: 0 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryable(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|500|INTERNAL|fetch failed|404|NOT_FOUND|no longer available/i.test(msg);
}

export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: object;
  temperature?: number;
  tier?: Tier;
}): Promise<{ data: T; model: string }> {
  let lastErr: unknown;
  for (const model of CHAINS[opts.tier ?? "fast"]) {
    try {
      const res = await ai().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
          thinkingConfig: thinkingFor(model),
        },
      });
      const text = res.text;
      if (!text) throw new Error("Empty response from model");
      return { data: JSON.parse(text) as T, model };
    } catch (err) {
      lastErr = err;
      if (!retryable(err) && !(err instanceof SyntaxError)) throw err;
      await sleep(400);
    }
  }
  throw lastErr;
}

export async function* streamText(opts: { system: string; prompt: string }) {
  let lastErr: unknown;
  for (const model of CHAINS.fast) {
    let started = false;
    try {
      const stream = await ai().models.generateContentStream({
        model,
        contents: opts.prompt,
        config: { systemInstruction: opts.system, temperature: 0.3, thinkingConfig: thinkingFor(model) },
      });
      for await (const chunk of stream) {
        if (chunk.text) {
          started = true;
          yield chunk.text;
        }
      }
      return;
    } catch (err) {
      lastErr = err;
      // Once text has streamed we can't restart on another model without duplicating output.
      if (started || !retryable(err)) throw err;
    }
  }
  throw lastErr;
}
