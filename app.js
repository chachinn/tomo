const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const els = Object.fromEntries([
  'installBtn','quickRollBtn','openFiltersBtn','closeFiltersBtn','filtersPanel','smartRollBtn','genreFilter','formatFilter',
  'episodesFilter','scoreFilter','resultSection','resultCover','resultTitle','resultMeta','resultDescription','resultTags',
  'rerollBtn','anilistLink','trendingGrid','trendingStatus','refreshTrendingBtn'
].map(id => [id, document.getElementById(id)]));

let deferredInstallPrompt = null;
let lastRollOptions = {};

const queryAniList = async (query, variables = {}) => {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`AniList request failed (${res.status})`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || 'AniList returned an error.');
  return json.data;
};

const titleOf = media => media.title?.english || media.title?.romaji || media.title?.native || 'Untitled';
const cleanText = html => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || 'No synopsis available yet.';
};

async function loadTrending() {
  els.trendingStatus.hidden = false;
  els.trendingStatus.textContent = 'Loading anime…';
  try {
    const data = await queryAniList(`
      query {
        Page(page: 1, perPage: 10) {
          media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
            id title { romaji english native } coverImage { large extraLarge }
            format episodes averageScore seasonYear siteUrl genres
          }
        }
      }
    `);
    els.trendingGrid.replaceChildren(...data.Page.media.map(mediaCard));
    els.trendingStatus.hidden = true;
  } catch (err) {
    els.trendingStatus.hidden = false;
    els.trendingStatus.textContent = `Couldn’t load AniList right now. ${err.message}`;
  }
}

function mediaCard(media) {
  const btn = document.createElement('button');
  btn.className = 'anime-card';
  btn.type = 'button';
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || '';
  btn.innerHTML = `
    <div class="anime-cover"><img src="${cover}" loading="lazy" alt=""></div>
    <div class="anime-title"></div>
    <div class="anime-sub">${media.format || 'Anime'}${media.seasonYear ? ` · ${media.seasonYear}` : ''}</div>
  `;
  btn.querySelector('.anime-title').textContent = titleOf(media);
  btn.addEventListener('click', () => showResult(media));
  return btn;
}

async function rollAnime(options = {}) {
  lastRollOptions = options;
  const page = Math.floor(Math.random() * 40) + 1;
  const variables = {
    page,
    genre: options.genre || null,
    format: options.format || null,
    maxEpisodes: options.maxEpisodes ? Number(options.maxEpisodes) : null,
    minScore: options.minScore ? Number(options.minScore) : null,
  };
  const query = `
    query ($page: Int, $genre: String, $format: MediaFormat, $maxEpisodes: Int, $minScore: Int) {
      Page(page: $page, perPage: 25) {
        media(
          type: ANIME,
          isAdult: false,
          genre: $genre,
          format: $format,
          episodes_lesser: $maxEpisodes,
          averageScore_greater: $minScore,
          sort: POPULARITY_DESC
        ) {
          id title { romaji english native } description(asHtml: true)
          coverImage { extraLarge large } format episodes duration averageScore seasonYear
          siteUrl genres
        }
      }
    }
  `;
  try {
    setRollBusy(true);
    const data = await queryAniList(query, variables);
    const pool = data.Page.media.filter(Boolean);
    if (!pool.length) throw new Error('No matches found. Try loosening one of your filters.');
    showResult(pool[Math.floor(Math.random() * pool.length)]);
  } catch (err) {
    alert(err.message);
  } finally {
    setRollBusy(false);
  }
}

function setRollBusy(busy) {
  [els.quickRollBtn, els.smartRollBtn, els.rerollBtn].forEach(btn => {
    btn.disabled = busy;
  });
  if (busy) els.quickRollBtn.textContent = 'Finding something…';
  else els.quickRollBtn.textContent = '🎲 Quick Roll';
}

function showResult(media) {
  els.resultCover.src = media.coverImage?.extraLarge || media.coverImage?.large || '';
  els.resultCover.alt = `${titleOf(media)} cover`;
  els.resultTitle.textContent = titleOf(media);
  els.resultDescription.textContent = cleanText(media.description);
  const details = [media.format, media.episodes ? `${media.episodes} eps` : null, media.averageScore ? `${media.averageScore}%` : null].filter(Boolean);
  els.resultMeta.textContent = details.join(' · ') || 'Anime';
  els.resultTags.replaceChildren(...(media.genres || []).slice(0, 5).map(tag => {
    const span = document.createElement('span'); span.textContent = tag; return span;
  }));
  els.anilistLink.href = media.siteUrl || `https://anilist.co/anime/${media.id}`;
  els.resultSection.hidden = false;
  els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

els.quickRollBtn.addEventListener('click', () => rollAnime());
els.rerollBtn.addEventListener('click', () => rollAnime(lastRollOptions));
els.openFiltersBtn.addEventListener('click', () => { els.filtersPanel.hidden = false; els.filtersPanel.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
els.closeFiltersBtn.addEventListener('click', () => { els.filtersPanel.hidden = true; });
els.smartRollBtn.addEventListener('click', () => rollAnime({
  genre: els.genreFilter.value,
  format: els.formatFilter.value,
  maxEpisodes: els.episodesFilter.value,
  minScore: els.scoreFilter.value,
}));
els.refreshTrendingBtn.addEventListener('click', loadTrending);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); deferredInstallPrompt = event; els.installBtn.hidden = false;
});
els.installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null; els.installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

loadTrending();
