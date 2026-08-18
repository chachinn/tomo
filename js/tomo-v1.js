import { initHomeV1 } from './features/home-v1.js';
import { initRandomizerModes } from './features/randomizer-modes.js';
import { initDiscoveryHub } from './features/discovery-hub.js';
import { initLibraryInsights } from './features/library-insights.js';
import { initAiringSchedule } from './features/airing-schedule.js';

async function boot() {
  await initHomeV1();
  initRandomizerModes();
  initDiscoveryHub();
  initLibraryInsights();
  initAiringSchedule();

  const quick = document.getElementById('quickRollBtn');
  if (quick) {
    const keepLabel = () => {
      if (!quick.disabled && /Quick Roll/i.test(quick.textContent || '')) quick.textContent = '🎲 Surprise Me';
    };
    new MutationObserver(keepLabel).observe(quick, { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['disabled'] });
    keepLabel();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
else boot();
