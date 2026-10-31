"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Classic from "@/components/session/activities/Classic";
import Flashcards from "@/components/session/activities/Flashcards";
import Grammar from "@/components/session/activities/Grammar";
import Listening from "@/components/session/activities/Listening";
import Match from "@/components/session/activities/Match";
import Reading from "@/components/session/activities/Reading";
import Scramble from "@/components/session/activities/Scramble";
import Shadowing from "@/components/session/activities/Shadowing";
import Speed from "@/components/session/activities/Speed";
import Writing, { sentenceWords, type WritingItem } from "@/components/session/activities/Writing";
import { toDrill, useSessionEngine, type DrillItem } from "@/components/session/engine";
import { Progress } from "@/components/session/parts";
import Summary, { type SummaryData } from "@/components/session/Summary";
import { Button, Card, cx, Segmented, Spinner } from "@/components/ui";
import { getChild, listLessons, loadContent, loadDueVocab, loadProgress, todayISO, type LessonContent, type LessonWithCounts } from "@/lib/data";
import { phrases } from "@/lib/phrases";
import { ACTIVITIES, activityLabel, mergeSettings } from "@/lib/settings";
import { priority } from "@/lib/srs";
import { prefetch, stopSpeaking, unlockAudio } from "@/lib/speech";
import { supabase } from "@/lib/supabase";
import { nowMs, shuffle } from "@/lib/text";
import type {
  ActivityKey,
  AnswerMode,
  Child,
  ChildSettings,
  Direction,
  GrammarItem,
  HintMode,
  ItemProgress,
  Lang,
  LessonText,
  Sentence,
  TextUse,
  VocabItem,
} from "@/lib/types";

type Setup = { lessonIds: string[]; activities: ActivityKey[]; direction: Direction; answerMode: AnswerMode; hintMode: HintMode };
export type Plan = {
  drill: DrillItem[];
  warmup: DrillItem[];
  pool: DrillItem[];
  grammar: GrammarItem[];
  texts: LessonText[];
  listening: Sentence[];
  shadow: Sentence[];
  writing: WritingItem[];
  activities: ActivityKey[];
  lessonTitles: string[];
};

const STORE = (id: string) => `anglictina.setup.${id}`;

function loadSetup(id: string): Partial<Setup> {
  try {
    return JSON.parse(localStorage.getItem(STORE(id)) ?? "{}");
  } catch {
    return {};
  }
}

