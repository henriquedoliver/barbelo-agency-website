/* Divide texto em palavras ou letras, cada uma dentro de uma "máscara" (overflow hidden),
   para o texto subir de dentro da máscara (só transform, sem desfoque).
   Acessibilidade: o texto original fica num span só para leitores de tela; as peças visuais ficam aria-hidden. */
(function () {
  'use strict';
  var BB = (window.BB = window.BB || {});

  function make(tag, cls) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    return e;
  }

  BB.split = function (el, mode) {
    if (el.__parts) { return el.__parts; }
    var original = el.textContent.replace(/\s+/g, ' ').trim();
    var parts = [];

    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) { return; }
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            var mask = make('span', 'w');
            mask.setAttribute('aria-hidden', 'true');
            if (mode === 'chars') {
              mask.classList.add('w--chars');
              Array.prototype.forEach.call(tok, function (ch) {
                var c = make('span', 'c');
                c.textContent = ch;
                mask.appendChild(c);
                parts.push(c);
              });
            } else {
              var inner = make('span', 'w__in');
              inner.textContent = tok;
              mask.appendChild(inner);
              parts.push(inner);
            }
            frag.appendChild(mask);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    }

    walk(el);
    var sr = make('span', 'sr-only');
    sr.textContent = original;
    el.insertBefore(sr, el.firstChild);
    el.__parts = parts;
    el.classList.add('is-split');
    return parts;
  };
})();
