export type Utterance = {
  idx: number;
  speaker: number; // participant key within the meeting
  startMs: number;
  endMs: number;
  text: string;
};

export type Participant = {
  key: number;
  name: string;
  role?: string | null;
  color: string;
  talkMs: number;
  external?: boolean;
};

export type Bullet = { text: string; startMs: number | null };
export type SummarySection = { heading: string; bullets: Bullet[] };
export type SummaryContent = { tldr: string; sections: SummarySection[] };

export type ActionItem = {
  id: number;
  text: string;
  assignee: string | null;
  startMs: number | null;
  done: boolean;
};

export type Chapter = { idx: number; title: string; startMs: number; endMs: number; gist: string };

export type Highlight = {
  id: string;
  meetingId: string;
  startMs: number;
  endMs: number;
  note: string;
  shareToken: string | null;
  source: string;
  createdAt: string;
};
