import { notFound } from "next/navigation";
import { getMeeting } from "@/lib/queries";
import { MeetingView } from "@/components/meeting/meeting-view";
import { Processing } from "@/components/meeting/processing";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/meetings/[id]">) {
  const data = await getMeeting((await params).id);
  return { title: data?.meeting.title ?? "Meeting" };
}

export default async function MeetingPage({ params, searchParams }: PageProps<"/meetings/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const data = await getMeeting(id);
  if (!data) notFound();
  if (data.meeting.status !== "ready") return <Processing meeting={data.meeting} />;
  const t = Number(sp.t);
  return <MeetingView key={id} data={data} initialMs={Number.isFinite(t) && t >= 0 ? t : null} />;
}
