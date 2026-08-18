const memory = new Map();
const pending = new Map();
let lastRequestAt = 0;
const MIN_GAP_MS = 2100;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stableKey = (query, variables, authenticated) => JSON.stringify([query, variables || {}, Boolean(authenticated)]);

async function waitForService() {
  for (let i = 0; i < 80; i += 1) {
    if (window.TomoAniList?.request) return;
    await sleep(100);
  }
  throw new Error('AniList services are still loading.');
}

async function request(query, variables = {}, { authenticated = false, ttl = 60000, force = false } = {}) {
  await waitForService();
  const key = stableKey(query, variables, authenticated);
  const cached = memory.get(key);
  if (!force && cached && Date.now() - cached.time < ttl) return cached.data;
  if (pending.has(key)) return pending.get(key);

  const work = (async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    const data = await window.TomoAniList.request(query, variables, { authenticated });
    memory.set(key, { time: Date.now(), data });
    return data;
  })().finally(() => pending.delete(key));

  pending.set(key, work);
  return work;
}

export const anilistClient = Object.freeze({
  public: (query, variables, options = {}) => request(query, variables, { ...options, authenticated: false }),
  authenticated: (query, variables, options = {}) => request(query, variables, { ...options, authenticated: true }),
  clear: () => memory.clear()
});
