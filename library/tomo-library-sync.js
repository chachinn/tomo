(() => {
  'use strict';

  const STATUS_LABELS = {
    CURRENT: 'Watching',
    PLANNING: 'Planning',
    COMPLETED: 'Completed',
    PAUSED: 'Paused',
    DROPPED: 'Dropped',
    REPEATING: 'Rewatching'
  };

  const STATUS_OPTIONS = ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'];
  const state = {
    open: false,
    busy: false,
    entry: null,
    original: null,
    previousFocus: null,
    requestedMediaId: 0
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'library-sync-backdrop';
  backdrop.hidden = true;

  const sheet = document.createElement('section');
  sheet.className = 'library-sync-sheet';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'librarySyncTitle');
  sheet.innerHTML = `
    <div class="library-sync-handle" aria-hidden="true"></div>
    <div class="library-sync-header">
      <div>
        <span class="eyebrow">SINGLE-TITLE ANILIST SYNC</span>
        <h2 id="librarySyncTitle">Update this anime</h2>
      </div>
      <button id="librarySyncClose" class="icon-btn" type="button" aria-label="Close anime details">×</button>
    </div>

    <div id="librarySyncLoading" class="library-sync-state">
      <span class="library-sync-spinner" aria-hidden="true"></span>
      <div><strong>Loading this AniList entry…</strong><small>Tomo will not change anything until you explicitly confirm.</small></div>
    </div>

    <div id="librarySyncContent" hidden>
      <div class="library-sync-anime">
        <div class="library-sync-poster"><img id="librarySyncCover" alt="" /></div>
        <div class="library-sync-copy">
          <h3 id="librarySyncAnimeTitle">Anime</h3>
          <p id="librarySyncMeta">AniList entry</p>
          <a id="librarySyncAniListLink" class="library-sync-link" target="_blank" rel="noopener noreferrer">View on AniList ↗</a>
        </div>
      </div>

      <div class="library-sync-current" aria-label="Current AniList values">
        <div><span>Current status</span><strong id="librarySyncCurrentStatus">—</strong></div>
        <div><span>Progress</span><strong id="librarySyncCurrentProgress">—</strong></div>
        <div><span>My score</span><strong id="librarySyncCurrentScore">—</strong></div>
      </div>

      <div class="library-sync-form">
        <label>
          <span>Status</span>
          <select id="librarySyncStatus"></select>
        </label>
        <label>
          <span>Episode progress</span>
          <input id="librarySyncProgress" type="number" inputmode="numeric" min="0" step="1" />
          <small id="librarySyncProgressHint">Enter the number of episodes watched.</small>
        </label>
      </div>

      <p class="library-sync-note">Score editing is intentionally read-only in this test build until Tomo verifies your AniList scoring format.</p>
      <p id="librarySyncValidation" class="library-sync-message error" hidden></p>
      <p id="librarySyncSuccess" class="library-sync-message success" hidden></p>

      <button id="librarySyncReview" class="primary-btn library-sync-primary" type="button">Review change</button>

      <div id="librarySyncConfirm" class="library-sync-confirm" hidden>
        <div class="library-sync-review-grid">
          <div><span>Before</span><strong id="librarySyncBefore">—</strong></div>
          <div><span>After</span><strong id="librarySyncAfter">—</strong></div>
        </div>
        <label class="library-sync-consent">
          <input id="librarySyncConsent" type="checkbox" />
          <span>I understand this will update this one title on my AniList account.</span>
        </label>
        <div class="library-sync-confirm-actions">
          <button id="librarySyncCancelReview" class="secondary-btn" type="button">Go back</button>
          <button id="librarySyncCommit" class="primary-btn" type="button" disabled>Update AniList</button>
        </div>
      </div>
    </div>

    <div id="librarySyncError" class="library-sync-state error" hidden>
      <strong>Couldn’t open this AniList entry.</strong>
      <small id="librarySyncErrorText"></small>
      <button id="librarySyncRetry" class="secondary-btn" type="button">Try again</button>
    </div>
  `;

  document.body.append(backdrop, sheet);

  const els = Object.fromEntries([
    'librarySyncClose','librarySyncLoading','librarySyncContent','librarySyncCover','librarySyncAnimeTitle','librarySyncMeta',
    'librarySyncAniListLink','librarySyncCurrentStatus','librarySyncCurrentProgress','librarySyncCurrentScore','librarySyncStatus',
    'librarySyncProgress','librarySyncProgressHint','librarySyncValidation','librarySyncSuccess','librarySyncReview','librarySyncConfirm',
    'librarySyncBefore','librarySyncAfter','librarySyncConsent','librarySyncCancelReview','librarySyncCommit','librarySyncError',
    'librarySyncErrorText','librarySyncRetry'
  ].map(id => [id, document.getElementById(id)]));

  for (const status of STATUS_OPTIONS) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = STATUS_LABELS[status];
    els.librarySyncStatus.appendChild(option);
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function titleOf(entry) {
    const title = entry?.media?.title || {};
    return title.userPreferred || title.english || title.romaji || title.native || 'Untitled';
  }

  function mediaIdFromCard(card) {
    const href = card?.getAttribute('href') || '';
    const match = href.match(/\/anime\/(\d+)/i);
    if (match) return Number(match[1]);
    return 0;
  }

  function findLocalEntry(mediaId) {
    return window.TomoLibrary?.getEntries?.().find(entry => Number(entry?.mediaId || entry?.media?.id || 0) === Number(mediaId)) || null;
  }

  function progressText(entry) {
    const progress = Number(entry?.progress || 0);
    const episodes = Number(entry?.media?.episodes || 0);
    return episodes > 0 ? `${progress}/${episodes}` : `${progress} eps`;
  }

  function scoreText(entry) {
    const score = Number(entry?.score || 0);
    return score > 0 ? String(score) : 'Not scored';
  }

  function summaryText(status, progress, episodes) {
    const statusLabel = STATUS_LABELS[status] || status || 'Unknown';
    if (episodes > 0) return `${statusLabel} · ${progress}/${episodes}`;
    return `${statusLabel} · ${progress} eps`;
  }

  function setBusy(busy) {
    state.busy = busy;
    els.librarySyncStatus.disabled = busy;
    els.librarySyncProgress.disabled = busy;
    els.librarySyncReview.disabled = busy;
    els.librarySyncCommit.disabled = busy || !els.librarySyncConsent.checked;
    els.librarySyncCancelReview.disabled = busy;
    els.librarySyncClose.disabled = busy;
  }

  function resetMessages() {
    els.librarySyncValidation.hidden = true;
    els.librarySyncValidation.textContent = '';
    els.librarySyncSuccess.hidden = true;
    els.librarySyncSuccess.textContent = '';
  }

  function resetReview() {
    els.librarySyncConfirm.hidden = true;
    els.librarySyncConsent.checked = false;
    els.librarySyncCommit.disabled = true;
    els.librarySyncReview.hidden = false;
  }

  function currentDraft() {
    const episodes = Number(state.entry?.media?.episodes || 0);
    const progress = Number(els.librarySyncProgress.value);
    return {
      status: els.librarySyncStatus.value,
      progress,
      episodes
    };
  }

  function validateDraft(draft) {
    if (!STATUS_OPTIONS.includes(draft.status)) return 'Choose a valid AniList status.';
    if (!Number.isInteger(draft.progress) || draft.progress < 0) return 'Episode progress must be a whole number of 0 or higher.';
    if (draft.episodes > 0 && draft.progress > draft.episodes) return `Progress cannot be higher than ${draft.episodes} episodes for this anime.`;
    const original = state.original;
    if (original && draft.status === original.status && draft.progress === original.progress) return 'Nothing has changed yet.';
    return '';
  }

  async function fetchEntry(mediaId) {
    const local = findLocalEntry(mediaId);
    if (local?.id && local?.media) return local;

    const viewer = window.TomoAniList?.getViewer?.();
    if (!viewer?.id) throw new Error('Your AniList account is not connected.');
    const data = await window.TomoAniList.request(`
      query ($userId: Int!, $mediaId: Int!) {
        MediaList(userId: $userId, mediaId: $mediaId, type: ANIME) {
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
    `, { userId: Number(viewer.id), mediaId: Number(mediaId) }, { authenticated: true });
    if (!data?.MediaList?.id) throw new Error('AniList did not return this list entry.');
    return data.MediaList;
  }

  async function verifyEntry(entryId) {
    const data = await window.TomoAniList.request(`
      query ($id: Int!) {
        MediaList(id: $id) {
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
    `, { id: Number(entryId) }, { authenticated: true });
    if (!data?.MediaList?.id) throw new Error('AniList did not confirm the updated entry.');
    return data.MediaList;
  }

  function renderEntry(entry) {
    state.entry = entry;
    state.original = {
      status: entry.status,
      progress: Number(entry.progress || 0)
    };
    const media = entry.media || {};
    const coverUrl = safeHttpsUrl(media?.coverImage?.large || media?.coverImage?.medium || '');
    if (coverUrl) {
      els.librarySyncCover.src = coverUrl;
      els.librarySyncCover.hidden = false;
    } else {
      els.librarySyncCover.removeAttribute('src');
      els.librarySyncCover.hidden = true;
    }
    els.librarySyncAnimeTitle.textContent = titleOf(entry);
    els.librarySyncMeta.textContent = [media.format, media.seasonYear].filter(Boolean).join(' · ') || 'Anime';
    els.librarySyncAniListLink.href = safeHttpsUrl(media.siteUrl) || `https://anilist.co/anime/${Number(media.id || entry.mediaId)}`;
    els.librarySyncCurrentStatus.textContent = STATUS_LABELS[entry.status] || entry.status || 'Unknown';
    els.librarySyncCurrentProgress.textContent = progressText(entry);
    els.librarySyncCurrentScore.textContent = scoreText(entry);
    els.librarySyncStatus.value = STATUS_OPTIONS.includes(entry.status) ? entry.status : 'PLANNING';
    els.librarySyncProgress.value = String(Number(entry.progress || 0));
    const episodes = Number(media.episodes || 0);
    if (episodes > 0) {
      els.librarySyncProgress.max = String(episodes);
      els.librarySyncProgressHint.textContent = `This anime has ${episodes} episodes.`;
    } else {
      els.librarySyncProgress.removeAttribute('max');
      els.librarySyncProgressHint.textContent = 'AniList does not currently provide a fixed episode total for this title.';
    }
    resetMessages();
    resetReview();
  }

  async function loadForMedia(mediaId) {
    els.librarySyncLoading.hidden = false;
    els.librarySyncContent.hidden = true;
    els.librarySyncError.hidden = true;
    setBusy(true);
    try {
      const entry = await fetchEntry(mediaId);
      renderEntry(entry);
      els.librarySyncContent.hidden = false;
    } catch (error) {
      els.librarySyncError.hidden = false;
      els.librarySyncErrorText.textContent = error?.message || 'This AniList entry could not be loaded.';
    } finally {
      els.librarySyncLoading.hidden = true;
      setBusy(false);
    }
  }

  function openSheet(mediaId, sourceElement) {
    if (!mediaId || !window.TomoAniList?.isConnected?.()) return;
    state.previousFocus = sourceElement instanceof HTMLElement ? sourceElement : document.activeElement;
    state.requestedMediaId = Number(mediaId);
    state.open = true;
    state.entry = null;
    state.original = null;
    backdrop.hidden = false;
    sheet.hidden = false;
    document.body.classList.add('library-sync-open');
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      sheet.classList.add('open');
      els.librarySyncClose.focus({ preventScroll: true });
    });
    loadForMedia(mediaId);
  }

  function closeSheet() {
    if (!state.open || state.busy) return;
    state.open = false;
    backdrop.classList.remove('visible');
    sheet.classList.remove('open');
    document.body.classList.remove('library-sync-open');
    setTimeout(() => {
      backdrop.hidden = true;
      sheet.hidden = true;
    }, 220);
    state.previousFocus?.focus?.({ preventScroll: true });
  }

  function reviewDraft() {
    resetMessages();
    const draft = currentDraft();
    const error = validateDraft(draft);
    if (error) {
      els.librarySyncValidation.textContent = error;
      els.librarySyncValidation.hidden = false;
      return;
    }
    els.librarySyncBefore.textContent = summaryText(state.original.status, state.original.progress, draft.episodes);
    els.librarySyncAfter.textContent = summaryText(draft.status, draft.progress, draft.episodes);
    els.librarySyncReview.hidden = true;
    els.librarySyncConfirm.hidden = false;
    els.librarySyncConsent.checked = false;
    els.librarySyncCommit.disabled = true;
    els.librarySyncConfirm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function commitDraft() {
    if (!state.entry?.id || !els.librarySyncConsent.checked || state.busy) return;
    const draft = currentDraft();
    const error = validateDraft(draft);
    if (error) {
      els.librarySyncValidation.textContent = error;
      els.librarySyncValidation.hidden = false;
      resetReview();
      return;
    }

    setBusy(true);
    resetMessages();
    els.librarySyncCommit.textContent = 'Updating AniList…';
    try {
      const mutation = await window.TomoAniList.request(`
        mutation ($id: Int!, $status: MediaListStatus!, $progress: Int!) {
          SaveMediaListEntry(id: $id, status: $status, progress: $progress) {
            id
            mediaId
            status
            progress
            score
            repeat
            updatedAt
          }
        }
      `, {
        id: Number(state.entry.id),
        status: draft.status,
        progress: Number(draft.progress)
      }, { authenticated: true });

      const saved = mutation?.SaveMediaListEntry;
      if (!saved?.id) throw new Error('AniList did not return the saved list entry.');

      const verified = await verifyEntry(saved.id);
      if (verified.status !== draft.status || Number(verified.progress || 0) !== Number(draft.progress)) {
        throw new Error('AniList returned values that do not match the requested update. Tomo did not mark this as synced.');
      }

      renderEntry(verified);
      els.librarySyncSuccess.textContent = `✓ Synced with AniList: ${summaryText(verified.status, Number(verified.progress || 0), Number(verified.media?.episodes || 0))}.`;
      els.librarySyncSuccess.hidden = false;
      els.librarySyncReview.textContent = 'Make another change';
      document.getElementById('anilistRefreshBtn')?.click();
      window.dispatchEvent(new CustomEvent('tomo:anilist-entry-synced', { detail: { mediaId: verified.mediaId, entry: verified } }));
    } catch (error) {
      els.librarySyncValidation.textContent = error?.message || 'AniList could not save this change.';
      els.librarySyncValidation.hidden = false;
    } finally {
      els.librarySyncCommit.textContent = 'Update AniList';
      setBusy(false);
    }
  }

  document.addEventListener('click', event => {
    const card = event.target.closest?.('.library-card');
    if (!card) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const mediaId = mediaIdFromCard(card);
    if (!mediaId) return;
    event.preventDefault();
    openSheet(mediaId, card);
  });

  els.librarySyncClose.addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  els.librarySyncReview.addEventListener('click', reviewDraft);
  els.librarySyncCancelReview.addEventListener('click', resetReview);
  els.librarySyncConsent.addEventListener('change', () => {
    els.librarySyncCommit.disabled = state.busy || !els.librarySyncConsent.checked;
  });
  els.librarySyncCommit.addEventListener('click', commitDraft);
  els.librarySyncRetry.addEventListener('click', () => {
    if (state.requestedMediaId) loadForMedia(state.requestedMediaId);
  });

  for (const input of [els.librarySyncStatus, els.librarySyncProgress]) {
    input.addEventListener('input', () => {
      resetMessages();
      resetReview();
      els.librarySyncReview.textContent = 'Review change';
    });
  }

  document.addEventListener('keydown', event => {
    if (!state.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hidden && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('tomo:anilist-disconnected', () => {
    if (state.open) {
      state.busy = false;
      closeSheet();
    }
  });
  window.addEventListener('tomo:anilist-auth-expired', () => {
    if (state.open) {
      state.busy = false;
      closeSheet();
    }
  });

  window.TomoLibrarySync = Object.freeze({
    openMedia: mediaId => openSheet(Number(mediaId), null),
    isOpen: () => state.open
  });
})();
