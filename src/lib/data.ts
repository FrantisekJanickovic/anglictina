"use client";

import { supabase } from "./supabase";
import type { Child, GrammarItem, ItemProgress, Lesson, LessonText, TextUse, VocabItem } from "./types";

export async function listChildren(): Promise<Child[]> {
  const { data, error } = await supabase().from("children").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function getChild(id: string): Promise<Child | null> {
  const { data, error } = await supabase().from("children").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Child | null;
}

export type LessonWithCounts = Lesson & { vocab: number; grammar: number; texts: number; reading: number; listening: number; writing: number };

export async function listLessons(): Promise<LessonWithCounts[]> {
  const { data, error } = await supabase()
    .from("lessons")
    .select("*, vocab_items(count), grammar_items(count), lesson_texts(uses, sentences)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = Lesson & {
    vocab_items: { count: number }[];
    grammar_items: { count: number }[];
    lesson_texts: { uses: TextUse[] | null; sentences: unknown[] | null }[];
  };
  return ((data ?? []) as Row[]).map(({ vocab_items, grammar_items, lesson_texts, ...l }) => {
    const texts = lesson_texts ?? [];
    const uses = (u: TextUse) => texts.filter((t) => (t.uses ?? ["reading", "listening"]).includes(u));
    return {
      ...l,
      vocab: vocab_items?.[0]?.count ?? 0,
      grammar: grammar_items?.[0]?.count ?? 0,
      texts: texts.length,
      reading: uses("reading").length,
      listening: uses("listening").length,
      writing: uses("writing").reduce((n, t) => n + (t.sentences?.length ?? 0), 0),
    };
  });
}

export type LessonContent = { vocab: VocabItem[]; grammar: GrammarItem[]; texts: LessonText[] };

export async function loadContent(lessonIds: string[]): Promise<LessonContent> {
  if (!lessonIds.length) return { vocab: [], grammar: [], texts: [] };
  const sb = supabase();
  const [v, g, t] = await Promise.all([
    sb.from("vocab_items").select("*").in("lesson_id", lessonIds).order("position"),
    sb.from("grammar_items").select("*").in("lesson_id", lessonIds).order("position"),
    sb.from("lesson_texts").select("*").in("lesson_id", lessonIds).order("position"),
  ]);
  if (v.error) throw v.error;
  if (g.error) throw g.error;
  if (t.error) throw t.error;
  return { vocab: v.data as VocabItem[], grammar: g.data as GrammarItem[], texts: t.data as LessonText[] };
}

export async function loadProgress(childId: string): Promise<Map<string, ItemProgress>> {
  const { data, error } = await supabase().from("item_progress").select("*").eq("child_id", childId);
  if (error) throw error;
  return new Map((data as ItemProgress[]).map((p) => [p.item_id, p]));
}

/** Vocab items of other lessons that are due for review (for the warm-up). */
export async function loadDueVocab(childId: string, excludeLessonIds: string[], limit = 5): Promise<VocabItem[]> {
  const sb = supabase();
  const { data, error } = await sb
    .from("item_progress")
    .select("item_id")
    .eq("child_id", childId)
    .eq("item_type", "vocab")
    .lte("due_at", new Date().toISOString())
    .order("box")
    .limit(40);
  if (error || !data?.length) return [];
  const ids = data.map((d) => d.item_id as string);
  let q = sb.from("vocab_items").select("*").in("id", ids);
  if (excludeLessonIds.length) q = q.not("lesson_id", "in", `(${excludeLessonIds.join(",")})`);
  const { data: items } = await q.limit(limit);
  return (items ?? []) as VocabItem[];
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
