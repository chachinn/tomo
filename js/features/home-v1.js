const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function initHomeV1() {
  for (let i=0;i<50;i+=1) { if (window.TomoNavigation) break; await sleep(100); }
  const card = document.querySelector('[data-home-quick-roll]');
  if (card) {
    card.removeAttribute('data-home-quick-roll');
    card.dataset.tomoHistoryShortcut = 'true';
    card.setAttribute('aria-label','Open recent randomizer history');
    card.innerHTML = '<span>↺</span><strong>Roll History</strong><small>See recent picks</small>';
    card.addEventListener('click', event => {
      event.preventDefault();
      window.TomoNavigation?.go?.('randomize');
      setTimeout(() => document.getElementById('tomoRollHistory')?.scrollIntoView({ behavior:'smooth', block:'start' }), 250);
    }, true);
  }
}
