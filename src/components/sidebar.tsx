"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckSquare, Info, Search, Sparkles, Upload, Video } from "lucide-react";
import { cn } from "@/lib/format";
import { Kbd, Logo } from "./ui";

const NAV = [
  { href: "/", label: "Meetings", icon: Video, match: (p: string) => p === "/" || p.startsWith("/meetings") },
  { href: "/action-items", label: "Action items", icon: CheckSquare, match: (p: string) => p.startsWith("/action-items") },
  { href: "/highlights", label: "Highlights", icon: Sparkles, match: (p: string) => p.startsWith("/highlights") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p: string) => p.startsWith("/calendar") || p.startsWith("/live") },
  { href: "/upload", label: "Upload recording", icon: Upload, match: (p: string) => p.startsWith("/upload") },
];

export const openPalette = () => window.dispatchEvent(new Event("open-palette"));

export function Sidebar() {
  const path = usePathname();
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="mb-5 flex items-center gap-2 px-2">
          <Logo />
          <span className="text-[16px] font-semibold tracking-tight">Plumb</span>
        </Link>
        <button
          onClick={openPalette}
          className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 text-[13px] text-ink-3 transition-colors hover:border-line-strong"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search meetings</span>
          <Kbd>⌘K</Kbd>
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
                match(path) ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <Link
            href="/about"
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors",
              path === "/about" ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-sunken hover:text-ink-2"
            )}
          >
            <Info size={14} /> What&apos;s real in this demo
          </Link>
          <div className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">You</span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-medium">Demo workspace</div>
              <div className="truncate text-[11.5px] text-ink-3">Free plan · no sign-in</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-5 w-5" />
          <span className="font-semibold">Plumb</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={openPalette} className="rounded-lg p-2 text-ink-2 hover:bg-sunken" aria-label="Search">
            <Search size={17} />
          </button>
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link key={href} href={href} aria-label={label} className={cn("rounded-lg p-2", match(path) ? "text-accent" : "text-ink-2")}>
              <Icon size={17} />
            </Link>
          ))}
        </div>
      </div>
      <div className="h-12 lg:hidden" />
    </>
  );
}
