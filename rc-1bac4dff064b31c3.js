// Source-dialog chrome is shared; all dated record facts, sources and manual quotations remain in the HTML.
(() => {
  const mount = () => {
    if (!document.getElementById('source-dialog')) {
      document.body.insertAdjacentHTML('beforeend', '<dialog id="source-dialog" aria-labelledby="source-dialog-title"><button class="dialog-close" aria-label="Close source details">×</button><div id="source-dialog-content"></div></dialog>');
    }
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, {once: true});
})();
