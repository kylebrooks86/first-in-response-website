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

  const desktopNav = document.querySelector('.desktop-nav');
  if (desktopNav) {
    const ensureLink = (label, href) => {
      if ([...desktopNav.querySelectorAll('a')].some((a) => a.getAttribute('href') === href)) return;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      desktopNav.appendChild(a);
    };
    ensureLink('Personalized estimate', '#personal');
    ensureLink('Leave a review', 'review/');
  }

  const mobileEstimate = document.querySelector('.bottom-estimate');
  if (mobileEstimate) mobileEstimate.textContent = 'INSTANT ESTIMATE';

  const combinedSurfaceAcc = [...document.querySelectorAll('#estimate .acc')].find((acc) => {
    const h3 = acc.querySelector('.acc-head h3');
    return h3 && h3.textContent.trim().toUpperCase() === 'CONCRETE, WOOD & OUTDOOR SURFACES';
  });
  if (combinedSurfaceAcc && !document.querySelector('#estimate .acc[data-live-split="wood"]')) {
    const h3 = combinedSurfaceAcc.querySelector('.acc-head h3');
    const desc = combinedSurfaceAcc.querySelector('.acc-head p');
    if (h3) h3.textContent = 'CONCRETE';
    if (desc) desc.textContent = 'Enter approximate square feet for the concrete or paver surfaces being cleaned.';

    const options = [...combinedSurfaceAcc.querySelectorAll(':scope > .opt')];
    const woodOptions = options.slice(2);
    if (woodOptions.length) {
      const woodAcc = document.createElement('div');
      woodAcc.className = 'acc collapsed';
      woodAcc.dataset.liveSplit = 'wood';
      woodAcc.innerHTML = '<div class="acc-head"><div><h3>WOOD & OUTDOOR SURFACES</h3><p>Enter square feet for decks and every fence side being cleaned, or choose the quantity that applies to outdoor add-ons.</p></div><span class="x" aria-hidden="true">+</span></div>';
      woodOptions.forEach((opt) => woodAcc.appendChild(opt));
      combinedSurfaceAcc.insertAdjacentElement('afterend', woodAcc);

      const head = woodAcc.querySelector('.acc-head');
      const icon = woodAcc.querySelector('.x');
      const toggle = () => {
        const opening = woodAcc.classList.contains('collapsed');
        woodAcc.classList.toggle('collapsed', !opening);
        if (icon) icon.textContent = opening ? '×' : '+';
      };
      if (head) {
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.setAttribute('aria-expanded', 'false');
        head.addEventListener('click', () => {
          toggle();
          head.setAttribute('aria-expanded', String(!woodAcc.classList.contains('collapsed')));
        });
        head.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            head.click();
          }
        });
      }
    }
  }

  document.querySelectorAll('.beforeafter').forEach((wrap) => {
    const handle = wrap.querySelector('.slider');
    if (!handle) return;
    const oldVisual = wrap.querySelector('.fire-slider-visual');
    if (oldVisual) oldVisual.remove();
    handle.textContent = '↔';
    handle.setAttribute('aria-hidden', 'true');
  });

  if (!document.querySelector('.fire-floating-estimate')) {
    const floatingEstimate = document.createElement('a');
    floatingEstimate.className = 'fire-floating-estimate';
    floatingEstimate.href = '#estimate';
    floatingEstimate.textContent = 'INSTANT ESTIMATE →';
    floatingEstimate.setAttribute('aria-label', 'Jump to instant estimate');
    document.body.appendChild(floatingEstimate);
  }

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
