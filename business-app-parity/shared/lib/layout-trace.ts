export type LayoutFrame = { elapsedMs: number; scrollY: number; documentHeight: number; viewportHeight: number; visualViewportHeight: number; visualViewportOffsetTop: number; headerTop: number | null; lastCustomerTop: number | null };
export type LayoutTrace = { version: 1; reason: 'manual' | 'timeout' | 'hidden' | 'cancelled'; frames: LayoutFrame[]; events: { elapsedMs: number; kind: 'scroll' | 'resize' | 'visual-resize' | 'visual-scroll' }[] };

/** Geometry only: no record text, identity, URLs, network, or persistent storage. */
export function startLayoutTrace(onComplete: (trace: LayoutTrace) => void) {
  const started = performance.now(), frames: LayoutFrame[] = [], events: LayoutTrace['events'] = [];
  let active = true, raf = 0, lastSample = -Infinity;
  const elapsed = () => Math.round(performance.now() - started);
  const position = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().top ?? null;
  const record = (kind: LayoutTrace['events'][number]['kind']) => { if (active && events.length < 600) events.push({ elapsedMs: elapsed(), kind }); };
  const scroll = () => record('scroll'), resize = () => record('resize'), visualResize = () => record('visual-resize'), visualScroll = () => record('visual-scroll');
  const visual = window.visualViewport;
  const stop = (reason: LayoutTrace['reason'] = 'manual') => {
    if (!active) return;
    active = false; cancelAnimationFrame(raf); clearTimeout(timer);
    window.removeEventListener('scroll', scroll); window.removeEventListener('resize', resize);
    visual?.removeEventListener('resize', visualResize); visual?.removeEventListener('scroll', visualScroll);
    document.removeEventListener('visibilitychange', hidden);
    onComplete({ version: 1, reason, frames, events });
  };
  const hidden = () => { if (document.hidden) stop('hidden'); };
  const tick = (now: number) => {
    if (!active) return;
    if (now - lastSample >= 100 && frames.length < 201) {
      lastSample = now;
      frames.push({ elapsedMs: elapsed(), scrollY: window.scrollY, documentHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight, visualViewportHeight: visual?.height ?? window.innerHeight, visualViewportOffsetTop: visual?.offsetTop ?? 0, headerTop: position('.topbar'), lastCustomerTop: position('.customer-card:last-child') });
    }
    raf = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', resize, { passive: true });
  visual?.addEventListener('resize', visualResize, { passive: true }); visual?.addEventListener('scroll', visualScroll, { passive: true });
  document.addEventListener('visibilitychange', hidden);
  const timer = setTimeout(() => stop('timeout'), 20000);
  raf = requestAnimationFrame(tick);
  return stop;
}
