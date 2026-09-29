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

  if (!document.getElementById('fire-parity-runtime-style')) {
    const style = document.createElement('style');
    style.id = 'fire-parity-runtime-style';
    style.textContent = `
      .dash{display:block!important;background:#2877d4!important;width:28px!important;height:3px!important;flex:0 0 28px!important}
      .fire-footer-contact-grid{max-width:980px;margin:32px auto 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #2b3036;border-bottom:1px solid #2b3036}
      .fire-footer-contact-grid a{padding:22px 20px;text-decoration:none;border-right:1px solid #2b3036;display:block}
      .fire-footer-contact-grid a:last-child{border-right:0}
      .fire-footer-contact-grid small{display:block;color:#8f969e;font-size:10px;font-weight:800;letter-spacing:.18em;margin-bottom:7px}
      .fire-footer-contact-grid strong{display:block;color:#fff;font-size:15px}
      .fire-floating-estimate{display:grid!important;gap:2px!important;min-width:150px!important;text-align:left!important;padding:11px 15px!important}
      .fire-floating-estimate small{display:block;font-size:9px;letter-spacing:.16em;font-weight:800;opacity:.82}
      .fire-floating-estimate strong{display:block;font-size:13px;letter-spacing:.03em;font-weight:900}
      @media(min-width:980px){.desktop-nav{gap:24px!important}.desktop-nav a{font-size:14px!important}.header-call{font-size:14px!important;padding:10px 16px!important}}
      @media(max-width:979px){.fire-footer-contact-grid{grid-template-columns:1fr}.fire-footer-contact-grid a{border-right:0;border-bottom:1px solid #2b3036;padding:16px 18px}.fire-footer-contact-grid a:last-child{border-bottom:0}}
    `;
    document.head.appendChild(style);
  }

  const desktopNav = document.querySelector('.desktop-nav');
  if (desktopNav) {
    [...desktopNav.querySelectorAll('a')].forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href === '#personal' || href === 'review/' || href.endsWith('/review/')) a.remove();
    });
  }

  const heroHeading = document.querySelector('.hero .display');
  if (heroHeading) {
    heroHeading.innerHTML = 'Tulsa exterior<br>cleaning<br><span class="hero-white">with a first-</span><span class="red">responder standard.</span>';
  }

  const mobileBar = document.querySelector('.bottom');
  if (mobileBar) {
    const links = [...mobileBar.querySelectorAll('a')];
    const call = links.find((a) => (a.getAttribute('href') || '').startsWith('tel:'));
    const text = links.find((a) => (a.getAttribute('href') || '').startsWith('sms:'));
    const estimate = links.find((a) => (a.getAttribute('href') || '').includes('#estimate'));
    if (call) call.textContent = 'Call';
    if (text) text.textContent = 'Text photos';
    if (estimate) estimate.textContent = 'Estimate';
    [call, text, estimate].filter(Boolean).forEach((a) => mobileBar.appendChild(a));
  }

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

  let floatingEstimate = document.querySelector('.fire-floating-estimate');
  if (!floatingEstimate) {
    floatingEstimate = document.createElement('a');
    floatingEstimate.className = 'fire-floating-estimate';
    floatingEstimate.href = '#estimate';
    floatingEstimate.setAttribute('aria-label', 'Price it now with the instant estimate');
    document.body.appendChild(floatingEstimate);
  }
  floatingEstimate.innerHTML = '<small>PRICE IT NOW</small><strong>INSTANT ESTIMATE</strong>';

  const footer = document.querySelector('footer');
  if (footer && !footer.querySelector('.fire-footer-contact-grid')) {
    const grid = document.createElement('div');
    grid.className = 'fire-footer-contact-grid';
    grid.innerHTML = `
      <a href="tel:+19189229366"><small>CALL</small><strong>(918) 922-9366</strong></a>
      <a href="sms:+19189229366"><small>TEXT</small><strong>(918) 922-9366</strong></a>
      <a href="mailto:kyle@firstinresponseexteriors.com"><small>EMAIL</small><strong>kyle@firstinresponseexteriors.com</strong></a>
    `;
    const footerCols = footer.querySelector('.footer-cols');
    if (footerCols) footer.insertBefore(grid, footerCols);
    else footer.appendChild(grid);
  }

  document.querySelectorAll('.job-video').forEach((card) => {
    const video = card.querySelector('video');
    if (!video) return;
    const custom = card.querySelector('.fire-play');
    if (custom) custom.remove();
    card.classList.remove('playing');
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
  });
})();
