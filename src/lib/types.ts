export type GradeBand = "primary" | "junior" | "senior";

export type SubjectNote = {
  name: string;
  level: "需加强" | "稳定" | "入门" | "保持";
  note: string;
};

export type Student = {
  id: string;
  userId: string;
  name: string;
  gradeBand: GradeBand;
  grade: string;
  school: string;
  guardian: string;
  goal: string;
  weeklyMinutes: number;
  focus: string;
  subjects: SubjectNote[];
};

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  credits: number;
};

export type LedgerItem = {
  id: string;
  delta: number;
  balanceAfter: number;
  note: string;
  toolId?: string;
  createdAt: string;
};

export type Section = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
};

export type Slide = {
  kicker: string;
  title: string;
  bullets: string[];
  notes: string;
};

export type ToolResult = {
  title: string;
  subtitle: string;
  summary: string;
  sections: Section[];
  slides?: Slide[];
  diagramSvg?: string;
  docHtml?: string;
};

export type SourceName = "mock" | "openai" | "deepseek";

export type GenerationRecord = {
  id: string;
  userId: string;
  toolId: string;
  toolName: string;
  source: SourceName;
  createdAt: string;
  input: Record<string, string>;
  result: ToolResult;
};

export type PublicGeneration = Omit<GenerationRecord, "userId">;

export type MeResponse = {
  user: PublicUser | null;
  student: Student | null;
  ledger: LedgerItem[];
};

export type CheckinItem = {
  date: string;
  step: number;
  done: boolean;
};

export type CheckinsResponse = {
  student: Student;
  checkins: CheckinItem[];
  readonly: boolean;
};
