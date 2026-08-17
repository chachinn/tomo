(() => {
  'use strict';

  const els = Object.fromEntries([
    'installBtn','accountJumpBtn','quickRollBtn','openFiltersBtn','closeFiltersBtn','filtersPanel','smartRollBtn','genreFilter','formatFilter',
    'episodesFilter','scoreFilter','resultSection','resultCover','resultTitle','resultMeta','resultDescription','resultTags',
    'rerollBtn','anilistLink','trendingGrid','trendingStatus','refreshTrendingBtn','toast',
    'anilistAccount','anilistDisconnected','anilistLoading','anilistConnected','anilistError','anilistConnectBtn',
    'anilistDisconnectBtn','anilistRefreshBtn','anilistRetryBtn','anilistLoadingCopy','anilistErrorText',
    'anilistAvatar','anilistName','anilistSyncMeta','anilistListStatus',
    'countCurrent','countCompleted','countPlanning','countPaused','countDropped'
  ].map(id => [id, document.getElementById(id)]));

  let deferredInstallPrompt = null;
  let lastRollOptions = {};
  let toastTimer = null;
  let accountBusy = false;

  const titleOf = media => media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled';

  function cleanText(html) {
    if (!html) return 'No synopsis available yet.';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return doc.body?.textContent?.trim() || 'No synopsis available yet.';
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function showToast(message, duration = 2600) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, duration);
  }

  async function queryAniList(query, variables = {}) {
    if (!window.TomoAniList) throw new Error('AniList services are still loading. Please try again.');
    return window.TomoAniList.request(query, variables, { authenticated: false });
  }

  async function loadTrending() {
    els.refreshTrendingBtn.disabled = true;
    els.trendingStatus.hidden = false;
    els.trendingStatus.textContent = 'Loading anime…';
    try {
      const data = await queryAniList(`
        query {
          Page(page: 1, perPage: 10) {
            media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
              id
              title { romaji english native }
              coverImage { large extraLarge }
              format
              episodes
              averageScore
              seasonYear
              siteUrl
              genres
            }
          }
        }
      `);
      const media = data?.Page?.media || [];
      els.trendingGrid.replaceChildren(...media.map(mediaCard));
      els.trendingStatus.hidden = media.length > 0;
      if (!media.length) els.trendingStatus.textContent = 'No trending anime were returned right now.';
    } catch (err) {
      els.trendingStatus.hidden = false;
      els.trendingStatus.textContent = `Couldn’t load AniList right now. ${err.message}`;
    } finally {
      els.refreshTrendingBtn.disabled = false;
    }
  }

  function mediaCard(media) {
    const btn = document.createElement('button');
    btn.className = 'anime-card';
    btn.type = 'button';
    btn.setAttribute('aria-label', `Open ${titleOf(media)}`);

    const coverBox = document.createElement('div');
    coverBox.className = 'anime-cover';
    const cover = document.createElement('img');
    cover.loading = 'lazy';
    cover.decoding = 'async';
    cover.alt = '';
    const coverUrl = safeHttpsUrl(media?.coverImage?.extraLarge || media?.coverImage?.large || '');
    if (coverUrl) cover.src = coverUrl;
    coverBox.appendChild(cover);

    const title = document.createElement('div');
    title.className = 'anime-title';
    title.textContent = titleOf(media);

    const sub = document.createElement('div');
    sub.className = 'anime-sub';
    sub.textContent = `${media?.format || 'Anime'}${media?.seasonYear ? ` · ${media.seasonYear}` : ''}`;

    btn.append(coverBox, title, sub);
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
      minScore: options.minScore ? Number(options.minScore) : null
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
            id
            title { romaji english native }
            description(asHtml: true)
            coverImage { extraLarge large }
            format
            episodes
            duration
            averageScore
            seasonYear
            siteUrl
            genres
          }
        }
      }
    `;
    try {
      setRollBusy(true);
      const data = await queryAniList(query, variables);
      const pool = (data?.Page?.media || []).filter(Boolean);
      if (!pool.length) throw new Error('No matches found. Try loosening one of your filters.');
      showResult(pool[Math.floor(Math.random() * pool.length)]);
    } catch (err) {
      showToast(err.message, 4200);
    } finally {
      setRollBusy(false);
    }
  }

  function setRollBusy(busy) {
    [els.quickRollBtn, els.smartRollBtn, els.rerollBtn].filter(Boolean).forEach(btn => { btn.disabled = busy; });
    els.quickRollBtn.textContent = busy ? 'Finding something…' : '🎲 Quick Roll';
  }

  function showResult(media) {
    const coverUrl = safeHttpsUrl(media?.coverImage?.extraLarge || media?.coverImage?.large || '');
    els.resultCover.src = coverUrl;
    els.resultCover.alt = `${titleOf(media)} cover`;
    els.resultTitle.textContent = titleOf(media);
    els.resultDescription.textContent = cleanText(media?.description);
    const details = [
      media?.format,
      media?.episodes ? `${media.episodes} eps` : null,
      media?.averageScore ? `${media.averageScore}%` : null
    ].filter(Boolean);
    els.resultMeta.textContent = details.join(' · ') || 'Anime';
    els.resultTags.replaceChildren(...(media?.genres || []).slice(0, 5).map(tag => {
      const span = document.createElement('span');
      span.textContent = tag;
      return span;
    }));
    const siteUrl = safeHttpsUrl(media?.siteUrl || '');
    els.anilistLink.href = siteUrl || `https://anilist.co/anime/${Number(media?.id) || ''}`;
    els.resultSection.hidden = false;
    els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setAccountView(view) {
    els.anilistDisconnected.hidden = view !== 'disconnected';
    els.anilistLoading.hidden = view !== 'loading';
    els.anilistConnected.hidden = view !== 'connected';
    els.anilistError.hidden = view !== 'error';
  }

  function updateAccountCounts(counts = {}) {
    els.countCurrent.textContent = counts.CURRENT || 0;
    els.countCompleted.textContent = counts.COMPLETED || 0;
    els.countPlanning.textContent = counts.PLANNING || 0;
    els.countPaused.textContent = counts.PAUSED || 0;
    els.countDropped.textContent = counts.DROPPED || 0;
  }

  function renderViewer(viewer) {
    const avatar = safeHttpsUrl(viewer?.avatar?.large || viewer?.avatar?.medium || '');
    if (avatar) {
      els.anilistAvatar.src = avatar;
      els.anilistAvatar.hidden = false;
    } else {
      els.anilistAvatar.removeAttribute('src');
      els.anilistAvatar.hidden = true;
    }
    els.anilistAvatar.alt = viewer?.name ? `${viewer.name} AniList avatar` : 'AniList avatar';
    els.anilistName.textContent = viewer?.name || 'AniList account';
  }

  async function refreshAccountLists({ announce = false } = {}) {
    if (accountBusy || !window.TomoAniList?.isConnected()) return;
    accountBusy = true;
    els.anilistRefreshBtn.disabled = true;
    els.anilistListStatus.textContent = 'Refreshing your AniList lists…';
    try {
      await window.TomoAniList.loadAnimeLists();
      const counts = window.TomoAniList.getStatusCounts();
      updateAccountCounts(counts);
      const now = new Date();
      els.anilistListStatus.textContent = 'Lists synced from AniList.';
      els.anilistSyncMeta.textContent = `Synced ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      if (announce) showToast('AniList lists refreshed.');
    } catch (err) {
      els.anilistListStatus.textContent = err.message;
      if (announce) showToast(err.message, 4200);
    } finally {
      accountBusy = false;
      els.anilistRefreshBtn.disabled = false;
    }
  }

  async function initAniListAccount() {
    if (!window.TomoAniList) {
      setAccountView('error');
      els.anilistErrorText.textContent = 'AniList login services did not load. Refresh Tomo and try again.';
      return;
    }

    setAccountView('loading');
    els.anilistLoadingCopy.textContent = 'Checking your saved AniList login.';

    try {
      const result = await window.TomoAniList.init();
      if (!result.connected) {
        setAccountView('disconnected');
        return;
      }

      renderViewer(result.viewer);
      setAccountView('connected');
      await refreshAccountLists();
      if (result.returnedFromOAuth) showToast(`Connected to AniList as ${result.viewer?.name || 'your account'}!`);
    } catch (err) {
      setAccountView('error');
      els.anilistErrorText.textContent = err.message;
    }
  }

  els.quickRollBtn.addEventListener('click', () => rollAnime());
  els.rerollBtn.addEventListener('click', () => rollAnime(lastRollOptions));
  els.openFiltersBtn.addEventListener('click', () => {
    els.filtersPanel.hidden = false;
    els.filtersPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  els.closeFiltersBtn.addEventListener('click', () => { els.filtersPanel.hidden = true; });
  els.smartRollBtn.addEventListener('click', () => rollAnime({
    genre: els.genreFilter.value,
    format: els.formatFilter.value,
    maxEpisodes: els.episodesFilter.value,
    minScore: els.scoreFilter.value
  }));
  els.refreshTrendingBtn.addEventListener('click', loadTrending);

  els.accountJumpBtn.addEventListener('click', () => els.anilistAccount.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  els.anilistConnectBtn.addEventListener('click', () => window.TomoAniList?.connect());
  els.anilistDisconnectBtn.addEventListener('click', () => {
    window.TomoAniList?.disconnect();
    updateAccountCounts();
    setAccountView('disconnected');
    showToast('AniList disconnected from this device.');
  });
  els.anilistRefreshBtn.addEventListener('click', () => refreshAccountLists({ announce: true }));
  els.anilistRetryBtn.addEventListener('click', initAniListAccount);

  window.addEventListener('tomo:anilist-auth-expired', () => {
    updateAccountCounts();
    setAccountView('disconnected');
    showToast('Your AniList login expired. Connect again to continue.', 4200);
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => { els.installBtn.hidden = true; });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js?v=1.0.1').catch(() => {});
    });
  }

  // Keep discovery and account loading independent so one API failure does not block the other.
  loadTrending();
  initAniListAccount();
})();
