"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy, ListChecks } from "lucide-react";
import type { ActionItem, Participant } from "@/lib/types";
import { toggleActionItem } from "@/app/actions";
import { clock, cn } from "@/lib/format";
import { Avatar, Button, Empty, TimeChip } from "@/components/ui";
import { usePlayer } from "./player-store";

export function ActionsPanel({
  items: initial,
  participants,
  readOnly = false,
  person,
  setPerson,
}: {
  items: ActionItem[];
  participants: Participant[];
  readOnly?: boolean;
  person: string | null; // "for me" view: only this person's items
  setPerson: (name: string | null) => void;
}) {
  const p = usePlayer();
  const [items, setItems] = useState(initial);
  useEffect(() => setItems(initial), [initial]); // e.g. an owner renamed via "Who spoke when"
  const [copied, setCopied] = useState(false);
  const [, start] = useTransition();
  const color = new Map(participants.map((x) => [x.name, x.color]));

  const owners = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items) c.set(i.assignee ?? "Unassigned", (c.get(i.assignee ?? "Unassigned") ?? 0) + 1);
    return [...c].sort((a, b) => (a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : b[1] - a[1]));
  }, [items]);

  const shown = person ? items.filter((i) => (i.assignee ?? "Unassigned") === person) : items;
  const done = shown.filter((i) => i.done).length;

  const toggle = (id: number, v: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done: v } : x)));
    start(() => toggleActionItem(id, v));
  };

  const copy = async () => {
    const text = shown.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}${i.assignee ? ` (${i.assignee})` : ""}${i.startMs != null ? ` @ ${clock(i.startMs)}` : ""}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!items.length) {
    return (
      <Empty icon={<ListChecks size={26} />} title="No action items">
        Nobody committed to a follow-up in this meeting.
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="font-medium text-ink">
                {done} of {shown.length} done
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${shown.length ? (done / shown.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="scroll-thin mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          <Chip on={person === null} onClick={() => setPerson(null)}>
            Everyone · {items.length}
          </Chip>
          {owners.map(([name, n]) => (
            <Chip key={name} on={person === name} onClick={() => setPerson(person === name ? null : name)}>
              {name !== "Unassigned" && <span className="h-2 w-2 rounded-full" style={{ background: color.get(name) }} />}
              {name} · {n}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {shown.map((i) => (
          <li key={i.id} className="group flex items-start gap-3 rounded-lg px-2.5 py-2.5 hover:bg-canvas">
            <button
              role="checkbox"
              aria-checked={i.done}
              disabled={readOnly}
              onClick={() => toggle(i.id, !i.done)}
              className={cn(
                "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                i.done ? "border-ok bg-ok text-white" : "border-line-strong bg-surface hover:border-accent"
              )}
            >
              {i.done && <Check size={12} strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[13.5px] leading-snug", i.done ? "text-ink-3 line-through" : "text-ink")}>{i.text}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-3">
                {i.assignee ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar name={i.assignee} color={color.get(i.assignee)} size={16} /> {i.assignee}
                  </span>
                ) : (
                  <span>Unassigned</span>
                )}
                {i.startMs != null && <TimeChip ms={i.startMs} onClick={() => p.seek(i.startMs!)} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:border-line-strong"
      )}
    >
      {children}
    </button>
  );
}
