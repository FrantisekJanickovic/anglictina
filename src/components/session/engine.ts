"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { phrases } from "@/lib/phrases";
import { nextProgress, type Outcome } from "@/lib/srs";
import { speak, type VoiceOpts } from "@/lib/speech";
import { supabase } from "@/lib/supabase";
import type { ActivityKey, Child, ChildSettings, ItemProgress, Lang, VocabItem } from "@/lib/types";

export type DrillItem = VocabItem & { dir: "en_sk" | "sk_en"; key: string };

export type AttemptInput = {
  activity: ActivityKey;
  itemType: "vocab" | "grammar";
  itemId: string;
  correct: boolean;
  hinted?: boolean;
  /** recognition tasks (choose / match) count as weaker evidence for the spaced repetition */
  recognition?: boolean;
  given?: string;
  direction?: string;
  responseMs?: number;
};

export type Bubble = { text: string; tone: "praise" | "reassure" | "streak" | "info"; id: number };

export type SessionCtx = {
  child: Child;
  settings: ChildSettings;
  voice: VoiceOpts;
  oral: boolean;
  showEmoji: boolean;
  say: (text: string, lang: Lang) => Promise<void>;
  record: (a: AttemptInput) => void;
  announce: (text: string, spoken?: boolean) => void;
};

export type ActivityStat = { total: number; correct: number };

export function useSessionEngine(opts: {
  child: Child;
  settings: ChildSettings;
  oral: boolean;
  sessionId: string | null;
  progress: Map<string, ItemProgress>;
  vocabById: Map<string, VocabItem>;
}) {
  const { child, settings, oral, sessionId, progress, vocabById } = opts;
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const stats = useRef(new Map<ActivityKey, ActivityStat>());
  const wrongWords = useRef(new Map<string, VocabItem>());
  const promoted = useRef(new Set<string>());
  const streak = useRef(0);
  const xp = useRef(0);
  const totals = useRef({ total: 0, correct: 0 });
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voice = useMemo<VoiceOpts>(() => ({ gender: settings.voice, slow: settings.slowSpeech }), [settings.voice, settings.slowSpeech]);
  const say = useCallback((text: string, lang: Lang) => speak(text, lang, voice), [voice]);

  const show = useCallback((text: string, tone: Bubble["tone"]) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubble({ text, tone, id: Date.now() });
    bubbleTimer.current = setTimeout(() => setBubble(null), tone === "streak" ? 2600 : 1800);
  }, []);

  const announce = useCallback(
    (text: string, spoken = false) => {
      show(text, "info");
      if (spoken) speak(text, "sk", { ...voice, priority: true });
    },
    [show, voice],
  );

  const record = useCallback(
    (a: AttemptInput) => {
      const s = stats.current.get(a.activity) ?? { total: 0, correct: 0 };
      s.total++;
      if (a.correct) s.correct++;
      stats.current.set(a.activity, s);
      totals.current.total++;
      if (a.correct) totals.current.correct++;

      // spaced repetition outcome: one promotion per item per session, recognition never promotes
      let outcome: Outcome = a.correct ? (a.hinted || a.recognition ? "hinted" : "correct") : "wrong";
      if (outcome === "correct") {
        if (promoted.current.has(a.itemId)) outcome = "hinted";
        else promoted.current.add(a.itemId);
      }
      xp.current += a.correct ? (outcome === "correct" ? 10 : 5) : 0;

      if (!a.correct && a.itemType === "vocab") {
        const v = vocabById.get(a.itemId);
        if (v) wrongWords.current.set(v.id, v);
      }

      // encouragement & motivation
      if (a.correct) {
        streak.current++;
        const st = settings.motivation ? phrases.streak(streak.current, child.name) : null;
        if (st) show(st, "streak");
        else if (settings.encouragement) show(phrases.praise(child.name), "praise");
      } else {
        streak.current = 0;
        if (settings.encouragement) show(phrases.reassure(child.name), "reassure");
      }

      if (!sessionId) return;
      const prev = progress.get(a.itemId);
      const next = nextProgress(prev, { child_id: child.id, item_type: a.itemType, item_id: a.itemId }, outcome);
      progress.set(a.itemId, next);
      const sb = supabase();
      chain.current = chain.current
        .then(() =>
          Promise.all([
            sb.from("attempts").insert({
              session_id: sessionId,
              child_id: child.id,
              item_type: a.itemType,
              item_id: a.itemId,
              activity: a.activity,
              direction: a.direction ?? null,
              correct: a.correct,
              given: a.given?.slice(0, 200) ?? null,
              hint_used: !!a.hinted,
              response_ms: a.responseMs ?? null,
            }),
            sb.from("item_progress").upsert(next),
          ]),
        )
        .catch(() => {});
    },
    [child, settings.motivation, settings.encouragement, sessionId, progress, vocabById, show],
  );

  const ctx: SessionCtx = useMemo(
    () => ({
      child,
      settings,
      voice,
      oral,
      showEmoji: settings.methods.dualCoding,
      say,
      record,
      announce,
    }),
    [child, settings, voice, oral, say, record, announce],
  );

  const flush = useCallback(() => chain.current, []);

  return { ctx, bubble, stats, wrongWords, xp, totals, flush };
}

export function toDrill(items: VocabItem[], direction: ChildSettings["direction"]): DrillItem[] {
  return items.map((v, i) => ({
    ...v,
    dir: direction === "mixed" ? (Math.random() < 0.5 ? "en_sk" : "sk_en") : direction,
    key: `${v.id}-${i}`,
  }));
}

export const sourceOf = (it: DrillItem) => (it.dir === "en_sk" ? { text: it.en, lang: "en" as Lang } : { text: it.sk, lang: "sk" as Lang });
export const targetOf = (it: DrillItem) => (it.dir === "en_sk" ? { text: it.sk, lang: "sk" as Lang } : { text: it.en, lang: "en" as Lang });
