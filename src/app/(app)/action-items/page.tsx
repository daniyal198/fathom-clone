import { listActionItems } from "@/lib/queries";
import { ActionBoard } from "@/components/action-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action items" };

export default async function ActionItemsPage() {
  const items = await listActionItems();
  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Action items</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink-3">Every follow-up from every meeting, by owner, each linked to the moment it was agreed.</p>
      <ActionBoard items={items} />
    </div>
  );
}
