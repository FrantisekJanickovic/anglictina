"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toDrill } from "@/components/session/engine";
import Summary, { type SummaryData } from "@/components/session/Summary";
import { Button, Card, cx } from "@/components/ui";
import { Runner, type Plan } from "@/app/hodina/session";
import { ACTIVITIES, DEFAULT_SETTINGS } from "@/lib/settings";
import { unlockAudio } from "@/lib/speech";
import { nowMs } from "@/lib/text";
import type { ActivityKey, Child, ChildSettings, GrammarItem, ItemProgress, LessonText, VocabItem } from "@/lib/types";

/** A sample lesson to try every activity without an account. Nothing is saved. */
const L = "demo-lesson";
const V = (n: number, en: string, sk: string, example_en: string, example_sk: string, emoji: string): VocabItem => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  lesson_id: L,
  en,
  sk,
  example_en,
  example_sk,
  emoji,
  position: n,
});

const VOCAB: VocabItem[] = [
  V(1, "mother", "mama, matka", "My mother is a doctor.", "Moja mama je lekárka.", "👩"),
  V(2, "father", "otec, ocko", "My father likes football.", "Môj otec má rád futbal.", "👨"),
  V(3, "sister", "sestra", "I have got one sister.", "Mám jednu sestru.", "👧"),
  V(4, "brother", "brat", "My brother is ten.", "Môj brat má desať rokov.", "👦"),
  V(5, "grandmother", "stará mama, babka", "Grandmother makes good cakes.", "Babka robí dobré koláče.", "👵"),
  V(6, "dog", "pes", "Our dog is very big.", "Náš pes je veľmi veľký.", "🐶"),
  V(7, "house", "dom", "We live in a small house.", "Bývame v malom dome.", "🏠"),
  V(8, "happy", "šťastný", "The children are happy.", "Deti sú šťastné.", "😊"),
];

const GRAMMAR: GrammarItem[] = [
  {
    id: "g1",
    lesson_id: L,
    prompt: "She ___ got a brother.",
    answer: "has",
    options: ["has", "have", "is"],
    translation_sk: "Ona má brata.",
    explanation_sk: "Pri he, she, it používame has got.",
    position: 0,
  },
  {
    id: "g2",
    lesson_id: L,
    prompt: "I ___ got a dog.",
    answer: "have",
    options: ["has", "have", "am"],
    translation_sk: "Mám psa.",
    explanation_sk: "Pri I, you, we, they používame have got.",
    position: 1,
  },
  {
    id: "g3",
    lesson_id: L,
    prompt: "My father ___ a teacher.",
    answer: "is",
    options: ["is", "are", "am"],
    translation_sk: "Môj otec je učiteľ.",
    explanation_sk: "Pri he, she, it používame is.",
    position: 2,
  },
  {
    id: "g4",
    lesson_id: L,
    prompt: "We ___ happy.",
    answer: "are|'re",
    options: ["is", "are", "am"],
    translation_sk: "Sme šťastní.",
    explanation_sk: "Pri we, you, they používame are.",
    position: 3,
  },
];

const TEXTS: LessonText[] = [
  {
    id: "t1",
    lesson_id: L,
    title: "My family",
    position: 0,
    sentences: [
      { en: "Hello, I am Tom.", sk: "Ahoj, ja som Tom." },
      { en: "I have got a sister and a brother.", sk: "Mám sestru a brata." },
      { en: "My mother is a doctor and my father is a teacher.", sk: "Moja mama je lekárka a môj otec je učiteľ." },
      { en: "We have got a big dog. His name is Max.", sk: "Máme veľkého psa. Volá sa Max." },
    ],
  },
];

const ALL_ON = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.methods).map((k) => [k, true])) as ChildSettings["methods"];

const CHILD: Child = {
  id: "demo",
  name: "Miško",
  avatar: "🦊",
  grade: 4,
  level: "zaciatocnik",
  questionnaire: {},
  settings: {},
  xp: 0,
  streak_days: 0,
  last_practice_date: null,
};

export default function Demo() {
  const [picked, setPicked] = useState<ActivityKey[]>(["flashcards", "classic"]);
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [direction, setDirection] = useState<"en_sk" | "sk_en" | "mixed">("en_sk");
  const [running, setRunning] = useState<Plan | null>(null);
  const [step, setStep] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const progress = useMemo(() => new Map<string, ItemProgress>(), []);

  const settings: ChildSettings = { ...DEFAULT_SETTINGS, voice, direction, methods: { ...ALL_ON, interleaving: false } };
  const acts = ACTIVITIES.filter((a) => a.key !== "warmup");

  function start() {
    unlockAudio();
    const drill = toDrill(VOCAB, direction);
    setRunning({
      drill,
      warmup: [],
      pool: drill,
      grammar: GRAMMAR,
      texts: TEXTS,
      listening: TEXTS[0].sentences,
      shadow: VOCAB.slice(0, 4).map((v) => ({ en: v.example_en!, sk: v.example_sk! })),
      activities: acts.map((a) => a.key).filter((k) => picked.includes(k)),
      lessonTitles: ["Ukážka: My family"],
    });
    setStep(0);
    setStartedAt(nowMs());
    setSummary(null);
  }

  if (summary) return <Summary data={summary} child={CHILD} settings={settings} doneHref="/ukazka" reviewHref={null} />;
  if (running)
    return (
      <Runner
        child={CHILD}
        settings={settings}
        plan={running}
        sessionId={null}
        progress={progress}
        step={step}
        setStep={setStep}
        startedAt={startedAt}
        onFinish={(s) => {
          setRunning(null);
          setSummary(s);
        }}
      />
    );

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-5 flex flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-bold text-slate">
        <ArrowLeft className="size-4" /> Späť
      </Link>
      <div>
        <h1 className="text-3xl font-black">Ukážková hodina</h1>
        <p className="text-slate mt-1">Lekcia „My family“ s 8 slovíčkami, gramatikou a textom. Nič sa neukladá.</p>
      </div>
      <Card className="divide-y divide-line">
        {acts.map((a) => {
          const on = picked.includes(a.key);
          return (
            <button
              key={a.key}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked(on ? picked.filter((x) => x !== a.key) : [...picked, a.key])}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className={cx("size-6 rounded-lg border-2 flex items-center justify-center", on ? "bg-ink border-ink text-white" : "border-line")}>
                {on && <Check className="size-4" />}
              </span>
              <span className="font-bold">{a.label}</span>
            </button>
          );
        })}
      </Card>
      <div className="flex flex-wrap gap-2">
        {(["female", "male"] as const).map((v) => (
          <Button key={v} size="sm" variant={voice === v ? "primary" : "outline"} onClick={() => setVoice(v)}>
            {v === "female" ? "Ženský hlas" : "Mužský hlas"}
          </Button>
        ))}
        {(["en_sk", "sk_en", "mixed"] as const).map((d) => (
          <Button key={d} size="sm" variant={direction === d ? "primary" : "outline"} onClick={() => setDirection(d)}>
            {d === "en_sk" ? "EN → SK" : d === "sk_en" ? "SK → EN" : "Oba smery"}
          </Button>
        ))}
      </div>
      <Button size="xl" variant="sun" onClick={start} disabled={!picked.length}>
        Spustiť ukážku
      </Button>
    </main>
  );
}
