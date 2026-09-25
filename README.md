# Plumb: a rebuild of Fathom, the AI meeting notetaker

- **Live app:** https://fathom-clone-two.vercel.app (no sign-in; opens straight into a demo workspace)
- **Repository:** https://github.com/daniyal198/fathom-clone
- **Agent logs:** [`.agent-logs/`](.agent-logs/) (every prompt and final response, captured by a Claude Code hook; see [CAPTURE-TEST.md](CAPTURE-TEST.md))

Plumb records a call, transcribes it with speaker labels, writes notes in the template you pick, pulls out action items, and lets you clip and share any moment. It's seeded with **7 real, public meetings** (about 3.5 hours), including a 53-minute call with 7 speakers and a 24-minute call with 9.

## Where to start

1. **[Product marketing weekly](https://fathom-clone-two.vercel.app/meetings/pmm-weekly)**: the long, many-person call. Play it and watch the transcript follow along. Click any note bullet to jump to that moment. Use **Who spoke when** to see one person's lines, or switch the notes template.
2. Press **H** while it plays (or select transcript lines). A highlight is saved. **Share** it and open the link in a private window: the viewer gets only that clip.
3. **⌘K** searches every meeting: what was said, action items and titles. Results jump to the exact second.
4. **Calendar → Join now** on a recordable meeting. It replays a real call as if it were live. Highlight mid-call, hang up, and the recording, notes and your highlights appear moments later.
5. **Upload recording**: drop in any audio or video, or record an in-person meeting from your mic. The same pipeline runs on it for real.

## What's real and what's simulated

| Real | Simulated |
|---|---|
| Transcription with speaker diarization (Deepgram nova-3); names recovered by AI from intros and hand-offs | **The meeting bot.** Nothing joins Zoom/Meet/Teams. "Join call" replays a real recording in a live-call UI; hanging up turns what you sat through into a meeting |
| Notes, chapters and action items (Gemini). Every bullet cites the transcript line it came from | **Calendar OAuth.** The consent screen is a stand-in and the week of events is seeded. Record rules and per-event toggles are stored and applied |
| 7 note templates. New ones are generated on demand, then cached | **Accounts.** One shared demo workspace, so reviewers can open the link and go |
| Streaming "Ask AI" with clickable timestamps | |
| Full-text search across all meetings (Postgres `tsvector` plus substring fallback) | |
| Highlights, clip trimming, public share links (clip or whole meeting) | |
| File upload and in-browser mic recording, straight to Blob, then transcribe → notes | |

## Product decisions

**What I built first.** The meeting page. It's where a notetaker earns its keep: playback, transcript and notes stay in sync, and every AI claim links back to the moment it came from. That's what makes AI notes trustworthy enough to act on.

**The eight-person, one-hour case** gets features the two-person call doesn't need:
- **Chapters**, so an hour becomes 10–13 scannable sections.
- **Who spoke when**: one lane per person across the whole call, with talk-time share and open to-dos. Click a name to read only their lines.
- **A speaker-coloured scrubber** that shows who's talking where before you press play.
- **Action items grouped by owner** ("what does Cindy owe?"), with a progress bar.
- **In-meeting search** with next/previous, plus follow-along that pauses when you scroll away and resumes with one click.

**The capture layer is stubbed on purpose.** A reliable meeting bot is weeks of work and says little about product judgement. The live-call simulator still exercises the parts that matter to a user: the "is it recording?" moment, highlighting mid-call, and the hand-off from call to notes.

**Left out:** CRM/Slack sync, team workspaces and permissions, billing, real-time WebRTC transcription, mobile apps.

## How it works

```
YouTube (public meetings) ── yt-dlp ──► 360p MP4 ──► Vercel Blob (self-hosted media, so clips/seeking work)
                                     └► 16 kHz audio ──► Deepgram (diarized utterances)
                                                           └► Gemini: speaker names → chapters, action items, notes
                                                                └► Neon Postgres ──► Next.js 16 app on Vercel
```

- **App:** Next.js 16 (App Router, server actions, `after()` for background processing), Tailwind v4, Radix primitives, cmdk.
- **Data:** Neon Postgres via the HTTP driver; raw SQL in [`scripts/db/schema.sql`](scripts/db/schema.sql). Transcript lines and action items have generated `tsvector` columns with GIN indexes.
- **AI:** Gemini free tier through a model chain ([`src/lib/ai/gemini.ts`](src/lib/ai/gemini.ts)). Interactive calls lead with `gemini-3.5-flash-lite` (about 3–5 s for notes on an hour-long transcript); the offline seed uses `gemini-3.5-flash`. Rate limits fall through to the next model instead of failing. Output is JSON-schema constrained. The model cites transcript **line numbers**, which map back to exact timestamps, so it never invents times.
- **Player:** a small external store (`useSyncExternalStore`) publishes playback time, so the transcript, scrubber and chapters re-render at a few Hz without re-rendering the page.
- **Demo freshness:** seeded dates roll forward on read, so "yesterday's standup" stays yesterday however late you open it.

## Seed data and credits

All recordings are public videos, credited on each meeting page with a link to the source:

| Meeting | Source |
|---|---|
| Product Marketing Meeting (weekly), 2020-04-12 | [GitLab Unfiltered](https://www.youtube.com/watch?v=uE4HwpsreEE) |
| GitLab Pods & CEO Sync | [GitLab Unfiltered](https://www.youtube.com/watch?v=Q7sxtxoRgT4) |
| Sync about issue 504188 | [GitLab Unfiltered](https://www.youtube.com/watch?v=VV1Bjazv0dk) |
| Key Meeting: Engineering | [GitLab Unfiltered](https://www.youtube.com/watch?v=qGFoZ8yodc4) |
| Weekly Package Team Meeting | [GitLab Unfiltered](https://www.youtube.com/watch?v=Of39LKmX6iM) |
| Kubernetes SIG Network, 2025-01-30 | [Kubernetes](https://www.youtube.com/watch?v=3DNmDpTenCU) |
| Live discovery call with a $70M steak company | [Zach Schubert](https://www.youtube.com/watch?v=QsJyiY_P5UQ) |

Processed transcripts, speaker maps and notes are committed in [`data/seed/`](data/seed/), so the app can be re-seeded without re-running transcription.

## Run it locally

```bash
npm install
vercel env pull .env.local          # DATABASE_URL, BLOB_READ_WRITE_TOKEN, GEMINI_API_KEY, DEEPGRAM_API_KEY
npx tsx scripts/db/migrate.ts       # schema
npx tsx scripts/seed/load.ts        # load data/seed/* into Postgres (uploads media if missing)
npm run dev
```

To rebuild the seed from scratch: `scripts/seed/fetch.sh` (needs yt-dlp + ffmpeg), then `npx tsx scripts/seed/process.ts`, then `load.ts`.
