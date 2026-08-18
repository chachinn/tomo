import { anilistClient } from '../core/anilist-client.js?v=1.0.0';

const $ = id => document.getElementById(id);
const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || 'Untitled';

function currentSeason() {
  const now = new Date();
  const m = now.getMonth() + 1;
  return [m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL', now.getFullYear()];
}

function card(media) {
  const a = document.createElement('a');
  a.className = 'tomo-discovery-card';
  a.href = media.siteUrl || `https://anilist.co/anime/${media.id}`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
  img.src = media?.coverImage?.large || '';
  const copy = document.createElement('span');
  const strong = document.createElement('strong'); strong.textContent = titleOf(media);
  const small = document.createElement('small'); small.textContent = [media.format, media.averageScore && `${media.averageScore}%`, media.seasonYear].filter(Boolean).join(' · ');
  copy.append(strong, small); a.append(img, copy); return a;
}

function section(title, subtitle, key) {
  const node = document.createElement('section');
  node.className = 'tomo-v1-card tomo-discovery-section';
  node.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">DISCOVER</span><h2>${title}</h2><p>${subtitle}</p></div></div><div class="tomo-discovery-row" data-discovery-row="${key}"><div class="tomo-v1-loading">Loading…</div></div>`;
  return node;
}

export async function initDiscoveryHub() {
  const screen = $('screen-discover');
  if (!screen || $('tomoDiscoveryHub')) return;
  const existing = screen.querySelector('.discover-block');
  const hub = document.createElement('div'); hub.id = 'tomoDiscoveryHub'; hub.className = 'tomo-discovery-hub';
  hub.append(
    section('This season', 'What is airing this season on AniList.', 'season'),
    section('Coming soon', 'Upcoming anime worth keeping an eye on.', 'upcoming'),
    section('Popular right now', 'High-popularity picks across AniList.', 'popular'),
    section('Hidden gems', 'Lower-popularity anime with solid community scores.', 'hidden')
  );
  existing?.insertAdjacentElement('afterend', hub) || screen.append(hub);

  const [season, year] = currentSeason();
  const query = `query TomoDiscovery($season:MediaSeason!,$year:Int!){
    season:Page(page:1,perPage:12){media(type:ANIME,isAdult:false,season:$season,seasonYear:$year,sort:[POPULARITY_DESC]){id title{romaji english native userPreferred} coverImage{large} format averageScore seasonYear siteUrl}}
    upcoming:Page(page:1,perPage:12){media(type:ANIME,isAdult:false,status:NOT_YET_RELEASED,sort:[POPULARITY_DESC]){id title{romaji english native userPreferred} coverImage{large} format averageScore seasonYear siteUrl}}
    popular:Page(page:1,perPage:12){media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC]){id title{romaji english native userPreferred} coverImage{large} format averageScore seasonYear siteUrl}}
    hidden:Page(page:1,perPage:12){media(type:ANIME,isAdult:false,popularity_lesser:15000,averageScore_greater:68,sort:[SCORE_DESC,POPULARITY_DESC]){id title{romaji english native userPreferred} coverImage{large} format averageScore seasonYear siteUrl}}
  }`;
  try {
    const data = await anilistClient.public(query, { season, year }, { ttl: 10 * 60 * 1000 });
    for (const key of ['season','upcoming','popular','hidden']) {
      const row = hub.querySelector(`[data-discovery-row="${key}"]`);
      const media = data?.[key]?.media || [];
      row?.replaceChildren(...media.map(card));
      if (row && !media.length) row.innerHTML = '<div class="tomo-v1-empty">Nothing to show right now.</div>';
    }
  } catch (error) {
    hub.querySelectorAll('.tomo-discovery-row').forEach(row => { row.innerHTML = `<div class="tomo-v1-empty">Couldn’t load this section. ${error?.message || ''}</div>`; });
  }
}
