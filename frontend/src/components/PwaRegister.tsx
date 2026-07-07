"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pos-sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

export function InstallPwaBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [ios, setIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setHidden(true);
      return;
    }

    setIos(isIOS());
    setHidden(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => {
      setDeferred(null);
      setHidden(true);
    });

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || isStandalone()) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setDeferred(null);
  }

  return (
    <div className="neu-flat mb-4 flex flex-wrap items-center justify-between gap-3 border border-[#b8860b]/30 px-4 py-3">
      <div>
        <p className="text-sm font-semibold accent-text">Install Prince Esquire POS</p>
        <p className="text-xs text-[var(--muted)]">
          Add to your home screen for faster access and offline sales.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {deferred ? (
          <button type="button" onClick={install} className="neu-btn px-4 py-2 text-sm font-medium accent-text">
            Install app
          </button>
        ) : ios ? (
          <button
            type="button"
            onClick={() => setShowIosHelp((v) => !v)}
            className="neu-btn px-4 py-2 text-sm font-medium accent-text"
          >
            How to install (iPhone/iPad)
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)] self-center">
            Chrome/Edge: menu (⋮) → Install app
          </span>
        )}
        <button type="button" onClick={() => setHidden(true)} className="neu-btn px-3 py-2 text-xs text-[var(--muted)]">
          Dismiss
        </button>
      </div>
      {showIosHelp && (
        <p className="w-full text-xs text-[var(--muted)]">
          Safari → Share button → <strong>Add to Home Screen</strong> → Add
        </p>
      )}
    </div>
  );
}
