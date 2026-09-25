"use client";

import { forwardRef } from "react";
import { cn, initials } from "@/lib/format";

export function Logo({ className }: { className?: string }) {
  // A plumb bob: the line you drop to measure depth.
  return (
    <svg viewBox="0 0 24 24" className={cn("h-6 w-6", className)} aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--color-accent)" />
      <path d="M12 4.5v4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 8.7c-2.9 0-4.6 2.1-4.6 4.4 0 2.9 2.6 4.6 4.6 6.4 2-1.8 4.6-3.5 4.6-6.4 0-2.3-1.7-4.4-4.6-4.4Z" fill="#fff" />
    </svg>
  );
}

export function Avatar({ name, color, size = 24, ring = false }: { name: string; color?: string; size?: number; ring?: boolean }) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none", ring && "ring-2 ring-surface")}
      style={{ width: size, height: size, background: color ?? "var(--color-ink-3)", fontSize: Math.max(9, size * 0.4) }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 22 }: { people: { name: string; color: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} color={p.color} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-sunken font-medium text-ink-2 ring-2 ring-surface"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-strong",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
        variant === "danger" && "text-danger hover:bg-red-50",
        className
      )}
      {...rest}
    />
  );
});

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface px-1 font-sans text-[10.5px] font-medium text-ink-3">{children}</kbd>
  );
}

export function TimeChip({ ms, onClick, className }: { ms: number; onClick?: () => void; className?: string }) {
  const s = Math.floor(ms / 1000);
  const label = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md bg-accent-soft px-1.5 font-mono text-[11px] font-medium tabular-nums text-accent transition-colors hover:bg-accent hover:text-white",
        className
      )}
      title="Jump to this moment"
    >
      {label}
    </button>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-ink-3">{children}</div>}
    </div>
  );
}
