/**
 * Aussie Grid — Lazy chunk loading with stale-deploy recovery
 * File: src/lib/lazyRetry.ts
 * Version: v0.1.2.13
 */
import { createElement, lazy, type ComponentType } from "react";

const CHUNK_RELOAD_KEY = "aussie-grid-chunk-reloaded";

function hasReloaded(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  } catch {
    // Storage unavailable (private mode): never auto-reload, avoid loops.
    return true;
  }
}

function markReloaded(reloaded: boolean): void {
  try {
    if (reloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    } else {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Reload the page once to pick up a fresh asset manifest after a redeploy.
 * Returns true if a reload was triggered, false if we already reloaded once.
 */
export function reloadOnceForStaleChunk(): boolean {
  if (hasReloaded()) return false;
  markReloaded(true);
  window.location.reload();
  return true;
}

/**
 * Lazy-load a view chunk with two layers of recovery:
 *
 * 1. On Vercel, a new deployment changes hashed chunk filenames, so sessions
 *    holding the previous index.html 404 on lazy imports. The first failure
 *    triggers a one-time page reload to pick up the fresh manifest.
 * 2. React permanently caches a rejected lazy() import, which would freeze
 *    navigation to that view even after the network recovers. After a failure
 *    we recreate the lazy component, so the next render (e.g. after the error
 *    boundary resets on navigation) retries the actual network fetch.
 */
export function lazyWithReload<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>
): ComponentType<P> {
  let failed = false;

  const makeLazy = () =>
    lazy(async () => {
      try {
        const mod = await load();
        markReloaded(false);
        return mod;
      } catch (err) {
        failed = true;
        reloadOnceForStaleChunk();
        throw err;
      }
    });

  let instance = makeLazy();

  return function LazyChunk(props: P) {
    if (failed) {
      failed = false;
      instance = makeLazy();
    }
    return createElement(instance, props);
  };
}
