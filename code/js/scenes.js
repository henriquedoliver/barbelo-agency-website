/* Cenas 02 a 07. Mapa de movimentos: "0. Painel de planejamento/Mapa de animações.md".
   Ordem de criação dos ScrollTriggers = ordem da página (os pins dependem disso).
   Técnicas do WebHub: pin + scrub 1, containerAnimation para a trilha horizontal, invalidateOnRefresh. */
(function () {
  'use strict';
  var BB = window.BB;
  var C = BB.ctx || {};
  var reduce = !!C.reduce, fine = !!C.fine;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var nav = $('#nav');
  var WORD_OFF = 130;

  /* divide todo texto marcado (o que já foi dividido na abertura volta do cache) */
  $$('[data-split]').forEach(function (el) {
    BB.split(el, el.getAttribute('data-split') === 'chars' ? 'chars' : 'words');
  });

  /* palavras sobem da máscara quando o gatilho entra na tela (uma vez) */
  function reveal(parts, trigger, start, containerAnim, extra) {
    gsap.set(parts, { yPercent: WORD_OFF });
    if (extra) { gsap.set(extra, { opacity: 0, y: 18 }); }
    ScrollTrigger.create({
      trigger: trigger, start: start || 'top 80%', once: true, containerAnimation: containerAnim,
      onEnter: function () {
        gsap.to(parts, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 });
        if (extra) { gsap.to(extra, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.08, delay: 0.3 }); }
      }
    });
  }

  /* vídeo: reprodução automática, sem som, em laço, sem botão. Só carrega perto da tela; pausa ao sair.
     Se o navegador impedir, fica a imagem (poster). Com "menos movimento", fica só a imagem. */
  function setupVideos() {
    var vids = $$('video[data-src]');
    if (reduce || !('IntersectionObserver' in window)) { return; }
    var onScreen = [];
    function playIt(v) { var pr = v.play(); if (pr && pr.catch) { pr.catch(function () { /* bloqueado: o poster continua visível */ }); } }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target, k = onScreen.indexOf(v);
        if (e.isIntersecting) {
          if (!v.getAttribute('src')) { v.src = v.getAttribute('data-src'); v.load(); }
          if (v.hasAttribute('data-restart')) { return; }   // este só carrega aqui; quem manda tocar é o observador de baixo
          if (k < 0) { onScreen.push(v); }
          playIt(v);
        } else if (!v.hasAttribute('data-restart')) { if (k >= 0) { onScreen.splice(k, 1); } v.pause(); }
      });
    }, { rootMargin: '300px 300px 300px 300px', threshold: 0.01 });
    vids.forEach(function (v) { io.observe(v); });
    // vídeos "data-restart" (a página oficial do livro, do preloader ao fim): sempre recomeçam do início quando aparecem na tela
    var ioStart = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target, k = onScreen.indexOf(v);
        if (e.intersectionRatio >= 0.4 && !v._live) {
          v._live = true;
          try { v.currentTime = 0; } catch (x) { /* ainda sem metadados: já começa do zero */ }
          if (k < 0) { onScreen.push(v); }
          playIt(v);
        } else if (e.intersectionRatio < 0.05 && v._live) {
          v._live = false; if (k >= 0) { onScreen.splice(k, 1); } v.pause();
        }
      });
    }, { threshold: [0, 0.05, 0.4] });
    vids.forEach(function (v) { if (v.hasAttribute('data-restart')) { ioStart.observe(v); } });
    // Modo de Pouca Energia (iPhone) recusa o autoplay; um toque da pessoa libera os vídeos que estão na tela
    function retry() { onScreen.forEach(function (v) { if (v.paused && v.getAttribute('src')) { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } } }); }
    document.addEventListener('touchend', retry, { passive: true });
    document.addEventListener('click', retry, { passive: true });
  }
  setupVideos();

  /* ao vivo: o site oficial abre DENTRO do celular (só para sites que aceitam ser exibidos em outra página; hoje, o do livro).
     Toque ou clique: o celular vem um pouco para a frente, o site carrega ali dentro e a pessoa rola para cima e para baixo.
     Sai por: botão Fechar, Esc, tocar fora, rolar a página (a trilha anda para o lado) ou sair da tela. */
  function setupLive() {
    var lives = $$('.live');
    var bar = $('#liveBar'), barOpen = $('#liveOpen'), barClose = $('#liveClose');
    if (!lives.length || !bar) { return; }
    var cur = null, openY = 0, openAt = 0;
    function hostOf(live) { return live.closest('.project') || live.closest('.vpanel'); }
    function fit(live) {   // o site roda com 390 px de largura (versão de celular) e é reduzido para a tela do celular
      var screen = $('.phone__screen', live), fr = $('.live__frame', live);
      if (!fr) { return; }
      var w = screen.offsetWidth, h = screen.offsetHeight, W = 390;
      fr.style.width = W + 'px'; fr.style.height = Math.round(W * h / w) + 'px';
      fr.style.transform = 'scale(' + (w / W) + ')';
    }
    function open(live) {
      if (cur === live) { return; }
      if (cur) { close(cur); }
      var phone = $('.phone', live), screen = $('.phone__screen', live), url = live.getAttribute('data-live');
      // zoom: fixo (trilha) ou "fit" (faixa final) = o quanto couber no painel, levando o celular ao centro dele
      var z = parseFloat(live.getAttribute('data-zoom')) || 1.12, dx = 0, dy = 0, panel = live.closest('.vpanel');
      if (live.getAttribute('data-zoom') === 'fit' && panel) {
        var pr = phone.getBoundingClientRect(), rr = panel.getBoundingClientRect();
        z = Math.min(3.2, (rr.height * 0.84) / pr.height);
        dx = (rr.left + rr.width / 2) - (pr.left + pr.width / 2);
        dy = (rr.top + rr.height / 2) - (pr.top + pr.height / 2);
      }
      live.style.setProperty('--lz', z.toFixed(3)); live.style.setProperty('--lx', Math.round(dx) + 'px'); live.style.setProperty('--ly', Math.round(dy) + 'px');
      var fr = $('.live__frame', live);
      if (!fr) {
        fr = document.createElement('iframe');
        fr.className = 'live__frame';
        fr.title = live.getAttribute('data-title') + ' ' + BB.i18n.t('live.frame');
        fr.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
        fr.addEventListener('load', function () { fr.classList.add('is-ready'); var v = $('video', live); if (v) { v.pause(); } });
        screen.appendChild(fr);
        fit(live);
        fr.src = url;
      }
      live.classList.add('is-open');
      if (hostOf(live)) { hostOf(live).classList.add('has-live'); }
      barOpen.href = url; bar.hidden = false;
      cur = live; openY = window.scrollY; openAt = performance.now();
    }
    function close(live) {
      if (!live) { return; }
      live.classList.remove('is-open');
      if (hostOf(live)) { hostOf(live).classList.remove('has-live'); }
      var fr = $('.live__frame', live);
      if (fr) {
        fr.classList.remove('is-ready');
        setTimeout(function () { if (!live.classList.contains('is-open') && fr.parentNode) { fr.parentNode.removeChild(fr); } }, 800);
      }
      var v = $('video', live), r = live.getBoundingClientRect();
      if (v && v.getAttribute('src') && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth) {
        var pr = v.play(); if (pr && pr.catch) { pr.catch(function () {}); }
      }
      if (cur === live) { cur = null; bar.hidden = true; }
    }
    lives.forEach(function (live) { $('.live__hit', live).addEventListener('click', function () { open(live); }); });
    barClose.addEventListener('click', function () { close(cur); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) { close(cur); } });
    document.addEventListener('pointerdown', function (e) { if (cur && !cur.contains(e.target) && !bar.contains(e.target)) { close(cur); } }, true);
    window.addEventListener('scroll', function () {
      if (cur && performance.now() - openAt > 600 && Math.abs(window.scrollY - openY) > 90) { close(cur); }
    }, { passive: true });
    window.addEventListener('resize', function () { if (cur) { fit(cur); } });
    if ('IntersectionObserver' in window) {
      var ioLive = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (cur === e.target && e.intersectionRatio < 0.2) { close(cur); } });
      }, { threshold: [0, 0.2] });
      lives.forEach(function (live) { ioLive.observe(live); });
    }
  }
  setupLive();

  /* botão "ouvir a música": o vídeo do DJ tem som (a música do topo do site). Só um som por vez; ao sair da tela, volta mudo. */
  function soundLabel(btn, on) { btn.textContent = BB.i18n.t(on ? 'snd.off' : 'snd.on'); }
  $$('.sound').forEach(function (btn) {
    var v = document.getElementById(btn.getAttribute('data-sound-for'));
    if (!v) { return; }
    function off() { v.muted = true; btn.setAttribute('aria-pressed', 'false'); soundLabel(btn, false); }
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      if (!on) { off(); return; }
      $$('video').forEach(function (x) { x.muted = true; });
      v.muted = false;
      var pr = v.play();
      if (pr && pr.catch) { pr.catch(function () { off(); }); }
      btn.setAttribute('aria-pressed', 'true'); soundLabel(btn, true);
    });
    v.addEventListener('pause', off);
  });

  /* ================= CENAS 02 e 03: ponte + projetos ================= */
  var workSec = $('.work'), workPin = $('.work__pin'), track = $('.work__track'), bar = $('#workBar');
  var projs = $$('.project', track);
  // carrossel dos sites: rolagem lateral nativa (dedo, trackpad, setas, arrastar com o mouse).
  // Não prende a página: a rolagem para cima e para baixo continua o site (pedido do Henrique, 27/10).
  function maxX() { return Math.max(0, track.scrollWidth - track.clientWidth); }
  function onTrack() {
    var m = maxX(), x = track.scrollLeft, p = m ? x / m : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (reduce) { return; }
    var mid = track.clientWidth / 2;
    projs.forEach(function (proj) {
      // projeto em foco fica claro; os vizinhos, apagados (Koto). Paralaxe interna leve.
      var r = proj.getBoundingClientRect(), t = track.getBoundingClientRect();
      var off = (r.left - t.left + r.width / 2 - mid) / (t.width / 2 + r.width / 2);
      off = Math.max(-1, Math.min(1, off));
      $('.stage', proj).style.opacity = (1 - Math.abs(off) * 0.72).toFixed(3);
      $$('[data-depth]', proj).forEach(function (el) {
        el.style.transform = 'translateX(' + (-off * parseFloat(el.getAttribute('data-depth')) * proj.offsetWidth).toFixed(1) + 'px)';
      });
    });
  }
  // pontos de parada: o começo de cada painel (site ou fecho), limitado ao fim da trilha
  function stops() {
    var m = maxX(), base = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).paddingLeft) - track.scrollLeft;
    var list = Array.prototype.slice.call(track.children).map(function (el) { return Math.min(m, Math.max(0, Math.round(el.getBoundingClientRect().left - base))); });
    list.push(m);
    return list.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (x, y) { return x - y; });
  }
  function step(dir) {
    var x = track.scrollLeft, list = stops(), to = x;
    if (dir > 0) { for (var i = 0; i < list.length; i++) { if (list[i] > x + 8) { to = list[i]; break; } } }
    else { for (var j = list.length - 1; j >= 0; j--) { if (list[j] < x - 8) { to = list[j]; break; } } }
    track.scrollTo({ left: to, behavior: reduce ? 'auto' : 'smooth' });
  }
  // entrada: quando a seção aparece, os sites chegam da direita e seguem andando bem devagar, sozinhos,
  // até parar no fecho ("O próximo pode ser o seu"). Se a pessoa mexer, ele para e ela manda (pedido do Henrique, 27/10).
  var autoTw = null, autoDone = reduce;
  function stopAuto() {
    autoDone = true;
    if (autoTw) { autoTw.kill(); autoTw = null; }
    gsap.to(track, { x: 0, duration: 0.4, overwrite: true });
    track.classList.remove('is-auto');
  }
  if (!reduce && 'IntersectionObserver' in window) {
    gsap.set(track, { x: function () { return window.innerWidth * 0.7; } });
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting || autoDone) { return; }
      io.disconnect();
      track.scrollLeft = 0;
      track.classList.add('is-auto');
      gsap.to(track, { x: 0, duration: 2.2, ease: 'power2.out' });
      var pos = { x: 0 }, dist = maxX();
      autoTw = gsap.to(pos, {
        x: dist, delay: 0.6, duration: Math.min(24, Math.max(12, dist / 55)), ease: 'sine.inOut',
        onUpdate: function () { track.scrollLeft = pos.x; },
        onComplete: function () { autoTw = null; autoDone = true; track.classList.remove('is-auto'); }
      });
    }, { threshold: 0.3 });
    io.observe(workPin);   // observa a moldura (o trilho começa fora da tela, à direita)
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { track.addEventListener(ev, function () { if (!autoDone) { stopAuto(); } }, { passive: true }); });
    track.addEventListener('wheel', function (e) { if (!autoDone && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { stopAuto(); } }, { passive: true });
  }
  track.addEventListener('scroll', onTrack, { passive: true });
  window.addEventListener('resize', onTrack);
  track.setAttribute('tabindex', '0');
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  // arrastar com o mouse (no toque o navegador já faz sozinho)
  (function () {
    var down = false, moved = false, sx = 0, sl = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) { return; }
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) { return; }
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
      if (moved) { track.scrollLeft = sl - dx; }
    });
    window.addEventListener('pointerup', function () {
      if (!down) { return; }
      down = false;
      if (!moved) { return; }
      var x = track.scrollLeft, best = x, d = Infinity;
      stops().forEach(function (v) { if (Math.abs(v - x) < d) { d = Math.abs(v - x); best = v; } });
      track.classList.remove('is-drag');
      track.scrollTo({ left: best, behavior: 'smooth' });
    });
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
  })();
  // trackpad de lado sobre o carrossel: a rolagem suave da página não deve engolir o gesto
  track.setAttribute('data-lenis-prevent-wheel', '');
  track.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { return; }   // lateral: o carrossel anda sozinho
    e.preventDefault();                                          // vertical: continua a página
    if (BB.ctx.lenis) { BB.ctx.lenis.scrollTo(BB.ctx.lenis.targetScroll + e.deltaY * (e.deltaMode === 1 ? 32 : 1)); }
    else { window.scrollBy(0, e.deltaY); }
  }, { passive: false });
  onTrack();

  if (!reduce) {
    reveal(BB.split($('.work__title')), $('.work__intro'), 'top 70%', null, [$('.work__sub')]);
    projs.forEach(function (proj) {
      reveal(BB.split($('.project__title', proj)), workPin, 'top 75%', null, $$('.project__text, .project__link, .sound', proj));
    });
    reveal(BB.split($('.work__title--end')), workPin, 'top 75%', null, [$('.work__end .btn')]);

    ScrollTrigger.create({
      trigger: workSec, start: 'top bottom', end: 'bottom top',
      toggleClass: { targets: workSec, className: 'is-live' }
    });
  }

  /* ================= CENA 04: serviços (seção clara; a bolinha volta) ================= */
  var whatSec = $('.what'), whatPin = $('.what__pin');
  var whatCover = false, whatPast = false;
  function applyTheme() { nav.setAttribute('data-theme', (whatCover && !whatPast) ? 'light' : 'dark'); }

  if (!reduce) {
    var says = $$('.say'), n = says.length, ring = $('.what__ring'), dotEl = $('.what__dot');
    var lens = says.map(function (s) { return parseFloat(s.getAttribute('data-len') || '0.9'); });
    var total = lens.reduce(function (a, b) { return a + b; }, 0);
    function syncCover() { whatCover = gsap.getProperty(dotEl, 'scale') > 0.8; applyTheme(); }
    /* ENTRADA (pedido do Henrique, 29/10): a bolinha branca já nasce durante a chegada da seção, sem a tela inteira preta.
       Enquanto a seção sobe (topo na base da janela até o topo da janela) a bolinha fica no centro da tela, cresce até
       cobrir tudo e o primeiro texto já entra. Quando a seção trava, tudo isso já aconteceu. */
    var lead = says[0], leadWords = BB.split($('.say__title', lead)), leadSubs = $$('.say__sub', lead);
    gsap.set(lead, { autoAlpha: 0 });
    var pre = gsap.timeline({
      onUpdate: syncCover,
      scrollTrigger: { trigger: whatSec, start: 'top bottom', end: 'top top', scrub: 0.6, invalidateOnRefresh: true }
    });
    pre.fromTo(dotEl, { y: function () { return -window.innerHeight; } }, { y: 0, ease: 'none', duration: 1 }, 0)
      .fromTo(dotEl, { scale: 0 }, { scale: 1, ease: 'power2.in', duration: 0.6 }, 0.25)
      .fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.8)
      .set(lead, { autoAlpha: 1 }, 0.84)
      .fromTo(leadWords, { yPercent: WORD_OFF }, { yPercent: 0, duration: 0.14, stagger: 0.012, ease: 'power3.out' }, 0.84);
    if (leadSubs.length) {
      pre.fromTo(leadSubs, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.1, stagger: 0.04, ease: 'power2.out' }, 0.9);
    }

    var tl = gsap.timeline({
      // a cor da barra de navegação acompanha a bolinha real (a animação alcança a rolagem com atraso)
      onUpdate: syncCover,
      scrollTrigger: {
        trigger: whatPin, start: 'top top',
        end: function () { return '+=' + Math.round(window.innerHeight * (0.9 + total * 0.9)); },
        pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
    var T0 = 0, t = T0, lastStart = T0;
    says.forEach(function (s, i) {
      var len = lens[i], words = BB.split($('.say__title', s)), subs = $$('.say__sub', s);
      if (i > 0) {
        gsap.set(words, { yPercent: WORD_OFF });
        if (subs.length) { gsap.set(subs, { opacity: 0, y: 24 }); }
        gsap.set(s, { autoAlpha: 0 });
        tl.set(s, { autoAlpha: 1 }, t)
          .to(words, { yPercent: 0, duration: 0.35, stagger: 0.04, ease: 'power3.out' }, t + 0.02);
        if (subs.length) { tl.to(subs, { opacity: 1, y: 0, duration: 0.25, stagger: 0.2, ease: 'power2.out' }, t + 0.3); }
      }
      if (i < n - 1) {
        if (subs.length) { tl.to(subs, { opacity: 0, y: -16, duration: 0.2 }, t + len - 0.26); }
        tl.to(words, { yPercent: -WORD_OFF, duration: 0.25, stagger: 0.02, ease: 'power2.in' }, t + len - 0.24)
          .set(s, { autoAlpha: 0 }, t + len);
      }
      lastStart = t; t += len;
    });
    tl.to({}, { duration: 0.45 }, lastStart + 0.55);
    tl.fromTo('#ringBar', { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', duration: tl.duration() - T0 }, T0);

    ScrollTrigger.create({
      trigger: whatSec, start: 'bottom 70px',
      onEnter: function () { whatPast = true; applyTheme(); },
      onLeaveBack: function () { whatPast = false; applyTheme(); }
    });
  }

  /* ================= CENA 05: processo (a linha acende com a rolagem) =================
     Proposta aprovada pelo Henrique em 18/10. A rolagem move uma cabeça de luz ao longo da linha (posição "x", em px);
     tudo o mais é decidido por essa posição: trecho aceso, ponto de cada etapa, entrada dos textos e fechamento.
     Desktop: seção presa, linha horizontal, com pausa em cada etapa. Celular: linha vertical, sem prender a rolagem.
     Só transform e opacity; medidas lidas uma vez por refresh, nunca por quadro. */
  if (!reduce) {
    reveal(BB.split($('.process__title')), $('.process__title'), 'top 82%');
    var pSec = $('.process'), pSteps = $('#steps');
    var pEls = $$('.step', pSteps);
    var pNodes = pEls.map(function (st) { return $('.step__node', st); });
    var pH = pEls.map(function (st) { return BB.split($('h3', st)); });
    var pP = pEls.map(function (st) { return $('p', st); });
    var pFill = $('.process__fill'), pHead = $('.process__head'), pSweep = $('.process__sweep');
    var P = { vertical: false, L: 0, cs: [] };
    var pLit = -1, pDone = false, pFin = null;
    // desktop, em alturas de janela: respiro inicial, 4 trechos de 0,5 (0,4 andando + 0,1 parada), corrida até o fim, parada final
    var LEAD = 0.2, STEP = 0.5, MOVE = 0.8, RUN = 0.3, HOLD = 0.35;
    var TOT = LEAD + 4 * STEP + RUN + HOLD;

    function pShow(i, delay) {
      gsap.to(pH[i], { yPercent: 0, duration: 0.9, ease: 'expo.out', delay: delay, overwrite: true });
      gsap.to(pP[i], { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: delay + 0.15, overwrite: true });
    }
    function pHide(i) {
      gsap.to(pH[i], { yPercent: WORD_OFF, duration: 0.4, ease: 'power2.in', overwrite: true });
      gsap.to(pP[i], { opacity: 0, y: 14, duration: 0.3, ease: 'power1.in', overwrite: true });
    }
    // n = última etapa acesa (-1 = nenhuma). Se a pessoa pular etapas rolando rápido, os textos entram em cascata.
    function pSetLit(n) {
      if (n === pLit) { return; }
      var from = pLit, i;
      if (n > from) { for (i = from + 1; i <= n; i++) { pShow(i, (i - from - 1) * 0.14); } }
      else { for (i = from; i > n; i--) { pHide(i); } }
      pEls.forEach(function (st, k) { st.classList.toggle('is-on', k <= n); st.classList.toggle('is-now', k === n); });
      pLit = n;
    }
    // posição de um ponto da linha que o brilho de fechamento cobre: inverso do power2.inOut, para o pulso de cada ponto cair sob o brilho
    function invIO(f) { return f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2); }
    function pFinale() {
      var a = P.vertical ? 'y' : 'x', sw = P.vertical ? pSweep.offsetHeight : pSweep.offsetWidth, D = 1.05;
      var from = { opacity: 0 }, mv = { duration: D, ease: 'power2.inOut' };
      from[a] = -sw; mv[a] = P.L;
      gsap.set(pSweep, from);
      pFin = gsap.timeline();
      pFin.to(pSweep, mv, 0)
        .to(pSweep, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0)
        .to(pSweep, { opacity: 0, duration: 0.4, ease: 'power1.in' }, 0.65);
      pNodes.forEach(function (nd, i) {
        var f = Math.max(0, Math.min(1, (P.cs[i] + sw / 2) / (P.L + sw))), t = D * invIO(f);
        pFin.to(nd, { scale: 1.55, duration: 0.22, ease: 'power2.out' }, t - 0.1)
          .to(nd, { scale: 1, duration: 0.5, ease: 'power2.inOut' }, t + 0.12);
      });
    }
    function pSetDone(v) {
      if (v === pDone) { return; }
      pDone = v; pSteps.classList.toggle('is-done', v);
      if (v) { pFinale(); }
      else { if (pFin) { pFin.kill(); pFin = null; } gsap.set(pSweep, { opacity: 0 }); gsap.set(pNodes, { scale: 1 }); }
    }
    // volta tudo ao começo (textos escondidos, nada aceso): ao montar e ao trocar de tamanho de tela
    function pReset() {
      if (pFin) { pFin.kill(); pFin = null; }
      pEls.forEach(function (st, i) {
        gsap.killTweensOf(pH[i]); gsap.killTweensOf(pP[i]);
        st.classList.remove('is-on', 'is-now');
      });
      pSteps.classList.remove('is-done');
      pH.forEach(function (h) { gsap.set(h, { yPercent: WORD_OFF }); });
      gsap.set(pP, { opacity: 0, y: 14 });
      gsap.set(pNodes, { scale: 1 });
      gsap.set(pSweep, { opacity: 0 });
      pLit = -1; pDone = false;
    }

    function pBuild(vertical, pinned, startNat, endNat) {
      var L = 0, cs = [];
      var setHead = gsap.quickSetter(pHead, vertical ? 'y' : 'x', 'px');
      var setFill = gsap.quickSetter(pFill, vertical ? 'scaleY' : 'scaleX');
      var setHeadOp = gsap.quickSetter(pHead, 'opacity');
      var EIO = gsap.parseEase('power1.inOut'), EOUT = gsap.parseEase('power2.out');
      P.vertical = vertical;
      gsap.set(pFill, vertical ? { scaleX: 1, scaleY: 0 } : { scaleX: 0, scaleY: 1 });
      function measure() {
        L = vertical ? pSteps.offsetHeight : pSteps.offsetWidth;
        cs = pEls.map(function (st, i) {
          var nd = pNodes[i];
          return vertical ? st.offsetTop + nd.offsetTop + nd.offsetHeight / 2 : st.offsetLeft + nd.offsetLeft + nd.offsetWidth / 2;
        });
        P.L = L; P.cs = cs;
      }
      // progresso da rolagem (0 a 1) -> posição da cabeça de luz em px
      function pos(p) {
        if (!pinned) { return p * L; }
        var u = p * TOT;
        if (u <= LEAD) { return cs[0] * EIO(u / LEAD); }
        var k = (u - LEAD) / STEP;
        if (k < 4) { var i = Math.floor(k); return cs[i] + (cs[i + 1] - cs[i]) * EIO(Math.min(1, (k - i) / MOVE)); }
        var r = (u - LEAD - 4 * STEP) / RUN;
        return r < 1 ? cs[4] + (L - cs[4]) * EOUT(r) : L;
      }
      function render(p) {
        var x = pos(p), n = -1, i;
        setHead(x); setFill(L ? x / L : 0);
        setHeadOp(Math.max(0, Math.min(1, x / 24, (L - x) / 36)));
        // a etapa acende quando a cabeça chega (a primeira só no fim do respiro inicial, não antes)
        for (i = 0; i < cs.length; i++) { if (x >= cs[i] - (i === 0 ? 1.5 : 8)) { n = i; } }
        pSetLit(n);
        if (!pDone) { if (L && x >= L - 1) { pSetDone(true); } }
        else if (x < L - Math.max(24, (L - cs[cs.length - 1]) * 0.5)) { pSetDone(false); }
      }
      var prog = { v: 0 };
      gsap.to(prog, {
        v: 1, ease: 'none',
        onUpdate: function () { render(prog.v); },
        scrollTrigger: {
          trigger: pinned ? pSec : pSteps,
          start: pinned ? 'top top' : startNat,
          end: pinned ? function () { return '+=' + Math.round(window.innerHeight * TOT); } : endNat,
          pin: pinned, scrub: pinned ? 0.8 : 0.5, anticipatePin: 1, invalidateOnRefresh: true,
          onRefresh: function () { measure(); render(prog.v); }
        }
      });
      measure(); render(0);
    }

    var pmm = gsap.matchMedia();
    pmm.add('(min-width: 701px) and (min-height: 620px)', function () {
      pSec.classList.add('is-pinned'); pReset(); pBuild(false, true);
      return function () { pSec.classList.remove('is-pinned'); };
    });
    pmm.add('(min-width: 701px) and (max-height: 619px)', function () { pReset(); pBuild(false, false, 'top 85%', 'bottom 15%'); });
    pmm.add('(max-width: 700px)', function () { pReset(); pBuild(true, false, 'top 62%', 'bottom 62%'); });
  }

  /* ================= CENA 06: faixa de celulares (referência Moha) ================= */
  var voicesSec = $('.voices'), vPin = $('.voices__pin'), vTrack = $('#vTrack'), panels = $$('.vpanel');
  var centerPanel = null, cycleTimer = null;

  function cycle() {
    if (!centerPanel) { return; }
    $$('[data-cycle]', centerPanel).forEach(function (ph) {
      var layers = $$('.layer', ph);
      if (layers.length < 2) { return; }
      var cur = 0;
      layers.forEach(function (l, i) { if (l.classList.contains('is-on')) { cur = i; } });
      var next = (cur + 1) % layers.length;
      var veil = $('.phone__veil', ph);
      if (veil) { veil.classList.remove('is-flash'); void veil.offsetWidth; veil.classList.add('is-flash'); }
      layers[cur].classList.remove('is-on');
      layers[next].classList.add('is-on');
    });
  }
  function voicesLive(on) {
    voicesSec.classList.toggle('is-live', on);
    if (on && !cycleTimer) { cycleTimer = setInterval(cycle, 4200); }
    if (!on && cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
  }

  if (!reduce) {
    reveal(BB.split($('.voices__title')), vPin, 'top 70%');
    var vdist = function () { return Math.max(0, vTrack.scrollWidth - window.innerWidth); };
    // painel do centro de frente e maior; vizinhos se inclinam em 3D e a faixa se dobra em onda
    var tilt = function () {
      var x = gsap.getProperty(vTrack, 'x') || 0, vw = window.innerWidth, best = 0, bestA = 9;
      var maxTilt = vw < 700 ? 15 : 30;   // no celular a inclinação é menor
      panels.forEach(function (p, i) {
        var cx = p.offsetLeft + p.offsetWidth / 2 + x;
        var k = (cx - vw / 2) / (vw * 0.5);
        k = Math.max(-1.3, Math.min(1.3, k));
        var a = Math.min(Math.abs(k), 1);
        if (Math.abs(k) < bestA) { bestA = Math.abs(k); best = i; }
        p.style.transform = 'perspective(1500px) translate3d(0,' + (Math.sin(k * 1.7) * -2.6).toFixed(2) + 'svh,0) rotateY(' + (-k * maxTilt).toFixed(2) +
          'deg) rotateZ(' + (k * 1.8).toFixed(2) + 'deg) scale(' + (1 - a * 0.13).toFixed(3) + ')';
        p.style.opacity = (1 - a * 0.42).toFixed(3);
      });
      centerPanel = panels[best];
    };
    gsap.to(vTrack, {
      x: function () { return -vdist(); }, ease: 'none',
      scrollTrigger: {
        trigger: vPin, start: 'top top',
        end: function () { return '+=' + Math.round(vdist() * 1.25); },
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: tilt, onRefresh: tilt, onToggle: function (self) { voicesLive(self.isActive); }
      }
    });
    tilt();
  }

  /* ================= CENA 07: contato ================= */
  if (window.BB_TALK_URL) {
    $$('[data-contact]').forEach(function (a) { a.setAttribute('href', window.BB_TALK_URL); a.removeAttribute('data-scroll-to'); });
  } else if (window.BB_CONTACT_EMAIL) {
    $$('[data-contact]').forEach(function (a) { a.setAttribute('href', 'mailto:' + window.BB_CONTACT_EMAIL + '?subject=' + encodeURIComponent('Hello from the website')); a.removeAttribute('data-scroll-to'); });
  }
  var talk = $('#talk'), letters = [];
  var wordEl = $('#talkLetters');
  Array.prototype.forEach.call(BB.i18n.t('t.word'), function (ch) {
    var s = document.createElement('span');
    // O apóstrofo curvo (U+2019) é "em pé" em texto vertical: não gira com as letras e vira um traço deitado ("Let- s talk").
    // O reto (U+0027) gira junto e continua um apóstrofo. O espaço ganha largura própria (.lt--sp), senão "s talk" lê "stalk".
    s.className = ch === ' ' ? 'lt lt--sp' : 'lt';
    s.textContent = ch === ' ' ? '\u00a0' : (ch === '\u2019' || ch === '\u2018' ? "'" : ch);
    wordEl.appendChild(s);
    letters.push(s);
  });

  if (!reduce) {
    gsap.fromTo('.talk__dot', { scale: 0 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: talk, start: 'top bottom', end: 'top 12%', scrub: true }
    });
    reveal(BB.split($('.talk__title')), talk, 'top 40%', null, [$('.talk__sub')]);

    gsap.set(letters, { yPercent: 130, opacity: 0 });
    gsap.set('#talkCta', { y: 18, autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: talk, start: 'top 45%', once: true,
      onEnter: function () {
        gsap.to(letters, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05 });
        gsap.to('#talkCta', { y: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', delay: 0.5 });   // o botão entra depois da palavra
      }
    });

    // onda lenta em repouso (só com o rodapé na tela)
    var wave = gsap.timeline({ paused: true });
    letters.forEach(function (l, i) {
      wave.fromTo(l, { xPercent: -10 }, { xPercent: 10, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }, i * 0.18);
    });
    ScrollTrigger.create({
      trigger: talk, start: 'top 60%', end: 'bottom top',
      onToggle: function (self) { if (self.isActive) { wave.play(); } else { wave.pause(); } }
    });

    // o ponteiro empurra as letras próximas (só desktop)
    if (fine) {
      var setX = letters.map(function (l) { return gsap.quickTo(l, 'x', { duration: 0.5, ease: 'power3.out' }); });
      talk.addEventListener('pointermove', function (e) {
        letters.forEach(function (l, i) {
          var r = l.getBoundingClientRect();
          var d = Math.abs(e.clientY - (r.top + r.height / 2));
          var f = Math.max(0, 1 - d / 220);
          setX[i](-(f * f) * 46);
        });
      }, { passive: true });
      talk.addEventListener('pointerleave', function () { setX.forEach(function (fn) { fn(0); }); });
    }

    // a barra de navegação sai de cena sobre o bloco de contato
    ScrollTrigger.create({
      trigger: talk, start: 'top 55%',
      onEnter: function () { nav.classList.add('is-hidden'); },
      onLeaveBack: function () { nav.classList.remove('is-hidden'); }
    });
  }

  /* gravação ilustrativa: o relógio da tela anda enquanto a cena dos projetos está na tela */
  var rec = $('#recTime'), recSec = 12;
  if (rec && !reduce) {
    setInterval(function () {
      if (!workSec.classList.contains('is-live')) { return; }
      recSec++;
      var m = Math.floor(recSec / 60), s = recSec % 60;
      rec.textContent = '00:' + ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
    }, 1000);
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
