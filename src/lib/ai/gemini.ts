import { GoogleGenAI } from "@google/genai";

// Free tier: gemini-2.5-flash, falling back to flash-lite when rate limited or overloaded.
export const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryable(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|500|INTERNAL|fetch failed/i.test(msg);
}

export async function generateJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: object;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  const attempts = [PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL, FALLBACK_MODEL];
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    try {
      const res = await ai().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
        },
      });
      const text = res.text;
      if (!text) throw new Error("Empty response from model");
      return { data: JSON.parse(text) as T, model };
    } catch (err) {
      lastErr = err;
      if (!retryable(err) && !(err instanceof SyntaxError)) throw err;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

export async function* streamText(opts: { system: string; prompt: string }) {
  const stream = await ai().models.generateContentStream({
    model: PRIMARY_MODEL,
    contents: opts.prompt,
    config: { systemInstruction: opts.system, temperature: 0.3 },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
