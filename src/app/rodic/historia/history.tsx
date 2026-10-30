"use client";

import { ChevronDown } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, cx, Segmented, Spinner } from "@/components/ui";
import { listChildren } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Child, SessionRow } from "@/lib/types";

type Problem = { id: string; en: string; sk: string; wrong: number; box: number };

function fmtDuration(sec?: number) {
  if (!sec) return "–";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export default function History() {
  const focus = useSearchParams().get("hodina");
  const [children, setChildren] = useState<Child[] | null>(null);
  const [childId, setChildId] = useState<string>("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [open, setOpen] = useState<string | null>(focus);

  useEffect(() => {
    listChildren().then((c) => {
      setChildren(c);
      if (c[0]) setChildId(c[0].id);
    });
  }, []);

  useEffect(() => {
    if (!childId) return;
    const sb = supabase();
    (async () => {
      const [s, p] = await Promise.all([
        sb.from("sessions").select("*").eq("child_id", childId).not("ended_at", "is", null).order("started_at", { ascending: false }).limit(50),
        sb
          .from("item_progress")
          .select("item_id, wrong_count, box")
          .eq("child_id", childId)
          .eq("item_type", "vocab")
          .gt("wrong_count", 0)
          .order("box")
          .order("wrong_count", { ascending: false })
          .limit(40),
      ]);
      setSessions((s.data ?? []) as SessionRow[]);
      const prog = (p.data ?? []) as { item_id: string; wrong_count: number; box: number }[];
      if (prog.length) {
        const { data: items } = await sb
          .from("vocab_items")
          .select("id, en, sk")
          .in(
            "id",
            prog.map((x) => x.item_id),
          );
        const map = new Map((items ?? []).map((i) => [i.id as string, i as { id: string; en: string; sk: string }]));
        setProblems(prog.filter((x) => map.has(x.item_id)).map((x) => ({ ...map.get(x.item_id)!, wrong: x.wrong_count, box: x.box })));
      } else setProblems([]);
    })();
  }, [childId]);

  const totals = useMemo(() => {
    const t = sessions.reduce((a, s) => ({ total: a.total + s.total, correct: a.correct + s.correct, sec: a.sec + (s.summary?.durationSec ?? 0) }), {
      total: 0,
      correct: 0,
      sec: 0,
    });
    return { ...t, pct: t.total ? Math.round((t.correct / t.total) * 100) : 0 };
  }, [sessions]);

  if (!children) return <Spinner />;
  if (!children.length) return <p className="text-slate">Zatiaľ žiadne deti.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">História</h1>
        {children.length > 1 && (
          <Segmented value={childId} onChange={setChildId} options={children.map((c) => ({ value: c.id, label: `${c.avatar} ${c.name}` }))} />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Hodín</div>
          <div className="text-2xl font-black">{sessions.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Úspešnosť</div>
          <div className="text-2xl font-black">{totals.pct} %</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold text-slate">Čas spolu</div>
          <div className="text-2xl font-black">{Math.round(totals.sec / 60)} min</div>
        </Card>
      </div>

      <section>
        <h2 className="text-lg font-black mb-3">Problémové slovíčka</h2>
        {problems.length === 0 ? (
          <Card className="p-5 text-slate">Žiadne. Keď dieťa urobí chybu, slovíčko sa tu objaví a v hodinách sa bude vracať častejšie.</Card>
        ) : (
          <Card className="p-4 flex flex-wrap gap-2">
            {problems.map((p) => (
              <span
                key={p.id}
                className={cx(
                  "rounded-xl px-3 py-1.5 text-sm font-bold border",
                  p.box <= 2 ? "bg-tomato-soft border-tomato/30 text-tomato" : "bg-paper border-line text-ink-soft",
                )}
                title={`Chyby: ${p.wrong}, úroveň ${p.box}/5`}
              >
                {p.en} <span className="font-semibold opacity-70">– {p.sk}</span> <span className="opacity-60">×{p.wrong}</span>
              </span>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-black mb-3">Hodiny</h2>
        {sessions.length === 0 ? (
          <Card className="p-5 text-slate">Zatiaľ žiadna dokončená hodina.</Card>
        ) : (
          <Card className="divide-y divide-line">
            {sessions.map((s) => {
              const pct = s.total ? Math.round((s.correct / s.total) * 100) : null;
              const isOpen = open === s.id;
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-paper/60"
                    onClick={() => setOpen(isOpen ? null : s.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="font-bold block">
                        {new Date(s.started_at).toLocaleString("sk-SK", {
                          weekday: "long",
                          day: "numeric",
                          month: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-sm text-slate block truncate">
                        {s.summary?.lessonTitles?.join(", ")} · {fmtDuration(s.summary?.durationSec)}
                      </span>
                    </span>
                    {pct !== null && <span className={cx("font-black", pct >= 80 ? "text-leaf" : pct >= 50 ? "text-sun-deep" : "text-tomato")}>{pct} %</span>}
                    <ChevronDown className={cx("size-5 text-mist transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(s.summary?.activities ?? []).map((a) => (
                          <div key={a.key} className="rounded-xl bg-paper px-3 py-2 flex justify-between text-sm">
                            <span className="font-bold">{a.label}</span>
                            <span>{a.total ? `${a.correct} / ${a.total}` : "hotovo"}</span>
                          </div>
                        ))}
                      </div>
                      {!!s.summary?.problemWords?.length && (
                        <div className="text-sm">
                          <span className="font-bold">Chyby v tejto hodine: </span>
                          {s.summary.problemWords.map((w) => `${w.en} (${w.sk})`).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
