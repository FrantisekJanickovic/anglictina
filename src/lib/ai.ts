"use client";

import { authHeader } from "./supabase";
import type { Sentence } from "./types";

export type DraftVocab = { en: string; sk: string; example_en?: string; example_sk?: string; emoji?: string };
export type DraftGrammar = { prompt: string; answer: string; options?: string[]; translation_sk?: string; explanation_sk?: string };
export type DraftText = { title?: string; sentences: Sentence[] };
export type ImportResult = { title?: string; unit?: string; vocab: DraftVocab[]; grammar: DraftGrammar[]; texts: DraftText[] };

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Chyba ${res.status}`);
  return json as T;
}

/** Downscale a photo so it uploads fast and stays under request limits. */
async function toJpegBase64(file: File, max = 1800): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mediaType: "image/jpeg" };
}

export async function importFromPhoto(file: File, ctx: { grade?: number | null; hint?: string }): Promise<ImportResult> {
  const img = await toJpegBase64(file);
  return post<ImportResult>("/api/ai/import", { image: img.data, mediaType: img.mediaType, grade: ctx.grade, hint: ctx.hint });
}

export async function enrichVocab(items: DraftVocab[], grade?: number | null) {
  return post<{ items: DraftVocab[] }>("/api/ai/enrich", { mode: "vocab", items, grade });
}

export async function generateGrammar(topic: string, words: string[], count: number, grade?: number | null) {
  return post<{ items: DraftGrammar[] }>("/api/ai/enrich", { mode: "grammar", topic, words, count, grade });
}

export async function translateSentences(sentences: string[]) {
  return post<{ sentences: Sentence[] }>("/api/ai/enrich", { mode: "translate", sentences });
}

export async function aiStatus(): Promise<boolean> {
  try {
    const res = await fetch("/api/ai/enrich", { headers: await authHeader() });
    const j = await res.json();
    return !!j.ai;
  } catch {
    return false;
  }
}
