import { anilistClient } from '../core/anilist-client.js';

function whenText(timestamp) {
  const date = new Date(Number(timestamp || 0) * 1000);
  if (!Number.isFinite(date.getTime())) return '';
  const diff = date.getTime() - Date.now();
  if (diff > 0 && diff < 48 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.round(diff / 3600000));
    return `in about ${hours}h`;
  }
  return date.toLocaleString([], { weekday:'short', hour:'numeric', minute:'2-digit' });
}

export async function initAiringSchedule() {
  const home = document.getElementById('screen-home');
  if (!home || document.getElementById('tomoAiringHome')) return;
  const host = document.createElement('section');
  host.id = 'tomoAiringHome'; host.className = 'tomo-v1-card'; host.hidden = true;
  host.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">WATCHING NOW</span><h2>Next episodes</h2><p>Your nearest upcoming episodes from anime currently marked Watching.</p></div></div><div class="tomo-airing-list"></div>`;
  home.append(host);

  if (!window.TomoAniList?.isConnected?.()) return;
  const viewer = window.TomoAniList.getViewer?.();
  if (!viewer?.id) return;
  try {
    const data = await anilistClient.authenticated(`query($id:Int!){MediaListCollection(userId:$id,type:ANIME,status:CURRENT){lists{entries{media{id title{userPreferred romaji english} siteUrl nextAiringEpisode{episode airingAt}}}}}}`, { id:Number(viewer.id) }, { ttl:5*60*1000 });
    const rows = (data?.MediaListCollection?.lists || []).flatMap(x => x?.entries || []).map(x => x.media).filter(x => x?.nextAiringEpisode?.airingAt).sort((a,b) => a.nextAiringEpisode.airingAt - b.nextAiringEpisode.airingAt).slice(0,6);
    if (!rows.length) return;
    host.hidden = false;
    const list = host.querySelector('.tomo-airing-list');
    list.replaceChildren(...rows.map(media => {
      const a = document.createElement('a'); a.className = 'tomo-airing-row'; a.href = media.siteUrl || `https://anilist.co/anime/${media.id}`; a.target='_blank'; a.rel='noopener noreferrer';
      const copy = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = media.title?.english || media.title?.userPreferred || media.title?.romaji || 'Anime'; const small = document.createElement('small'); small.textContent = `Episode ${media.nextAiringEpisode.episode} · ${whenText(media.nextAiringEpisode.airingAt)}`; copy.append(strong,small); a.append(copy); return a;
    }));
  } catch { host.hidden = true; }
}
