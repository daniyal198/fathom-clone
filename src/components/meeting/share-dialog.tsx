"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, ExternalLink, Globe, Mail, X } from "lucide-react";
import { Button } from "@/components/ui";

export function ShareDialog({
  open,
  onOpenChange,
  heading,
  blurb,
  getToken,
  subject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  heading: string;
  blurb: string;
  getToken: () => Promise<string>;
  subject: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(null);
    setCopied(false);
    getToken().then((t) => setUrl(`${window.location.origin}/share/${t}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 shadow-pop">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-[16px] font-semibold">{heading}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-ink-3">{blurb}</Dialog.Description>
            </div>
            <Dialog.Close className="rounded-lg p-1 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-canvas p-1.5 pl-3">
            <Globe size={15} className="shrink-0 text-ok" />
            <input
              readOnly
              value={url ?? "Creating link…"}
              onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] text-ink-2 outline-none"
            />
            <Button variant="primary" size="sm" onClick={copy} disabled={!url}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-ink-3">Anyone with the link can watch. They don&apos;t need a Plumb account.</p>
          <div className="mt-4 flex gap-2">
            <a
              href={url ? `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(url)}` : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium hover:bg-sunken"
            >
              <Mail size={13} /> Email
            </a>
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium hover:bg-sunken"
            >
              <ExternalLink size={13} /> Preview as a guest
            </a>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
