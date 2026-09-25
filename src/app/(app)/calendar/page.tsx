import { getCalendar } from "@/lib/queries";
import { CalendarSettings } from "@/components/calendar-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const calendar = await getCalendar();
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Calendar & recording</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink-3">Plumb joins the calls on your calendar and takes notes, so you don&apos;t have to.</p>
      <CalendarSettings calendar={calendar} />
    </div>
  );
}
