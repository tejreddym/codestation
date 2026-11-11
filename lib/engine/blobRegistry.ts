/**
 * Code Station — Blob URL Lifecycle & Memory Management Registry
 * lib/engine/blobRegistry.ts
 *
 * Centrally tracks all Object URLs generated during binary and media tool executions.
 * Prevents memory leaks by ensuring deterministic revocation on re-run and unmount,
 * while supporting delayed revocation for asynchronous browser file downloads.
 */

export class BlobUrlRegistry {
  private urls = new Set<string>();
  private scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Evaluates whether the host environment provides native URL object creation.
   */
  public static isSupported(): boolean {
    return (
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      typeof URL.revokeObjectURL === "function"
    );
  }

  /**
   * Total number of active Object URLs tracked in this registry.
   */
  public get size(): number {
    return this.urls.size;
  }

  /**
   * Backward-compatible alias for size.
   */
  public getActiveCount(): number {
    return this.urls.size;
  }

  /**
   * Total number of scheduled delayed revocations currently pending.
   */
  public get scheduledCount(): number {
    return this.scheduledTimers.size;
  }

  /**
   * Creates an Object URL for the provided Blob or File and adds it to the registry.
   * In environments where URL.createObjectURL is not available (e.g., JSDOM or SSR),
   * generates a safe synthetic mock URL to prevent unhandled runtime exceptions.
   */
  public create(blob: Blob | File): string {
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      try {
        const url = URL.createObjectURL(blob);
        this.urls.add(url);
        return url;
      } catch {
        // Fallback if native createObjectURL fails on custom stub
      }
    }

    // Safe synthetic fallback for SSR and unmocked Vitest/JSDOM environments
    const fallbackId = Math.random().toString(36).slice(2, 10);
    const fallbackUrl = `blob:mock-${Date.now()}-${fallbackId}`;
    this.urls.add(fallbackUrl);
    return fallbackUrl;
  }

  /**
   * Registers an Object URL or Blob into the tracking registry.
   * Accepts either an already generated URL string or a Blob/File instance.
   */
  public register(blobOrUrl: Blob | File | string): string {
    if (typeof blobOrUrl === "string") {
      if (blobOrUrl.trim().length > 0) {
        this.urls.add(blobOrUrl);
      }
      return blobOrUrl;
    }
    return this.create(blobOrUrl);
  }

  /**
   * Checks whether the given URL is currently tracked in this registry.
   */
  public has(url: string): boolean {
    return this.urls.has(url);
  }

  /**
   * Immediately revokes a tracked Object URL and removes it from the registry.
   * Cancels any pending scheduled revocation timer for this URL.
   */
  public revoke(url: string): void {
    if (!this.urls.has(url)) {
      return;
    }

    // Cancel any scheduled timer for this URL
    const timer = this.scheduledTimers.get(url);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.scheduledTimers.delete(url);
    }

    this.urls.delete(url);

    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe no-op if custom stub throws
      }
    }
  }

  /**
   * Schedules a delayed revocation for an Object URL (default 60 seconds).
   * Safe for download buttons to prevent revoking the URL while the browser's
   * asynchronous file save prompt is active.
   */
  public scheduleRevocation(url: string, delayMs = 60_000): void {
    this.register(url);

    // Clear existing timer if already scheduled for this URL
    const existing = this.scheduledTimers.get(url);
    if (existing !== undefined) {
      clearTimeout(existing);
      this.scheduledTimers.delete(url);
    }

    const timer = setTimeout(() => {
      this.scheduledTimers.delete(url);
      this.revoke(url);
    }, delayMs);

    // In Node.js environments, unref timer so it does not hold the event loop open
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      const unrefFn = (timer as { unref?: () => void }).unref;
      if (typeof unrefFn === "function") {
        unrefFn.call(timer);
      }
    }

    this.scheduledTimers.set(url, timer);
  }

  /**
   * Revokes all tracked Object URLs, cancels all pending revocation timers,
   * and clears the registry completely.
   */
  public revokeAll(): void {
    for (const [, timer] of this.scheduledTimers) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();

    for (const url of this.urls) {
      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Safe no-op
        }
      }
    }
    this.urls.clear();
  }

  /**
   * Disposable interface alias for revokeAll().
   */
  public dispose(): void {
    this.revokeAll();
  }

  /**
   * Returns an array snapshot of all currently tracked Object URLs.
   */
  public getUrls(): string[] {
    return Array.from(this.urls);
  }

  /**
   * Backward-compatible alias for getUrls.
   */
  public getActiveUrls(): string[] {
    return Array.from(this.urls);
  }
}
