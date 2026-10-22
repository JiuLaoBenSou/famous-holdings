// Classic, self-hosted bootstrap: runs before the asynchronous AdSense SDK.
// It only manages our outer container, never Google's creative or iframe.
(() => {
  if (window.__holdingsAdFramesRegistered) return;
  window.__holdingsAdFramesRegistered = true;
  let sdkFailed = false;
  const frames = () => document.querySelectorAll('.ad-slot:has(ins.adsbygoogle[data-ad-slot])');
  window.addEventListener('error', event => {
    if (event.target?.tagName !== 'SCRIPT' || !event.target.src.includes('/pagead/js/adsbygoogle.js')) return;
    sdkFailed = true;
    for (const frame of frames()) {
      if (frame.querySelector('ins').getAttribute('data-ad-status') !== 'filled') frame.hidden = true;
    }
  }, true);
  function mount() {
    for (const frame of frames()) {
      const ad = frame.querySelector('ins.adsbygoogle');
      if (sdkFailed || frame.dataset.adInitialized) continue;
      frame.dataset.adInitialized = 'true';
      const sync = () => {
        const status = ad.getAttribute('data-ad-status');
        if (status === 'unfilled') frame.hidden = true;
        else if (status === 'filled' || status === 'unfill-optimized') frame.hidden = false;
      };
      new MutationObserver(sync).observe(ad, {attributes: true, attributeFilter: ['data-ad-status']});
      // Google must be able to measure the responsive unit when requesting it.
      frame.hidden = false;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        frame.hidden = true;
      }
      sync();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
