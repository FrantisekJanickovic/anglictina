import Anthropic from "@anthropic-ai/sdk";

export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

type JsonSchema = Record<string, unknown>;

/** Ask Claude for structured output by forcing a single tool call with the given schema. */
export async function structured<T>(opts: {
  system: string;
  content: Anthropic.MessageParam["content"];
  toolName: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL(),
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    tools: [{ name: opts.toolName, description: opts.description, input_schema: opts.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.content }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("AI nevrátila výsledok.");
  return block.input as T;
}

const str = { type: "string" };

export const vocabSchema = {
  type: "object",
  properties: {
    en: { ...str, description: "English word or phrase" },
    sk: { ...str, description: "Slovak translation; several meanings separated by comma" },
    example_en: { ...str, description: "Short, simple English example sentence using the word (max 8 words)" },
    example_sk: { ...str, description: "Natural Slovak translation of the example sentence" },
    emoji: { ...str, description: "One emoji that depicts the word, or empty string" },
  },
  required: ["en", "sk", "example_en", "example_sk", "emoji"],
};

export const grammarSchema = {
  type: "object",
  properties: {
    prompt: { ...str, description: "English sentence with exactly one gap written as ___" },
    answer: { ...str, description: "Correct word(s) for the gap; acceptable alternatives separated by |" },
    options: { type: "array", items: str, description: "3-4 multiple-choice options including the correct answer" },
    translation_sk: { ...str, description: "Slovak translation of the complete sentence" },
    explanation_sk: { ...str, description: "One short child-friendly explanation of the rule in Slovak" },
  },
  required: ["prompt", "answer", "options", "translation_sk", "explanation_sk"],
};

export const sentenceSchema = {
  type: "object",
  properties: { en: str, sk: str },
  required: ["en", "sk"],
};

export const gradeNote = (grade?: number | null) =>
  grade ? `The child is in grade ${grade} of a Slovak primary school (about ${grade + 5} years old).` : "The child attends a Slovak primary school.";

export const STYLE = `Slovak must be natural, correct, with full diacritics, as a Slovak teacher would write it for children.
English example sentences must be short, concrete and use only simple vocabulary a child at this level knows. Use British English spelling.`;

/** Coerce model output into plain strings so the UI never receives surprises. */
export const s = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
