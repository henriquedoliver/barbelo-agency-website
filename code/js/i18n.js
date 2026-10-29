/* Aplica o dicionário (locales/*.js) aos elementos com data-i18n="chave".
   Idioma: a página define window.BB_LANG ("pt" em /pt/, "es" em /es/); sem isso, vale ?lang=xx e, por padrão, inglês.
   Chave que falta no idioma escolhido cai para o inglês. */
(function () {
  'use strict';
  var BB = (window.BB = window.BB || {});
  var locales = window.BB_LOCALES || {};
  var asked = String(window.BB_LANG || new URLSearchParams(location.search).get('lang') || 'en').toLowerCase();
  var lang = locales[asked] ? asked : 'en';
  var dict = {}, base = locales.en || {}, over = locales[lang] || {}, k;
  for (k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) { dict[k] = base[k]; } }
  for (k in over) { if (Object.prototype.hasOwnProperty.call(over, k)) { dict[k] = over[k]; } }

  document.documentElement.lang = { pt: 'pt-BR', es: 'es', en: 'en' }[lang] || lang;

  BB.i18n = {
    lang: lang,
    t: function (key) { return dict[key] != null ? dict[key] : key; },
    apply: function (scope) {
      var nodes = (scope || document).querySelectorAll('[data-i18n]');
      Array.prototype.forEach.call(nodes, function (el) {
        var key = el.getAttribute('data-i18n');
        if (dict[key] == null) { return; }
        el.textContent = dict[key];
      });
      // textos com marcação (<em>): o dicionário é nosso, então innerHTML é seguro aqui
      var rich = (scope || document).querySelectorAll('[data-i18n-html]');
      Array.prototype.forEach.call(rich, function (el) {
        var key = el.getAttribute('data-i18n-html');
        if (dict[key] != null) { el.innerHTML = dict[key]; }
      });
    }
  };
})();
