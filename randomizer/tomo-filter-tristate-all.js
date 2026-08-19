(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const groups = {
    season: { host: 'arfSeasons', optionKey: 'season', multiple: false },
    format: { host: 'arfFormats', optionKey: 'formats', multiple: true },
    release: { host: 'arfRelease', optionKey: 'release', multiple: true },
    country: { host: 'arfCountries', optionKey: 'countries', multiple: true },
    source: { host: 'arfSources', optionKey: 'sources', multiple: true }
  };

  const state = Object.fromEntries(Object.keys(groups).map(key => [key, { include: new Set(), exclude: new Set() }]));

  function chipValue(chip) {
    return chip?.dataset?.value || '';
  }

  function stateFor(group, value) {
    if (state[group].include.has(value)) return 'include';
    if (state[group].exclude.has(value)) return 'exclude';
    return 'none';
  }

  function cycle(group, value) {
    const bucket = state[group];
    if (bucket.include.has(value)) {
      bucket.include.delete(value);
      bucket.exclude.add(value);
    } else if (bucket.exclude.has(value)) {
      bucket.exclude.delete(value);
    } else {
      if (!groups[group].multiple) bucket.include.clear();
      bucket.include.add(value);
    }
    renderGroup(group);
  }

  function renderGroup(group) {
    const host = $(groups[group].host);
    if (!host) return;
    host.querySelectorAll(`[data-group="${group}"]`).forEach(chip => {
      const value = chipValue(chip);
      const mode = stateFor(group, value);
      chip.dataset.state = mode;
      chip.setAttribute('aria-pressed', mode === 'include' ? 'true' : 'false');
      chip.setAttribute('aria-label', `${chip.textContent.trim()}: ${mode === 'include' ? 'included' : mode === 'exclude' ? 'excluded' : 'not selected'}`);
    });
  }

  function renderAll() {
    Object.keys(groups).forEach(renderGroup);
  }

  function seedFromDom(group) {
    const host = $(groups[group].host);
    if (!host) return;
    host.querySelectorAll(`[data-group="${group}"][aria-pressed="true"]`).forEach(chip => {
      const value = chipValue(chip);
      if (value) state[group].include.add(value);
    });
  }

  function bindGroup(group) {
    const host = $(groups[group].host);
    if (!host || host.dataset.tomoTriStateAll === 'true') return;
    host.dataset.tomoTriStateAll = 'true';
    seedFromDom(group);
    host.addEventListener('click', event => {
      const chip = event.target.closest(`[data-group="${group}"]`);
      if (!chip) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cycle(group, chipValue(chip));
    }, true);
    new MutationObserver(() => requestAnimationFrame(() => renderGroup(group))).observe(host, { childList: true });
    renderGroup(group);
  }

  function installHints() {
    const ids = ['arfSeasons','arfFormats','arfRelease','arfCountries','arfSources'];
    for (const id of ids) {
      const host = $(id);
      if (!host || host.nextElementSibling?.dataset?.tomoTriStateHint === 'true') continue;
      const p = document.createElement('p');
      p.className = 'arf-hint';
      p.dataset.tomoTriStateHint = 'true';
      p.textContent = 'Tap once to include, twice to exclude, a third time to clear.';
      host.after(p);
    }
  }

  function clearAll() {
    Object.values(state).forEach(bucket => {
      bucket.include.clear();
      bucket.exclude.clear();
    });
    renderAll();
  }

  function wrapOptions() {
    const api = window.TomoAdvancedRandomizer;
    if (!api?.getOptions || api.getOptions.__tomoAllTriState) return;
    const original = api.getOptions.bind(api);
    const wrapped = () => {
      const base = original() || {};
      const seasonInclude = [...state.season.include];
      return {
        ...base,
        season: seasonInclude[0] || null,
        formats: [...state.format.include].sort(),
        release: [...state.release.include].sort(),
        countries: [...state.country.include].sort(),
        sources: [...state.source.include].sort(),
        excludeSeasons: [...state.season.exclude].sort(),
        excludeFormats: [...state.format.exclude].sort(),
        excludeRelease: [...state.release.exclude].sort(),
        excludeCountries: [...state.country.exclude].sort(),
        excludeSources: [...state.source.exclude].sort()
      };
    };
    wrapped.__tomoAllTriState = true;
    window.TomoAdvancedRandomizer = Object.freeze({ ...api, getOptions: wrapped });
  }

  function filterMedia(media, options) {
    if (!media) return false;
    if ((options.excludeSeasons || []).includes(media.season)) return false;
    if ((options.excludeFormats || []).includes(media.format)) return false;
    if ((options.excludeRelease || []).includes(media.status)) return false;
    if ((options.excludeCountries || []).includes(media.countryOfOrigin)) return false;
    if ((options.excludeSources || []).includes(media.source)) return false;
    return true;
  }

  function activeOptions() {
    return window.TomoAdvancedRandomizer?.getOptions?.() || {};
  }

  function wrapAniListRequest() {
    const api = window.TomoAniList;
    if (!api?.request || api.request.__tomoAllTriState) return;
    const original = api.request.bind(api);
    const wrapped = async (query, variables, config) => {
      const data = await original(query, variables, config);
      if (!/TomoAdvancedRollFast|MediaListCollection/.test(String(query || ''))) return data;
      const options = activeOptions();
      const hasExclusions = ['excludeSeasons','excludeFormats','excludeRelease','excludeCountries','excludeSources']
        .some(key => Array.isArray(options[key]) && options[key].length);
      if (!hasExclusions) return data;

      if (data?.Page?.media) data.Page.media = data.Page.media.filter(media => filterMedia(media, options));
      for (const list of data?.MediaListCollection?.lists || []) {
        if (Array.isArray(list?.entries)) list.entries = list.entries.filter(entry => filterMedia(entry?.media, options));
      }
      return data;
    };
    wrapped.__tomoAllTriState = true;
    window.TomoAniList = Object.freeze({ ...api, request: wrapped });
  }

  async function install() {
    for (let i = 0; i < 120; i += 1) {
      if (window.TomoAdvancedRandomizer?.getOptions && window.TomoAniList?.request && $('arfFormats')) break;
      await sleep(80);
    }
    Object.keys(groups).forEach(bindGroup);
    installHints();
    wrapOptions();
    wrapAniListRequest();
    $('arfReset')?.addEventListener('click', () => setTimeout(clearAll, 0), true);

    const style = document.createElement('style');
    style.dataset.tomoTriStateAllStyle = 'true';
    style.textContent = '.arf-chip[data-state="exclude"]{color:#8a294f!important;background:#ffe5ee!important;border-color:#dc789c!important;text-decoration:line-through}.arf-chip[data-state="include"]{color:#fff!important;background:var(--pink-deep)!important;border-color:var(--pink-deep)!important}';
    document.head.appendChild(style);
  }

  install();
})();
