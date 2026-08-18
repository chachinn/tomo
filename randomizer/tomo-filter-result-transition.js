(() => {
  'use strict';

  const result = document.getElementById('resultSection');
  if (!result || result.dataset.tomoFilterResultTransition === 'true') return;
  result.dataset.tomoFilterResultTransition = 'true';

  let timer = null;

  function revealResult() {
    clearTimeout(timer);

    const filtersOpen = document.getElementById('filtersPanel')?.classList.contains('open');
    if (filtersOpen) window.TomoAdvancedRandomizer?.close?.();

    timer = setTimeout(() => {
      if (window.TomoNavigation?.getScreen?.() !== 'randomize') {
        window.TomoNavigation?.go?.('randomize');
      }

      requestAnimationFrame(() => {
        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }, filtersOpen ? 260 : 40);
  }

  const observer = new MutationObserver(() => {
    if (!result.hidden) revealResult();
  });

  observer.observe(result, { attributes: true, attributeFilter: ['hidden'] });
})();
