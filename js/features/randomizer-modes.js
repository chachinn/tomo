import { anilistClient } from '../core/anilist-client.js';
import { store } from '../core/storage.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || 'Untitled';

const MODES = [
  ['surprise','🎲','Surprise Me','Anything goes'],
  ['backlog','📚','Backlog Roulette','From Planning'],
  ['continue','▶️','Continue Something','From Watching'],
  ['rewatch','↻','Rewatch Roulette','From Completed'],
  ['rescue','🛟','Dropped Rescue','Give one another chance'],
  ['movie','🎬','Movie Night','Movies only'],
  ['short','🍬','Short & Sweet','12 episodes or fewer'],
  ['hidden','💎','Hidden Gem','Lower popularity, solid score'],
  ['throwback','📼','Throwback','Before 2000'],
  ['current-season','🌸','Season Roulette','Current season only']
];

const MEDIA_FIELDS = `id title{romaji english native userPreferred} description(asHtml:true) coverImage{extraLarge large} format episodes duration averageScore popularity season seasonYear status siteUrl genres`;

function cleanText(html) {
  if (!html) return 'No synopsis available yet.';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  return doc.body?.textContent?.trim() || 'No synopsis available yet.';
}

function historyIds() {
  return store.getHistory().slice(0, 20).map(item => Number(item.id)).filter(Boolean);
}

function notTonightIds() {
  return store.getNotTonight().filter(item => Date.now() - Number(item.time || 0) < 12 * 60 * 60 * 1000).map(item => Number(item.id)).filter(Boolean);
}

function remember(media, mode) {
  const next = [{ id: media.id, title: titleOf(media), cover: media?.coverImage?.large || '', mode, time: Date.now() }, ...store.getHistory().filter(item => Number(item.id) !== Number(media.id))].slice(0, 40);
  store.setHistory(next);
  window.dispatchEvent(new CustomEvent('tomo:roll-history-updated'));
}

