import { listHighlights } from "@/lib/queries";
import { HighlightsLibrary } from "@/components/highlights-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Highlights" };

export default async function HighlightsPage() {
  const items = await listHighlights();
  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Highlights</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink-3">Moments you clipped across all your meetings, ready to share.</p>
      <HighlightsLibrary items={items} />
    </div>
  );
}
