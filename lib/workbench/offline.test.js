import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

let handlers, stores;

function cache(name) {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    match: async (key) => entries.get(typeof key === 'string' ? key : key.url),
    put: async (key, value) => entries.set(key, value),
  };
}

beforeEach(async () => {
  handlers = {};
  stores = new Map();
  vi.resetModules();
  vi.stubGlobal('self', {
    location: { origin: 'https://codestation.in' },
    addEventListener: (name, handler) => (handlers[name] = handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  });
  vi.stubGlobal('caches', {
    keys: async () => [...stores.keys()],
    open: async (name) => cache(name),
    delete: async (name) => stores.delete(name),
  });
  await import('../../public/code-station-sw.js');
});

afterEach(() => vi.unstubAllGlobals());

describe('Offline pack request boundaries', () => {
  it.each([
    { url: 'https://codestation.in/tools/json-formatter?input=secret', method: 'GET', mode: 'navigate' },
    { url: 'https://codestation.in/tools/json-formatter', method: 'POST', mode: 'navigate' },
    { url: 'https://external.example/image.png', method: 'GET', mode: 'no-cors' },
    { url: 'https://codestation.in/tools/api-request-tester', method: 'GET', mode: 'navigate' },
    { url: 'https://codestation.in/api/v1/license/verify', method: 'GET', mode: 'cors' },
    { url: 'https://codestation.in/pro', method: 'GET', mode: 'navigate' },
    { url: 'https://codestation.in/tools/json-formatter', method: 'GET', mode: 'cors', rsc: true },
  ])('does not intercept private, query, external, API/pro, or RSC requests: $url', (request) => {
    const respondWith = vi.fn();
    handlers.fetch({
      request: { ...request, headers: new Headers(request.rsc ? { RSC: '1' } : {}) },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  });

  it('serves supported HTML from a complete pack when network fails', async () => {
    const c = cache('code-station-offline-v1-test');
    await c.put('/__code-station-offline-ready', new Response('ready'));
    await c.put('/tools/json-formatter', new Response('cached shell'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
    let result;
    handlers.fetch({
      request: { url: 'https://codestation.in/tools/json-formatter', method: 'GET', mode: 'navigate', headers: new Headers() },
      respondWith: (p) => (result = p),
    });
    expect(await (await result).text()).toBe('cached shell');
  });

  it('never exposes an incomplete pack', async () => {
    await cache('code-station-offline-v1-incomplete').put('/tools/json-formatter', new Response('incomplete'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
    let result;
    handlers.fetch({
      request: { url: 'https://codestation.in/tools/json-formatter', method: 'GET', mode: 'navigate', headers: new Headers() },
      respondWith: (p) => (result = p),
    });
    expect((await result).status).toBe(503);
  });

  it('removes a failed download while retaining a prior ready pack', async () => {
    const old = cache('code-station-offline-v1-old');
    await old.put('/__code-station-offline-ready', new Response('ready'));
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ version: '0123456789abcdef', bytes: 1, assets: ['/_next/static/a.js'] }))
        )
        .mockResolvedValue(new Response('missing', { status: 404 }))
    );
    const postMessage = vi.fn();
    let work;
    handlers.message({
      data: { type: 'INSTALL_PACK' },
      ports: [{ postMessage }],
      waitUntil: (p) => (work = p),
    });
    await work;
    expect(stores.has('code-station-offline-v1-old')).toBe(true);
    expect(stores.has('code-station-offline-v1-0123456789abcdef')).toBe(false);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('pre-caches core assets on install and deletes obsolete caches on activate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
    let installWork;
    handlers.install({ waitUntil: (p) => (installWork = p) });
    await installWork;
    expect(stores.has('code-station-core-v2')).toBe(true);
    expect(await cache('code-station-core-v2').match('/offline')).toBeDefined();

    stores.set('code-station-core-v1', new Map());
    stores.set('code-station-pages-v1', new Map());
    stores.set('code-station-static-v1', new Map());
    stores.set('code-station-offline-v1-partial', new Map());

    let activateWork;
    handlers.activate({ waitUntil: (p) => (activateWork = p) });
    await activateWork;
    expect(stores.has('code-station-core-v1')).toBe(false);
    expect(stores.has('code-station-pages-v1')).toBe(false);
    expect(stores.has('code-station-static-v1')).toBe(false);
    expect(stores.has('code-station-offline-v1-partial')).toBe(false);
    expect(stores.has('code-station-core-v2')).toBe(true);
  });

  it('uses network-first for tool pages and falls back to runtime cache or /offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>live tool</html>', { status: 200 })));
    let res1;
    handlers.fetch({
      request: { url: 'https://codestation.in/tools/base64-encoder', method: 'GET', mode: 'navigate', headers: new Headers() },
      respondWith: (p) => (res1 = p),
    });
    expect(await (await res1).text()).toBe('<html>live tool</html>');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Error('offline')));
    let res2;
    handlers.fetch({
      request: { url: 'https://codestation.in/tools/base64-encoder', method: 'GET', mode: 'navigate', headers: new Headers() },
      respondWith: (p) => (res2 = p),
    });
    expect(await (await res2).text()).toBe('<html>live tool</html>');
  });

  it('serves immutable _next/static assets cache-first after populating', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('console.log(1)', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    let res1;
    handlers.fetch({
      request: { url: 'https://codestation.in/_next/static/chunks/app.js', method: 'GET', mode: 'no-cors', headers: new Headers() },
      respondWith: (p) => (res1 = p),
    });
    expect(await (await res1).text()).toBe('console.log(1)');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    let res2;
    handlers.fetch({
      request: { url: 'https://codestation.in/_next/static/chunks/app.js', method: 'GET', mode: 'no-cors', headers: new Headers() },
      respondWith: (p) => (res2 = p),
    });
    expect(await (await res2).text()).toBe('console.log(1)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
