export function initRerollBridge() {
  const result = document.getElementById('resultSection');
  if (!result || result.dataset.tomoRerollBridge === 'true') return;
  result.dataset.tomoRerollBridge = 'true';

  document.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target) return;
    if (target.id === 'quickRollBtn' || target.id === 'smartRollBtn') {
      delete result.dataset.tomoMode;
      return;
    }
    if (target.id !== 'rerollBtn') return;
    const mode = result.dataset.tomoMode;
    if (!mode) return;
    const modeButton = document.querySelector(`[data-tomo-mode="${CSS.escape(mode)}"]`);
    if (!modeButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    modeButton.click();
  }, true);
}
