import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getShare } from "@/lib/queries";
import { clock, thumbFor } from "@/lib/format";
import { SharedClip, SharedMeeting } from "@/components/share-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const share = await getShare((await params).token);
  if (!share) return { title: "Not found" };
  const m = share.data.meeting;
  const title = share.kind === "clip" ? share.highlight.note || `Clip from ${m.title}` : m.title;
  const description =
    share.kind === "clip"
      ? `${clock(share.highlight.endMs - share.highlight.startMs)} clip from “${m.title}”, shared with Plumb`
      : share.data.summaries.general?.tldr ?? `Recording and notes from ${m.title}`;
  const image = thumbFor(m);
  return { title, description, openGraph: { title, description, images: image ? [image] : [] }, twitter: { card: "summary_large_image", title, description } };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const share = await getShare((await params).token);
  if (!share || !share.data.meeting.mediaUrl) notFound();
  return share.kind === "clip" ? <SharedClip data={share.data} highlight={share.highlight} /> : <SharedMeeting data={share.data} />;
}
