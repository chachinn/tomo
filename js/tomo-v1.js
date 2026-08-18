import { initHomeV1 } from './features/home-v1.js?v=1.0.0';
import { initRandomizerModes } from './features/randomizer-modes.js?v=1.0.0';
import { initDiscoveryHub } from './features/discovery-hub.js?v=1.0.0';
import { initLibraryInsights } from './features/library-insights.js?v=1.0.0';
import { initAiringSchedule } from './features/airing-schedule.js?v=1.0.0';
import { initRerollBridge } from './features/reroll-bridge.js?v=1.0.0';

async function boot() {
  await initHomeV1();
  initRandomizerModes();
  initRerollBridge();
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
