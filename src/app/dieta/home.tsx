"use client";

import { Flame, Lock, RotateCcw, Star, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Progress } from "@/components/session/parts";
import { buttonClass, Card, Spinner } from "@/components/ui";
import { getChild, todayISO } from "@/lib/data";
import { getLockedChild } from "@/lib/device";
import { mergeSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import type { Child, SessionRow } from "@/lib/types";

export default function ChildHome() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const [child, setChild] = useState<Child | null>(null);
  const [problems, setProblems] = useState(0);
  const [todayXp, setTodayXp] = useState(0);
  const [last, setLast] = useState<SessionRow | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setLocked(!!getLockedChild());
    if (!id) {
      router.replace("/");
      return;
    }
    (async () => {
      const sb = supabase();
      const today = todayISO();
      const [c, p, t, l] = await Promise.all([
        getChild(id),
        sb
          .from("item_progress")
          .select("item_id", { count: "exact", head: true })
          .eq("child_id", id)
          .eq("item_type", "vocab")
          .gt("wrong_count", 0)
          .lte("box", 2),
        sb.from("sessions").select("xp_earned").eq("child_id", id).gte("started_at", `${today}T00:00:00`),
        sb.from("sessions").select("*").eq("child_id", id).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(1),
      ]);
      if (!c) {
        router.replace("/");
        return;
      }
      setChild(c);
      setProblems(p.count ?? 0);
      setTodayXp((t.data ?? []).reduce((a, r) => a + ((r.xp_earned as number) ?? 0), 0));
      setLast(((l.data ?? [])[0] as SessionRow) ?? null);
    })();
  }, [id, router]);

  if (!child) return <Spinner />;
  const s = mergeSettings(child.settings);
  const g = s.methods.gamification;
  const lastPct = last && last.total ? Math.round((last.correct / last.total) * 100) : null;
  const practicedToday = child.last_practice_date === todayISO();

  return (
    <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        {locked ? (
          <span />
        ) : (
          <Link href="/" className="h-10 px-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-bold text-slate hover:bg-ink/5">
            <Users className="size-4" /> Profily
          </Link>
        )}
        <Link href="/rodic" className="h-10 px-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-bold text-slate hover:bg-ink/5">
          <Lock className="size-4" /> Rodič
        </Link>
      </header>

      <section className="text-center pt-4">
        <div className="text-8xl leading-none">{child.avatar}</div>
        <h1 className="text-4xl font-black mt-3">Ahoj, {child.name}!</h1>
        <p className="text-slate font-bold mt-1">{practicedToday ? "Dnes už máš hodinu za sebou. Ďalšia?" : "Poďme si zopakovať angličtinu."}</p>
      </section>

      {g && (
        <Card className="p-4 space-y-3">
          <div className="flex justify-between font-black">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="size-5 text-tomato" /> {child.streak_days} {child.streak_days === 1 ? "deň" : child.streak_days < 5 ? "dni" : "dní"} v rade
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-5 text-sun-deep" /> {child.xp} bodov
            </span>
          </div>
          <div>
            <div className="flex justify-between text-sm font-bold text-slate mb-1.5">
              <span>Dnešný cieľ</span>
              <span>
                {Math.min(todayXp, s.dailyGoal)} / {s.dailyGoal}
              </span>
            </div>
            <Progress value={todayXp} total={s.dailyGoal} />
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 mt-auto">
        <Link href={`/hodina?dieta=${child.id}`} className={buttonClass("sun", "xl", "!h-20 !text-2xl")}>
          Začať hodinu
        </Link>
        {problems > 0 && (
          <Link href={`/hodina?dieta=${child.id}&rezim=chyby`} className={buttonClass("outline", "xl")}>
            <RotateCcw className="size-5" /> Opakovať chyby ({problems})
          </Link>
        )}
        {lastPct !== null && last && (
          <p className="text-center text-sm font-bold text-slate">
            Minulá hodina: {lastPct} % · {new Date(last.started_at).toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "numeric" })}
          </p>
        )}
      </div>
    </main>
  );
}
