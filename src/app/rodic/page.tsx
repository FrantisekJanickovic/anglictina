"use client";

import { BookOpen, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Spinner, buttonClass } from "@/components/ui";
import { listChildren, listLessons, type LessonWithCounts } from "@/lib/data";
import { LEVELS } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import type { Child, SessionRow } from "@/lib/types";

type Stats = Record<string, { problems: number; sessions: number }>;

export default function ParentHome() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [lessons, setLessons] = useState<LessonWithCounts[]>([]);
  const [recent, setRecent] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const [c, l, s, p] = await Promise.all([
        listChildren(),
        listLessons(),
        sb.from("sessions").select("*").not("ended_at", "is", null).order("started_at", { ascending: false }).limit(6),
        sb.from("problem_items").select("child_id").eq("mastered", false),
      ]);
      setChildren(c);
      setLessons(l);
      setRecent((s.data ?? []) as SessionRow[]);
      const st: Stats = {};
      for (const ch of c) st[ch.id] = { problems: 0, sessions: 0 };
      for (const row of (p.data ?? []) as { child_id: string }[]) {
        if (st[row.child_id]) st[row.child_id].problems++;
      }
      setStats(st);
    })().catch(() => setChildren([]));
  }, []);

  if (!children) return <Spinner />;
  const childName = (id: string) => children.find((c) => c.id === id);

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-end justify-between mb-4">
          <h1 className="text-2xl font-black">Deti</h1>
          <Link href="/rodic/dieta" className={buttonClass("outline", "sm")}>
            <Plus className="size-4" /> Pridať dieťa
          </Link>
        </div>
        {children.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-slate mb-4">Zatiaľ tu nie je žiadne dieťa. Vytvor prvý profil.</p>
            <Link href="/rodic/dieta" className={buttonClass("primary", "md")}>
              <Plus className="size-4" /> Vytvoriť profil
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {children.map((c) => (
              <Card key={c.id} className="p-5 flex gap-4 items-start">
                <span className="text-5xl leading-none">{c.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-black truncate">{c.name}</h2>
                    <Link href={`/rodic/dieta?id=${c.id}`} aria-label={`Upraviť profil ${c.name}`} className={buttonClass("ghost", "sm")}>
                      <Pencil className="size-4" /> Upraviť
                    </Link>
                  </div>
                  <p className="text-sm text-slate font-semibold">
                    {c.grade}. trieda · {LEVELS.find((l) => l.value === c.level)?.label}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-paper py-2">
                      <dt className="text-xs text-slate font-bold">Séria</dt>
                      <dd className="font-black">{c.streak_days} d</dd>
                    </div>
                    <div className="rounded-xl bg-paper py-2">
                      <dt className="text-xs text-slate font-bold">Body</dt>
                      <dd className="font-black">{c.xp}</dd>
                    </div>
                    <div className="rounded-xl bg-paper py-2">
                      <dt className="text-xs text-slate font-bold">Problémové</dt>
                      <dd className="font-black text-tomato">{stats[c.id]?.problems ?? 0}</dd>
                    </div>
                  </dl>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl font-black">Lekcie</h2>
          <Link href="/rodic/lekcia" className={buttonClass("outline", "sm")}>
            <Plus className="size-4" /> Nová lekcia
          </Link>
        </div>
        {lessons.length === 0 ? (
          <Card className="p-6 text-center text-slate">Pridaj prvú lekciu z učebnice: odfoť stranu so slovíčkami alebo ich prepíš do formulára.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {lessons.slice(0, 5).map((l) => (
              <Link key={l.id} href={`/rodic/lekcia?id=${l.id}`} className="flex items-center gap-3 p-4 hover:bg-paper/60">
                <BookOpen className="size-5 text-sky shrink-0" />
                <span className="font-bold flex-1 truncate">{l.title}</span>
                <span className="text-sm text-slate">{l.vocab} slovíčok</span>
              </Link>
            ))}
            {lessons.length > 5 && (
              <Link href="/rodic/lekcie" className="block p-4 text-sm font-bold text-sky">
                Všetky lekcie ({lessons.length})
              </Link>
            )}
          </Card>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-2xl font-black mb-4">Posledné tréningy</h2>
          <Card className="divide-y divide-line">
            {recent.map((s) => {
              const ch = childName(s.child_id);
              const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
              return (
                <Link key={s.id} href={`/rodic/historia?hodina=${s.id}`} className="flex items-center gap-3 p-4 hover:bg-paper/60">
                  <span className="text-2xl">{ch?.avatar}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold">{ch?.name}</span>
                    <span className="block text-sm text-slate truncate">
                      {new Date(s.started_at).toLocaleString("sk-SK", {
                        weekday: "short",
                        day: "numeric",
                        month: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.summary?.lessonTitles?.length ? ` · ${s.summary.lessonTitles.join(", ")}` : ""}
                    </span>
                  </span>
                  {pct !== null && <span className={`font-black ${pct >= 80 ? "text-leaf" : pct >= 50 ? "text-sun-deep" : "text-tomato"}`}>{pct} %</span>}
                </Link>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
