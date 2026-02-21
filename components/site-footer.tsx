"use client";

import { useState } from "react";
import { attributionsDocument } from "@/lib/attributions";
import { AttributionsModal } from "@/components/attributions-modal";

export type SiteFooterProps = {
  className?: string;
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

export function SiteFooter({ className }: SiteFooterProps) {
  const [isAttributionsOpen, setIsAttributionsOpen] = useState(false);

  return (
    <>
      <footer className={` bg-zinc-950/70 px-4 py-4 text-xs text-zinc-300 ${className ?? ""}`}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <a
              className="text-cyan-400 transition-colors hover:text-cyan-300"
              href="https://github.com/Revenantal/eve-fittings"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Repository
            </a>
            <span className="text-zinc-500">|</span>
            <span>In-game: yipcool</span>
            <span className="text-zinc-500">|</span>
            <span>Discord: #revenantal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-400">v{APP_VERSION}</span>
            <button
              type="button"
              onClick={() => setIsAttributionsOpen(true)}
              className="cursor-pointer text-cyan-400 transition-colors hover:text-cyan-300"
            >
              Attributions
            </button>
          </div>
        </div>
      </footer>
      <AttributionsModal
        isOpen={isAttributionsOpen}
        onClose={() => setIsAttributionsOpen(false)}
        attributions={attributionsDocument}
      />
    </>
  );
}
