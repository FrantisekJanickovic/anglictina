"use client";

import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Spinner, buttonClass } from "@/components/ui";
import { listLessons, type LessonWithCounts } from "@/lib/data";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithCounts[] | null>(null);
  useEffect(() => {
    listLessons()
      .then(setLessons)
      .catch(() => setLessons([]));
  }, []);
  if (!lessons) return <Spinner />;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-black">Lekcie</h1>
        <Link href="/rodic/lekcia" className={buttonClass("primary", "sm")}>
          <Plus className="size-4" /> Nová lekcia
        </Link>
      </div>
      {lessons.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate mb-4">Zatiaľ žiadne lekcie. Odfoť stranu z učebnice alebo prepíš slovíčka do formulára.</p>
          <Link href="/rodic/lekcia" className={buttonClass("primary", "md")}>
            <Plus className="size-4" /> Pridať lekciu
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lessons.map((l) => (
            <Link key={l.id} href={`/rodic/lekcia?id=${l.id}`}>
              <Card className="p-5 h-full hover:border-mist transition-colors">
                <div className="flex items-start gap-3">
                  <BookOpen className="size-5 text-sky mt-1 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="font-black text-lg leading-tight">{l.title}</h2>
                    <p className="text-sm text-slate">
                      {[l.textbook, l.unit, l.grade ? `${l.grade}. ročník` : null].filter(Boolean).join(" · ") || "Bez učebnice"}
                    </p>
                    <p className="text-sm font-bold mt-2 text-ink-soft">
                      {l.vocab} slovíčok · {l.grammar} gramatika · {l.texts} texty
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
