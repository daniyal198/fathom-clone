import Link from "next/link";
import { CalendarDays, CheckSquare, Loader2, Sparkles, Upload } from "lucide-react";
import { getCalendar, listMeetings, type MeetingListItem } from "@/lib/queries";
import { cn, dayLabel, duration, thumbFor, timeLabel } from "@/lib/format";
import { AvatarStack } from "@/components/ui";
import { UpcomingStrip } from "@/components/upcoming-strip";

export const dynamic = "force-dynamic";

export default async function MeetingsPage({ searchParams }: PageProps<"/">) {
  const { tab = "all" } = (await searchParams) as { tab?: string };
  const [meetings, calendar] = await Promise.all([listMeetings(), getCalendar()]);
  const shown = meetings.filter((m) => (tab === "shared" ? m.sharedWithMe : tab === "mine" ? !m.sharedWithMe : true));

  const groups = new Map<string, MeetingListItem[]>();
  for (const m of shown) {
    const k = dayLabel(m.startedAt);
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const counts = { all: meetings.length, mine: meetings.filter((m) => !m.sharedWithMe).length, shared: meetings.filter((m) => m.sharedWithMe).length };

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Meetings</h1>
          <p className="mt-0.5 text-[13.5px] text-ink-3">Every call, recorded, transcribed and summarized.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13.5px] font-medium hover:bg-sunken"
        >
          <Upload size={15} /> Upload recording
        </Link>
      </div>

      <UpcomingStrip calendar={calendar} />

      <div className="scroll-thin mt-8 mb-3 flex items-center gap-1 overflow-x-auto border-b border-line">
        {(
          [
            ["all", "All meetings"],
            ["mine", "My meetings"],
            ["shared", "Shared with me"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/" : `/?tab=${key}`}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
              tab === key ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
            )}
          >
            {label}
            <span className="rounded-full bg-sunken px-1.5 text-[11px] text-ink-3">{counts[key]}</span>
          </Link>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <p className="font-medium">No meetings here yet</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Recordings your teammates share with you will show up in this tab.
          </p>
        </div>
      )}

      {[...groups].map(([day, items]) => (
        <section key={day} className="mt-5">
          <h2 className="mb-2 px-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{day}</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {items.map((m, i) => (
              <MeetingRow key={m.id} m={m} first={i === 0} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MeetingRow({ m, first }: { m: MeetingListItem; first: boolean }) {
  const thumb = thumbFor(m);
  const processing = m.status !== "ready";
  return (
    <Link
      href={`/meetings/${m.id}`}
      className={cn("group flex gap-4 px-4 py-3.5 transition-colors hover:bg-canvas", !first && "border-t border-line")}
    >
      <div className="relative hidden h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-sunken sm:block">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-soft to-sunken">
            <Upload size={18} className="text-accent/60" />
          </div>
        )}
        <span className="absolute right-1 bottom-1 rounded bg-ink/75 px-1 text-[10.5px] font-medium text-white tabular-nums">
          {duration(m.durationMs)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[14.5px] font-semibold group-hover:text-accent">{m.title}</h3>
          <span className="shrink-0 text-[12.5px] text-ink-3 tabular-nums">{timeLabel(m.startedAt)}</span>
        </div>
        {processing ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-accent">
            <Loader2 size={13} className="animate-spin" /> {m.statusDetail ?? "Processing recording…"}
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{m.tldr}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-3">
          <AvatarStack people={m.participants} size={20} />
          <span>{m.participants.length} people</span>
          {m.actionCount > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare size={12} />
              {m.openActionCount} open
            </span>
          )}
          {m.highlightCount > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles size={12} />
              {m.highlightCount}
            </span>
          )}
          {m.sharedWithMe && (
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">Shared with you</span>
          )}
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <CalendarDays size={12} />
            {m.platform === "meet" ? "Google Meet" : m.platform === "teams" ? "Teams" : m.platform === "upload" ? "Uploaded" : "Zoom"}
          </span>
        </div>
      </div>
    </Link>
  );
}
