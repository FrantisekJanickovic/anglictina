import { aiConfigured, grammarSchema, gradeNote, sentenceSchema, structured, STYLE, vocabSchema } from "@/lib/claude";
import { requireUser, unauthorized } from "@/lib/server-auth";

export const maxDuration = 120;

type ImportResult = {
  title?: string;
  unit?: string;
  vocab: unknown[];
  grammar: unknown[];
  texts: { title?: string; sentences: { en: string; sk: string }[] }[];
};

export async function POST(req: Request) {
  if (!aiConfigured()) return Response.json({ error: "AI nie je nastavené (chýba ANTHROPIC_API_KEY)." }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { image?: string; mediaType?: string; grade?: number | null; hint?: string } | null;
  if (!body?.image) return Response.json({ error: "Chýba obrázok." }, { status: 400 });
  const mediaType = (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(body.mediaType ?? "") ? body.mediaType : "image/jpeg") as
    "image/jpeg" | "image/png" | "image/webp" | "image/gif";

  const system = `You help a Slovak parent turn a photographed page of an English textbook for children (for example Headway) into a practice lesson.
${gradeNote(body.grade)}
${STYLE}
Rules:
- Extract only what is on the page. Do not invent vocabulary, exercises or texts that are not there.
- You MAY add: Slovak translations, short example sentences with translation, one emoji per word, and short Slovak explanations.
- Vocabulary: keep the English exactly as printed (lowercase unless it is a proper noun). If the page prints Slovak translations, use them.
- Grammar exercises: convert each item into a gap-fill sentence with one ___ gap.
- Reading texts or dialogues: split into sentences, each with a Slovak translation.
- Return empty lists for kinds of content that are not on the page.`;

  try {
    const result = await structured<ImportResult>({
      system,
      toolName: "save_lesson",
      description: "Save the extracted lesson content",
      maxTokens: 12000,
      schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short lesson title, e.g. 'Unit 3 – My family'" },
          unit: { type: "string", description: "Unit or page label if visible, else empty" },
          vocab: { type: "array", items: vocabSchema },
          grammar: { type: "array", items: grammarSchema },
          texts: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, sentences: { type: "array", items: sentenceSchema } }, required: ["sentences"] },
          },
        },
        required: ["title", "vocab", "grammar", "texts"],
      },
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: body.image } },
        { type: "text", text: `Extract the lesson from this textbook page.${body.hint ? ` The parent calls this lesson: "${body.hint}".` : ""}` },
      ],
    });
    return Response.json({
      title: result.title ?? "",
      unit: result.unit ?? "",
      vocab: result.vocab ?? [],
      grammar: result.grammar ?? [],
      texts: result.texts ?? [],
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI zlyhala." }, { status: 502 });
  }
}
