import Link from "next/link";
import { CheckSquare, Search as SearchIcon, Video } from "lucide-react";
import { search, type SearchHit } from "@/lib/queries";
import { clock, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q = "" } = (await searchParams) as { q?: string };
  const hits = q.trim() ? await search(q, 200) : [];
  const byMeeting = new Map<string, SearchHit[]>();
  for (const h of hits) byMeeting.set(h.meetingId, [...(byMeeting.get(h.meetingId) ?? []), h]);

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-8 sm:py-8">
      <form action="/search" className="mb-6 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-accent">
        <SearchIcon size={17} className="text-ink-3" />
        <input name="q" defaultValue={q} autoFocus placeholder="Search across every meeting…" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
      </form>
      {q.trim() && (
        <p className="mb-4 text-[13px] text-ink-3">
          {hits.length ? `${hits.length} moments in ${byMeeting.size} meetings` : `Nothing matched “${q}”. Try fewer or different words.`}
        </p>
      )}
      <div className="space-y-4">
        {[...byMeeting].map(([id, list]) => (
          <section key={id} className="overflow-hidden rounded-xl border border-line bg-surface">
            <Link href={`/meetings/${id}`} className="flex items-center gap-2 border-b border-line px-4 py-2.5 hover:bg-canvas">
              <Video size={15} className="text-ink-3" />
              <span className="font-semibold">{list[0].meetingTitle}</span>
              <span className="text-[12.5px] text-ink-3">· {shortDate(list[0].startedAt)}</span>
              <span className="ml-auto text-[12px] text-ink-3">{list.length} match{list.length > 1 ? "es" : ""}</span>
            </Link>
            <ul>
              {list.slice(0, 8).map((h, i) => (
                <li key={i}>
                  <Link
                    href={`/meetings/${id}${h.startMs != null ? `?t=${h.startMs}` : ""}`}
                    className="flex gap-3 border-t border-line px-4 py-2.5 first:border-t-0 hover:bg-canvas"
                  >
                    <span className="w-14 shrink-0 pt-0.5 font-mono text-[12px] text-accent">{h.startMs != null ? clock(h.startMs) : ""}</span>
                    <span className="min-w-0 text-[13.5px] leading-relaxed text-ink-2">
                      {h.kind === "action" && (
                        <span className="mr-1.5 inline-flex items-center gap-1 rounded bg-sunken px-1.5 text-[11px] font-medium text-ink-2">
                          <CheckSquare size={11} /> Action item
                        </span>
                      )}
                      {h.speaker && h.kind === "transcript" && <b className="font-medium text-ink">{h.speaker}: </b>}
                      <span dangerouslySetInnerHTML={{ __html: h.snippet }} />
                    </span>
                  </Link>
                </li>
              ))}
              {list.length > 8 && <li className="border-t border-line px-4 py-2 text-[12.5px] text-ink-3">+{list.length - 8} more in this meeting</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
