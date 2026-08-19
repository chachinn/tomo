(() => {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);

  const state = {
    includeTags: new Set(),
    excludeTags: new Set(),
    includeGenres: new Set(),
    excludeGenres: new Set()
  };

  const RELATIONSHIP = [
    ['Heterosexual', 'Straight / Heterosexual'],
    ['Unrequited Love', 'Unrequited Love'],
    ['Age Gap', 'Age Gap'],
    ['LGBTQ+ Themes', 'LGBTQ+ Themes']
  ];

  const CAST = [
    ['Female Protagonist', 'Female Protagonist'],
    ['Male Protagonist', 'Male Protagonist'],
    ['Ensemble Cast', 'Ensemble Cast'],
    ['Primarily Female Cast', 'Mostly Female Cast'],
    ['Primarily Male Cast', 'Mostly Male Cast'],
    ['Primarily Adult Cast', 'Adult Cast'],
    ['Primarily Teen Cast', 'Teen Cast'],
    ['Primarily Child Cast', 'Child Cast']
  ];

  const THEMES = [
    ['School', 'School'], ['Work', 'Workplace'], ['Isekai', 'Isekai'],
    ['Iyashikei', 'Iyashikei'], ['Coming of Age', 'Coming of Age'],
    ['Family Life', 'Family Life'], ['Found Family', 'Found Family'],
    ['Urban', 'Urban'], ['Rural', 'Rural'], ['Historical', 'Historical'],
    ['Time Skip', 'Time Skip'], ['Revenge', 'Revenge']
  ];

  function tagState(tag) {
    if (state.includeTags.has(tag)) return 'include';
    if (state.excludeTags.has(tag)) return 'exclude';
    return 'none';
  }

  function genreState(genre) {
    if (state.includeGenres.has(genre)) return 'include';
    if (state.excludeGenres.has(genre)) return 'exclude';
    return 'none';
  }

  function cycleTag(tag) {
    if (state.includeTags.has(tag)) {
      state.includeTags.delete(tag);
      state.excludeTags.add(tag);
    } else if (state.excludeTags.has(tag)) {
      state.excludeTags.delete(tag);
    } else {
      state.includeTags.add(tag);
    }
    renderStates();
  }

  function cycleGenre(genre) {
    if (state.includeGenres.has(genre)) {
      state.includeGenres.delete(genre);
      state.excludeGenres.add(genre);
    } else if (state.excludeGenres.has(genre)) {
      state.excludeGenres.delete(genre);
    } else {
      state.includeGenres.add(genre);
    }
    renderStates();
  }

  function makeTagButton(tag, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'arf-chip arf-tag';
    b.dataset.tomoExtraTag = tag;
    b.dataset.state = tagState(tag);
    b.textContent = label;
    return b;
  }

  function renderStates() {
    document.querySelectorAll('[data-tomo-extra-tag]').forEach(b => {
      b.dataset.state = tagState(b.dataset.tomoExtraTag);
    });

    $('arfGenres')?.querySelectorAll('[data-group="genre"]').forEach(b => {
      const genre = b.dataset.value || b.textContent.trim();
      const mode = genreState(genre);
      b.classList.add('arf-tag');
      b.dataset.state = mode;
      b.setAttribute('aria-pressed', mode === 'include' ? 'true' : 'false');
      b.setAttribute('aria-label', `${genre}: ${mode === 'include' ? 'included' : mode === 'exclude' ? 'excluded' : 'not selected'}`);
    });

    const note = $('arfExpandedSummary');
    if (note) {
      const bits = [];
      if (state.includeGenres.size) bits.push(`${state.includeGenres.size} genre${state.includeGenres.size === 1 ? '' : 's'} included`);
      if (state.excludeGenres.size) bits.push(`${state.excludeGenres.size} genre${state.excludeGenres.size === 1 ? '' : 's'} excluded`);
      if (state.includeTags.size) bits.push(`${state.includeTags.size} quick tag${state.includeTags.size === 1 ? '' : 's'} included`);
      if (state.excludeTags.size) bits.push(`${state.excludeTags.size} quick tag${state.excludeTags.size === 1 ? '' : 's'} excluded`);
      note.textContent = bits.join(' · ') || 'No extra quick filters selected.';
    }
  }

  function syncRelationshipButtons() {
    const host = $('arfRelationship');
    if (!host) return;
    for (const [tag, label] of RELATIONSHIP) {
      if (!host.querySelector(`[data-tomo-extra-tag="${CSS.escape(tag)}"]`)) host.append(makeTagButton(tag, label));
    }
    renderStates();
  }

  function bindGenreTriState() {
    const host = $('arfGenres');
    if (!host || host.dataset.tomoTriState === 'true') return;
    host.dataset.tomoTriState = 'true';

    host.querySelectorAll('[data-group="genre"][aria-pressed="true"]').forEach(b => {
      state.includeGenres.add(b.dataset.value || b.textContent.trim());
    });

    host.addEventListener('click', event => {
      const chip = event.target.closest('[data-group="genre"]');
      if (!chip) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cycleGenre(chip.dataset.value || chip.textContent.trim());
    }, true);

    new MutationObserver(() => requestAnimationFrame(renderStates))
      .observe(host, { childList: true, subtree: false });
    renderStates();
  }

  function clearExtraState() {
    state.includeTags.clear();
    state.excludeTags.clear();
    state.includeGenres.clear();
    state.excludeGenres.clear();
    ['arfFromYear','arfToYear','arfMaxScore','arfMaxPopularity'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('arfLicensedOnly')) $('arfLicensedOnly').value = '';
    renderStates();
  }

  function installSections() {
    const base = document.querySelector('.advanced-randomizer-filters');
    if (!base || $('tomoExpandedFilters')) return false;

    syncRelationshipButtons();
    bindGenreTriState();

    const genreSection = $('arfGenres')?.closest('.arf-section');
    if (genreSection && !genreSection.querySelector('[data-tomo-genre-help]')) {
      const p = document.createElement('p');
      p.className = 'arf-hint';
      p.dataset.tomoGenreHelp = 'true';
      p.textContent = 'Tap once to include, twice to exclude, a third time to clear.';
      $('arfGenres').after(p);
    }

    const formatSection = $('arfFormats')?.closest('.arf-section');
    const metrics = [...base.querySelectorAll('details.arf-section')]
      .find(d => /Episodes, duration/i.test(d.querySelector('summary')?.textContent || ''));

    const expanded = document.createElement('div');
    expanded.id = 'tomoExpandedFilters';
    expanded.className = 'advanced-randomizer-filters';
    expanded.innerHTML = `
      <details class="arf-section" open>
        <summary>More people & relationship filters</summary>
        <div class="arf-label arf-space">CAST & PROTAGONIST</div>
        <div id="arfCastQuick" class="arf-chips"></div>
        <div class="arf-label arf-space">THEMES & SETTING</div>
        <div id="arfThemeQuick" class="arf-chips"></div>
        <p class="arf-hint">Tap once to include, twice to exclude, a third time to clear.</p>
      </details>
      <details class="arf-section">
        <summary>Narrow the release window</summary>
        <div class="arf-grid">
          <label class="arf-field">From year<input id="arfFromYear" type="number" min="1940" max="2100" inputmode="numeric" placeholder="Any"></label>
          <label class="arf-field">Through year<input id="arfToYear" type="number" min="1940" max="2100" inputmode="numeric" placeholder="Any"></label>
        </div>
      </details>
      <details class="arf-section">
        <summary>More score, popularity & licensing filters</summary>
        <div class="arf-grid">
          <label class="arf-field">Max score %<input id="arfMaxScore" type="number" min="1" max="100" placeholder="Any"></label>
          <label class="arf-field">Max popularity<input id="arfMaxPopularity" type="number" min="0" placeholder="Any"></label>
        </div>
        <label class="arf-field">Licensing
          <select id="arfLicensedOnly">
            <option value="">Any</option>
            <option value="true">Officially licensed only</option>
          </select>
        </label>
      </details>
      <div id="arfExpandedSummary" class="arf-summary">No extra quick filters selected.</div>`;

    (metrics || formatSection)?.insertAdjacentElement('beforebegin', expanded);
    if (!expanded.isConnected) base.append(expanded);

    $('arfCastQuick')?.replaceChildren(...CAST.map(([tag, label]) => makeTagButton(tag, label)));
    $('arfThemeQuick')?.replaceChildren(...THEMES.map(([tag, label]) => makeTagButton(tag, label)));

    expanded.addEventListener('click', event => {
      const tag = event.target.closest('[data-tomo-extra-tag]');
      if (!tag) return;
      event.preventDefault();
      cycleTag(tag.dataset.tomoExtraTag);
    });

    $('arfRelationship')?.addEventListener('click', event => {
      const tag = event.target.closest('[data-tomo-extra-tag]');
      if (!tag) return;
      event.preventDefault();
      event.stopPropagation();
      cycleTag(tag.dataset.tomoExtraTag);
    });

    const relationship = $('arfRelationship');
    if (relationship) new MutationObserver(syncRelationshipButtons).observe(relationship, { childList: true });

    $('arfReset')?.addEventListener('click', () => {
      clearExtraState();
      setTimeout(() => {
        syncRelationshipButtons();
        bindGenreTriState();
        renderStates();
      }, 0);
    }, true);

    renderStates();
    return true;
  }

  function numberValue(id) {
    const raw = $(id)?.value;
    return raw === '' || raw == null ? null : Number(raw);
  }

  function wrapOptions() {
    const api = window.TomoAdvancedRandomizer;
    if (!api?.getOptions || api.getOptions.__tomoExpanded) return;
    const original = api.getOptions.bind(api);
    const wrapped = () => {
      const base = original() || {};
      const include = [...new Set([...(base.include || []), ...state.includeTags])];
      const exclude = [...new Set([...(base.exclude || []), ...state.excludeTags])].filter(tag => !include.includes(tag));
      return {
        ...base,
        genres: [...state.includeGenres],
        include,
        exclude,
        excludeGenres: [...state.excludeGenres],
        fromYear: numberValue('arfFromYear'),
        toYear: numberValue('arfToYear'),
        maxScore: numberValue('arfMaxScore'),
        maxPopularity: numberValue('arfMaxPopularity'),
        licensedOnly: $('arfLicensedOnly')?.value === 'true'
      };
    };
    wrapped.__tomoExpanded = true;

    window.TomoAdvancedRandomizer = Object.freeze({
      ...api,
      getOptions: wrapped,
      reset: () => {
        clearExtraState();
        api.reset?.();
        setTimeout(() => {
          syncRelationshipButtons();
          bindGenreTriState();
          renderStates();
        }, 0);
      }
    });
  }

  async function install() {
    for (let i = 0; i < 100; i += 1) {
      if (window.TomoAdvancedRandomizer?.getOptions && document.querySelector('.advanced-randomizer-filters')) break;
      await sleep(80);
    }
    if (!installSections()) return;
    wrapOptions();
  }

  install();
})();
