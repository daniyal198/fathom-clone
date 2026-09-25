"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, ListChecks } from "lucide-react";
import type { ActionRow } from "@/lib/queries";
import { toggleActionItem } from "@/app/actions";
import { clock, cn, dayLabel } from "@/lib/format";
import { Avatar, Empty } from "@/components/ui";

export function ActionBoard({ items: initial }: { items: ActionRow[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [owner, setOwner] = useState<string | null>(null);
  const [, start] = useTransition();

  const shown = items.filter((i) => (filter === "all" ? true : filter === "open" ? !i.done : i.done));
  const groups = useMemo(() => {
    const g = new Map<string, ActionRow[]>();
    for (const i of shown) g.set(i.assignee ?? "Unassigned", [...(g.get(i.assignee ?? "Unassigned") ?? []), i]);
    return [...g].sort((a, b) => (a[0] === "Unassigned" ? 1 : b[0] === "Unassigned" ? -1 : b[1].length - a[1].length));
  }, [shown]);
  const visible = owner ? groups.filter(([name]) => name === owner) : groups;

  const toggle = (id: number, v: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done: v } : x)));
    start(() => toggleActionItem(id, v));
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("h-7 rounded-md px-3 text-[12.5px] font-medium capitalize", filter === f ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
            >
              {f} · {items.filter((i) => (f === "all" ? true : f === "open" ? !i.done : i.done)).length}
            </button>
          ))}
        </div>
        <select
          value={owner ?? ""}
          onChange={(e) => setOwner(e.target.value || null)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink-2 outline-none"
          aria-label="Filter by owner"
        >
          <option value="">Everyone</option>
          {groups.map(([name, list]) => (
            <option key={name} value={name}>
              {name} ({list.length})
            </option>
          ))}
        </select>
      </div>
      {visible.length === 0 && <Empty icon={<ListChecks size={26} />} title={filter === "open" ? "Nothing open. Nice." : "Nothing here"} />}
      <div className="space-y-4">
        {visible.map(([name, list]) => (
          <section key={name} className="overflow-hidden rounded-xl border border-line bg-surface">
            <h2 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[13.5px] font-semibold">
              {name !== "Unassigned" && <Avatar name={name} color={list[0].color ?? undefined} size={22} />}
              {name}
              <span className="font-normal text-ink-3">· {list.length}</span>
            </h2>
            <ul>
              {list.map((i) => (
                <li key={i.id} className="flex items-start gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
                  <button
                    role="checkbox"
                    aria-checked={i.done}
                    onClick={() => toggle(i.id, !i.done)}
                    className={cn(
                      "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border",
                      i.done ? "border-ok bg-ok text-white" : "border-line-strong hover:border-accent"
                    )}
                  >
                    {i.done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13.5px] leading-snug", i.done && "text-ink-3 line-through")}>{i.text}</p>
                    <Link
                      href={`/meetings/${i.meetingId}${i.startMs != null ? `?t=${i.startMs}` : ""}`}
                      className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-accent"
                    >
                      {i.meetingTitle} · {dayLabel(i.startedAt)}
                      {i.startMs != null && <span className="font-mono">@ {clock(i.startMs)}</span>}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