function showResult(media, mode) {
  if (!$('resultSection') || !media) return;
  const cover = $('resultCover');
  const url = media?.coverImage?.extraLarge || media?.coverImage?.large || '';
  if (cover) { if (url) cover.src = url; cover.alt = `${titleOf(media)} cover`; }
  $('resultTitle').textContent = titleOf(media);
  $('resultDescription').textContent = cleanText(media.description);
  $('resultMeta').textContent = [media.format, media.episodes && `${media.episodes} eps`, media.duration && `${media.duration} min`, media.averageScore && `${media.averageScore}%`, media.seasonYear].filter(Boolean).join(' · ') || 'Anime';
  $('resultTags').replaceChildren(...(media.genres || []).slice(0, 6).map(name => { const span = document.createElement('span'); span.textContent = name; return span; }));
  $('anilistLink').href = media.siteUrl || `https://anilist.co/anime/${media.id}`;
  $('resultSection').hidden = false;
  $('resultSection').dataset.tomoMode = mode;
  $('resultSection').dataset.mediaId = String(media.id || '');
  $('resultSection').dataset.mediaTitle = titleOf(media);
  $('resultSection').dataset.mediaCover = media?.coverImage?.large || '';
  remember(media, mode);
  ensureResultActions();
  $('resultSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toast(message) {
  const node = $('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3600);
}

function ensureResultActions() {
  const actions = $('resultSection')?.querySelector('.result-actions');
  if (!actions || actions.querySelector('[data-tomo-feedback]')) return;
  const maybe = document.createElement('button');
  maybe.type = 'button'; maybe.className = 'secondary-btn'; maybe.dataset.tomoFeedback = 'maybe'; maybe.textContent = '♡ Maybe later';
  const skip = document.createElement('button');
  skip.type = 'button'; skip.className = 'secondary-btn'; skip.dataset.tomoFeedback = 'skip'; skip.textContent = 'Not tonight';
  actions.append(maybe, skip);
}

function currentSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (month <= 3) return ['WINTER', now.getFullYear()];
  if (month <= 6) return ['SPRING', now.getFullYear()];
  if (month <= 9) return ['SUMMER', now.getFullYear()];
  return ['FALL', now.getFullYear()];
}

async function detailedList() {
  const local = window.TomoLibrary?.getEntries?.() || [];
  if (local.length) return local;
  if (!window.TomoAniList?.isConnected?.()) throw new Error('Connect AniList first for this mode.');
  const viewer = window.TomoAniList.getViewer?.();
  if (!viewer?.id) throw new Error('Your AniList account is still loading.');
  const data = await anilistClient.authenticated(`query($userId:Int!){MediaListCollection(userId:$userId,type:ANIME){lists{entries{mediaId status progress score repeat media{${MEDIA_FIELDS}}}}}}`, { userId: Number(viewer.id) }, { ttl: 30000 });
  return (data?.MediaListCollection?.lists || []).flatMap(list => list?.entries || []);
}

function pickFromList(entries, status, mode) {
  const blocked = new Set([...historyIds(), ...notTonightIds()]);
  let pool = entries.filter(entry => entry?.status === status && entry?.media && !blocked.has(Number(entry.media.id || entry.mediaId)));
  if (!pool.length) pool = entries.filter(entry => entry?.status === status && entry?.media);
  if (!pool.length) throw new Error(`No anime are available in ${status.toLowerCase()} right now.`);
  const chosen = pool[Math.floor(Math.random() * pool.length)].media;
  showResult(chosen, mode);
}

async function publicPick(mode, extraArgs = [], vars = {}) {
  const blocked = [...new Set([...historyIds(), ...notTonightIds()])].slice(0, 40);
  const defs = ['$page:Int'];
  const args = ['type:ANIME','isAdult:false'];
  const variables = { page: 1, ...vars };
  if (blocked.length) { defs.push('$blocked:[Int]'); args.push('id_not_in:$blocked'); variables.blocked = blocked; }
  for (const part of extraArgs) { defs.push(part.def); args.push(part.arg); }
  args.push('sort:[POPULARITY_DESC,SCORE_DESC]');
  const query = `query TomoMode(${defs.join(',')}){Page(page:$page,perPage:50){pageInfo{lastPage}media(${args.join(',')}){${MEDIA_FIELDS}}}}`;
  const first = await anilistClient.public(query, variables, { ttl: 15000, force: true });
  let pool = first?.Page?.media || [];
  if (!pool.length && blocked.length) return publicPick(mode, extraArgs, vars);
  if (!pool.length) throw new Error('No anime matched this mode right now.');
  const last = Math.min(40, Math.max(1, Number(first?.Page?.pageInfo?.lastPage || 1)));
  const page = Math.floor(Math.random() * last) + 1;
  if (page !== 1) pool = (await anilistClient.public(query, { ...variables, page }, { ttl: 15000, force: true }))?.Page?.media || pool;
  showResult(pool[Math.floor(Math.random() * pool.length)], mode);
}

async function runMode(mode, button) {
  if (button?.disabled) return;
  const old = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = '<strong>Picking…</strong><small>Just a moment</small>'; }
  try {
    if (mode === 'surprise') return $('quickRollBtn')?.click();
    if (mode === 'backlog') return pickFromList(await detailedList(), 'PLANNING', mode);
    if (mode === 'continue') return pickFromList(await detailedList(), 'CURRENT', mode);
    if (mode === 'rewatch') return pickFromList(await detailedList(), 'COMPLETED', mode);
    if (mode === 'rescue') return pickFromList(await detailedList(), 'DROPPED', mode);
    if (mode === 'movie') return await publicPick(mode, [{ def:'$format:MediaFormat', arg:'format:$format' }], { format:'MOVIE' });
    if (mode === 'short') return await publicPick(mode, [{ def:'$episodes:Int', arg:'episodes_lesser:$episodes' }], { episodes:13 });
    if (mode === 'hidden') return await publicPick(mode, [{ def:'$pop:Int', arg:'popularity_lesser:$pop' },{ def:'$score:Int', arg:'averageScore_greater:$score' }], { pop:15000, score:68 });
    if (mode === 'throwback') return await publicPick(mode, [{ def:'$date:FuzzyDateInt', arg:'startDate_lesser:$date' }], { date:20000101 });
    if (mode === 'current-season') { const [season, year] = currentSeason(); return await publicPick(mode, [{ def:'$season:MediaSeason', arg:'season:$season' },{ def:'$year:Int', arg:'seasonYear:$year' }], { season, year }); }
  } catch (error) {
    toast(error?.message || 'Tomo could not pick an anime right now.');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = old; }
  }
}

