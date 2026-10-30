export type Lang = "en" | "sk";
export type Direction = "en_sk" | "sk_en" | "mixed";
export type HintMode = "blanks" | "audio" | "reveal";
export type AnswerMode = "written" | "oral";
export type GrammarMode = "choice" | "typing";
export type Level = "zaciatocnik" | "mierne_pokrocily" | "pokrocily";

export type MethodKey =
  "classic" | "flashcards" | "match" | "scramble" | "dictation" | "speed" | "shadowing" | "interleaving" | "dualCoding" | "gamification" | "warmup";

export type ChildSettings = {
  voice: "female" | "male";
  encouragement: boolean;
  motivation: boolean;
  answerMode: AnswerMode;
  direction: Direction;
  hintMode: HintMode;
  grammarMode: GrammarMode;
  wordsPerSession: number; // 0 = all
  slowSpeech: boolean;
  dailyGoal: number;
  methods: Record<MethodKey, boolean>;
};

export type Questionnaire = {
  strengths?: string[];
  weaknesses?: string[];
  likes?: string[];
  attention?: "short" | "medium" | "long";
  notes?: string;
};

export type Child = {
  id: string;
  name: string;
  avatar: string;
  grade: number;
  level: Level;
  questionnaire: Questionnaire;
  settings: Partial<ChildSettings>;
  xp: number;
  streak_days: number;
  last_practice_date: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  textbook: string | null;
  unit: string | null;
  grade: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VocabItem = {
  id: string;
  lesson_id: string;
  en: string;
  sk: string;
  example_en: string | null;
  example_sk: string | null;
  emoji: string | null;
  position: number;
};

export type GrammarItem = {
  id: string;
  lesson_id: string;
  prompt: string;
  answer: string;
  options: string[];
  translation_sk: string | null;
  explanation_sk: string | null;
  position: number;
};

export type Sentence = { en: string; sk: string };

export type LessonText = {
  id: string;
  lesson_id: string;
  title: string | null;
  sentences: Sentence[];
  position: number;
};

export type ItemProgress = {
  child_id: string;
  item_type: "vocab" | "grammar";
  item_id: string;
  box: number;
  due_at: string;
  correct_count: number;
  wrong_count: number;
  last_seen: string | null;
};

export type SessionRow = {
  id: string;
  child_id: string;
  lesson_ids: string[];
  config: Record<string, unknown>;
  started_at: string;
  ended_at: string | null;
  total: number;
  correct: number;
  xp_earned: number;
  summary: SessionSummary;
};

export type SessionSummary = {
  durationSec?: number;
  activities?: { key: ActivityKey; label: string; total: number; correct: number }[];
  problemWords?: { id: string; en: string; sk: string }[];
  lessonTitles?: string[];
};

export type ActivityKey =
  "warmup" | "flashcards" | "classic" | "match" | "scramble" | "dictation" | "speed" | "shadowing" | "grammar" | "reading" | "listening";
