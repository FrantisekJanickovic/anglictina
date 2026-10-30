"use client";

import { ArrowLeft, Camera, Check, ClipboardPaste, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Card, cx, ErrorNote, Field, Input, Segmented, Spinner, Textarea } from "@/components/ui";
import { aiStatus, enrichVocab, generateGrammar, importFromPhoto, translateSentences } from "@/lib/ai";
import { loadContent } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Lesson } from "@/lib/types";

type VRow = { id: string; en: string; sk: string; example_en: string; example_sk: string; emoji: string };
type GRow = { id: string; prompt: string; answer: string; options: string; translation_sk: string; explanation_sk: string };
type TRow = { id: string; title: string; sentences: { en: string; sk: string }[] };

const uid = () => crypto.randomUUID();
const emptyV = (): VRow => ({ id: uid(), en: "", sk: "", example_en: "", example_sk: "", emoji: "" });
const emptyG = (): GRow => ({ id: uid(), prompt: "", answer: "", options: "", translation_sk: "", explanation_sk: "" });

function parseList(text: string): VRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = (line.includes("\t") ? line.split("\t") : line.split(/\s[-–—=]\s|;/)).map((p) => p.trim());
      return { ...emptyV(), en: parts[0] ?? "", sk: parts[1] ?? "", example_en: parts[2] ?? "", example_sk: parts[3] ?? "" };
    })
    .filter((r) => r.en);
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z"“])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function LessonEditor() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [loading, setLoading] = useState(!!id);
  const [meta, setMeta] = useState({ title: "", textbook: "", unit: "", grade: "" as string, notes: "" });
  const [vocab, setVocab] = useState<VRow[]>([]);
  const [grammar, setGrammar] = useState<GRow[]>([]);
  const [texts, setTexts] = useState<TRow[]>([]);
  const [deleted, setDeleted] = useState({ vocab: [] as string[], grammar: [] as string[], texts: [] as string[] });
  const [tab, setTab] = useState<"vocab" | "grammar" | "texts">("vocab");
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [paste, setPaste] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [textPaste, setTextPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    aiStatus().then(setAi);
    if (!id) {
      setVocab([emptyV(), emptyV(), emptyV()]);
      return;
    }
    (async () => {
      const { data } = await supabase().from("lessons").select("*").eq("id", id).maybeSingle();
      const l = data as Lesson | null;
      if (l) setMeta({ title: l.title, textbook: l.textbook ?? "", unit: l.unit ?? "", grade: l.grade ? String(l.grade) : "", notes: l.notes ?? "" });
      const c = await loadContent([id]);
      setVocab(c.vocab.map((v) => ({ id: v.id, en: v.en, sk: v.sk, example_en: v.example_en ?? "", example_sk: v.example_sk ?? "", emoji: v.emoji ?? "" })));
      setGrammar(
        c.grammar.map((g) => ({
          id: g.id,
          prompt: g.prompt,
          answer: g.answer,
          options: (g.options ?? []).join(", "),
          translation_sk: g.translation_sk ?? "",
          explanation_sk: g.explanation_sk ?? "",
        })),
      );
      setTexts(c.texts.map((t) => ({ id: t.id, title: t.title ?? "", sentences: t.sentences ?? [] })));
      setLoading(false);
    })();
  }, [id]);

  const dirty = () => setSaved(false);
  const setM = (patch: Partial<typeof meta>) => {
    dirty();
    setMeta((m) => ({ ...m, ...patch }));
  };
  const setT = (fn: (rows: TRow[]) => TRow[]) => {
    dirty();
    setTexts(fn);
  };
  const updV = (i: number, k: keyof VRow, v: string) => {
    dirty();
    setVocab((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };
  const delV = (i: number) => {
    dirty();
    setDeleted((d) => ({ ...d, vocab: [...d.vocab, vocab[i].id] }));
    setVocab((rows) => rows.filter((_, j) => j !== i));
  };
  const updG = (i: number, k: keyof GRow, v: string) => {
    dirty();
    setGrammar((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  };
  const delG = (i: number) => {
    dirty();
    setDeleted((d) => ({ ...d, grammar: [...d.grammar, grammar[i].id] }));
    setGrammar((rows) => rows.filter((_, j) => j !== i));
  };

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      dirty();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    await run("Čítam fotku…", async () => {
      for (const f of Array.from(files)) {
        const r = await importFromPhoto(f, { grade: meta.grade ? Number(meta.grade) : null, hint: meta.title });
        setMeta((m) => ({ ...m, title: m.title || r.title || "", unit: m.unit || r.unit || "" }));
        const nv = r.vocab.map((v) => ({ ...emptyV(), ...v, example_en: v.example_en ?? "", example_sk: v.example_sk ?? "", emoji: v.emoji ?? "" }));
        setVocab((rows) => [...rows.filter((x) => x.en || x.sk), ...nv]);
        setGrammar((rows) => [
          ...rows,
          ...r.grammar.map((g) => ({
            ...emptyG(),
            prompt: g.prompt,
            answer: g.answer,
            options: (g.options ?? []).join(", "),
            translation_sk: g.translation_sk ?? "",
            explanation_sk: g.explanation_sk ?? "",
          })),
        ]);
        setTexts((rows) => [...rows, ...r.texts.map((t) => ({ id: uid(), title: t.title ?? "", sentences: t.sentences }))]);
      }
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function enrich() {
    const targets = vocab.filter((v) => v.en && v.sk && (!v.example_en || !v.example_sk || !v.emoji));
    if (!targets.length) return;
    await run("Dopĺňam vety a obrázky…", async () => {
      const r = await enrichVocab(
        targets.map(({ en, sk, example_en, example_sk, emoji }) => ({ en, sk, example_en, example_sk, emoji })),
        meta.grade ? Number(meta.grade) : null,
      );
      setVocab((rows) =>
        rows.map((row) => {
          const hit = r.items.find((x) => x.en.trim().toLowerCase() === row.en.trim().toLowerCase());
          if (!hit) return row;
          return {
            ...row,
            example_en: row.example_en || hit.example_en || "",
            example_sk: row.example_sk || hit.example_sk || "",
            emoji: row.emoji || hit.emoji || "",
          };
        }),
      );
    });
  }

  async function genGrammar() {
    if (!topic.trim()) return;
    await run("Tvorím gramatické cvičenia…", async () => {
      const r = await generateGrammar(topic, vocab.map((v) => v.en).filter(Boolean), 8, meta.grade ? Number(meta.grade) : null);
      setGrammar((rows) => [
        ...rows,
        ...r.items.map((g) => ({
          ...emptyG(),
          prompt: g.prompt,
          answer: g.answer,
          options: (g.options ?? []).join(", "),
          translation_sk: g.translation_sk ?? "",
          explanation_sk: g.explanation_sk ?? "",
        })),
      ]);
    });
  }

  async function addText() {
    const sentences = splitSentences(textPaste);
    if (!sentences.length) return;
    const row: TRow = { id: uid(), title: "", sentences: sentences.map((en) => ({ en, sk: "" })) };
    setTexts((t) => [...t, row]);
    setTextPaste("");
    dirty();
    if (ai) {
      await run("Prekladám text…", async () => {
        const r = await translateSentences(sentences);
        setTexts((t) => t.map((x) => (x.id === row.id ? { ...x, sentences: r.sentences } : x)));
      });
    }
  }

  async function save() {
    if (!meta.title.trim()) {
      setError("Zadaj názov lekcie.");
      return;
    }
    setBusy("Ukladám…");
    setError(null);
    try {
      const sb = supabase();
      const lessonId = id ?? uid();
      const lr = await sb.from("lessons").upsert({
        id: lessonId,
        title: meta.title.trim(),
        textbook: meta.textbook.trim() || null,
        unit: meta.unit.trim() || null,
        grade: meta.grade ? Number(meta.grade) : null,
        notes: meta.notes.trim() || null,
      });
      if (lr.error) throw lr.error;
      const ops = [];
      if (deleted.vocab.length) ops.push(sb.from("vocab_items").delete().in("id", deleted.vocab));
      if (deleted.grammar.length) ops.push(sb.from("grammar_items").delete().in("id", deleted.grammar));
      if (deleted.texts.length) ops.push(sb.from("lesson_texts").delete().in("id", deleted.texts));
      const v = vocab
        .filter((r) => r.en.trim() && r.sk.trim())
        .map((r, i) => ({
          id: r.id,
          lesson_id: lessonId,
          en: r.en.trim(),
          sk: r.sk.trim(),
          example_en: r.example_en.trim() || null,
          example_sk: r.example_sk.trim() || null,
          emoji: r.emoji.trim() || null,
          position: i,
        }));
      const g = grammar
        .filter((r) => r.prompt.trim() && r.answer.trim())
        .map((r, i) => {
          const opts = r.options
            .split(/[,;]/)
            .map((o) => o.trim())
            .filter(Boolean);
          const answer = r.answer.trim();
          const first = answer.split("|")[0].trim();
          if (opts.length && !opts.some((o) => o.toLowerCase() === first.toLowerCase())) opts.push(first);
          return {
            id: r.id,
            lesson_id: lessonId,
            prompt: r.prompt.trim(),
            answer,
            options: opts,
            translation_sk: r.translation_sk.trim() || null,
            explanation_sk: r.explanation_sk.trim() || null,
            position: i,
          };
        });
      const t = texts
        .map((r, i) => ({ id: r.id, lesson_id: lessonId, title: r.title.trim() || null, sentences: r.sentences.filter((s) => s.en.trim()), position: i }))
        .filter((r) => r.sentences.length);
      if (v.length) ops.push(sb.from("vocab_items").upsert(v));
      if (g.length) ops.push(sb.from("grammar_items").upsert(g));
      if (t.length) ops.push(sb.from("lesson_texts").upsert(t));
      const results = await Promise.all(ops);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      setDeleted({ vocab: [], grammar: [], texts: [] });
      setSaved(true);
      if (!id) router.replace(`/rodic/lekcia?id=${lessonId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uloženie zlyhalo.");
    } finally {
      setBusy(null);
    }
  }

  async function removeLesson() {
    if (!id || !confirm("Zmazať celú lekciu? Pokrok detí pri jej slovíčkach sa tiež stratí.")) return;
    await supabase().from("lessons").delete().eq("id", id);
    router.push("/rodic/lekcie");
  }

  if (loading) return <Spinner />;
  const missingExtras = vocab.filter((v) => v.en && v.sk && (!v.example_en || !v.emoji)).length;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link href="/rodic/lekcie" className="inline-flex items-center gap-1 text-sm font-bold text-slate hover:text-ink">
        <ArrowLeft className="size-4" /> Lekcie
      </Link>

      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-black">{id ? "Upraviť lekciu" : "Nová lekcia"}</h1>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPhotos(e.target.files)} />
            <Button variant="sun" onClick={() => fileRef.current?.click()} disabled={!ai || !!busy} title={ai ? undefined : "AI nie je nastavené"}>
              <Camera className="size-4" /> Import z fotky
            </Button>
          </div>
        </div>
        {!ai && (
          <p className="text-sm text-slate">
            Import z fotky a dopĺňanie viet cez AI sa zapne po nastavení kľúča <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> vo Verceli. Formulár
            funguje aj bez neho.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Názov lekcie">
            <Input value={meta.title} onChange={(e) => setM({ title: e.target.value })} placeholder="napr. Unit 3 – My family" />
          </Field>
          <Field label="Učebnica">
            <Input value={meta.textbook} onChange={(e) => setM({ textbook: e.target.value })} placeholder="napr. Headway" />
          </Field>
          <Field label="Kapitola / unit">
            <Input value={meta.unit} onChange={(e) => setM({ unit: e.target.value })} placeholder="napr. 3B" />
          </Field>
          <Field label="Ročník">
            <Input
              inputMode="numeric"
              value={meta.grade}
              onChange={(e) => setM({ grade: e.target.value.replace(/\D/g, "").slice(0, 1) })}
              placeholder="napr. 4"
            />
          </Field>
        </div>
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "vocab", label: `Slovíčka (${vocab.filter((v) => v.en).length})` },
          { value: "grammar", label: `Gramatika (${grammar.length})` },
          { value: "texts", label: `Čítanie a počúvanie (${texts.length})` },
        ]}
      />

      {busy && (
        <div className="rounded-2xl bg-sky-soft text-sky font-bold px-4 py-3 flex items-center gap-2">
          <Sparkles className="size-4 animate-pulse" /> {busy}
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {tab === "vocab" && (
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPaste(paste === null ? "" : null)}>
              <ClipboardPaste className="size-4" /> Vložiť zoznam
            </Button>
            {ai && (
              <Button size="sm" variant="outline" onClick={enrich} disabled={!missingExtras || !!busy}>
                <Sparkles className="size-4" /> Doplniť vety a obrázky ({missingExtras})
              </Button>
            )}
          </div>
          {paste !== null && (
            <div className="rounded-2xl bg-paper p-3 space-y-2">
              <p className="text-sm text-slate">
                Jedno slovíčko na riadok: <b>apple - jablko</b>. Môžeš vložiť aj stĺpce z Excelu (EN, SK, veta EN, veta SK).
              </p>
              <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"dog - pes\ncat - mačka"} />
              <Button
                size="sm"
                onClick={() => {
                  const rows = parseList(paste);
                  setVocab((v) => [...v.filter((x) => x.en || x.sk), ...rows]);
                  setPaste(null);
                  dirty();
                }}
              >
                <Plus className="size-4" /> Pridať {parseList(paste).length} slovíčok
              </Button>
            </div>
          )}
          <div className="hidden sm:grid grid-cols-[1fr_1fr_56px_36px] gap-2 px-1 text-xs font-bold text-slate">
            <span>Anglicky</span>
            <span>Slovensky</span>
            <span>Obrázok</span>
            <span />
          </div>
          <div className="space-y-3">
            {vocab.map((r, i) => (
              <div key={r.id} className="rounded-2xl border border-line p-2 sm:p-2.5 space-y-2">
                <div className="grid grid-cols-[1fr_1fr_48px_36px] sm:grid-cols-[1fr_1fr_56px_36px] gap-2">
                  <Input value={r.en} onChange={(e) => updV(i, "en", e.target.value)} placeholder="apple" autoCapitalize="off" aria-label="Anglicky" />
                  <Input value={r.sk} onChange={(e) => updV(i, "sk", e.target.value)} placeholder="jablko" aria-label="Slovensky" />
                  <Input value={r.emoji} onChange={(e) => updV(i, "emoji", e.target.value)} placeholder="🍎" className="text-center px-1" aria-label="Emoji" />
                  <button type="button" onClick={() => delV(i)} className="text-mist hover:text-tomato" aria-label="Zmazať slovíčko">
                    <X className="size-5 mx-auto" />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    value={r.example_en}
                    onChange={(e) => updV(i, "example_en", e.target.value)}
                    placeholder="Veta: I eat an apple."
                    className="h-9 text-sm font-normal"
                    aria-label="Veta anglicky"
                  />
                  <Input
                    value={r.example_sk}
                    onChange={(e) => updV(i, "example_sk", e.target.value)}
                    placeholder="Preklad: Jem jablko."
                    className="h-9 text-sm font-normal"
                    aria-label="Veta slovensky"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setVocab((v) => [...v, emptyV()])}>
            <Plus className="size-4" /> Pridať slovíčko
          </Button>
        </Card>
      )}

      {tab === "grammar" && (
        <Card className="p-4 sm:p-5 space-y-3">
          <p className="text-sm text-slate">
            Vetu napíš s medzerou <b>___</b> na mieste, ktoré dieťa doplní. Viac správnych odpovedí oddeľ znakom <b>|</b>, možnosti na výber čiarkou.
          </p>
          {ai && (
            <div className="flex flex-wrap gap-2 rounded-2xl bg-paper p-3">
              <Input
                className="flex-1 min-w-48"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Téma, napr. present simple, have got, there is/are"
              />
              <Button size="md" variant="outline" onClick={genGrammar} disabled={!topic.trim() || !!busy}>
                <Sparkles className="size-4" /> Vytvoriť 8 cvičení
              </Button>
            </div>
          )}
          {grammar.map((r, i) => (
            <div key={r.id} className="rounded-2xl border border-line p-3 space-y-2">
              <div className="flex gap-2">
                <Input value={r.prompt} onChange={(e) => updG(i, "prompt", e.target.value)} placeholder="She ___ got a cat." aria-label="Veta s medzerou" />
                <button type="button" onClick={() => delG(i)} className="text-mist hover:text-tomato px-1" aria-label="Zmazať cvičenie">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input value={r.answer} onChange={(e) => updG(i, "answer", e.target.value)} placeholder="Správne: has" aria-label="Správna odpoveď" />
                <Input value={r.options} onChange={(e) => updG(i, "options", e.target.value)} placeholder="Možnosti: has, have, is" aria-label="Možnosti" />
                <Input
                  value={r.translation_sk}
                  onChange={(e) => updG(i, "translation_sk", e.target.value)}
                  placeholder="Preklad: Ona má mačku."
                  className="text-sm font-normal"
                  aria-label="Preklad"
                />
                <Input
                  value={r.explanation_sk}
                  onChange={(e) => updG(i, "explanation_sk", e.target.value)}
                  placeholder="Vysvetlenie: he/she/it → has"
                  className="text-sm font-normal"
                  aria-label="Vysvetlenie"
                />
              </div>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setGrammar((g) => [...g, emptyG()])}>
            <Plus className="size-4" /> Pridať cvičenie
          </Button>
        </Card>
      )}

      {tab === "texts" && (
        <Card className="p-4 sm:p-5 space-y-4">
          <p className="text-sm text-slate">Text z učebnice na čítanie a počúvanie. Appka ho číta po vetách a ku každej povie preklad.</p>
          <div className="rounded-2xl bg-paper p-3 space-y-2">
            <Textarea rows={4} value={textPaste} onChange={(e) => setTextPaste(e.target.value)} placeholder="Vlož anglický text…" />
            <Button size="sm" onClick={addText} disabled={!textPaste.trim() || !!busy}>
              <Plus className="size-4" /> Pridať text {ai ? "a preložiť" : ""}
            </Button>
          </div>
          {texts.map((t, ti) => (
            <div key={t.id} className="rounded-2xl border border-line p-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={t.title}
                  onChange={(e) => setT((x) => x.map((r, j) => (j === ti ? { ...r, title: e.target.value } : r)))}
                  placeholder="Názov textu"
                />
                <button
                  type="button"
                  className="text-mist hover:text-tomato px-1"
                  aria-label="Zmazať text"
                  onClick={() => {
                    dirty();
                    setDeleted((d) => ({ ...d, texts: [...d.texts, t.id] }));
                    setTexts((x) => x.filter((_, j) => j !== ti));
                  }}
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
              {t.sentences.map((s, si) => (
                <div key={si} className="grid sm:grid-cols-2 gap-2">
                  {(["en", "sk"] as const).map((k) => (
                    <Input
                      key={k}
                      value={s[k]}
                      className="text-sm font-normal"
                      placeholder={k === "en" ? "Anglická veta" : "Slovenský preklad"}
                      onChange={(e) =>
                        setT((x) =>
                          x.map((r, j) => (j === ti ? { ...r, sentences: r.sentences.map((q, qi) => (qi === si ? { ...q, [k]: e.target.value } : q)) } : r)),
                        )
                      }
                    />
                  ))}
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setT((x) => x.map((r, j) => (j === ti ? { ...r, sentences: [...r.sentences, { en: "", sk: "" }] } : r)))}
              >
                <Plus className="size-4" /> Pridať vetu
              </Button>
            </div>
          ))}
        </Card>
      )}

      <div className="flex gap-3 sticky bottom-20 md:bottom-4">
        <Button
          size="lg"
          className={cx("flex-1 shadow-lg", saved && "!bg-leaf")}
          onClick={save}
          loading={busy === "Ukladám…"}
          disabled={!!busy && busy !== "Ukladám…"}
        >
          {saved ? (
            <>
              <Check className="size-5" /> Uložené
            </>
          ) : (
            "Uložiť lekciu"
          )}
        </Button>
        {id && (
          <Button size="lg" variant="danger" onClick={removeLesson} aria-label="Zmazať lekciu">
            <Trash2 className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
