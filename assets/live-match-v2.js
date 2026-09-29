(() => {
  const mobileEstimate = document.querySelector('.bottom-estimate');
  if (mobileEstimate) mobileEstimate.textContent = 'INSTANT ESTIMATE';

  document.querySelectorAll('.beforeafter .slider').forEach((handle) => {
    const force = (prop, value) => handle.style.setProperty(prop, value, 'important');
    force('display', 'grid');
    force('place-items', 'center');
    force('width', '64px');
    force('height', '64px');
    force('min-width', '64px');
    force('min-height', '64px');
    force('background', '#e62e2e');
    force('border', '4px solid #fff');
    force('border-radius', '999px');
    force('box-shadow', '0 6px 22px rgba(0,0,0,.48)');
    force('color', '#fff');
    force('font-size', '25px');
    force('font-weight', '900');
    force('line-height', '1');
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
