import { offlineFetch, enqueueMutation, getPendingMutations, flushQueue } from './offline';

describe('offline manager', () => {
  const originalFetch = global.fetch;
  const originalNavigator = global.navigator;
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    // simple localStorage mock
    const store = {};
    global.localStorage = {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
    // token preset
    localStorage.setItem('token', 'test-token');
    // mock navigator
    global.navigator = { onLine: true };
    // mock fetch
    global.fetch = vi.fn(async (url, init) => {
      if (String(url).includes('/error')) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ url, method: (init?.method || 'GET'), body: init?.body ? JSON.parse(init.body) : null, auth: init?.headers?.Authorization })
      };
    });
    getPendingMutations().splice(0, getPendingMutations().length);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.navigator = originalNavigator;
    global.localStorage = originalLocalStorage;
  });

  it('caches GET responses and serves when offline', async () => {
    const url = '/api/test?b=2&a=1';
    const onlineData = await offlineFetch(url);
    expect(onlineData.url).toContain('/api/test');
    // go offline
    global.navigator.onLine = false;
    const offlineData = await offlineFetch(url);
    expect(offlineData).toEqual(onlineData);
  });

  it('queues mutations when offline', async () => {
    global.navigator.onLine = false;
    const res = await enqueueMutation('/api/items', { method: 'POST', body: { name: 'Item' } });
    expect(res.queued).toBe(true);
    const pending = getPendingMutations();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending[0].method).toBe('POST');
  });

  it('flushes queue when back online', async () => {
    global.navigator.onLine = false;
    await enqueueMutation('/api/items', { method: 'POST', body: { name: 'X' } });
    global.navigator.onLine = true;
    await flushQueue();
    const pending = getPendingMutations();
    expect(pending.length).toBe(0);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('cleans body before syncing', async () => {
    global.navigator.onLine = false;
    await enqueueMutation('/api/items', { 
      method: 'POST', 
      body: { 
        name: 'Item', 
        empty: '', 
        nested: { a: null, b: '', c: 1 },
        list: [1, '', null, 2]
      } 
    });
    
    global.navigator.onLine = true;
    await flushQueue();
    
    // Check the call to fetch
    const lastCall = global.fetch.mock.calls[global.fetch.mock.calls.length - 1];
    const body = JSON.parse(lastCall[1].body);
    
    expect(body.name).toBe('Item');
    expect(body.empty).toBeUndefined();
    expect(body.nested).toEqual({ c: 1 });
    expect(body.list).toEqual([1, 2]);
  });

  it('does not queue non-retryable errors when online', async () => {
    global.navigator.onLine = true;
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 413,
      text: async () => '{"error":"request entity too large"}'
    }));

    await expect(
      enqueueMutation('/api/appointments/5', { method: 'PUT', body: { photos: [{ url: 'data:image/jpeg;base64,AAAA' }] } })
    ).rejects.toThrow('Falha ao sincronizar (413)');

    expect(getPendingMutations().length).toBe(0);
  });

  it('drops non-retryable queued item and syncs the remaining ones', async () => {
    global.navigator.onLine = false;
    await enqueueMutation('/api/appointments/5', { method: 'PUT', body: { photos: [{ url: 'data:image/jpeg;base64,AAAA' }] } });
    await enqueueMutation('/api/items', { method: 'POST', body: { name: 'ok' } });

    global.navigator.onLine = true;
    global.fetch = vi.fn(async (url, init) => {
      if (String(url).includes('/api/appointments/5')) {
        return {
          ok: false,
          status: 413,
          text: async () => '{"error":"request entity too large"}'
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ url, method: (init?.method || 'GET') })
      };
    });

    await expect(flushQueue({ force: true })).rejects.toThrow('Falha ao sincronizar (413)');
    expect(getPendingMutations().length).toBe(0);
    expect(global.fetch.mock.calls.length).toBe(2);
  });

  it('merges queued appointment updates for the same appointment', async () => {
    global.navigator.onLine = false;
    await enqueueMutation('/api/appointments/5', {
      method: 'PUT',
      body: { notes: 'primeiro', photos: [{ url: 'data:image/jpeg;base64,AAAA' }] }
    });
    await enqueueMutation('/api/appointments/5', { method: 'PUT', body: { notes: 'segundo' } });

    const pending = getPendingMutations();
    expect(pending.length).toBe(1);
    expect(pending[0].method).toBe('PUT');
    expect(pending[0].url).toBe('/api/appointments/5');
    expect(pending[0].body).toEqual({
      notes: 'segundo',
      photos: [{ url: 'data:image/jpeg;base64,AAAA' }]
    });
  });
});
