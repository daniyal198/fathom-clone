"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FileAudio, Mic, Square, UploadCloud } from "lucide-react";
import { TEMPLATES } from "@/lib/ai/templates";
import { clock, cn } from "@/lib/format";
import { Button } from "@/components/ui";

export function Uploader() {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "mic">("file");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("general");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Microphone recording (a real capture path for in-person meetings)
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(t);
  }, [recording]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/^(audio|video)\//.test(f.type)) return setError("That doesn't look like an audio or video file.");
    if (f.size > 300 * 1024 * 1024) return setError("Files up to 300 MB for now.");
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const startMic = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mime });
        const name = `Recording ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
        setFile(new File([blob], `${name}.${mime.includes("webm") ? "webm" : "m4a"}`, { type: mime }));
        if (!title) setTitle(name);
      };
      rec.start(1000);
      recorder.current = rec;
      setElapsed(0);
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. Allow it in your browser to record.");
    }
  };

  const stopMic = () => {
    recorder.current?.stop();
    setRecording(false);
  };

  const submit = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const blob = await upload(`recordings/${file.name.replace(/[^\w.-]+/g, "-")}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: file.size > 20 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, mediaUrl: blob.url, template, source: mode === "mic" ? "mic" : "upload" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/meetings/${data.id}`);
    } catch (e) {
      setError((e as Error).message || "Upload failed");
      setProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex gap-1 border-b border-line px-3">
        {(
          [
            ["file", "Upload a file", UploadCloud],
            ["mic", "Record in-person meeting", Mic],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => {
              setMode(k);
              setFile(null);
            }}
            disabled={recording || progress !== null}
            className={cn("-mb-px flex h-11 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium", mode === k ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink-2")}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {mode === "file" && !file && (
          <button
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              drag ? "border-accent bg-accent-soft/50" : "border-line-strong hover:border-accent/60 hover:bg-canvas"
            )}
          >
            <UploadCloud size={28} className="mb-2 text-accent" />
            <span className="font-medium">Drop a recording here, or click to choose</span>
            <span className="mt-1 text-[12.5px] text-ink-3">MP4, MOV, WebM, MP3, M4A or WAV, up to 300 MB</span>
          </button>
        )}
        <input ref={input} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

        {mode === "mic" && !file && (
          <div className="flex flex-col items-center py-8 text-center">
            <button
              onClick={recording ? stopMic : startMic}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full text-white shadow-pop transition-transform active:scale-95",
                recording ? "bg-danger" : "bg-accent hover:bg-accent-strong"
              )}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? <Square size={20} fill="currentColor" /> : <Mic size={24} />}
            </button>
            <p className="mt-3 font-mono text-[18px] tabular-nums">{clock(elapsed)}</p>
            <p className="mt-1 text-[13px] text-ink-3">{recording ? "Recording… put your device in the middle of the table." : "Tap to start recording an in-person meeting."}</p>
          </div>
        )}

        {file && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
              <FileAudio size={18} className="text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{file.name}</p>
                <p className="text-[12px] text-ink-3">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              {progress === null && (
                <button className="text-[12.5px] text-ink-3 hover:text-ink" onClick={() => setFile(null)}>
                  Change
                </button>
              )}
            </div>
            <label className="block text-[12.5px] font-medium text-ink-2">
              Meeting title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line px-3 text-[13.5px] font-normal outline-none focus:border-accent" />
            </label>
            <label className="block text-[12.5px] font-medium text-ink-2">
              Notes template
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] font-normal outline-none focus:border-accent">
                {TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}: {t.blurb}
                  </option>
                ))}
              </select>
            </label>
            {progress !== null ? (
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1.5 text-[12.5px] text-ink-3">{progress < 100 ? `Uploading… ${Math.round(progress)}%` : "Starting transcription…"}</p>
              </div>
            ) : (
              <Button variant="primary" onClick={submit} className="w-full">
                Transcribe & summarize
              </Button>
            )}
          </div>
        )}
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </div>
    </div>
  );
}
