import Link from "next/link";
import { Check, FlaskConical, Minus } from "lucide-react";

export const metadata = { title: "What's real in this demo" };

const REAL = [
  ["Recordings", "7 real, public meetings (GitLab Unfiltered, Kubernetes SIG, a live sales discovery call), self-hosted so clips and seeking work."],
  ["Transcripts & speakers", "Deepgram nova-3 with diarization; speaker names recovered by AI from intros and hand-offs."],
  ["AI notes", "Summaries, chapters and action items from Gemini, with every bullet linked to the moment it came from."],
  ["Templates", "Switch between 7 templates. New ones are generated on demand from the transcript, then cached."],
  ["Ask AI", "Streaming Q&A grounded in the transcript, with clickable timestamps."],
  ["Search", "Postgres full-text search across every transcript line, action item and title."],
  ["Highlights & sharing", "Clip any moment (H key, transcript selection, or during a live call) and share a public link that plays only that clip."],
  ["Upload & in-person", "Upload a file or record from your mic: it goes through the same transcription and notes pipeline."],
];

const SIMULATED = [
  ["Meeting bot", "No bot joins Zoom/Meet/Teams. “Join call” replays a real recording as if it were live; hanging up turns what you sat through into a meeting."],
  ["Calendar", "The Google/Outlook connection is a stand-in; the week of events is seeded. Record rules and toggles are stored."],
  ["Accounts", "No sign-in: everyone shares one demo workspace, so reviewers can open the link and go."],
];

const LEFT_OUT = ["CRM & Slack sync", "Team workspaces, permissions and billing", "Real-time transcription over WebRTC", "Mobile apps"];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">What&apos;s real in this demo</h1>
      <p className="mt-1 mb-8 text-[14px] text-ink-2">
        Plumb is a working rebuild of an AI meeting notetaker. Everything that happens <i>after</i> a call is real. The part that joins the call is simulated.
      </p>
      <Section title="Real" icon={<Check size={15} />} tone="text-ok bg-ok/10" rows={REAL} />
      <Section title="Simulated" icon={<FlaskConical size={15} />} tone="text-amber-700 bg-amber-50" rows={SIMULATED} />
      <h2 className="mt-8 mb-2 flex items-center gap-2 text-[15px] font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sunken text-ink-3"><Minus size={15} /></span> Left out on purpose
      </h2>
      <p className="text-[13.5px] text-ink-2">{LEFT_OUT.join(" · ")}</p>
      <p className="mt-10 text-[13px] text-ink-3">
        Start with the hour-long, seven-person{" "}
        <Link href="/meetings/pmm-weekly" className="font-medium text-accent hover:underline">product marketing weekly</Link>, or{" "}
        <Link href="/calendar" className="font-medium text-accent hover:underline">join a call</Link> and highlight something mid-meeting.
      </p>
    </div>
  );
}

function Section({ title, icon, tone, rows }: { title: string; icon: React.ReactNode; tone: string; rows: string[][] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${tone}`}>{icon}</span> {title}
      </h2>
      <dl className="overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map(([k, v], i) => (
          <div key={k} className={`grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] ${i ? "border-t border-line" : ""}`}>
            <dt className="text-[13.5px] font-medium">{k}</dt>
            <dd className="text-[13.5px] text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
