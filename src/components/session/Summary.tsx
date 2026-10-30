"use client";

import { Flame, Star } from "lucide-react";
import Link from "next/link";
import { speak } from "@/lib/speech";
import type { ActivityKey, Child, ChildSettings } from "@/lib/types";
import { buttonClass, Card, SpeakButton } from "../ui";
import { Progress } from "./parts";

export type SummaryData = {
  durationSec: number;
  activities: { key: ActivityKey; label: string; total: number; correct: number }[];
  problemWords: { id: string; en: string; sk: string }[];
  xpEarned: number;
  total: number;
  correct: number;
  streak: number;
  todayXp: number;
};

function headline(pct: number | null) {
  if (pct === null) return "Hodina je hotová!";
  if (pct >= 90) return "Úžasný výkon!";
  if (pct >= 70) return "Veľmi dobrá práca!";
  if (pct >= 50) return "Dobrá práca, ide to!";
  return "Dobrý tréning, nabudúce to bude lepšie!";
}

export default function Summary({
  data,
  child,
  settings,
  doneHref,
  reviewHref,
}: {
  data: SummaryData;
  child: Child;
  settings: ChildSettings;
  doneHref?: string;
  reviewHref?: string | null;
}) {
  const done = doneHref ?? `/dieta?id=${child.id}`;
  const review = reviewHref === undefined ? `/hodina?dieta=${child.id}&rezim=chyby` : reviewHref;
  const pct = data.total ? Math.round((data.correct / data.total) * 100) : null;
  const min = Math.floor(data.durationSec / 60);
  const sec = data.durationSec % 60;
  const g = settings.methods.gamification;
  const voice = { gender: settings.voice, slow: settings.slowSpeech };

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="text-center anim-rise">
        <div className="text-7xl leading-none mb-3">{child.avatar}</div>
        <h1 className="text-3xl font-black">{headline(pct)}</h1>
        {pct !== null && (
          <p className="text-lg font-bold text-slate mt-1">
            Správne {data.correct} z {data.total} · {pct} %
          </p>
        )}
        <p className="text-sm text-mist font-bold mt-1">
          {min ? `${min} min ` : ""}
          {sec} s
        </p>
      </div>

      {g && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <Star className="size-6 mx-auto text-sun-deep" />
            <div className="text-2xl font-black">+{data.xpEarned}</div>
            <div className="text-xs font-bold text-slate">bodov</div>
          </Card>
          <Card className="p-4 text-center">
            <Flame className="size-6 mx-auto text-tomato" />
            <div className="text-2xl font-black">{data.streak}</div>
            <div className="text-xs font-bold text-slate">{data.streak === 1 ? "deň v rade" : data.streak < 5 ? "dni v rade" : "dní v rade"}</div>
          </Card>
          <Card className="p-4 col-span-2">
            <div className="flex justify-between text-sm font-bold mb-2">
              <span>Denný cieľ</span>
              <span>
                {Math.min(data.todayXp, settings.dailyGoal)} / {settings.dailyGoal}
              </span>
            </div>
            <Progress value={data.todayXp} total={settings.dailyGoal} />
          </Card>
        </div>
      )}

      <Card className="divide-y divide-line">
        {data.activities.map((a) => (
          <div key={a.key} className="flex justify-between px-4 py-3">
            <span className="font-bold">{a.label}</span>
            <span className="font-black">{a.total ? `${a.correct} / ${a.total}` : "hotovo"}</span>
          </div>
        ))}
      </Card>

      {data.problemWords.length > 0 && (
        <section>
          <h2 className="font-black mb-2">Tieto slovíčka si ešte zopakujeme</h2>
          <Card className="divide-y divide-line">
            {data.problemWords.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <SpeakButton size="sm" onClick={() => speak(w.en, "en", voice)} />
                <span className="font-black">{w.en}</span>
                <span className="text-slate">{w.sk}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <div className="mt-auto flex flex-col gap-2 safe-bottom">
        {data.problemWords.length > 0 && review && (
          <a href={review} className={buttonClass("sun", "xl")}>
            Precvičiť chyby
          </a>
        )}
        <Link href={done} className={buttonClass(data.problemWords.length && review ? "outline" : "primary", "xl")}>
          Hotovo
        </Link>
      </div>
    </main>
  );
}
