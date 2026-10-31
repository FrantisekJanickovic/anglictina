"use client";

import { ArrowLeft, Lightbulb, Smartphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Card, cx, ErrorNote, Field, Input, Segmented, SpeakButton, Spinner, Textarea, Toggle } from "@/components/ui";
import { getChild } from "@/lib/data";
import { getLockedChild, setLockedChild } from "@/lib/device";
import { AVATARS, LEVELS, LIKES, mergeSettings, METHODS, recommendSettings, SKILLS } from "@/lib/settings";
import { speak, unlockAudio } from "@/lib/speech";
import { supabase } from "@/lib/supabase";
import type { ChildSettings, Level, MethodKey, Questionnaire } from "@/lib/types";

function Section({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-black">{title}</h2>
      {description && <p className="text-sm text-slate mt-0.5">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function Chips({
  options,
  value,
  onChange,
  tone = "sky",
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  tone?: "sky" | "leaf" | "tomato";
}) {
  const on = { sky: "bg-sky text-white border-sky", leaf: "bg-leaf text-white border-leaf", tomato: "bg-tomato text-white border-tomato" }[tone];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}
            className={cx(
              "h-9 px-3 rounded-full border-2 text-sm font-bold transition-colors",
              active ? on : "bg-card border-line text-ink-soft hover:border-mist",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function ChildEditor() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [loading, setLoading] = useState(!!id);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [grade, setGrade] = useState(3);
  const [level, setLevel] = useState<Level>("zaciatocnik");
  const [q, setQ] = useState<Questionnaire>({});
  const [s, setS] = useState<ChildSettings>(mergeSettings(null));
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLocked(getLockedChild() === id);
    getChild(id).then((c) => {
      if (c) {
        setName(c.name);
        setAvatar(c.avatar);
        setGrade(c.grade);
        setLevel(c.level);
        setQ(c.questionnaire ?? {});
        setS(mergeSettings(c.settings));
      }
      setLoading(false);
    });
  }, [id]);

  const set = <K extends keyof ChildSettings>(k: K, v: ChildSettings[K]) => setS((p) => ({ ...p, [k]: v }));
  const setMethod = (k: MethodKey, v: boolean) => setS((p) => ({ ...p, methods: { ...p.methods, [k]: v } }));

  async function save() {
    if (!name.trim()) {
      setError("Zadaj meno dieťaťa.");
      return;
    }
    setSaving(true);
    setError(null);
    const row = { name: name.trim(), avatar, grade, level, questionnaire: q, settings: s };
    const sb = supabase();
    const res = id ? await sb.from("children").update(row).eq("id", id) : await sb.from("children").insert(row);
    setSaving(false);
    if (res.error) setError(res.error.message);
    else router.push("/rodic");
  }

  async function remove() {
    if (!id || !confirm(`Naozaj zmazať profil ${name} aj s celou históriou?`)) return;
    await supabase().from("children").delete().eq("id", id);
    if (getLockedChild() === id) setLockedChild(null);
    router.push("/rodic");
  }

  function testVoice() {
    unlockAudio();
    speak("Hello! Let's learn English together.", "en", { gender: s.voice, slow: s.slowSpeech }).then(() =>
      speak("Ahoj! Poďme sa spolu učiť angličtinu.", "sk", { gender: s.voice, slow: s.slowSpeech }),
    );
  }

  if (loading) return <Spinner />;

  const core = METHODS.filter((m) => m.core);
  const modern = METHODS.filter((m) => !m.core);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/rodic" className="inline-flex items-center gap-1 text-sm font-bold text-slate hover:text-ink">
        <ArrowLeft className="size-4" /> Prehľad
      </Link>
      <h1 className="text-2xl font-black">{id ? `Profil: ${name}` : "Nový profil dieťaťa"}</h1>

      <Section title="Profil">
        <Field label="Meno">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Miško" />
        </Field>
        <div>
          <span className="block text-sm font-bold text-ink-soft mb-1.5">Obrázok</span>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={avatar === a}
                onClick={() => setAvatar(a)}
                className={cx("size-12 text-3xl rounded-2xl border-2", avatar === a ? "border-sun-deep bg-sun-soft" : "border-transparent hover:bg-paper")}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Trieda">
            <select
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
              className="w-full h-11 rounded-xl border-2 border-line bg-card px-3 font-semibold"
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  {g}. trieda ZŠ
                </option>
              ))}
            </select>
          </Field>
          <Field label="Zdatnosť v angličtine">
            <Segmented value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
          </Field>
        </div>
      </Section>

      <Section title="Dotazník" description="Pomôže nastaviť metódy tak, aby sedeli dieťaťu.">
        <Field label="V čom je silný/á">
          <Chips tone="leaf" options={SKILLS} value={q.strengths ?? []} onChange={(v) => setQ({ ...q, strengths: v })} />
        </Field>
        <Field label="Kde potrebuje pomoc">
          <Chips tone="tomato" options={SKILLS} value={q.weaknesses ?? []} onChange={(v) => setQ({ ...q, weaknesses: v })} />
        </Field>
        <Field label="Čo ho/ju baví">
          <Chips options={LIKES} value={q.likes ?? []} onChange={(v) => setQ({ ...q, likes: v })} />
        </Field>
        <Field label="Ako dlho vydrží sústredene">
          <Segmented
            value={q.attention ?? "medium"}
            onChange={(v) => setQ({ ...q, attention: v })}
            options={[
              { value: "short", label: "do 5 min" },
              { value: "medium", label: "5–10 min" },
              { value: "long", label: "15+ min" },
            ]}
          />
        </Field>
        <Field label="Poznámka">
          <Textarea rows={2} value={q.notes ?? ""} onChange={(e) => setQ({ ...q, notes: e.target.value })} placeholder="napr. pletie si b a d, rád kreslí" />
        </Field>
        <Button
          variant="sun"
          onClick={() => {
            const r = recommendSettings(q, s);
            setS(r.settings);
            setReasons(r.reasons);
          }}
        >
          <Lightbulb className="size-4" /> Nastaviť metódy podľa dotazníka
        </Button>
        {reasons && (
          <ul className="rounded-2xl bg-sun-soft p-4 text-sm space-y-1 list-disc pl-8">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            <li className="list-none -ml-4 pt-1 font-bold">Zmeny sa uložia po kliknutí na Uložiť.</li>
          </ul>
        )}
      </Section>

      <Section title="Hlas a povzbudzovanie">
        <div className="flex items-center gap-3">
          <Segmented
            value={s.voice}
            onChange={(v) => set("voice", v)}
            options={[
              { value: "female", label: "Ema (ženský hlas)" },
              { value: "male", label: "Leo (mužský hlas)" },
            ]}
          />
          <SpeakButton onClick={testVoice} label="Vyskúšať hlas" />
        </div>
        <Toggle checked={s.slowSpeech} onChange={(v) => set("slowSpeech", v)} label="Pomalšia reč" description="Vhodné pre mladšie deti a nové slovíčka." />
        <Toggle
          checked={s.encouragement}
          onChange={(v) => set("encouragement", v)}
          label="Povzbudzovanie"
          description="Pochvala po správnej odpovedi a upokojenie po chybe."
        />
        <Toggle
          checked={s.motivation}
          onChange={(v) => set("motivation", v)}
          label="Motivačné hlášky"
          description="Pri sérii správnych odpovedí, v polovici a na konci tréningu."
        />
      </Section>

      <Section title="Precvičovanie" description="Platí pre každý tréning tohto dieťaťa.">
        <Field label="Smer prekladu">
          <Segmented
            value={s.direction}
            onChange={(v) => set("direction", v)}
            options={[
              { value: "en_sk", label: "EN → SK" },
              { value: "sk_en", label: "SK → EN" },
              { value: "mixed", label: "Oba smery" },
            ]}
          />
        </Field>
        <Field label="Odpoveď">
          <Segmented
            value={s.answerMode}
            onChange={(v) => set("answerMode", v)}
            options={[
              { value: "written", label: "Písomne" },
              { value: "oral", label: "Ústne" },
            ]}
          />
        </Field>
        <Field label="Nápoveda pri písaní">
          <Segmented
            value={s.hintMode}
            onChange={(v) => set("hintMode", v)}
            options={[
              { value: "blanks", label: "Prázdne políčka" },
              { value: "audio", label: "Zvuková nápoveda" },
              { value: "reveal", label: "Odkrývanie písmen" },
            ]}
          />
        </Field>
        <Field label="Gramatické cvičenia">
          <Segmented
            value={s.grammarMode}
            onChange={(v) => set("grammarMode", v)}
            options={[
              { value: "choice", label: "Výber z možností" },
              { value: "typing", label: "Ručne doplniť" },
            ]}
          />
        </Field>
        <Field label="Slovíčok na tréning">
          <Segmented
            value={String(s.wordsPerSession)}
            onChange={(v) => set("wordsPerSession", Number(v))}
            options={[
              { value: "8", label: "8" },
              { value: "12", label: "12" },
              { value: "20", label: "20" },
              { value: "0", label: "Všetky" },
            ]}
          />
        </Field>
      </Section>

      <Section title="Metódy výučby" description="Predvolene klasika a kartičky. Moderné metódy zapneš podľa potreby.">
        {core.map((m) => (
          <Toggle key={m.key} checked={s.methods[m.key]} onChange={(v) => setMethod(m.key, v)} label={m.label} description={m.what} />
        ))}
        <div className="border-t border-line pt-4">
          <h3 className="font-black mb-1">Moderné metódy</h3>
          {modern.map((m) => (
            <Toggle
              key={m.key}
              checked={s.methods[m.key]}
              onChange={(v) => setMethod(m.key, v)}
              label={m.label}
              description={
                <>
                  {m.what} <span className="text-mist">{m.why}</span>
                </>
              }
            />
          ))}
        </div>
        {s.methods.gamification && (
          <Field label="Denný cieľ (body)">
            <Segmented
              value={String(s.dailyGoal)}
              onChange={(v) => set("dailyGoal", Number(v))}
              options={["10", "20", "50", "100"].map((x) => ({ value: x, label: x }))}
            />
          </Field>
        )}
      </Section>

      {id && (
        <Section title="Tento mobil">
          <p className="text-sm text-slate -mt-2">
            Ak má dieťa vlastný mobil: prihlás sa na ňom raz svojím účtom a zamkni ho na tento profil. Rodičovská zóna potom pýta PIN.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setLockedChild(locked ? null : id);
              setLocked(!locked);
            }}
          >
            <Smartphone className="size-4" /> {locked ? "Odomknúť toto zariadenie" : `Používať toto zariadenie len pre ${name || "dieťa"}`}
          </Button>
        </Section>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <Button size="lg" className="flex-1 shadow-lg" onClick={save} loading={saving}>
          Uložiť
        </Button>
        {id && (
          <Button size="lg" variant="danger" onClick={remove} aria-label="Zmazať profil">
            <Trash2 className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
