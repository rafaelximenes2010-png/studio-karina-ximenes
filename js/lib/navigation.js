// Marca entradas internas para o botão Voltar nunca sair do aplicativo em um acesso direto.
export function markEntry(event) {
  if (history.state?.studioEntry) return;
  history.replaceState({ ...history.state, studioEntry: true, studioParent: Boolean(event?.oldURL) }, '');
}

export function back(fallback = '#/') {
  if (history.state?.studioParent) history.back();
  else {
    const oldURL = location.href;
    history.replaceState({ studioEntry: true, studioParent: false }, '', fallback);
    window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
  }
}

export function visitStep(hash, quick) {
  const oldURL = location.href;
  history.pushState({ studioEntry: true, studioParent: true, quick }, '', hash);
  window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: location.href }));
}

// Um gesto vertical começa no topo. Campos, controles e o canvas mantêm seus gestos próprios.
export function enablePullBack() {
  let drag;
  function reset() {
    if (drag) drag.el.style.removeProperty('translate');
    drag = null;
  }
  document.addEventListener('touchstart', (event) => {
    reset();
    const target = event.target;
    if (event.touches.length !== 1 || target.closest('input, textarea, select, [contenteditable], button, a, .ed-stage, .chips, #lock, .ed-props, .ed-tools, .ed-pages')) return;
    const sheet = null; if (target.closest('.sheet')) return;
    const editor = document.body.classList.contains('editor-mode');
    if (!sheet && (document.querySelector('.sheet-backdrop') || !document.body.classList.contains('sub') || (editor && !target.closest('.ed-top')))) return;
    if ((sheet ? sheet.scrollTop : window.scrollY) > 1) return;
    const el = sheet || document.querySelector('#view');
    const control = null || document.querySelector(editor ? '#e-back' : '#btn-back');
    const point = event.touches[0];
    drag = { el, control, x: point.clientX, y: point.clientY, distance: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!drag) return;
    const point = event.touches[0];
    const dy = point.clientY - drag.y;
    const dx = Math.abs(point.clientX - drag.x);
    if (event.touches.length !== 1 || dy < -5 || dx > Math.max(12, dy) || !event.cancelable) return reset();
    if (dy < 6 && !drag.distance) return;
    event.preventDefault();
    drag.distance = Math.max(0, dy);
    drag.el.style.translate = '0 ' + Math.min(128, drag.distance * 0.65) + 'px';
  }, { passive: false });
  document.addEventListener('touchend', () => {
    const control = drag?.distance >= 85 && drag.control;
    reset();
    if (control?.isConnected) control.click();
  }, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
  window.addEventListener('hashchange', reset);
}