export default function SessionPage() {
  const params = useSearchParams();
  const childId = params.get("dieta") ?? "";
  const reviewMode = params.get("rezim") === "chyby";
  const router = useRouter();

  const [child, setChild] = useState<Child | null>(null);
  const [lessons, setLessons] = useState<LessonWithCounts[]>([]);
  const [progress, setProgress] = useState<Map<string, ItemProgress>>(new Map());
  const [problemCount, setProblemCount] = useState(0);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [phase, setPhase] = useState<"setup" | "preparing" | "run" | "summary">("setup");
  const [prep, setPrep] = useState({ done: 0, total: 0 });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const baseSettings = useMemo(() => mergeSettings(child?.settings), [child]);
  const settings: ChildSettings = useMemo(
    () => (setup ? { ...baseSettings, direction: setup.direction, answerMode: setup.answerMode, hintMode: setup.hintMode } : baseSettings),
    [baseSettings, setup],
  );

  useEffect(() => {
    if (!childId) return;
    (async () => {
      const [c, l, p] = await Promise.all([getChild(childId), listLessons(), loadProgress(childId)]);
      if (!c) {
        router.replace("/");
        return;
      }
      setChild(c);
      setLessons(l);
      setProgress(p);
      setProblemCount([...p.values()].filter((x) => x.item_type === "vocab" && x.wrong_count > 0 && x.box <= 2).length);
      const s = mergeSettings(c.settings);
      const saved = loadSetup(childId);
      const valid = (saved.lessonIds ?? []).filter((id) => l.some((x) => x.id === id));
      const enabled = (k: ActivityKey) => {
        const a = ACTIVITIES.find((x) => x.key === k);
        return !a?.method || s.methods[a.method];
      };
      const defaults: ActivityKey[] = reviewMode
        ? (["flashcards", "classic"] as ActivityKey[]).filter(enabled)
        : ACTIVITIES.filter((a) => a.method && s.methods[a.method] && a.key !== "shadowing")
            .map((a) => a.key)
            .concat("grammar", "writing");
      setSetup({
        lessonIds: valid.length ? valid : l[0] ? [l[0].id] : [],
        activities: !reviewMode && saved.activities?.length ? saved.activities.filter(enabled) : defaults.length ? defaults : ["classic"],
        direction: saved.direction ?? s.direction,
        answerMode: saved.answerMode ?? s.answerMode,
        hintMode: saved.hintMode ?? s.hintMode,
      });
    })();
  }, [childId, reviewMode, router]);

  const selectedLessons = lessons.filter((l) => setup?.lessonIds.includes(l.id));
  const counts = selectedLessons.reduce(
    (a, l) => ({
      vocab: a.vocab + l.vocab,
      grammar: a.grammar + l.grammar,
      reading: a.reading + l.reading,
      listening: a.listening + l.listening,
      writing: a.writing + l.writing,
    }),
    { vocab: 0, grammar: 0, reading: 0, listening: 0, writing: 0 },
  );

  const available = useMemo(() => {
    if (!child || !setup) return [] as ActivityKey[];
    const s = baseSettings;
    return ACTIVITIES.filter((a) => {
      if (a.method && !s.methods[a.method]) return false;
      if (reviewMode) return ["flashcards", "classic", "match", "scramble", "dictation", "speed"].includes(a.key);
      if (a.key === "grammar") return counts.grammar > 0;
      if (a.key === "writing") return counts.writing > 0;
      if (a.key === "reading") return counts.reading > 0;
      if (a.key === "listening") return counts.listening > 0;
      if (a.key === "warmup") return true;
      return counts.vocab > 0;
    }).map((a) => a.key);
  }, [child, setup, baseSettings, counts.grammar, counts.reading, counts.listening, counts.writing, counts.vocab, reviewMode]);

  // activities the user picked, in their chosen order, then the remaining available ones
  const orderedActivities = useMemo(() => {
    if (!setup) return [];
    const chosen = setup.activities.filter((a) => available.includes(a));
    return [...chosen, ...available.filter((a) => !chosen.includes(a))];
  }, [setup, available]);

  const chosenActivities = orderedActivities.filter((a) => setup?.activities.includes(a));

  function toggleActivity(a: ActivityKey) {
    if (!setup) return;
    const has = setup.activities.includes(a);
    const next = has ? setup.activities.filter((x) => x !== a) : [...chosenActivities, a];
    setSetup({ ...setup, activities: next });
  }

  function move(a: ActivityKey, delta: number) {
    if (!setup) return;
    const list = [...chosenActivities];
    const i = list.indexOf(a);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setSetup({ ...setup, activities: list });
  }

  async function start() {
    if (!child || !setup) return;
    unlockAudio();
    setError(null);
    setPhase("preparing");
    try {
      const s = settings;
      try {
        localStorage.setItem(STORE(child.id), JSON.stringify({ ...setup, activities: chosenActivities }));
      } catch {}

      let content: LessonContent;
      let warmupItems: VocabItem[] = [];
      if (reviewMode) {
        const ids = [...progress.values()]
          .filter((p) => p.item_type === "vocab" && p.wrong_count > 0 && p.box <= 2)
          .sort((a, b) => a.box - b.box || b.wrong_count - a.wrong_count)
          .slice(0, s.wordsPerSession || 30)
          .map((p) => p.item_id);
        const { data } = await supabase()
          .from("vocab_items")
          .select("*")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        content = { vocab: (data ?? []) as VocabItem[], grammar: [], texts: [] };
      } else {
        content = await loadContent(setup.lessonIds);
        if (chosenActivities.includes("warmup")) warmupItems = await loadDueVocab(child.id, setup.lessonIds, 5);
      }

      // choose which words to practise: due problem words first, then new, then the rest
      const lessonOrder = new Map(setup.lessonIds.map((id, i) => [id, i]));
      const ranked = shuffle(content.vocab).sort((a, b) => priority(progress.get(a.id)) - priority(progress.get(b.id)));
      const limit = s.wordsPerSession || ranked.length;
      let chosen = ranked.slice(0, limit);
      if (!s.methods.interleaving)
        chosen = [...chosen].sort((a, b) => (lessonOrder.get(a.lesson_id) ?? 0) - (lessonOrder.get(b.lesson_id) ?? 0) || a.position - b.position);
      else chosen = shuffle(chosen);

      const drill = toDrill(chosen, s.direction);
      const grammar = [...content.grammar].sort((a, b) => priority(progress.get(a.id)) - priority(progress.get(b.id))).slice(0, 12);
      const usedFor = (u: TextUse) => content.texts.filter((t) => (t.uses?.length ? t.uses : ["reading", "listening"]).includes(u));
      const readingTexts = usedFor("reading");
      const listening = usedFor("listening").flatMap((t) => t.sentences);
      const writing: WritingItem[] = usedFor("writing")
        .flatMap((t) => t.sentences.map((x, i) => ({ id: x.id ?? `${t.id}-${i}`, en: x.en, sk: x.sk })))
        .filter((x) => sentenceWords(x.en).length >= 2)
        .sort((a, b) => priority(progress.get(a.id)) - priority(progress.get(b.id)))
        .slice(0, 10)
        .map((x, i) => ({ ...x, key: `${x.id}-${i}` }));
      const shadow: Sentence[] = chosen
        .filter((v) => v.example_en)
        .slice(0, 6)
        .map((v) => ({ en: v.example_en!, sk: v.example_sk ?? "" }));
      if (shadow.length < 3) shadow.push(...listening.slice(0, 6 - shadow.length));

      const acts = chosenActivities.filter((a) => {
        if (a === "warmup") return warmupItems.length > 0;
        if (a === "grammar") return grammar.length > 0;
        if (a === "reading") return readingTexts.length > 0;
        if (a === "listening") return listening.length > 0;
        if (a === "writing") return writing.length > 0;
        if (a === "shadowing") return shadow.length > 0;
        if (a === "match") return drill.length >= 2;
        return drill.length > 0;
      });
      if (!acts.length) {
        setError("V zvolených lekciách nie je nič na precvičenie.");
        setPhase("setup");
        return;
      }

      const newPlan: Plan = {
        drill,
        warmup: toDrill(warmupItems, s.direction),
        pool: toDrill(content.vocab, s.direction),
        grammar,
        texts: readingTexts,
        listening,
        shadow,
        writing,
        activities: acts,
        lessonTitles: reviewMode ? ["Opakovanie chýb"] : selectedLessons.map((l) => l.title),
      };

      const { data: row, error: e } = await supabase()
        .from("sessions")
        .insert({ child_id: child.id, lesson_ids: setup.lessonIds, config: { ...setup, activities: acts, reviewMode } })
        .select("id")
        .single();
      if (e) throw e;

      // pre-generate every sound of the session so practice has no waiting
      const say: { text: string; lang: Lang }[] = [];
      const add = (text: string | null | undefined, lang: Lang) => text && say.push({ text, lang });
      for (const v of [...drill, ...newPlan.warmup]) {
        add(v.en, "en");
        add(v.sk, "sk");
        add(v.example_en, "en");
      }
      for (const g of grammar) add(g.prompt.replace(/_{2,}/, g.answer.split("|")[0].trim()), "en");
      if (acts.includes("listening"))
        for (const t of listening) {
          add(t.en, "en");
          add(t.sk, "sk");
        }
      if (acts.includes("reading")) for (const t of readingTexts.flatMap((x) => x.sentences)) add(t.en, "en");
      if (acts.includes("writing")) for (const t of writing) add(t.en, "en");
      for (const t of shadow) add(t.en, "en");
      const unique = [...new Map(say.map((x) => [`${x.lang}|${x.text}`, x])).values()];
      setPrep({ done: 0, total: unique.length });
      await prefetch(unique, { gender: s.voice, slow: s.slowSpeech }, (done, total) => setPrep({ done, total }));

      setPlan(newPlan);
      setSessionId(row.id as string);
      setStep(0);
      setStartedAt(nowMs());
      setPhase("run");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hodinu sa nepodarilo pripraviť.");
      setPhase("setup");
    }
  }

  if (!child || !setup) return <Spinner />;

  if (phase === "run" && plan && sessionId)
    return (
      <Runner
        child={child}
        settings={settings}
        plan={plan}
        sessionId={sessionId}
        progress={progress}
        step={step}
        setStep={setStep}
        startedAt={startedAt}
        onFinish={(s) => {
          setSummary(s);
          setPhase("summary");
        }}
      />
    );

  if (phase === "summary" && summary) return <Summary data={summary} child={child} settings={settings} />;

  if (phase === "preparing")
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-6xl">{child.avatar}</div>
        <p className="text-xl font-black">Pripravujem hodinu…</p>
        {prep.total > 0 && (
          <div className="w-full max-w-xs">
            <Progress value={prep.done} total={prep.total} />
            <p className="text-sm text-slate mt-2">
              Nahrávam hlas {prep.done} / {prep.total}
            </p>
          </div>
        )}
      </main>
    );

  const canStart = (reviewMode ? problemCount > 0 : setup.lessonIds.length > 0) && chosenActivities.length > 0;

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-4 pb-6 flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link href={`/dieta?id=${child.id}`} className="size-10 inline-flex items-center justify-center rounded-xl hover:bg-ink/5" aria-label="Späť">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-black">{reviewMode ? "Opakovanie chýb" : "Nová hodina"}</h1>
      </header>

      {reviewMode ? (
        <Card className="p-5">
          <p className="font-bold">{problemCount > 0 ? `${problemCount} slovíčok, ktoré ti robili problém.` : "Žiadne problémové slovíčka. Výborne!"}</p>
        </Card>
      ) : (
        <section>
          <h2 className="font-black mb-2">Lekcie</h2>
          {lessons.length === 0 ? (
            <Card className="p-5 text-slate">Zatiaľ žiadne lekcie. Popros rodiča, nech nejakú pridá.</Card>
          ) : (
            <div className="space-y-2">
              {lessons.map((l) => {
                const on = setup.lessonIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSetup({ ...setup, lessonIds: on ? setup.lessonIds.filter((x) => x !== l.id) : [...setup.lessonIds, l.id] })}
                    className={cx(
                      "w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
                      on ? "bg-sun-soft border-sun-deep" : "bg-card border-line",
                    )}
                  >
                    <span
                      className={cx(
                        "size-6 rounded-lg border-2 flex items-center justify-center shrink-0",
                        on ? "bg-ink border-ink text-white" : "border-line",
                      )}
                    >
                      {on && <Check className="size-4" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-black truncate">{l.title}</span>
                      <span className="block text-sm text-slate">
                        {l.vocab} slovíčok{l.grammar ? ` · ${l.grammar} gramatika` : ""}
                        {l.writing ? ` · ${l.writing} viet` : ""}
                        {l.texts ? ` · ${l.texts} text` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="font-black mb-2">Čo budeme robiť</h2>
        <Card className="divide-y divide-line">
          {orderedActivities.map((a) => {
            const on = setup.activities.includes(a);
            const idx = chosenActivities.indexOf(a);
            return (
              <div key={a} className="flex items-center gap-2 px-3 py-2">
                <button type="button" aria-pressed={on} onClick={() => toggleActivity(a)} className="flex-1 flex items-center gap-3 py-1.5 text-left">
                  <span
                    className={cx(
                      "size-6 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs font-black",
                      on ? "bg-ink border-ink text-white" : "border-line",
                    )}
                  >
                    {on ? idx + 1 : ""}
                  </span>
                  <span className={cx("font-bold", !on && "text-slate")}>{activityLabel(a)}</span>
                </button>
                {on && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(a, -1)}
                      disabled={idx === 0}
                      className="size-9 rounded-lg hover:bg-paper disabled:opacity-30 inline-flex items-center justify-center"
                      aria-label="Posunúť vyššie"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(a, 1)}
                      disabled={idx === chosenActivities.length - 1}
                      className="size-9 rounded-lg hover:bg-paper disabled:opacity-30 inline-flex items-center justify-center"
                      aria-label="Posunúť nižšie"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      <section>
        <button type="button" onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 font-black" aria-expanded={showOptions}>
          Možnosti <ChevronDown className={cx("size-4 transition-transform", showOptions && "rotate-180")} />
        </button>
        {showOptions && (
          <div className="mt-3 space-y-3">
            <Segmented
              value={setup.direction}
              onChange={(v) => setSetup({ ...setup, direction: v })}
              options={[
                { value: "en_sk", label: "EN → SK" },
                { value: "sk_en", label: "SK → EN" },
                { value: "mixed", label: "Oba smery" },
              ]}
            />
            <Segmented
              value={setup.answerMode}
              onChange={(v) => setSetup({ ...setup, answerMode: v })}
              options={[
                { value: "written", label: "Písomne" },
                { value: "oral", label: "Ústne" },
              ]}
            />
            <Segmented
              value={setup.hintMode}
              onChange={(v) => setSetup({ ...setup, hintMode: v })}
              options={[
                { value: "blanks", label: "Prázdne políčka" },
                { value: "audio", label: "Zvuková nápoveda" },
                { value: "reveal", label: "Odkrývanie" },
              ]}
            />
          </div>
        )}
      </section>

      {error && <p className="rounded-xl bg-tomato-soft text-tomato px-3 py-2 font-semibold">{error}</p>}

      <div className="sticky bottom-0 mt-auto pt-3 bg-gradient-to-t from-paper via-paper to-paper/0 safe-bottom">
        <Button size="xl" variant="sun" onClick={start} disabled={!canStart}>
          Začať
        </Button>
      </div>
    </main>
  );
}

export function Runner({
  child,
  settings,
  plan,
  sessionId,
  progress,
  step,
  setStep,
  startedAt,
  onFinish,
}: {
  child: Child;
  settings: ChildSettings;
  plan: Plan;
  /** null = demo mode, nothing is saved */
  sessionId: string | null;
  progress: Map<string, ItemProgress>;
  step: number;
  setStep: (n: number) => void;
  startedAt: number;
  onFinish: (s: SummaryData) => void;
}) {
  const vocabById = useMemo(() => new Map([...plan.pool, ...plan.warmup].map((v) => [v.id, v])), [plan]);
  const { ctx, bubble, stats, wrongWords, xp, totals, flush } = useSessionEngine({
    child,
    settings,
    oral: settings.answerMode === "oral",
    sessionId,
    progress,
    vocabById,
  });
  const finishing = useRef(false);
  const total = plan.activities.length;
  const current = plan.activities[step];

  useEffect(() => {
    if (settings.motivation) ctx.announce(phrases.start(child.name), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    stopSpeaking();
    await flush();
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const activities = plan.activities.map((k) => {
      const st = stats.current.get(k) ?? { total: 0, correct: 0 };
      return { key: k, label: activityLabel(k), total: st.total, correct: st.correct };
    });
    const problemWords = [...wrongWords.current.values()].map((v) => ({ id: v.id, en: v.en, sk: v.sk }));
    const xpEarned = xp.current;
    const { total: t, correct: c } = totals.current;

    const today = todayISO();
    const yesterday = new Date(Date.now() - 86400000);
    const yISO = new Date(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const streak = child.last_practice_date === today ? child.streak_days : child.last_practice_date === yISO ? child.streak_days + 1 : 1;

    let todayXp = xpEarned;
    if (sessionId) {
      const sb = supabase();
      await Promise.all([
        sb
          .from("sessions")
          .update({
            ended_at: new Date().toISOString(),
            total: t,
            correct: c,
            xp_earned: xpEarned,
            summary: { durationSec, activities, problemWords, lessonTitles: plan.lessonTitles },
          })
          .eq("id", sessionId),
        sb
          .from("children")
          .update({ xp: child.xp + xpEarned, streak_days: streak, last_practice_date: today })
          .eq("id", child.id),
      ]);
      const { data: todays } = await sb.from("sessions").select("xp_earned").eq("child_id", child.id).gte("started_at", `${today}T00:00:00`);
      todayXp = (todays ?? []).reduce((a, r) => a + ((r.xp_earned as number) ?? 0), 0);
    }
    if (settings.motivation) ctx.announce(phrases.finish(child.name), true);
    onFinish({ durationSec, activities, problemWords, xpEarned, total: t, correct: c, streak, todayXp });
  }, [child, ctx, flush, stats, wrongWords, xp, totals, onFinish, plan, sessionId, settings.motivation, startedAt]);

  const next = useCallback(() => {
    const n = step + 1;
    if (n >= total) {
      finish();
      return;
    }
    if (total >= 3 && n === Math.floor(total / 2) && settings.motivation) ctx.announce(phrases.halfway(child.name), true);
    setStep(n);
  }, [step, total, finish, settings.motivation, ctx, child.name, setStep]);

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-3 flex flex-col">
      <header className="flex items-center gap-2 mb-4">
        <button
          type="button"
          aria-label="Ukončiť hodinu"
          className="size-10 inline-flex items-center justify-center rounded-xl hover:bg-ink/5 text-slate"
          onClick={() => {
            if (confirm("Ukončiť hodinu? Doterajšie výsledky sa uložia.")) finish();
          }}
        >
          <X className="size-6" />
        </button>
        <div className="flex-1 text-center">
          <div className="font-black">{activityLabel(current)}</div>
          {total > 1 && (
            <div className="flex justify-center gap-1 mt-1" aria-label={`Časť ${step + 1} z ${total}`}>
              {plan.activities.map((a, i) => (
                <span key={a + i} className={cx("h-1.5 rounded-full transition-all", i < step ? "w-4 bg-leaf" : i === step ? "w-6 bg-ink" : "w-4 bg-line")} />
              ))}
            </div>
          )}
        </div>
        <span className="size-10 inline-flex items-center justify-center text-2xl" aria-hidden>
          {child.avatar}
        </span>
      </header>

      <div className="relative h-0">
        {bubble && (
          <div
            key={bubble.id}
            role="status"
            className={cx(
              "absolute left-1/2 -translate-x-1/2 -top-1 z-10 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-black shadow-sm anim-pop",
              bubble.tone === "streak"
                ? "bg-sun text-ink"
                : bubble.tone === "reassure"
                  ? "bg-sky-soft text-sky"
                  : bubble.tone === "info"
                    ? "bg-ink text-white"
                    : "bg-leaf-soft text-leaf",
            )}
          >
            {bubble.text}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col pt-6" key={`${current}-${step}`}>
        {current === "warmup" && <Classic items={plan.warmup} ctx={ctx} onDone={next} activity="warmup" hintMode={settings.hintMode} />}
        {current === "flashcards" && <Flashcards items={plan.drill} ctx={ctx} onDone={next} />}
        {current === "classic" && <Classic items={plan.drill} ctx={ctx} onDone={next} hintMode={settings.hintMode} />}
        {current === "match" && <Match items={plan.drill} ctx={ctx} onDone={next} />}
        {current === "scramble" && <Scramble items={plan.drill} ctx={ctx} onDone={next} />}
        {current === "dictation" && <Classic items={plan.drill} ctx={ctx} onDone={next} activity="dictation" hintMode="blanks" mode="dictation" />}
        {current === "speed" && <Speed items={plan.drill} pool={plan.pool} ctx={ctx} onDone={next} />}
        {current === "shadowing" && <Shadowing sentences={plan.shadow} ctx={ctx} onDone={next} />}
        {current === "grammar" && <Grammar items={plan.grammar} ctx={ctx} onDone={next} />}
        {current === "writing" && <Writing items={plan.writing} ctx={ctx} onDone={next} />}
        {current === "reading" && <Reading texts={plan.texts} ctx={ctx} onDone={next} />}
        {current === "listening" && <Listening sentences={plan.listening} ctx={ctx} onDone={next} />}
      </div>
    </main>
  );
}