function renderHistory() {
  const host = $('tomoRollHistory');
  if (!host) return;
  const items = store.getHistory().slice(0, 8);
  host.hidden = !items.length;
  const grid = host.querySelector('.tomo-history-grid');
  if (!grid) return;
  grid.replaceChildren(...items.map(item => {
    const a = document.createElement('a');
    a.href = `https://anilist.co/anime/${item.id}`; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'tomo-history-card';
    if (item.cover) { const img = document.createElement('img'); img.src = item.cover; img.alt = ''; img.loading = 'lazy'; a.append(img); }
    const span = document.createElement('span'); span.textContent = item.title; a.append(span); return a;
  }));
}

export function initRandomizerModes() {
  const screen = $('screen-randomize');
  const hero = screen?.querySelector('.hero-card');
  if (!screen || !hero || $('tomoModeHub')) return;
  const hub = document.createElement('section');
  hub.id = 'tomoModeHub'; hub.className = 'tomo-v1-card tomo-mode-hub';
  hub.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">PICK A MODE</span><h2>One randomizer, lots of ways to choose.</h2><p>Quick Roll is now Surprise Me — the other modes give the roll a purpose.</p></div></div><div class="tomo-mode-grid">${MODES.map(([id,icon,title,desc]) => `<button type="button" class="tomo-mode-card" data-tomo-mode="${id}"><span>${icon}</span><strong>${title}</strong><small>${desc}</small></button>`).join('')}</div>`;
  hero.insertAdjacentElement('afterend', hub);

  const history = document.createElement('section');
  history.id = 'tomoRollHistory'; history.className = 'tomo-v1-card tomo-history'; history.hidden = true;
  history.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">RECENT ROLLS</span><h2>Roll history</h2></div><button class="ghost-btn" type="button" data-clear-history>Clear</button></div><div class="tomo-history-grid"></div>`;
  screen.append(history);

  hub.addEventListener('click', event => { const btn = event.target.closest('[data-tomo-mode]'); if (btn) runMode(btn.dataset.tomoMode, btn); });
  $('resultSection')?.addEventListener('click', event => {
    const btn = event.target.closest('[data-tomo-feedback]'); if (!btn) return;
    const id = Number($('resultSection').dataset.mediaId || 0); if (!id) return;
    const item = { id, title: $('resultSection').dataset.mediaTitle || $('resultTitle')?.textContent || 'Anime', cover: $('resultSection').dataset.mediaCover || '', time: Date.now() };
    if (btn.dataset.tomoFeedback === 'maybe') { store.setMaybeLater([item, ...store.getMaybeLater().filter(x => Number(x.id) !== id)].slice(0,100)); toast('Saved to Maybe Later on this device.'); }
    else { store.setNotTonight([item, ...store.getNotTonight().filter(x => Number(x.id) !== id)].slice(0,100)); toast('Skipped for tonight. Tomo will avoid it for 12 hours.'); }
  });
  history.addEventListener('click', event => { if (!event.target.closest('[data-clear-history]')) return; store.setHistory([]); renderHistory(); });
  window.addEventListener('tomo:roll-history-updated', renderHistory);
  renderHistory();
  const quick = $('quickRollBtn'); if (quick) quick.textContent = '🎲 Surprise Me';
}
