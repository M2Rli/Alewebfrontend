/* Progressive enhancements only: all tools and navigation work without this file. */
(() => {
  'use strict';
  const root = document.documentElement;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');
  const stage = document.querySelector('.scene-wrap');
  const object = document.querySelector('.scene-object');
  let userPaused = false;
  let frame = 0;
  let pointer = { x: 0, y: 0 };
  try { userPaused = localStorage.getItem('the-op-motion') === 'off'; } catch (_) {}

  function updateMotion() {
    const paused = userPaused || preference.matches;
    root.classList.toggle('motion-off', paused);
    toggle.setAttribute('aria-pressed', String(!paused));
    toggle.setAttribute('aria-label', paused ? 'تشغيل الحركة' : 'إيقاف الحركة');
    toggle.title = preference.matches ? 'الحركة متوقفة حسب إعدادات جهازك' : (paused ? 'تشغيل الحركة' : 'إيقاف الحركة');
    toggle.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
  }
  toggle.addEventListener('click', () => {
    // Respect the OS accessibility preference even if the site toggle is clicked.
    userPaused = !userPaused;
    try { localStorage.setItem('the-op-motion', userPaused ? 'off' : 'on'); } catch (_) {}
    updateMotion();
  });
  preference.addEventListener('change', updateMotion);
  updateMotion();

  function drawTilt() {
    frame = 0;
    object.style.setProperty('--scene-x', `${10 - pointer.y * 5}deg`);
    object.style.setProperty('--scene-y', `${18 + pointer.x * 8}deg`);
  }
  stage.addEventListener('pointermove', (event) => {
    if (root.classList.contains('motion-off') || event.pointerType !== 'mouse') return;
    const rect = stage.getBoundingClientRect();
    pointer = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 };
    if (!frame) frame = requestAnimationFrame(drawTilt);
  }, { passive: true });
  stage.addEventListener('pointerleave', () => {
    pointer = { x: 0, y: 0 };
    if (!frame) frame = requestAnimationFrame(drawTilt);
  });
  const visibility = new IntersectionObserver(([entry]) => {
    object.style.animationPlayState = entry.isIntersecting && !document.hidden ? 'running' : 'paused';
  }, { threshold: 0.1 });
  visibility.observe(stage);
  document.addEventListener('visibilitychange', () => {
    object.style.animationPlayState = document.hidden ? 'paused' : 'running';
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
  });

  const clock = document.getElementById('workspaceTime');
  function updateClock() {
    clock.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date()) + ' UTC';
  }
  updateClock();
  setInterval(updateClock, 60000);

  // Desktop tabs must not consume page scroll. Horizontal scrolling is touch/native on mobile.
  const views = ['home', 'calc', 'imgchart', 'prices', 'pulse', 'limit', 'report'];
  function updateNavigation(event) {
    const page = event.detail.page;
    const index = views.indexOf(page);
    document.getElementById('pageIndex').textContent = `${String(index + 1).padStart(2, '0')} / WORKSPACE`;
    document.getElementById('workspaceCrumb').textContent = document.getElementById('pageTitle').textContent;
    const activeTab = document.querySelector(`.page-tab[data-page="${page}"]`);
    if (window.innerWidth <= 760) activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: root.classList.contains('motion-off') ? 'instant' : 'smooth' });
  }
  document.addEventListener('op:pagechange', updateNavigation);

  // Real labels and native buttons keep the existing calculator usable by keyboard.
  document.querySelectorAll('.form-row label').forEach((label) => {
    const control = label.parentElement.querySelector('input, select');
    if (control?.id) label.htmlFor = control.id;
  });
  document.getElementById('capital').setAttribute('aria-label', 'رأس المال بالدولار');
  document.getElementById('emptyState').setAttribute('role', 'status');
  document.getElementById('imgDrop').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); document.getElementById('imgFileInput').click();
    }
  });
})();
