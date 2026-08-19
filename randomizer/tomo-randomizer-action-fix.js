(() => {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);
  let lastSuccessfulOptions = null;
  let cache = { key: '', queue: [], seen: new Set(), context: null };
  let backgroundTimer = null;

  const MEDIA_FIELDS = `
    id
    title { romaji english native }
    description(asHtml:true)
    coverImage { extraLarge large }
    format episodes duration averageScore popularity season seasonYear status
    countryOfOrigin source(version:3) isLicensed
    startDate { year month day }
    siteUrl genres
    tags { name rank isAdult }
  `;

  async function waitForRandomizer() {
    for (let i = 0; i < 100; i += 1) {
      if (window.TomoAdvancedRandomizer?.getOptions && $('smartRollBtn') && window.TomoAniList?.request) return true;
      await sleep(80);
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
    box.style.background = isError ? 'rgba(255,230,238,.9)' : '';
    box.style.color = isError ? '#8a294f' : '';
  }

  function titleOf(media) {
    return media?.title?.english || media?.title?.romaji || media?.title?.native || 'Untitled';
  }

  function stableOptions(options = {}) {
    const clone = JSON.parse(JSON.stringify(options));
    for (const key of ['genres','formats','release','countries','sources','include','exclude','excludeGenres','listStatuses']) {
      if (Array.isArray(clone[key])) clone[key] = [...clone[key]].sort();
    }
    return JSON.stringify(clone);
  }

  function shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function resetCache(key, items = [], context = null) {
    cache = { key, queue: shuffle(items.filter(Boolean)), seen: new Set(), context };
  }

  function addToCache(items = []) {
    const fresh = [];
    for (const media of items) {
      const id = Number(media?.id || 0);
      if (!id || cache.seen.has(id) || cache.queue.some(x => Number(x?.id) === id)) continue;
      fresh.push(media);
    }
    cache.queue.push(...shuffle(fresh));
  }

  function takeCached(key) {
    if (cache.key !== key) return null;
    while (cache.queue.length) {
      const media = cache.queue.shift();
      const id = Number(media?.id || 0);
      if (!id || cache.seen.has(id)) continue;
      cache.seen.add(id);
      return media;
    }
    return null;
  }

  function setResultSource(source) {
    const result = $('resultSection');
    if (!result) return;
    if (source) result.dataset.tomoRollSource = source;
    else delete result.dataset.tomoRollSource;
  }

  function showResult(media) {
    const result = $('resultSection');
    if (!result || !media) return;
    const cover = $('resultCover');
    const coverUrl = media?.coverImage?.extraLarge || media?.coverImage?.large || '';
    if (cover) {
      if (coverUrl) cover.src = coverUrl;
      cover.alt = `${titleOf(media)} cover`;
    }
    if ($('resultTitle')) $('resultTitle').textContent = titleOf(media);
    if ($('resultDescription')) {
      const doc = new DOMParser().parseFromString(String(media?.description || ''), 'text/html');
      $('resultDescription').textContent = doc.body?.textContent?.trim() || 'No synopsis available yet.';
    }
    if ($('resultMeta')) $('resultMeta').textContent = [media.format, media.episodes && `${media.episodes} eps`, media.duration && `${media.duration} min`, media.averageScore && `${media.averageScore}%`, media.seasonYear].filter(Boolean).join(' · ');
    if ($('resultTags')) $('resultTags').replaceChildren(...(media.genres || []).slice(0, 6).map(name => {
      const span = document.createElement('span');
      span.textContent = name;
      return span;
    }));
    if ($('anilistLink')) $('anilistLink').href = media.siteUrl || `https://anilist.co/anime/${media.id}`;
    delete result.dataset.tomoMode;
    Object.assign(result.dataset, {
      tomoRollSource: 'filtered',
      mediaId: String(media?.id || ''),
      mediaTitle: titleOf(media),
      mediaCover: media?.coverImage?.large || ''
    });
    result.hidden = false;
    window.dispatchEvent(new CustomEvent('tomo:roll-result', { detail: { source: 'filtered', media } }));
  }

  function tagMatches(media, name, rank) {
    return (media?.tags || []).some(tag => !tag?.isAdult && tag?.name === name && Number(tag?.rank || 0) >= rank);
  }

  function localMatches(media, options) {
    if (!media) return false;
    const genres = new Set(media.genres || []);
    const formats = options.formats || [];
    const releases = options.release || [];
    const countries = options.countries || [];
    const sources = options.sources || [];
    const includeGenres = options.genres || [];
    const excludeGenres = options.excludeGenres || [];
    const includeTags = options.include || [];
    const excludeTags = options.exclude || [];
    const rank = Number(options.rank || 18);
    const year = Number(media?.startDate?.year || media?.seasonYear || 0);

    if (formats.length && !formats.includes(media.format)) return false;
    if (releases.length && !releases.includes(media.status)) return false;
    if (countries.length && !countries.includes(media.countryOfOrigin)) return false;
    if (sources.length && !sources.includes(media.source)) return false;
    if (includeGenres.length && !includeGenres.every(g => genres.has(g))) return false;
    if (excludeGenres.some(g => genres.has(g))) return false;
    if (options.season && media.season !== options.season) return false;
    if (options.year && Number(media.seasonYear || year) !== Number(options.year)) return false;
    if (options.fromYear && (!year || year < Number(options.fromYear))) return false;
    if (options.toYear && (!year || year > Number(options.toYear))) return false;
    if (options.minEp && (!media.episodes || Number(media.episodes) < Number(options.minEp))) return false;
    if (options.maxEp && (!media.episodes || Number(media.episodes) > Number(options.maxEp))) return false;
    if (options.minDur && (!media.duration || Number(media.duration) < Number(options.minDur))) return false;
    if (options.maxDur && (!media.duration || Number(media.duration) > Number(options.maxDur))) return false;
    if (options.score && (!media.averageScore || Number(media.averageScore) < Number(options.score))) return false;
    if (options.maxScore && (!media.averageScore || Number(media.averageScore) > Number(options.maxScore))) return false;
    if (options.popularity && Number(media.popularity || 0) < Number(options.popularity)) return false;
    if (options.maxPopularity && Number(media.popularity || 0) > Number(options.maxPopularity)) return false;
    if (options.licensedOnly && media.isLicensed !== true) return false;
    if (includeTags.length && !includeTags.every(tag => tagMatches(media, tag, rank))) return false;
    if (excludeTags.some(tag => tagMatches(media, tag, rank))) return false;
    return true;
  }

  async function fetchListPool(options) {
    if (!window.TomoAniList?.isConnected?.()) throw new Error('Connect your AniList account first, or switch Source to Anywhere.');
    const viewer = window.TomoAniList.getViewer?.();
    if (!viewer?.id) throw new Error('AniList account details are still loading. Try again in a moment.');
    const statuses = [...new Set((options.listStatuses || []).filter(Boolean))];
    if (!statuses.length) throw new Error('Choose at least one AniList status.');

    const data = await window.TomoAniList.request(`
      query ($userId: Int!, $statuses: [MediaListStatus]) {
        MediaListCollection(userId: $userId, type: ANIME, status_in: $statuses) {
          lists {
            entries {
              mediaId status
              media { ${MEDIA_FIELDS} }
            }
          }
        }
      }
    `, { userId: Number(viewer.id), statuses }, { authenticated: true });

    const wanted = new Set(statuses);
    const byId = new Map();
    for (const entry of (data?.MediaListCollection?.lists || []).flatMap(list => list?.entries || [])) {
      if (!wanted.has(entry?.status) || !entry?.media) continue;
      const id = Number(entry.media.id || entry.mediaId || 0);
      if (id && localMatches(entry.media, options)) byId.set(id, entry.media);
    }
    return [...byId.values()];
  }

  function addArg(ctx, name, type, value, arg) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
    ctx.vars[name] = value;
    ctx.defs.push(`$${name}:${type}`);
    ctx.args.push(`${arg}:$${name}`);
  }

  function publicContext(options) {
    const ctx = { vars: { page: 1 }, defs: ['$page:Int'], args: ['type:ANIME', 'isAdult:false'], auth: options.scope === 'not-list' };
    if (options.scope === 'not-list') {
      if (!window.TomoAniList?.isConnected?.()) throw new Error('Connect AniList first so Tomo knows what is not on your list.');
      addArg(ctx, 'onList', 'Boolean', false, 'onList');
    }
    addArg(ctx, 'formats', '[MediaFormat]', options.formats, 'format_in');
    addArg(ctx, 'release', '[MediaStatus]', options.release, 'status_in');
    if (options.countries?.length) {
      const country = options.countries[Math.floor(Math.random() * options.countries.length)];
      addArg(ctx, 'country', 'CountryCode', country, 'countryOfOrigin');
    }
    addArg(ctx, 'sources', '[MediaSource]', options.sources, 'source_in');
    addArg(ctx, 'genres', '[String]', options.genres, 'genre_in');
    addArg(ctx, 'excludeGenres', '[String]', options.excludeGenres, 'genre_not_in');
    addArg(ctx, 'tags', '[String]', options.include, 'tag_in');
    addArg(ctx, 'excludeTags', '[String]', options.exclude, 'tag_not_in');
    if (options.include?.length || options.exclude?.length) addArg(ctx, 'rank', 'Int', Number(options.rank || 18), 'minimumTagRank');
    if (options.season) {
      addArg(ctx, 'season', 'MediaSeason', options.season, 'season');
      if (options.year) addArg(ctx, 'seasonYear', 'Int', Number(options.year), 'seasonYear');
    } else if (options.year) {
      addArg(ctx, 'year', 'String', `${options.year}%`, 'startDate_like');
    }
    if (options.fromYear) addArg(ctx, 'fromYear', 'FuzzyDateInt', Number(`${options.fromYear}0000`), 'startDate_greater');
    if (options.toYear) addArg(ctx, 'toYear', 'FuzzyDateInt', Number(`${options.toYear}1231`), 'startDate_lesser');
    if (options.minEp) addArg(ctx, 'minEp', 'Int', Math.max(0, Number(options.minEp) - 1), 'episodes_greater');
    if (options.maxEp) addArg(ctx, 'maxEp', 'Int', Number(options.maxEp) + 1, 'episodes_lesser');
    if (options.minDur) addArg(ctx, 'minDur', 'Int', Math.max(0, Number(options.minDur) - 1), 'duration_greater');
    if (options.maxDur) addArg(ctx, 'maxDur', 'Int', Number(options.maxDur) + 1, 'duration_lesser');
    if (options.score) addArg(ctx, 'score', 'Int', Math.max(0, Number(options.score) - 1), 'averageScore_greater');
    if (options.maxScore) addArg(ctx, 'maxScore', 'Int', Number(options.maxScore) + 1, 'averageScore_lesser');
    if (options.popularity) addArg(ctx, 'pop', 'Int', Math.max(0, Number(options.popularity) - 1), 'popularity_greater');
    if (options.maxPopularity) addArg(ctx, 'maxPop', 'Int', Number(options.maxPopularity) + 1, 'popularity_lesser');
    if (options.licensedOnly) addArg(ctx, 'licensed', 'Boolean', true, 'isLicensed');
    ctx.args.push('sort:[POPULARITY_DESC,SCORE_DESC]');
    return ctx;
  }

  function pageQuery(ctx) {
    return `query TomoAdvancedRollFast(${ctx.defs.join(',')}) {
      Page(page:$page, perPage:50) {
        pageInfo { total lastPage }
        media(${ctx.args.join(',')}) { ${MEDIA_FIELDS} }
      }
    }`;
  }

  async function fetchPage(ctx, page) {
    return window.TomoAniList.request(pageQuery(ctx), { ...ctx.vars, page }, { authenticated: ctx.auth });
  }

  function scheduleBackgroundPrefetch(ctx, lastPage) {
    clearTimeout(backgroundTimer);
    const last = Math.min(200, Math.max(1, Number(lastPage || 1)));
    if (last <= 1) return;
    backgroundTimer = setTimeout(async () => {
      try {
        const page = Math.floor(Math.random() * last) + 1;
        if (page === 1) return;
        const data = await fetchPage(ctx, page);
        addToCache(data?.Page?.media || []);
      } catch {
        // Prefetch is opportunistic. The visible roll remains usable if it fails.
      }
    }, 2300);
  }

  function revealAndClose() {
    window.TomoAdvancedRandomizer?.close?.();
    setTimeout(() => $('resultSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 260);
  }

  async function run(optionsOverride = null, { allowCache = true } = {}) {
    const button = $('smartRollBtn');
    if (!button) return;
    const options = optionsOverride || window.TomoAdvancedRandomizer.getOptions();
    const key = stableOptions(options);

    if (allowCache) {
      const cached = takeCached(key);
      if (cached) {
        lastSuccessfulOptions = JSON.parse(JSON.stringify(options));
        setStatus('');
        showResult(cached);
        revealAndClose();
        return;
      }
    }

    if (button.dataset.tomoActionBusy === 'true') return;
    button.dataset.tomoActionBusy = 'true';
    button.disabled = true;
    button.textContent = 'Finding your anime…';
    setStatus('Searching AniList…');

    try {
      let pool = [];
      let ctx = null;
      let lastPage = 1;

      if (options.scope === 'list') {
        pool = await fetchListPool(options);
      } else {
        ctx = publicContext(options);
        const first = await fetchPage(ctx, 1);
        pool = (first?.Page?.media || []).filter(Boolean);
        lastPage = first?.Page?.pageInfo?.lastPage || 1;
      }

      if (!pool.length) throw new Error('No anime match these filters. Try loosening one or two choices.');

      resetCache(key, pool, ctx);
      const pick = takeCached(key);
      if (!pick) throw new Error('Tomo could not choose a result from the matching anime. Please try again.');

      lastSuccessfulOptions = JSON.parse(JSON.stringify(options));
      showResult(pick);
      setStatus('');
      revealAndClose();
      if (ctx) scheduleBackgroundPrefetch(ctx, lastPage);
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

    $('quickRollBtn')?.addEventListener('click', () => {
      lastSuccessfulOptions = null;
      setResultSource('quick');
    }, true);

    window.addEventListener('tomo:roll-result', event => {
      if (event?.detail?.source !== 'filtered') lastSuccessfulOptions = null;
    });

    document.addEventListener('click', event => {
      const reroll = event.target.closest?.('#rerollBtn');
      const result = $('resultSection');
      if (!reroll || result?.dataset?.tomoRollSource !== 'filtered' || !lastSuccessfulOptions) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      run(lastSuccessfulOptions, { allowCache: true });
    }, true);
  }

  window.TomoRandomizerActionFix = Object.freeze({
    run: options => run(options || null),
    clearPool: () => { cache = { key: '', queue: [], seen: new Set(), context: null }; }
  });
  install();
})();
