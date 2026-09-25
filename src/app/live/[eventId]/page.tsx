import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getMeeting } from "@/lib/queries";
import { LiveCall } from "@/components/live-call";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live call" };

export default async function LivePage({ params }: PageProps<"/live/[eventId]">) {
  const { eventId } = await params;
  const [ev] = await sql`SELECT id, title, platform, attendees, replay_of FROM calendar_events WHERE id = ${eventId}`;
  if (!ev?.replay_of) notFound();
  const data = await getMeeting(ev.replay_of);
  if (!data?.meeting.mediaUrl) notFound();
  return (
    <LiveCall
      event={{ id: ev.id, title: ev.title, platform: ev.platform }}
      mediaUrl={data.meeting.mediaUrl}
      utterances={data.utterances}
      participants={data.participants}
    />
  );
}
