import { store } from '../core/storage.js?v=1.0.0';

const $ = id => document.getElementById(id);
const clamp = value => Math.max(1, Math.min(20, Number.parseInt(value, 10) || 1));
const titleOf = media => media?.title?.english || media?.title?.userPreferred || media?.title?.romaji || media?.title?.native || 'Untitled';
let desired = clamp(store.getPreference('rollAmount', 1));
let collecting = false;
let items = [];
let source = '';
let mode = '';
let rerollTimer = null;

function cleanText(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return doc.body?.textContent?.trim() || 'No synopsis available yet.';
}
function toast(message) {
  const node = $('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3200);
}
function setAmount(value) {
  desired = clamp(value);
  store.setPreference('rollAmount', desired);
  const input = $('tomoRollAmountInput');
  if (input) input.value = String(desired);
  document.querySelectorAll('[data-tomo-roll-step]').forEach(button => {
    button.disabled = (button.dataset.tomoRollStep === '-1' && desired === 1) || (button.dataset.tomoRollStep === '1' && desired === 20);
  });
}
function ensureControl() {
  if ($('tomoRollAmount')) return;
  const hero = $('screen-randomize')?.querySelector('.hero-card');
  const actions = hero?.querySelector('.hero-actions');
  if (!hero || !actions) return;
  const control = document.createElement('div');
  control.id = 'tomoRollAmount';
  control.className = 'tomo-roll-amount';
  control.innerHTML = '<div><strong>How many picks?</strong><small>Choose 1–20 unique anime</small></div><div class="tomo-roll-stepper"><button type="button" data-tomo-roll-step="-1" aria-label="One fewer pick">−</button><input id="tomoRollAmountInput" type="number" inputmode="numeric" min="1" max="20" step="1" aria-label="Number of anime to roll"><button type="button" data-tomo-roll-step="1" aria-label="One more pick">+</button></div>';
  actions.before(control);
  control.addEventListener('click', event => {
    const step = Number(event.target.closest?.('[data-tomo-roll-step]')?.dataset?.tomoRollStep || 0);
    if (step) setAmount(desired + step);
  });
  $('tomoRollAmountInput')?.addEventListener('change', event => setAmount(event.target.value));
  $('tomoRollAmountInput')?.addEventListener('blur', event => setAmount(event.target.value));
  setAmount(desired);
}
function rememberFeedback(kind, media) {
  const item = { id:Number(media.id), title:titleOf(media), cover:media?.coverImage?.large || '', time:Date.now() };
  if (kind === 'maybe') {
    store.setMaybeLater([item, ...store.getMaybeLater().filter(x => Number(x.id) !== item.id)].slice(0,100));
    toast('Saved to Maybe Later on this device.');
  } else {
    store.setNotTonight([item, ...store.getNotTonight().filter(x => Number(x.id) !== item.id)].slice(0,100));
    toast('Skipped for tonight. Tomo will avoid it for 12 hours.');
  }
}
function batchCard(media, index) {
  const article = document.createElement('article');
  article.className = 'tomo-batch-card';
  article.dataset.mediaId = String(media.id || '');
  const cover = media?.coverImage?.extraLarge || media?.coverImage?.large || '';
  const meta = [media.format, media.episodes && `${media.episodes} eps`, media.duration && `${media.duration} min`, media.averageScore && `${media.averageScore}%`, media.seasonYear].filter(Boolean).join(' · ') || 'Anime';
  article.innerHTML = `<div class="tomo-batch-number">${index + 1}</div>${cover ? `<img src="${cover}" alt="" loading="lazy" decoding="async">` : ''}<div class="tomo-batch-copy"><span class="pill">${meta}</span><h3></h3><p></p><div class="tag-row"></div><div class="tomo-batch-actions"><a class="secondary-btn link-btn" target="_blank" rel="noopener noreferrer">View on AniList</a><button class="secondary-btn" type="button" data-batch-feedback="maybe">♡ Maybe later</button><button class="secondary-btn" type="button" data-batch-feedback="skip">Not tonight</button></div></div>`;
  article.querySelector('h3').textContent = titleOf(media);
  article.querySelector('p').textContent = cleanText(media.description);
  article.querySelector('.tag-row').replaceChildren(...(media.genres || []).slice(0,5).map(name => { const span = document.createElement('span'); span.textContent = name; return span; }));
  article.querySelector('a').href = media.siteUrl || `https://anilist.co/anime/${Number(media.id) || ''}`;
  article.addEventListener('click', event => {
    const kind = event.target.closest?.('[data-batch-feedback]')?.dataset?.batchFeedback;
    if (kind) rememberFeedback(kind, media);
  });
  return article;
}
function renderBatch() {
  const result = $('resultSection');
  if (!result) return;
  let host = $('tomoBatchResults');
  if (!host) {
    host = document.createElement('section');
    host.id = 'tomoBatchResults';
    host.className = 'tomo-v1-card tomo-batch-results';
    result.after(host);
  }
  const count = items.length;
  host.innerHTML = `<div class="tomo-v1-heading"><div><span class="eyebrow">YOUR PICKS</span><h2>${count} anime${count === 1 ? '' : 's'} rolled</h2><p>${count < desired ? `Tomo found ${count} available unique matches for this roll.` : 'A fresh batch from the same randomizer pool.'}</p></div><button type="button" class="primary-btn" data-batch-reroll>🎲 Reroll ${desired}</button></div><div class="tomo-batch-grid"></div>`;
  host.querySelector('.tomo-batch-grid').replaceChildren(...items.map(batchCard));
  host.querySelector('[data-batch-reroll]').addEventListener('click', () => startBatch(source, mode, true));
  result.hidden = true;
  host.hidden = false;
  host.scrollIntoView({ behavior:'smooth', block:'start' });
}
function nextRoll() {
  clearTimeout(rerollTimer);
  rerollTimer = setTimeout(() => {
    const reroll = $('rerollBtn');
    if (reroll && !reroll.disabled) reroll.click();
    else finishBatch();
  }, 45);
}
function finishBatch() {
  collecting = false;
  clearTimeout(rerollTimer);
  if (items.length) renderBatch();
}
function startBatch(nextSource, nextMode = '', reroll = false) {
  if (desired <= 1) return false;
  source = nextSource;
  mode = nextMode;
  collecting = true;
  items = [];
  $('tomoBatchResults')?.setAttribute('hidden', '');
  if (reroll) {
    if (source === 'mode') document.querySelector(`[data-tomo-mode="${CSS.escape(mode)}"]`)?.click();
    else if (source === 'filtered') $('smartRollBtn')?.click();
    else document.querySelector('[data-tomo-mode="surprise"]')?.click();
  }
  return true;
}
function onResult(event) {
  if (!collecting || !event?.detail?.media) return;
  const media = event.detail.media;
  if (!items.some(item => Number(item.id) === Number(media.id))) items.push(media);
  if (items.length >= desired) finishBatch();
  else nextRoll();
}
function interceptStart(event) {
  if (desired <= 1 || collecting) return;
  const target = event.target.closest?.('#quickRollBtn, #smartRollBtn, [data-tomo-mode]');
  if (!target) return;
  if (target.id === 'quickRollBtn') {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (startBatch('mode', 'surprise')) document.querySelector('[data-tomo-mode="surprise"]')?.click();
    return;
  }
  if (target.id === 'smartRollBtn') startBatch('filtered');
  else startBatch('mode', target.dataset.tomoMode || 'surprise');
}

export function initBatchRoll() {
  ensureControl();
  document.addEventListener('click', interceptStart, true);
  window.addEventListener('tomo:roll-result', onResult);
}
