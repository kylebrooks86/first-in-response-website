(() => {
  const exactLogo = 'assets/recent-work/fire-logo-direct.png';
  const headerLogo = document.querySelector('.brand img');
  const footerLogo = document.querySelector('.footer-logo');
  if (headerLogo) {
    headerLogo.src = exactLogo;
    headerLogo.alt = 'First In Response Exteriors logo';
  }
  if (footerLogo) {
    footerLogo.src = exactLogo;
    footerLogo.alt = 'First In Response Exteriors logo';
  }

  const mobileEstimate = document.querySelector('.bottom-estimate');
  if (mobileEstimate) mobileEstimate.textContent = 'INSTANT ESTIMATE';

  document.querySelectorAll('.beforeafter').forEach((wrap) => {
    const handle = wrap.querySelector('.slider');
    if (!handle) return;

    const oldVisual = wrap.querySelector('.fire-slider-visual');
    if (oldVisual) oldVisual.remove();

    const force = (prop, value) => handle.style.setProperty(prop, value, 'important');
    force('display', 'block');
    force('position', 'absolute');
    force('top', '50%');
    force('left', handle.style.left || '50%');
    force('transform', 'translate(-50%, -50%)');
    force('width', '30px');
    force('height', '30px');
    force('min-width', '30px');
    force('min-height', '30px');
    force('background', 'rgba(255,255,255,.94)');
    force('border', '2px solid rgba(20,20,20,.58)');
    force('border-radius', '50%');
    force('box-shadow', '0 2px 8px rgba(0,0,0,.28)');
    force('color', '#2b2b2b');
    force('font-size', '15px');
    force('font-weight', '700');
    force('line-height', '26px');
    force('text-align', 'center');
    force('z-index', '10');
    force('opacity', '1');
    handle.textContent = '↔';
    handle.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.job-video').forEach((card) => {
    const video = card.querySelector('video');
    if (!video || card.querySelector('.fire-play')) return;
    video.removeAttribute('controls');
    video.setAttribute('playsinline', '');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fire-play';
    btn.textContent = 'PLAY';
    btn.setAttribute('aria-label', 'Play job video');
    btn.addEventListener('click', async () => {
      try {
        if (video.paused) await video.play();
        else video.pause();
      } catch (_) {}
    });
    video.addEventListener('play', () => {
      card.classList.add('playing');
      btn.textContent = 'PAUSE';
      btn.setAttribute('aria-label', 'Pause job video');
    });
    video.addEventListener('pause', () => {
      card.classList.remove('playing');
      btn.textContent = 'PLAY';
      btn.setAttribute('aria-label', 'Play job video');
    });
    video.addEventListener('ended', () => {
      card.classList.remove('playing');
      btn.textContent = 'PLAY';
      btn.setAttribute('aria-label', 'Play job video');
    });
    card.appendChild(btn);
  });
})();
