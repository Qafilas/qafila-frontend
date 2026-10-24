/* Qafila — apply the saved theme before first paint (load in <head>). */
(function () {
  var t = null;
  try { t = localStorage.getItem('qafila_theme'); } catch (_) {}
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
