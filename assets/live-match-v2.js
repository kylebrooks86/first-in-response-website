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
      .fire-footer-contact-grid{display:none!important}
      .fire-floating-estimate{display:grid!important;gap:2px!important;min-width:150px!important;text-align:left!important;padding:11px 15px!important}
      .fire-floating-estimate small{display:block;font-size:9px;letter-spacing:.16em;font-weight:800;opacity:.82}
      .fire-floating-estimate strong{display:block;font-size:13px;letter-spacing:.03em;font-weight:900}
      @media(min-width:980px){
        .desktop-nav{gap:17px!important}
        .desktop-nav a{font-size:12px!important}
        .header-call{font-size:12px!important;padding:9px 12px!important}
        .hero{min-height:960px!important;padding:110px 32px 90px!important}
        .hero .eyebrow-row,.hero .hero-inner,.hero .checks{max-width:700px!important;margin-left:auto!important;margin-right:auto!important}
        .hero .hero-inner{margin-top:28px!important}
        .hero .display{max-width:700px!important}
        .hero .lead{max-width:700px!important}
        .hero .hero-buttons{max-width:700px!important}
        #results .proof-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:24px!important}
        #results .beforeafter{height:667px!important}
        #estimate .max{max-width:1100px!important}
        #estimate .acc-head{min-height:104px!important;padding:22px 26px!important;align-items:center!important}
        #services .services{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:18px!important}
        #services .service{padding:24px!important;min-height:250px!important;border:1px solid #d9dde2!important;border-radius:4px!important;box-shadow:0 2px 8px rgba(0,0,0,.04)!important;background:#fff!important}
        #services .service h3{font-size:23px!important;line-height:1.15!important;margin:22px 0 10px!important}
        #services .service p{font-size:15px!important;line-height:1.55!important}
        #services .service .learn{font-size:14px!important;margin-top:14px!important}
        #reviews .reviews{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:28px!important}
        #reviews .review{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:8px 4px 24px!important;min-width:0!important}
        #reviews .quote{font-size:54px!important;line-height:.8!important;margin-bottom:10px!important;color:#d93934!important}
        #reviews .stars{font-size:18px!important;letter-spacing:1px!important;color:#e8a51b!important;margin-bottom:10px!important}
        #reviews .review p{font-size:16px!important;line-height:1.65!important;color:#34373d!important}
        #reviews .review b{font-size:15px!important}
        #reviews .review small{font-size:12px!important;margin-top:8px!important}
        .owner-photo{height:720px!important}
        .faq{gap:24px!important;margin-top:48px!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .faq details{padding:28px 40px!important;min-height:79px!important}
        .faq summary{font-size:20px!important;line-height:1.3!important}
        footer{padding:84px 48px 96px!important;display:grid!important;grid-template-columns:minmax(220px,1fr) minmax(280px,1fr) minmax(280px,1fr)!important;column-gap:56px!important;row-gap:18px!important;align-items:start!important}
        footer>.footer-logo{grid-column:1!important;grid-row:1!important;width:118px!important;margin:0 0 12px!important;justify-self:start!important}
        footer>.footer-center{grid-column:1!important;grid-row:2!important;text-align:left!important}
        footer>.footer-center strong{font-size:20px!important}
        footer>.footer-center p{font-size:14px!important;margin:8px 0 0!important}
        footer>.footer-cols{display:contents!important}
        footer>.footer-cols>div:first-child{grid-column:2!important;grid-row:1 / span 2!important}
        footer>.footer-cols>div:last-child{grid-column:3!important;grid-row:1 / span 2!important}
        footer>.footer-cols>div h3{margin-top:0!important;font-size:18px!important;color:#fff!important}
        footer>.footer-cols>div p,footer>.footer-cols>div a{font-size:14px!important;line-height:1.8!important}
        footer>.footer-cols>div a{display:block!important;margin:3px 0!important}
        footer>.footer-cols>div .footer-social{display:flex!important;gap:18px!important;flex-wrap:wrap!important;margin-top:18px!important}
        footer>.footer-cols>div .footer-social a{display:inline-block!important;margin:0!important}
        footer>.copyright{grid-column:1 / -1!important;grid-row:3!important;margin:30px 0 0!important;padding-top:20px!important;border-top:0!important;font-size:12px!important;color:#7f858d!important}
      }
      @media(max-width:979px){
        #services .services{grid-template-columns:1fr!important}
        #reviews .reviews{display:block!important}
        #reviews .review{margin-bottom:28px!important}
        footer{display:block!important}
        footer>.footer-logo{margin-left:auto!important;margin-right:auto!important}
        footer>.footer-center{text-align:center!important}
        footer>.footer-cols{display:block!important}
      }
    `;
    document.head.appendChild(style);
  }

  const ownerSection = document.querySelector('#meet-kyle');
  if (ownerSection) {
    const ownerKicker = ownerSection.querySelector('.kicker');
    if (ownerKicker && /meet the owner/i.test(ownerKicker.textContent || '')) ownerKicker.remove();
    const ownerHeading = ownerSection.querySelector('h2');
    if (ownerHeading) ownerHeading.textContent = 'Meet Kyle Brooks';
  }

  const faqSection = document.querySelector('#faq') || document.querySelector('.faq')?.closest('section');
  if (faqSection) {
    [...faqSection.querySelectorAll('summary')].forEach((summary) => {
      if (/first responder or military discounts/i.test(summary.textContent || '')) {
        summary.textContent = 'Do you offer first responder or veteran discounts?';
      }
    });
  }

  const desktopNav = document.querySelector('.desktop-nav');
  if (desktopNav) {
    desktopNav.innerHTML = `
      <a href="#services">Services</a>
      <a href="#estimate">Instant Estimate</a>
      <a href="#results">Results</a>
      <a href="#on-the-job">Recent Work</a>
      <a href="#reviews">Reviews</a>
      <a href="#meet-kyle">Meet Kyle</a>
      <a href="#faq">FAQs</a>
      <a href="#personal">Personalized Estimate</a>
    `;
  }

  const heroHeading = document.querySelector('.hero .display');
  if (heroHeading) {
    heroHeading.innerHTML = 'TULSA EXTERIOR<br>CLEANING WITH A FIRST-<br><span class="red">RESPONDER STANDARD.</span>';
  }

  const mobileBar = document.querySelector('.bottom');
  if (mobileBar) {
    let call = mobileBar.querySelector('a[href^="tel:"]');
    let text = mobileBar.querySelector('a[href^="sms:"]');
    let estimate = mobileBar.querySelector('.bottom-estimate');
    if (!estimate) {
      estimate = document.createElement('a');
      estimate.className = 'bottom-estimate';
      mobileBar.appendChild(estimate);
    }
    if (call) call.textContent = 'Call';
    if (text) text.textContent = 'Text photos';
    estimate.href = '#estimate';
    estimate.textContent = 'Estimate';
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

  const resultGrid = document.querySelector('#results .proof-grid');
  if (resultGrid) {
    const items = [
      ['House wash','assets/front-patio-before.jpg','assets/front-patio-after.jpg'],
      ['Full driveway cleaning','assets/driveway-before.jpg','assets/driveway-after.jpg'],
      ['Gutter channel cleaning','assets/recent-work/gutter-packed-debris.jpg','assets/recent-work/gutter-cleared-channel.jpg'],
      ['Stone fireplace cleaning','assets/recent-work/stone-fireplace-before.jpg','assets/recent-work/stone-fireplace-after.jpg'],
      ['Gutter brightening','assets/gutter-brightening-before.jpg','assets/gutter-brightening-after.jpg'],
      ['Exterior window cleaning','assets/window-before.jpg','assets/window-after.jpg']
    ];
    resultGrid.innerHTML = items.map(([title,before,after]) => `
      <article class="proof-card">
        <div class="beforeafter" data-pos="50">
          <img src="${before}" alt="${title} before">
          <img src="${after}" alt="${title} after">
          <span class="label before-label">BEFORE</span>
          <span class="label after-label">AFTER</span>
          <span class="divider" aria-hidden="true"></span>
          <span class="slider" aria-hidden="true">↔</span>
        </div>
        <div class="proof-caption"><b>${title}</b><small>COMPARE BEFORE AND AFTER</small></div>
      </article>
    `).join('');
  }

  const applySliderPosition = (wrap, pct) => {
    const value = Math.max(0, Math.min(100, pct));
    const after = wrap.querySelector('img:nth-child(2)');
    const divider = wrap.querySelector('.divider');
    const handle = wrap.querySelector('.slider');
    if (after) after.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
    if (divider) divider.style.left = `${value}%`;
    if (handle) handle.style.left = `${value}%`;
    wrap.dataset.pos = String(value);
  };

  document.querySelectorAll('.beforeafter').forEach((wrap) => {
    const handle = wrap.querySelector('.slider');
    if (!handle) return;
    const oldVisual = wrap.querySelector('.fire-slider-visual');
    if (oldVisual) oldVisual.remove();
    handle.textContent = '↔';
    handle.setAttribute('aria-hidden', 'true');
    applySliderPosition(wrap, Number(wrap.dataset.pos || 50));
    let dragging = false;
    const update = (event) => {
      const rect = wrap.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      applySliderPosition(wrap, ((clientX - rect.left) / rect.width) * 100);
    };
    wrap.addEventListener('pointerdown', (event) => {
      dragging = true;
      wrap.setPointerCapture?.(event.pointerId);
      update(event);
    });
    wrap.addEventListener('pointermove', (event) => {
      if (dragging) update(event);
    });
    wrap.addEventListener('pointerup', () => { dragging = false; });
    wrap.addEventListener('pointercancel', () => { dragging = false; });
  });

  const jobCards = [...document.querySelectorAll('.job-video')];
  if (jobCards.length > 1) {
    const parent = jobCards[0].parentElement;
    if (parent && jobCards.every((card) => card.parentElement === parent)) {
      parent.style.setProperty('display', 'grid', 'important');
      parent.style.setProperty('grid-template-columns', 'repeat(2,minmax(0,1fr))', 'important');
      parent.style.setProperty('gap', '24px', 'important');
    }
  }

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
  if (footer) {
    const extraGrid = footer.querySelector('.fire-footer-contact-grid');
    if (extraGrid) extraGrid.remove();
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
