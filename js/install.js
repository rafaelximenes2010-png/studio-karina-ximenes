// Página de instalação: detecta o aparelho, mostra o passo a passo certo e oferece o botão de instalar quando o sistema permite.
(function () {
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua);
  var isSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA/i.test(ua) && !inApp;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var show = function (id) { var el = document.getElementById(id); if (el) el.hidden = false; };
  if (standalone) show('done');
  if (isIOS) { show('ios'); if (!isSafari) show('notSafari'); }
  else if (isAndroid) show('android');
  else show('desktop');

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    ['installBtn', 'installBtnDesk'].forEach(function (id) { var b = document.getElementById(id); if (b) b.hidden = false; });
  });
  ['installBtn', 'installBtnDesk'].forEach(function (id) {
    var b = document.getElementById(id); if (!b) return;
    b.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.then(function () { deferred = null; b.hidden = true; }); });
  });
  window.addEventListener('appinstalled', function () { show('done'); });

  var url = location.origin + location.pathname;
  var msg = 'Studio Karina Ximenes — instale o app no celular: ' + url;
  document.getElementById('share').href = 'https://wa.me/?text=' + encodeURIComponent(msg);

  // service worker: necessário para o botão de instalar no Android e para funcionar offline
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
})();
