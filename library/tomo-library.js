(() => {
  'use strict';

  const screen = document.getElementById('screen-library');
  const accountCard = document.getElementById('anilistAccount');
  const connectedPanel = document.getElementById('anilistConnected');
  const refreshButton = document.getElementById('anilistRefreshBtn');
  if (!screen || !accountCard) return;

  const PAGE_SIZE = 30;
  const STATUS_ORDER = ['ALL', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED', 'DROPPED', 'REPEATING'];
  const STATUS_LABELS = {
    ALL: 'All',
    CURRENT: 'Watching',
    COMPLETED: 'Completed',
    PLANNING: 'Planning',
    PAUSED: 'Paused',
    DROPPED: 'Dropped',
    REPEATING: 'Rewatching'
  };

  const state = {
    loading: false,
    loaded: false,
    entries: [],
    filtered: [],
    status: 'ALL',
    query: '',
    sort: 'updated',
    visibleCount: PAGE_SIZE,
    loadToken: 0
  };

  const host = document.createElement('section');
  host.id = 'tomoLibraryBrowser';
  host.className = 'tomo-library-browser';
  host.hidden = true;
  host.innerHTML = `
    <div class="library-heading-row">
      <div>
        <span class="eyebrow">YOUR LIBRARY</span>
        <h2>Browse My Anime</h2>
        <p id="librarySummary" class="library-summary">Loading your AniList library…</p>
      </div>
      <button id="libraryReloadBtn" class="ghost-btn library-reload-btn" type="button">Refresh</button>
    </div>

    <div class="library-toolbar">
      <label class="library-search-wrap">
        <span class="sr-only">Search your anime</span>
        <span class="library-search-icon" aria-hidden="true">⌕</span>
        <input id="librarySearch" type="search" inputmode="search" autocomplete="off" placeholder="Search your anime…" />
      </label>
      <label class="library-sort-wrap">
        <span class="sr-only">Sort your anime</span>
        <select id="librarySort" aria-label="Sort your anime">
          <option value="updated">Recently updated</option>
          <option value="title">Title A–Z</option>
          <option value="score">My score</option>
          <option value="progress">Progress</option>
        </select>
      </label>
    </div>

    <div id="libraryStatusTabs" class="library-status-tabs" role="tablist" aria-label="Anime list status"></div>

    <div id="libraryLoading" class="library-state-card" hidden>
      <span class="library-spinner" aria-hidden="true"></span>
      <strong>Loading your anime…</strong>
      <small>Tomo is fetching the titles and covers for your AniList library.</small>
    </div>

    <div id="libraryError" class="library-state-card error" hidden>
      <strong>Couldn’t load your library.</strong>
      <small id="libraryErrorText"></small>
      <button id="libraryRetryBtn" class="secondary-btn" type="button">Try again</button>
    </div>

    <div id="libraryEmpty" class="library-state-card" hidden>
      <strong>No anime found here.</strong>
      <small>Try another status or clear your search.</small>
    </div>

    <div id="libraryGrid" class="library-grid" aria-live="polite"></div>
    <button id="libraryLoadMoreBtn" class="secondary-btn library-load-more" type="button" hidden>Load more</button>
  `;
  accountCard.insertAdjacentElement('afterend', host);

  const els = Object.fromEntries([
    'librarySummary','libraryReloadBtn','librarySearch','librarySort','libraryStatusTabs','libraryLoading',
    'libraryError','libraryErrorText','libraryRetryBtn','libraryEmpty','libraryGrid','libraryLoadMoreBtn'
  ].map(id => [id, document.getElementById(id)]));

  function titleOf(entry) {
    const title = entry?.media?.title || {};
    return title.userPreferred || title.english || title.romaji || title.native || 'Untitled';
  }

  function normalize(value) {
    return String(value || '').toLocaleLowerCase().normalize('NFKD');
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function isConnected() {
    return Boolean(window.TomoAniList?.isConnected?.() && window.TomoAniList?.getViewer?.()?.id);
  }

  function libraryScreenIsActive() {
    return screen.classList.contains('active');
  }

  function setHostVisibility() {
    const show = isConnected() && !connectedPanel?.hidden;
    host.hidden = !show;
    if (!show) clearRenderedLibrary();
  }

  function clearRenderedLibrary() {
    state.entries = [];
    state.filtered = [];
    state.loaded = false;
    state.loading = false;
    state.visibleCount = PAGE_SIZE;
    els.libraryGrid.replaceChildren();
    els.libraryStatusTabs.replaceChildren();
    els.libraryLoading.hidden = true;
    els.libraryError.hidden = true;
    els.libraryEmpty.hidden = true;
    els.libraryLoadMoreBtn.hidden = true;
    els.librarySummary.textContent = 'Connect AniList to browse your anime here.';
  }

  function flattenLists(lists) {
    const byMediaId = new Map();
    for (const list of lists || []) {
      for (const entry of list?.entries || []) {
        const mediaId = Number(entry?.mediaId || entry?.media?.id || 0);
        if (!mediaId || !entry?.media) continue;
        const existing = byMediaId.get(mediaId);
        if (!existing || Number(entry.updatedAt || 0) >= Number(existing.updatedAt || 0)) {
          byMediaId.set(mediaId, entry);
        }
      }
    }
    return [...byMediaId.values()];
  }

  function countsByStatus(entries = state.entries) {
    const counts = { ALL: entries.length, CURRENT: 0, COMPLETED: 0, PLANNING: 0, PAUSED: 0, DROPPED: 0, REPEATING: 0 };
    for (const entry of entries) {
      if (entry?.status in counts) counts[entry.status] += 1;
    }
    return counts;
  }

  function renderTabs() {
    const counts = countsByStatus();
    const fragment = document.createDocumentFragment();
    for (const status of STATUS_ORDER) {
      if (status === 'REPEATING' && !counts.REPEATING) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'library-status-chip';
      button.dataset.libraryStatus = status;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', state.status === status ? 'true' : 'false');
      button.textContent = `${STATUS_LABELS[status]} ${counts[status] || 0}`;
      fragment.appendChild(button);
    }
    els.libraryStatusTabs.replaceChildren(fragment);
  }

  function applyFilters({ resetVisible = true } = {}) {
    let entries = [...state.entries];

    if (state.status !== 'ALL') entries = entries.filter(entry => entry?.status === state.status);

    const query = normalize(state.query.trim());
    if (query) {
      entries = entries.filter(entry => {
        const media = entry?.media || {};
        const title = media.title || {};
        const haystack = [title.userPreferred, title.english, title.romaji, title.native, media.format, media.seasonYear]
          .map(normalize)
          .join(' ');
        return haystack.includes(query);
      });
    }

    if (state.sort === 'title') {
      entries.sort((a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { sensitivity: 'base' }));
    } else if (state.sort === 'score') {
      entries.sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || titleOf(a).localeCompare(titleOf(b)));
    } else if (state.sort === 'progress') {
      entries.sort((a, b) => Number(b.progress || 0) - Number(a.progress || 0) || titleOf(a).localeCompare(titleOf(b)));
    } else {
      entries.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    state.filtered = entries;
    if (resetVisible) state.visibleCount = PAGE_SIZE;
    renderEntries();
  }

  function statusText(entry) {
    const label = STATUS_LABELS[entry?.status] || 'Anime';
    const progress = Number(entry?.progress || 0);
    const episodes = Number(entry?.media?.episodes || 0);
    if (entry?.status === 'PLANNING' && !progress) return label;
    if (episodes > 0) return `${label} · ${progress}/${episodes}`;
    if (progress > 0) return `${label} · ${progress} eps`;
    return label;
  }

  function libraryCard(entry) {
    const media = entry?.media || {};
    const link = document.createElement('a');
    link.className = 'library-card';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.href = safeHttpsUrl(media.siteUrl) || `https://anilist.co/anime/${Number(media.id || entry.mediaId || 0)}`;
    link.setAttribute('aria-label', `Open ${titleOf(entry)} on AniList`);

    const poster = document.createElement('div');
    poster.className = 'library-poster';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    const coverUrl = safeHttpsUrl(media?.coverImage?.large || media?.coverImage?.medium || '');
    if (coverUrl) img.src = coverUrl;
    const color = String(media?.coverImage?.color || '');
    if (/^#[0-9a-f]{3,8}$/i.test(color)) poster.style.backgroundColor = color;
    poster.appendChild(img);

    const copy = document.createElement('div');
    copy.className = 'library-card-copy';

    const title = document.createElement('strong');
    title.className = 'library-card-title';
    title.textContent = titleOf(entry);

    const meta = document.createElement('span');
    meta.className = 'library-card-meta';
    meta.textContent = [media.format, media.seasonYear].filter(Boolean).join(' · ') || 'Anime';

    const status = document.createElement('span');
    status.className = `library-card-status status-${String(entry?.status || '').toLowerCase()}`;
    status.textContent = statusText(entry);

    const detailRow = document.createElement('span');
    detailRow.className = 'library-card-detail';
    const details = [];
    if (Number(entry?.score || 0) > 0) details.push(`My score ${Number(entry.score)}`);
    if (Number(entry?.repeat || 0) > 0) details.push(`Rewatched ${Number(entry.repeat)}×`);
    detailRow.textContent = details.join(' · ');
    detailRow.hidden = details.length === 0;

    copy.append(title, meta, status, detailRow);
    link.append(poster, copy);
    return link;
  }

  function renderEntries() {
    const total = state.filtered.length;
    const visible = state.filtered.slice(0, state.visibleCount);
    const fragment = document.createDocumentFragment();
    for (const entry of visible) fragment.appendChild(libraryCard(entry));
    els.libraryGrid.replaceChildren(fragment);

    els.libraryEmpty.hidden = total > 0 || state.loading;
    els.libraryLoadMoreBtn.hidden = visible.length >= total || total === 0;
    if (!els.libraryLoadMoreBtn.hidden) els.libraryLoadMoreBtn.textContent = `Load more (${visible.length} of ${total})`;

    const statusLabel = state.status === 'ALL' ? 'anime' : STATUS_LABELS[state.status].toLowerCase();
    const searchNote = state.query.trim() ? ` matching “${state.query.trim()}”` : '';
    els.librarySummary.textContent = `${total.toLocaleString()} ${statusLabel}${searchNote}. Showing ${visible.length.toLocaleString()}.`;
  }

  function setLoading(loading) {
    state.loading = loading;
    els.libraryLoading.hidden = !loading;
    els.libraryReloadBtn.disabled = loading;
    els.libraryRetryBtn.disabled = loading;
    if (loading) {
      els.libraryError.hidden = true;
      els.libraryEmpty.hidden = true;
      els.libraryLoadMoreBtn.hidden = true;
      els.librarySummary.textContent = 'Loading your AniList library…';
    }
  }

  async function fetchDetailedLists({ force = false } = {}) {
    if (!isConnected()) {
      setHostVisibility();
      return;
    }
    if (state.loading) return;
    if (state.loaded && !force) {
      applyFilters({ resetVisible: false });
      return;
    }

    const token = ++state.loadToken;
    setLoading(true);
    host.hidden = false;

    try {
      const viewer = window.TomoAniList.getViewer();
      const data = await window.TomoAniList.request(`
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
                media {
                  id
                  title { userPreferred romaji english native }
                  coverImage { large medium color }
                  format
                  episodes
                  seasonYear
                  siteUrl
                }
              }
            }
          }
        }
      `, { userId: Number(viewer.id) }, { authenticated: true });

      if (token !== state.loadToken) return;
      const lists = data?.MediaListCollection?.lists || [];
      state.entries = flattenLists(lists);
      state.loaded = true;
      state.visibleCount = PAGE_SIZE;
      renderTabs();
      applyFilters();
      els.libraryError.hidden = true;
    } catch (error) {
      if (token !== state.loadToken) return;
      state.loaded = false;
      els.libraryError.hidden = false;
      els.libraryErrorText.textContent = error?.message || 'AniList did not return your library.';
      els.libraryGrid.replaceChildren();
      els.libraryStatusTabs.replaceChildren();
      els.librarySummary.textContent = 'Your library could not be displayed yet.';
    } finally {
      if (token === state.loadToken) setLoading(false);
    }
  }

  function ensureLoadedForCurrentScreen({ force = false } = {}) {
    setHostVisibility();
    if (!libraryScreenIsActive() || !isConnected()) return;
    fetchDetailedLists({ force });
  }

  els.libraryStatusTabs.addEventListener('click', event => {
    const button = event.target.closest('[data-library-status]');
    if (!button) return;
    state.status = button.dataset.libraryStatus || 'ALL';
    renderTabs();
    applyFilters();
  });

  let searchTimer = null;
  els.librarySearch.addEventListener('input', event => {
    clearTimeout(searchTimer);
    const value = event.target.value;
    searchTimer = setTimeout(() => {
      state.query = value;
      applyFilters();
    }, 120);
  });

  els.librarySort.addEventListener('change', event => {
    state.sort = event.target.value || 'updated';
    applyFilters();
  });

  els.libraryLoadMoreBtn.addEventListener('click', () => {
    state.visibleCount += PAGE_SIZE;
    renderEntries();
  });

  els.libraryReloadBtn.addEventListener('click', () => fetchDetailedLists({ force: true }));
  els.libraryRetryBtn.addEventListener('click', () => fetchDetailedLists({ force: true }));

  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-nav-screen="library"]')) return;
    setTimeout(() => ensureLoadedForCurrentScreen(), 0);
  }, true);

  refreshButton?.addEventListener('click', () => {
    state.loaded = false;
    setTimeout(() => ensureLoadedForCurrentScreen({ force: true }), 250);
  });

  window.addEventListener('popstate', () => setTimeout(() => ensureLoadedForCurrentScreen(), 0));
  window.addEventListener('tomo:anilist-disconnected', () => {
    state.loadToken += 1;
    clearRenderedLibrary();
    host.hidden = true;
  });
  window.addEventListener('tomo:anilist-auth-expired', () => {
    state.loadToken += 1;
    clearRenderedLibrary();
    host.hidden = true;
  });

  const connectedObserver = connectedPanel ? new MutationObserver(() => {
    setHostVisibility();
    if (!connectedPanel.hidden) setTimeout(() => ensureLoadedForCurrentScreen(), 0);
  }) : null;
  connectedObserver?.observe(connectedPanel, { attributes: true, attributeFilter: ['hidden'] });

  setTimeout(() => ensureLoadedForCurrentScreen(), 350);

  window.TomoLibrary = Object.freeze({
    refresh: () => fetchDetailedLists({ force: true }),
    getEntries: () => [...state.entries],
    getVisibleCount: () => Math.min(state.visibleCount, state.filtered.length)
  });
})();
