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
      @media(min-width:980px){.desktop-nav{gap:17px!important}.desktop-nav a{font-size:12px!important}.header-call{font-size:12px!important;padding:9px 12px!important}}
      @media(max-width:979px){.fire-footer-contact-grid{grid-template-columns:1fr}.fire-footer-contact-grid a{border-right:0;border-bottom:1px solid #2b3036;padding:16px 18px}.fire-footer-contact-grid a:last-child{border-bottom:0}}
    `;
    document.head.appendChild(style);
  }

  const ownerSection = document.querySelector('.owner-photo')?.closest('section');
  if (ownerSection && !ownerSection.id) ownerSection.id = 'meet-kyle';
  const faqSection = document.querySelector('.faq')?.closest('section');
  if (faqSection && !faqSection.id) faqSection.id = 'faqs';

  const desktopNav = document.querySelector('.desktop-nav');
  if (desktopNav) {
    desktopNav.innerHTML = `
      <a href="#services">Services</a>
      <a href="#estimate">Instant Estimate</a>
      <a href="#results">Results</a>
      <a href="#on-the-job">Recent Work</a>
      <a href="#reviews">Reviews</a>
      <a href="#meet-kyle">Meet Kyle</a>
      <a href="#faqs">FAQs</a>
      <a href="#personal">Personalized Estimate</a>
    `;
  }

  const heroHeading = document.querySelector('.hero .display');
  if (heroHeading) {
    heroHeading.innerHTML = 'TULSA EXTERIOR<br>CLEANING WITH A FIRST-<br><span class="red">RESPONDER STANDARD.</span>';
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

  let combinedSurfaceAcc = [...document.querySelectorAll('#estimate .acc')].find((acc) => {
    const h3 = acc.querySelector('.acc-head h3');
    const title = h3?.textContent.trim().toUpperCase() || '';
    return title === 'CONCRETE, WOOD & OUTDOOR SURFACES' || title === 'CONCRETE';
  });
  const woodSurfaceAcc = document.querySelector('#estimate .acc[data-live-split="wood"]');
  if (combinedSurfaceAcc && woodSurfaceAcc) {
    [...woodSurfaceAcc.querySelectorAll(':scope > .opt')].forEach((opt) => combinedSurfaceAcc.appendChild(opt));
    woodSurfaceAcc.remove();
  }
  if (combinedSurfaceAcc) {
    const h3 = combinedSurfaceAcc.querySelector('.acc-head h3');
    const desc = combinedSurfaceAcc.querySelector('.acc-head p');
    if (h3) h3.textContent = 'CONCRETE, WOOD & OUTDOOR SURFACES';
    if (desc) desc.textContent = 'Enter square feet for flat surfaces, decks, and every fence side being cleaned.';
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
