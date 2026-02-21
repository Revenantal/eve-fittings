"use client";

import { useEffect, useRef } from "react";
import type { AttributionsDocument } from "@/lib/attributions/types";

export type AttributionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  attributions: AttributionsDocument;
};

export function AttributionsModal({ isOpen, onClose, attributions }: AttributionsModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const focusableSelectors = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
      ];
      const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelectors.join(","))).filter(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true"
      );

      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || !panel.contains(current)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      lastFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Attributions"
        tabIndex={-1}
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded border border-zinc-700 bg-zinc-900 p-5 text-sm text-zinc-200 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Attributions</h2>
            <p className="mt-1 text-xs text-zinc-400">Generated: {new Date(attributions.generatedAt).toLocaleString()}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">APIs and Services</h3>
          <ul className="space-y-3">
            {attributions.services.map((service) => (
              <li key={service.name} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">{service.name}</p>
                <p className="mt-1 text-zinc-300">{service.purpose}</p>
                <p className="mt-1 text-xs">
                  Service:{" "}
                  <a className="text-cyan-400 hover:text-cyan-300" href={service.url} target="_blank" rel="noreferrer">
                    {service.url}
                  </a>
                </p>
                <p className="mt-1 text-xs">
                  Terms:{" "}
                  <a className="text-cyan-400 hover:text-cyan-300" href={service.termsUrl} target="_blank" rel="noreferrer">
                    {service.termsUrl}
                  </a>
                </p>
                {service.requiredNotice ? (
                  <p className="mt-2 rounded border border-zinc-700 bg-zinc-900/70 p-2 text-xs text-zinc-300">
                    {service.requiredNotice}
                  </p>
                ) : null}
                {service.notes ? <p className="mt-2 text-xs text-zinc-400">{service.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Resources</h3>
          <ul className="space-y-2">
            {attributions.resources.map((resource) => (
              <li key={resource.name} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">{resource.name}</p>
                <p className="mt-1 text-zinc-300">{resource.purpose}</p>
                <a className="mt-1 inline-block text-xs text-cyan-400 hover:text-cyan-300" href={resource.url} target="_blank" rel="noreferrer">
                  {resource.url}
                </a>
                {resource.notes ? <p className="mt-2 text-xs text-zinc-400">{resource.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Open Source Libraries (Direct Dependencies)
          </h3>
          <ul className="space-y-2">
            {attributions.libraries.map((library) => (
              <li key={library.name} className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="font-medium text-zinc-100">
                  {library.name} <span className="text-zinc-400">@ {library.version}</span>
                </p>
                <p className="mt-1 text-xs text-zinc-300">License: {library.license}</p>
                <a className="mt-1 inline-block text-xs text-cyan-400 hover:text-cyan-300" href={library.url} target="_blank" rel="noreferrer">
                  {library.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
