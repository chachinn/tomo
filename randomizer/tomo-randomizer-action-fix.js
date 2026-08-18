(() => {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);

  async function waitForRandomizer() {
    for (let i = 0; i < 80; i += 1) {
      if (window.TomoAdvancedRandomizer && $('smartRollBtn') && window.TomoAniList?.request) return true;
      await sleep(100);
    }
    return false;
  }

  function ensureStatus() {
    let box = $('arfActionStatus');
    if (box) return box;
    const summary = $('arfSummary');
    const button = $('smartRollBtn');
    box = document.createElement('div');
    box.id = 'arfActionStatus';
    box.className = 'arf-summary';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.hidden = true;
    if (summary) summary.before(box);
    else button?.before(box);
    return box;
  }

  function setStatus(message, isError = false) {
    const box = ensureStatus();
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || '';
    box.dataset.state = isError ? 'error' : 'info';
    if (isError) {
      box.style.background = 'rgba(255,230,238,.9)';
      box.style.color = '#8a294f';
    } else {
      box.style.background = '';
      box.style.color = '';
    }
  }

  function add(ctx, name, type, value, arg) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
    ctx.vars[name] = value;
    ctx.defs.push(`$${name}:${type}`);
    ctx.args.push(`${arg}:$${name}`);
  }

  async function listIds(statuses) {
    if (!window.TomoAniList?.isConnected?.()) throw new Error('Connect your AniList account first, or switch Source to Anywhere.');
    const viewer = window.TomoAniList.getViewer?.();
    if (!viewer?.id) throw new Error('AniList account details are still loading. Try again in a moment.');
    const data = await window.TomoAniList.request(`
      query ($userId: Int!) {
        MediaListCollection(userId: $userId, type: ANIME) {
          lists { entries { mediaId status } }
        }
      }
    `, { userId: Number(viewer.id) }, { authenticated: true });
    const wanted = new Set(statuses || []);
    return [...new Set((data?.MediaListCollection?.lists || [])
      .flatMap(list => list?.entries || [])
      .filter(entry => wanted.has(entry?.status))
      .map(entry => Number(entry?.mediaId || 0))
      .filter(Boolean))];
  }

  async function buildContext(options) {
    const ctx = { vars: { page: 1 }, defs: ['$page:Int'], args: ['type:ANIME', 'isAdult:false'], auth: false };
    if (options.scope === 'list') {
      if (!options.listStatuses?.length) throw new Error('Choose at least one AniList status.');
      const ids = await listIds(options.listStatuses);
      if (!ids.length) throw new Error('There are no anime in the selected AniList statuses.');
      add(ctx, 'ids', '[Int]', ids, 'id_in');
      ctx.auth = true;
    } else if (options.scope === 'not-list') {
      if (!window.TomoAniList?.isConnected?.()) throw new Error('Connect AniList first so Tomo knows what is not on your list.');
      add(ctx, 'onList', 'Boolean', false, 'onList');
      ctx.auth = true;
    }
    add(ctx, 'formats', '[MediaFormat]', options.formats, 'format_in');
    add(ctx, 'release', '[MediaStatus]', options.release, 'status_in');
    if (options.countries?.length === 1) add(ctx, 'country', 'CountryCode', options.countries[0], 'countryOfOrigin');
    add(ctx, 'sources', '[MediaSource]', options.sources, 'source_in');
    add(ctx, 'genres', '[String]', options.genres, 'genre_in');
    add(ctx, 'tags', '[String]', options.include, 'tag_in');
    add(ctx, 'excludeTags', '[String]', options.exclude, 'tag_not_in');
    if (options.include?.length || options.exclude?.length) add(ctx, 'rank', 'Int', options.rank, 'minimumTagRank');
    if (options.season) {
      add(ctx, 'season', 'MediaSeason', options.season, 'season');
      if (options.year) add(ctx, 'seasonYear', 'Int', options.year, 'seasonYear');
    } else if (options.year) add(ctx, 'year', 'String', `${options.year}%`, 'startDate_like');
    if (options.minEp) add(ctx, 'minEp', 'Int', Math.max(0, options.minEp - 1), 'episodes_greater');
    if (options.maxEp) add(ctx, 'maxEp', 'Int', options.maxEp + 1, 'episodes_lesser');
    if (options.minDur) add(ctx, 'minDur', 'Int', Math.max(0, options.minDur - 1), 'duration_greater');
    if (options.maxDur) add(ctx, 'maxDur', 'Int', options.maxDur + 1, 'duration_lesser');
    if (options.score) add(ctx, 'score', 'Int', Math.max(0, options.score - 1), 'averageScore_greater');
    if (options.popularity) add(ctx, 'pop', 'Int', Math.max(0, options.popularity - 1), 'popularity_greater');
    ctx.args.push('sort:[POPULARITY_DESC,SCORE_DESC]');
    return ctx;
  }

  function query(ctx) {
    return `query TomoAdvancedRollFix(${ctx.defs.join(',')}) {
      Page(page:$page, perPage:50) {
        pageInfo { total lastPage }
        media(${ctx.args.join(',')}) {
          id title { romaji english native }
          description(asHtml:true)
          coverImage { extraLarge large }
          format episodes duration averageScore popularity seasonYear status siteUrl genres
        }
      }
    }`;
  }

  async function fetchPage(ctx, page) {
    return window.TomoAniList.request(query(ctx), { ...ctx.vars, page }, { authenticated: ctx.auth });
  }

  function titleOf(media) {
    return media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled';
  }

  function showResult(media) {
    const cover = $('resultCover');
    const coverUrl = media?.coverImage?.extraLarge || media?.coverImage?.large || '';
    if (cover && coverUrl) cover.src = coverUrl;
    if (cover) cover.alt = `${titleOf(media)} cover`;
    if ($('resultTitle')) $('resultTitle').textContent = titleOf(media);
    if ($('resultDescription')) {
      const doc = new DOMParser().parseFromString(String(media?.description || ''), 'text/html');
      $('resultDescription').textContent = doc.body?.textContent?.trim() || 'No synopsis available yet.';
    }
    if ($('resultMeta')) $('resultMeta').textContent = [media.format, media.episodes && `${media.episodes} eps`, media.duration && `${media.duration} min`, media.averageScore && `${media.averageScore}%`, media.seasonYear].filter(Boolean).join(' · ');
    if ($('resultTags')) $('resultTags').replaceChildren(...(media.genres || []).slice(0, 6).map(name => { const span = document.createElement('span'); span.textContent = name; return span; }));
    if ($('anilistLink')) $('anilistLink').href = media.siteUrl || `https://anilist.co/anime/${media.id}`;
    if ($('resultSection')) $('resultSection').hidden = false;
  }

  async function run() {
    const button = $('smartRollBtn');
    if (!button || button.dataset.tomoActionBusy === 'true') return;
    button.dataset.tomoActionBusy = 'true';
    button.disabled = true;
    button.textContent = 'Finding your anime…';
    setStatus('Searching AniList…');
    try {
      const options = window.TomoAdvancedRandomizer.getOptions();
      const ctx = await buildContext(options);
      const first = await fetchPage(ctx, 1);
      const info = first?.Page?.pageInfo || {};
      const firstPool = first?.Page?.media || [];
      if (!firstPool.length) throw new Error('No anime match these filters. Try another list status or loosen one or two filters.');

      let pool = firstPool;
      const last = Math.max(1, Number(info.lastPage || 1));
      const pageNumber = Math.floor(Math.random() * last) + 1;
      if (pageNumber !== 1) {
        const randomPage = (await fetchPage(ctx, pageNumber))?.Page?.media || [];
        // AniList can occasionally report a lastPage that produces an empty page,
        // especially with restrictive id_in/list-status filters. Never fail a valid
        // search just because that randomized page is empty; safely fall back to
        // the already verified first page instead.
        if (randomPage.length) pool = randomPage;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      showResult(pick);
      setStatus('');
      window.TomoAdvancedRandomizer.close();
      setTimeout(() => $('resultSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    } catch (error) {
      setStatus(error?.message || 'Tomo could not randomize with those filters.', true);
    } finally {
      button.dataset.tomoActionBusy = 'false';
      button.disabled = false;
      button.textContent = '✨ Randomize with these filters';
    }
  }

  async function install() {
    if (!await waitForRandomizer()) return;
    const oldButton = $('smartRollBtn');
    if (!oldButton || oldButton.dataset.tomoActionFix === 'true') return;
    const button = oldButton.cloneNode(true);
    button.dataset.tomoActionFix = 'true';
    oldButton.replaceWith(button);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      run();
    });
  }

  install();
})();
