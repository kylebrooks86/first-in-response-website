(() => {
  const mobileEstimate = document.querySelector('.bottom-estimate');
  if (mobileEstimate) mobileEstimate.textContent = 'INSTANT ESTIMATE';

  document.querySelectorAll('.beforeafter').forEach((wrap) => {
    const handle = wrap.querySelector('.slider');
    if (!handle) return;

    const force = (prop, value) => handle.style.setProperty(prop, value, 'important');
    force('display', 'block');
    force('width', '1px');
    force('height', '1px');
    force('min-width', '1px');
    force('min-height', '1px');
    force('background', 'transparent');
    force('border', '0');
    force('box-shadow', 'none');
    force('font-size', '0');
    force('z-index', '10');
    handle.textContent = '';

    let visual = wrap.querySelector('.fire-slider-visual');
    if (!visual) {
      visual = document.createElement('span');
      visual.className = 'fire-slider-visual';
      visual.textContent = '↔';
      visual.setAttribute('aria-hidden', 'true');
      Object.assign(visual.style, {
        position: 'absolute',
        top: '50%',
        left: handle.style.left || '50%',
        transform: 'translate(-50%, -50%)',
        width: '64px',
        height: '64px',
        display: 'grid',
        placeItems: 'center',
        background: '#e62e2e',
        color: '#fff',
        border: '4px solid #fff',
        borderRadius: '999px',
        boxShadow: '0 6px 22px rgba(0,0,0,.48)',
        fontSize: '25px',
        fontWeight: '900',
        lineHeight: '1',
        zIndex: '12',
        pointerEvents: 'none'
      });
      wrap.appendChild(visual);
    }

    const sync = () => {
      visual.style.left = handle.style.left || '50%';
    };
    sync();
    new MutationObserver(sync).observe(handle, { attributes: true, attributeFilter: ['style'] });
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
