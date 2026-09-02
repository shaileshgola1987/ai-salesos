"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (public/sw.js) — makes the app installable and keeps
 * the app shell available offline after a first visit. See PRD §5 Offline-First. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a progressive enhancement — a failed registration (e.g.
      // unsupported browser, blocked by a privacy setting) shouldn't affect the app.
    });
  }, []);

  return null;
}
