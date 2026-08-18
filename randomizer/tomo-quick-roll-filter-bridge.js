(() => {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const $ = id => document.getElementById(id);

  function hasActiveFilters(options = {}) {
    return options.scope !== 'any'
      || Boolean(options.genres?.length)
      || Boolean(options.formats?.length)
      || Boolean(options.release?.length)
      || Boolean(options.countries?.length)
      || Boolean(options.sources?.length)
      || Boolean(options.season)
      || Boolean(options.year)
      || Boolean(options.minEp)
      || Boolean(options.maxEp)
      || Boolean(options.minDur)
      || Boolean(options.maxDur)
      || Boolean(options.score)
      || Boolean(options.popularity)
      || Boolean(options.include?.length)
      || Boolean(options.exclude?.length);
  }

  function mirrorHiddenFilterError() {
    const status = $('arfActionStatus');
    const toast = $('toast');
    if (!status || !toast || status.dataset.quickRollMirror === 'true') return;
    status.dataset.quickRollMirror = 'true';
    const observer = new MutationObserver(() => {
      if (status.hidden || status.dataset.state !== 'error' || !status.textContent.trim()) return;
      toast.textContent = status.textContent.trim();
      toast.hidden = false;
      clearTimeout(mirrorHiddenFilterError.timer);
      mirrorHiddenFilterError.timer = setTimeout(() => { toast.hidden = true; }, 4300);
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-state'] });
  }

  async function install() {
    for (let i = 0; i < 80; i += 1) {
      if (window.TomoAdvancedRandomizer?.getOptions && $('quickRollBtn') && $('smartRollBtn')) break;
      await sleep(100);
    }

    const quick = $('quickRollBtn');
    if (!quick || !window.TomoAdvancedRandomizer?.getOptions || quick.dataset.tomoFilterBridge === 'true') return;
    quick.dataset.tomoFilterBridge = 'true';
    mirrorHiddenFilterError();

    quick.addEventListener('click', event => {
      const options = window.TomoAdvancedRandomizer?.getOptions?.() || {};
      if (!hasActiveFilters(options)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const smart = $('smartRollBtn');
      if (!smart || smart.disabled) return;
      smart.click();
    }, true);
  }

  install();
})();
