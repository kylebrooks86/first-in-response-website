(() => {
  const mobileEstimate = document.querySelector('.bottom-estimate');
  if (mobileEstimate) mobileEstimate.textContent = 'INSTANT ESTIMATE';

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
        if (video.paused) {
          await video.play();
        } else {
          video.pause();
        }
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
