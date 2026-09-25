import { Uploader } from "@/components/uploader";

export const metadata = { title: "Upload recording" };

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Add a recording</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink-3">
        In-person meeting, phone call, or a recording from another tool: Plumb transcribes it, works out who&apos;s speaking, and writes the notes.
      </p>
      <Uploader />
    </div>
  );
}
