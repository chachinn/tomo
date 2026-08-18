import { anilistClient } from '../core/anilist-client.js';
import { store } from '../core/storage.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function stat(label, value, sub = '') {
  return `<div class="tomo-stat"><strong>${value}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

function renderMaybeLater(host) {
  const items = store.getMaybeLater().slice(0, 12);
  const shelf = host.querySelector('[data-maybe-later]');
  if (!shelf) return;
  shelf.hidden = !items.length;
  const row = shelf.querySelector('.tomo-discovery-row');
  row.replaceChildren(...items.map(item => {
    const a = document.createElement('a');
    a.className = 'tomo-discovery-card'; a.href = `https://anilist.co/anime/${item.id}`; a.target = '_blank'; a.rel = 'noopener noreferrer';
    if (item.cover) { const img = document.createElement('img'); img.src = item.cover; img.loading = 'lazy'; img.alt = ''; a.append(img); }
    const copy = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = item.title; copy.append(strong); a.append(copy); return a;
  }));
}

async function renderStats(host) {
  const box = host.querySelector('[data-stats-grid]');
  if (!box) return;
  if (!window.TomoAniList?.isConnected?.()) { box.innerHTML = stat('Connect AniList', '—', 'Personal stats appear here after connecting.'); return; }
  const viewer = window.TomoAniList.getViewer?.();
  if (!viewer?.id) return;
  try {
    const data = await anilistClient.authenticated(`query($id:Int!){User(id:$id){statistics{anime{count meanScore minutesWatched episodesWatched genres(limit:3,sort:COUNT_DESC){genre count} formats(limit:3,sort:COUNT_DESC){format count}}}}}`, { id:Number(viewer.id) }, { ttl:5*60*1000 });
    const s = data?.User?.statistics?.anime;
    if (!s) throw new Error('No stats returned.');
    const hours = Math.round(Number(s.minutesWatched || 0) / 60);
    const fav = (s.genres || []).map(g => g.genre).filter(Boolean).join(', ');
    box.innerHTML = [
      stat('Anime on list', Number(s.count || 0).toLocaleString()),
      stat('Episodes watched', Number(s.episodesWatched || 0).toLocaleString()),
      stat('Hours watched', hours.toLocaleString()),
      stat('Mean score', s.meanScore ? Number(s.meanScore).toFixed(1) : '—'),
      stat('Top genres', fav || '—'),
      stat('Favorite formats', (s.formats || []).map(f => String(f.format || '').replaceAll('_',' ')).filter(Boolean).join(', ') || '—')
    ].join('');
  } catch (error) {
    const entries = window.TomoLibrary?.getEntries?.() || [];
    const completed = entries.filter(e => e.status === 'COMPLETED').length;
    const planning = entries.filter(e => e.status === 'PLANNING').length;
    box.innerHTML = [stat('Loaded titles', entries.length.toLocaleString()),stat('Completed', completed.toLocaleString()),stat('Planning', planning.toLocaleString()),stat('Stats status','Partial','Detailed AniList statistics will retry later.')].join('');
  }
}

export async function initLibraryInsights() {
  const screen = $('screen-library');
  if (!screen || $('tomoLibraryInsights')) return;
  const host = document.createElement('section');
  host.id = 'tomoLibraryInsights'; host.className = 'tomo-v1-card tomo-library-insights';
  host.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">YOUR ANIME DNA</span><h2>My anime at a glance</h2><p>Read-only insights from AniList. Tomo still treats AniList as the source of truth.</p></div></div><div class="tomo-stats-grid" data-stats-grid><div class="tomo-v1-loading">Loading your stats…</div></div><section data-maybe-later hidden><div class="tomo-v1-heading"><div><span class="eyebrow">LOCAL TO TOMO</span><h3>Maybe Later</h3><p>Things you saved from randomizer results on this device.</p></div></div><div class="tomo-discovery-row"></div></section>`;
  screen.append(host);
  renderMaybeLater(host);
  for (let i=0;i<50;i+=1) { if (window.TomoAniList?.request) break; await sleep(100); }
  renderStats(host);
  window.addEventListener('tomo:anilist-disconnected', () => renderStats(host));
}
