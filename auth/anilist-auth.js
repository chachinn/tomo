(() => {
  'use strict';

  const cfg = window.TOMO_ANILIST_CONFIG;
  if (!cfg) {
    console.error('Tomo AniList configuration was not loaded.');
    return;
  }

  const state = {
    token: null,
    expiresAt: 0,
    viewer: null,
    lists: null,
    requestTimes: [],
    lastRequestAt: 0,
    initialized: false
  };

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function storageGet(key) {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const value = storage.getItem(key);
        if (value) return value;
      } catch {}
    }
    return null;
  }

  function storageSet(key, value) {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.setItem(key, value);
        return true;
      } catch {}
    }
    return false;
  }

  function storageRemove(key) {
    for (const storage of [localStorage, sessionStorage]) {
      try { storage.removeItem(key); } catch {}
    }
  }

  function readStoredAuth() {
    const raw = storageGet(cfg.storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.token || !parsed?.expiresAt || Date.now() >= Number(parsed.expiresAt)) {
        storageRemove(cfg.storageKey);
        return null;
      }
      return parsed;
    } catch {
      storageRemove(cfg.storageKey);
      return null;
    }
  }

  function storeAuth(token, expiresInSeconds) {
    const expiresAt = Date.now() + Math.max(60, Number(expiresInSeconds || 31536000)) * 1000;
    state.token = token;
    state.expiresAt = expiresAt;
    storageSet(cfg.storageKey, JSON.stringify({ token, expiresAt }));
  }

  function clearAuth() {
    storageRemove(cfg.storageKey);
    storageRemove(cfg.cachedProfileKey);
    state.token = null;
    state.expiresAt = 0;
    state.viewer = null;
    state.lists = null;
  }

  function consumeOAuthFragment() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return false;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const token = params.get('access_token');
    if (!token) return false;
    const expiresIn = params.get('expires_in') || '31536000';
    storeAuth(token, expiresIn);
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return true;
  }

  async function acquireRequestSlot() {
    while (true) {
      const now = Date.now();
      state.requestTimes = state.requestTimes.filter(t => now - t < cfg.requestWindowMs);

      if (state.requestTimes.length >= cfg.requestLimit) {
        const waitFor = cfg.requestWindowMs - (now - state.requestTimes[0]) + 100;
        await wait(Math.max(100, waitFor));
        continue;
      }

      const gap = now - state.lastRequestAt;
      if (gap < cfg.burstGapMs) await wait(cfg.burstGapMs - gap);

      const stamped = Date.now();
      state.lastRequestAt = stamped;
      state.requestTimes.push(stamped);
      return;
    }
  }

  async function request(query, variables = {}, options = {}) {
    const { authenticated = false } = options;
    if (authenticated && !state.token) throw new Error('Connect your AniList account first.');

    await acquireRequestSlot();

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (authenticated) headers.Authorization = `Bearer ${state.token}`;

    let response;
    try {
      response = await fetch(cfg.graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        cache: 'no-store'
      });
    } catch {
      throw new Error('AniList could not be reached. Check your connection and try again.');
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {}

    if (response.status === 401) {
      clearAuth();
      window.dispatchEvent(new CustomEvent('tomo:anilist-auth-expired'));
      throw new Error('Your AniList login is no longer valid. Please connect again.');
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') || 60);
      throw new Error(`AniList is rate-limiting requests. Try again in about ${retryAfter} seconds.`);
    }

    if (payload?.errors?.length) {
      const first = payload.errors[0];
      throw new Error(first?.message || `AniList request failed (${response.status}).`);
    }

    if (!response.ok) throw new Error(`AniList request failed (${response.status}).`);
    if (!payload) throw new Error('AniList returned an unreadable response. Please try again.');
    return payload.data;
  }

  async function loadViewer() {
    const data = await request(`
      query {
        Viewer {
          id
          name
          avatar { large medium }
          siteUrl
        }
      }
    `, {}, { authenticated: true });

    state.viewer = data?.Viewer || null;
    if (!state.viewer) throw new Error('AniList did not return your account profile.');

    storageSet(cfg.cachedProfileKey, JSON.stringify({
      id: state.viewer.id,
      name: state.viewer.name,
      avatar: state.viewer.avatar?.medium || state.viewer.avatar?.large || '',
      savedAt: Date.now()
    }));

    return state.viewer;
  }

  async function loadAnimeLists() {
    if (!state.viewer?.id) await loadViewer();

    const data = await request(`
      query ($userId: Int!) {
        MediaListCollection(userId: $userId, type: ANIME) {
          lists {
            name
            status
            isCustomList
            entries {
              id
              mediaId
              status
              score
              progress
              repeat
              updatedAt
            }
          }
        }
      }
    `, { userId: Number(state.viewer.id) }, { authenticated: true });

    const lists = data?.MediaListCollection?.lists || [];
    state.lists = lists;
    return lists;
  }

  function getStatusCounts() {
    const counts = { CURRENT: 0, COMPLETED: 0, PLANNING: 0, PAUSED: 0, DROPPED: 0, REPEATING: 0 };
    const seen = new Set();

    for (const list of state.lists || []) {
      for (const entry of list?.entries || []) {
        if (!entry?.mediaId || seen.has(entry.mediaId)) continue;
        seen.add(entry.mediaId);
        if (entry.status in counts) counts[entry.status] += 1;
      }
    }
    return counts;
  }

  function connect() {
    const url = new URL(cfg.authorizeUrl);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('response_type', 'token');
    window.location.assign(url.toString());
  }

  function disconnect() {
    clearAuth();
    window.dispatchEvent(new CustomEvent('tomo:anilist-disconnected'));
  }

  async function init() {
    if (state.initialized && state.viewer && state.token) {
      return { connected: true, returnedFromOAuth: false, viewer: state.viewer };
    }

    const returnedFromOAuth = consumeOAuthFragment();
    if (!state.token) {
      const stored = readStoredAuth();
      if (stored) {
        state.token = stored.token;
        state.expiresAt = Number(stored.expiresAt);
      }
    }

    if (!state.token) {
      state.initialized = true;
      return { connected: false, returnedFromOAuth: false };
    }

    try {
      const viewer = await loadViewer();
      state.initialized = true;
      return { connected: true, returnedFromOAuth, viewer };
    } catch (error) {
      if (!state.token) return { connected: false, returnedFromOAuth, error };
      throw error;
    }
  }

  window.TomoAniList = Object.freeze({
    init,
    connect,
    disconnect,
    request,
    loadViewer,
    loadAnimeLists,
    getStatusCounts,
    isConnected: () => Boolean(state.token && Date.now() < state.expiresAt),
    getViewer: () => state.viewer,
    getLists: () => state.lists
  });
})();
