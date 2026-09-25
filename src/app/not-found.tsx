import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-[13px] font-medium text-accent">404</p>
      <h1 className="mt-1 text-[20px] font-semibold">This page isn&apos;t here</h1>
      <p className="mt-1 text-[13.5px] text-ink-3">The meeting or link may have been deleted, or never shared.</p>
      <Link href="/" className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13.5px] font-medium text-white">Go to meetings</Link>
    </div>
  );
}
