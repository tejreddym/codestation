import { beforeEach } from "vitest";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const memoryStorage = new MemoryStorage();

function bindStorage(target: any) {
  if (!target) return;
  try {
    Object.defineProperty(target, "localStorage", {
      get: () => memoryStorage,
      configurable: true,
    });
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  bindStorage(window);
}
if (typeof globalThis !== "undefined") {
  bindStorage(globalThis);
}

beforeEach(() => {
  if (typeof window !== "undefined") {
    bindStorage(window);
  }
  const jsdomWindow = (globalThis as unknown as { jsdom?: { window?: Window } })?.jsdom?.window;
  if (jsdomWindow) {
    bindStorage(jsdomWindow);
  }
});
