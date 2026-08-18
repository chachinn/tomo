(() => {
  'use strict';

  const menuButton = document.getElementById('menuButton');
  const drawer = document.getElementById('sideDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const closeButton = document.getElementById('closeDrawer');
  const screens = new Map([...document.querySelectorAll('[data-screen]')].map(node => [node.dataset.screen, node]));
  const navButtons = [...document.querySelectorAll('[data-nav-screen]')];
  const accountStatus = document.getElementById('drawerAccountStatus');
  const connectButton = document.getElementById('anilistConnectBtn');
  const RETURN_KEY = 'tomo.nav.oauth-return.v1';
  const SCREEN_KEY = 'tomo.nav.screen.v1';
  const validScreens = new Set(screens.keys());
  let activeScreen = 'home';
  let drawerHideTimer = null;
  let previousFocus = null;

  function safeSessionGet(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }

  function safeSessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch {}
  }

  function safeSessionRemove(key) {
    try { sessionStorage.removeItem(key); } catch {}
  }

  function screenFromHash() {
    const hash = String(location.hash || '').replace(/^#/, '');
    return validScreens.has(hash) ? hash : '';
  }

  function refreshAccountSummary() {
    if (!accountStatus) return;
    const viewer = window.TomoAniList?.getViewer?.();
    if (viewer?.name) {
      accountStatus.textContent = `Connected as ${viewer.name}. Open your library and sync status.`;
      return;
    }
    accountStatus.textContent = window.TomoAniList?.isConnected?.()
      ? 'AniList connected. Open your library and sync status.'
      : 'Connect AniList to bring your library into Tomo.';
  }

  function setCurrentNav(screen) {
    for (const button of navButtons) {
      if (button.dataset.navScreen === screen) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }

  function showScreen(screen, { historyMode = 'push', focusHeading = false } = {}) {
    if (!validScreens.has(screen)) screen = 'home';
    activeScreen = screen;

    for (const [name, node] of screens) {
      const active = name === screen;
      node.classList.toggle('active', active);
      node.setAttribute('aria-hidden', active ? 'false' : 'true');
    }

    setCurrentNav(screen);
    safeSessionSet(SCREEN_KEY, screen);

    if (historyMode !== 'none') {
      const target = screen === 'home'
        ? `${location.pathname}${location.search}`
        : `${location.pathname}${location.search}#${screen}`;
      if (historyMode === 'replace') history.replaceState({ tomoScreen: screen }, '', target);
      else history.pushState({ tomoScreen: screen }, '', target);
    }

    closeDrawer({ restoreFocus: false });
    window.scrollTo({ top: 0, behavior: 'auto' });

    if (focusHeading) {
      requestAnimationFrame(() => {
        const heading = screens.get(screen)?.querySelector('h1, h2');
        if (!heading) return;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
      });
    }

    refreshAccountSummary();
  }

  function openDrawer() {
    if (!drawer || !overlay || !menuButton) return;
    clearTimeout(drawerHideTimer);
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton;
    overlay.hidden = false;
    drawer.inert = false;
    drawer.setAttribute('aria-hidden', 'false');
    menuButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('tomo-drawer-open');
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      drawer.classList.add('open');
      refreshAccountSummary();
      closeButton?.focus({ preventScroll: true });
    });
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!drawer || !overlay || !menuButton) return;
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    drawer.setAttribute('aria-hidden', 'true');
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('tomo-drawer-open');
    drawer.inert = true;
    clearTimeout(drawerHideTimer);
    drawerHideTimer = setTimeout(() => { overlay.hidden = true; }, 240);
    if (restoreFocus && previousFocus?.focus) previousFocus.focus({ preventScroll: true });
  }

  function trapDrawerFocus(event) {
    if (event.key !== 'Tab' || !drawer?.classList.contains('open')) return;
    const focusable = [...drawer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function loadLibraryModule() {
    if (!document.querySelector('link[data-tomo-library-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'library/tomo-library.css?v=1.1.1';
      link.dataset.tomoLibraryStyle = 'true';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-tomo-library-script]')) {
      const script = document.createElement('script');
      script.src = 'library/tomo-library.js?v=1.1.1';
      script.defer = true;
      script.dataset.tomoLibraryScript = 'true';
      document.body.appendChild(script);
    }

    if (!document.querySelector('link[data-tomo-library-sync-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'library/tomo-library-sync.css?v=1.1.2';
      link.dataset.tomoLibrarySyncStyle = 'true';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-tomo-library-sync-script]')) {
      const script = document.createElement('script');
      script.src = 'library/tomo-library-sync.js?v=1.1.2';
      script.defer = true;
      script.dataset.tomoLibrarySyncScript = 'true';
      document.body.appendChild(script);
    }
  }

  menuButton?.addEventListener('click', () => {
    if (drawer?.classList.contains('open')) closeDrawer();
    else openDrawer();
  });
  closeButton?.addEventListener('click', () => closeDrawer());
  overlay?.addEventListener('click', () => closeDrawer());

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawer?.classList.contains('open')) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    trapDrawerFocus(event);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-nav-screen]');
    if (!button) return;
    const screen = button.dataset.navScreen;
    if (!validScreens.has(screen)) return;
    showScreen(screen, { historyMode: screen === activeScreen ? 'replace' : 'push' });
  }, true);

  connectButton?.addEventListener('click', () => safeSessionSet(RETURN_KEY, 'library'), { capture: true });

  window.addEventListener('popstate', () => {
    showScreen(screenFromHash() || 'home', { historyMode: 'none' });
  });

  window.addEventListener('tomo:anilist-disconnected', refreshAccountSummary);
  window.addEventListener('tomo:anilist-auth-expired', refreshAccountSummary);

  const oauthReturn = safeSessionGet(RETURN_KEY);
  if (oauthReturn && validScreens.has(oauthReturn)) {
    safeSessionRemove(RETURN_KEY);
    showScreen(oauthReturn, { historyMode: 'replace' });
  } else {
    const initial = screenFromHash() || safeSessionGet(SCREEN_KEY) || 'home';
    showScreen(validScreens.has(initial) ? initial : 'home', { historyMode: 'replace' });
  }

  loadLibraryModule();

  window.TomoNavigation = Object.freeze({
    go: screen => showScreen(screen),
    openDrawer,
    closeDrawer,
    getScreen: () => activeScreen
  });
})();
