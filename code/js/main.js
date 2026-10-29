/* Cena 01 (abertura). Mapa de movimentos: "0. Painel de planejamento/Mapa de animações.md", cena 01.
   Técnicas do WebHub: preloader por promessas com limite de 8 s, ScrollTrigger com scrub 1,
   immediateRender:false, ignoreMobileResize, um só canvas WebGL com plano B. */
(function () {
  'use strict';
  var BB = window.BB;
  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var params = new URLSearchParams(location.search);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var forceGL = params.get('gl') === 'force';          // só para teste: ignora a guarda de desempenho
  var isSmall = function () { return window.innerWidth < 700; };

  if (reduce) { root.classList.add('is-reduced'); }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- texto ---------- */
  BB.i18n.apply(document);
  var phraseEls = $$('.phrase');
  var phraseWords = phraseEls.map(function (p) { return BB.split(p, 'words'); });
  var brandChars = BB.split($('.hero__brand'), 'chars');
  var agencyChars = BB.split($('.hero__agency'), 'chars');

  /* ---------- rolagem suave ---------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  $$('[data-scroll-to]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if ((window.BB_TALK_URL || window.BB_CONTACT_EMAIL) && a.hasAttribute('data-contact')) { return; }   // com página (ou e-mail) definida, o link vai para ela
      var target = $(a.getAttribute('data-scroll-to'));
      if (!target) { return; }
      e.preventDefault();
      if (lenis) { lenis.scrollTo(target, { duration: 1.8 }); } else { target.scrollIntoView(); }
    });
  });

  BB.ctx = { root: root, reduce: reduce, fine: fine, lenis: lenis };

  /* ---------- campo de luz (WebGL) ---------- */
  var S = {
    introFold: 1, slideFold: 0, scrollFold: 0,
    rot: 0, scrollRot: 0, zoom: 2.7, scrollZoom: 0,
    bright: 0, scrollDim: 0, chroma: 1.9, seed: 0, ring: 16, mx: 0, my: 0, burst: 0,
    // (parâmetros antigos da textura procedural; o motor de imagens não os usa)
    cell: 4.8,           // densidade das manchas
    ember: 1,            // força do laranja-brasa das manchas
    cool: 0.55,          // quanto os veios puxam para azul/verde
    vein: 1,             // intensidade dos veios claros
    lift: 1              // claridade do fundo tinta
  };
  // deslocamento para esconder atrás da máscara (em % da própria altura); letras grandes precisam de mais
  var CHAR_OFF = 160, WORD_OFF = 130;
  BB.S = S;
  var gl = null, glDead = false, heroOn = true;

  function fallbackToPoster() { glDead = true; root.classList.add('no-gl'); }

  // ?gl=off mostra o plano B (imagem estática), para conferir como fica sem WebGL
  if (params.get('gl') !== 'off') {
    // um só efeito de fundo: caleidoscópio de espelhos com as duas imagens aprovadas (gl-kal.js)
    gl = BB.createKaleidoGL ? BB.createKaleidoGL($('#gl'), S, { scale: isSmall() ? 0.6 : 1, onLost: fallbackToPoster }) : null;
  }
  if (!gl) { fallbackToPoster(); }

  // a palavra da marca vira os estilhaços do caleidoscópio (textura gerada com a própria fonte)
  function buildWordCanvas() {
    var c = document.createElement('canvas');
    c.width = c.height = 1024;
    var g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // uma linha só, centrada: o espelho do caleidoscópio dobra a palavra ao meio e as letras correm pelas facetas
    g.font = '800 300px "Bricolage Grotesque", Arial, sans-serif';
    g.fillText('Barbelo', 512, 512 + 100);
    return c;
  }
  if (gl && document.fonts && document.fonts.load) {
    document.fonts.load('800 300px "Bricolage Grotesque"').then(function () {
      if (gl && !gl.lost) { gl.setWordTexture(buildWordCanvas()); if (reduce) { gl.draw(0); } }
    }).catch(function () { /* sem a fonte, o campo segue sem as letras */ });
  }

  // guarda de desempenho: se pesar, baixa a resolução; se ainda pesar, vira imagem estática
  var perf = { n: 0, sum: 0, last: 0, drops: 0 };
  function guard() {
    if (forceGL || !gl || glDead) { return; }
    var now = performance.now();
    if (perf.last) {
      var dt = now - perf.last;
      if (dt < 200) { perf.sum += dt; perf.n++; }
    }
    perf.last = now;
    if (perf.n >= 45) {
      var avg = perf.sum / perf.n;
      perf.n = 0; perf.sum = 0;
      if (avg > 40) {                                  // abaixo de 25 quadros por segundo
        if (perf.drops < 3) { perf.drops++; gl.setScale(gl.getScale() * 0.75); }
        else { fallbackToPoster(); }
      }
    }
  }
  gsap.ticker.add(function (time) {
    if (!gl || glDead || !heroOn || document.hidden || reduce) { perf.last = 0; return; }
    gl.draw(time);
    guard();
  });

  /* ---------- troca de frases ---------- */
  var ticks = $$('.tick');
  var DWELL = 5.6;
  var ringByPhrase = [16, 11, 24];
  var idx = 0, busy = false, tickTween = null, scrolled = false, introDone = false;

  function setActive(i) {
    phraseEls.forEach(function (p, k) {
      p.classList.toggle('is-active', k === i);
      p.setAttribute('aria-hidden', k === i ? 'false' : 'true');
    });
    ticks.forEach(function (t, k) {
      t.classList.toggle('is-active', k === i);
      t.setAttribute('aria-current', k === i ? 'true' : 'false');
      gsap.set($('i', t), { scaleX: k < i || (reduce && k === i) ? 1 : 0 });
    });
  }
  function killDwell() { if (tickTween) { tickTween.kill(); tickTween = null; } }
  function syncCycle() {
    if (!tickTween) { return; }
    var run = introDone && heroOn && !scrolled && !document.hidden;
    if (run) { tickTween.resume(); } else { tickTween.pause(); }
  }
  function startDwell() {
    killDwell();
    var fill = $('i', ticks[idx]);
    gsap.set(fill, { scaleX: 0 });
    tickTween = gsap.to(fill, {
      scaleX: 1, duration: DWELL, ease: 'none',
      onComplete: function () { goTo((idx + 1) % phraseEls.length); }
    });
    syncCycle();
  }
  function goTo(next) {
    if (busy || next === idx) { return; }
    busy = true; killDwell();
    var from = idx; idx = next;
    var tl = gsap.timeline({ onComplete: function () { busy = false; startDwell(); } });
    tl.to(phraseWords[from], { yPercent: -WORD_OFF, duration: 0.5, ease: 'power2.in', stagger: 0.025 }, 0)
      .to(S, { slideFold: 1, duration: 0.9, ease: 'power2.in' }, 0.1)
      .to(S, { seed: '+=4.3', ring: ringByPhrase[next], rot: '+=1.1', duration: 2.7, ease: 'sine.inOut' }, 0.1)
      .fromTo(S, { burst: 0 }, { burst: 1, duration: 1.5, ease: 'power2.out' }, 0.95)
      .add(function () { setActive(next); gsap.set(phraseWords[next], { yPercent: WORD_OFF }); }, 1.15)
      .to(S, { slideFold: 0, duration: 1.3, ease: 'power2.out' }, 1.4)
      .to(phraseWords[next], { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05 }, 1.6);
  }
  BB.goTo = goTo;
  ticks.forEach(function (t) {
    t.addEventListener('click', function () {
      var i = parseInt(t.getAttribute('data-i'), 10);
      if (reduce) { idx = i; setActive(i); return; }
      if (introDone) { goTo(i); }
    });
  });
  document.addEventListener('visibilitychange', syncCycle);

  /* ---------- hero: visibilidade e saída pela rolagem ---------- */
  var hero = $('.hero');
  ScrollTrigger.create({
    trigger: hero, start: 'top bottom', end: 'bottom top',
    onToggle: function (self) { heroOn = self.isActive; syncCycle(); }
  });
  if (!reduce) {
    var exit = gsap.timeline({
      scrollTrigger: {
        trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 1,
        onUpdate: function (self) { scrolled = self.progress > 0.02; syncCycle(); }
      }
    });
    exit.fromTo(brandChars.concat(agencyChars), { yPercent: 0 },
        { yPercent: -CHAR_OFF, ease: 'power2.in', stagger: 0.025, duration: 0.45, immediateRender: false }, 0)
      .fromTo('#phrases', { yPercent: 0, opacity: 1 },
        { yPercent: -60, opacity: 0, ease: 'power1.in', duration: 0.35, immediateRender: false }, 0)
      .to('#ticks', { opacity: 0, duration: 0.2, immediateRender: false }, 0)
      .to(S, { scrollFold: 0.85, scrollZoom: 0.5, scrollRot: 0.7, scrollDim: 0.97, ease: 'none', duration: 1, immediateRender: false }, 0);
  }

  /* ---------- ponteiro desloca o centro do campo (só desktop) ---------- */
  if (fine && !reduce) {
    var qx = gsap.quickTo(S, 'mx', { duration: 1.4, ease: 'power3.out' });
    var qy = gsap.quickTo(S, 'my', { duration: 1.4, ease: 'power3.out' });
    window.addEventListener('pointermove', function (e) {
      qx((e.clientX / window.innerWidth - 0.5) * 2);
      qy(-(e.clientY / window.innerHeight - 0.5) * 2);
    }, { passive: true });
  }

  /* ---------- redimensionar (ignora a barra do Safari: mudança só de altura) ---------- */
  var lastW = window.innerWidth, lastH = window.innerHeight, rt;
  window.addEventListener('resize', function () {
    var dw = Math.abs(window.innerWidth - lastW), dh = Math.abs(window.innerHeight - lastH);
    if (dw === 0 && dh < 120 && !fine) { return; }
    clearTimeout(rt);
    rt = setTimeout(function () {
      lastW = window.innerWidth; lastH = window.innerHeight;
      if (gl) { gl.resize(); if (reduce) { gl.draw(0); } }
      ScrollTrigger.refresh();
    }, 200);
  });

  /* ---------- abertura ---------- */
  var loader = $('#loader'), dot = $('#dot'), drops = $$('.loader__drop'), count = $('#count'), nav = $('#nav');

  /* escolha do idioma na entrada (pedido do Henrique, 20/10): o site só abre depois do clique em English, Português
     ou Español. Mesmo idioma da página: a abertura continua aqui. Outro idioma: vai para /pt/ ou /es/ (ou a raiz),
     que não pergunta de novo nesta visita (sessionStorage "bb-lang"). */
  var langBox = $('#loaderLangs'), langLinks = $$('.loader__lang');
  var picked = !langBox;
  try { picked = picked || !!sessionStorage.getItem('bb-lang'); } catch (e) { /* sem armazenamento: pergunta sempre */ }
  function onPick(same) {
    var chosen = false;
    langLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (chosen) { return; }
        chosen = true;
        var code = a.getAttribute('data-lang'), href = a.href;
        try { sessionStorage.setItem('bb-lang', code); } catch (err) { /* ok */ }
        if (code === BB.i18n.lang) { same(a); return; }
        if (reduce) { location.href = href; return; }
        gsap.to(langBox, { autoAlpha: 0, duration: 0.3, ease: 'power1.in', onComplete: function () { location.href = href; } });
      });
    });
  }

  // versão parada (menos movimento): tudo já no lugar
  if (reduce) {
    S.introFold = 0; S.bright = 1; S.zoom = 1;
    if (gl) { gl.draw(0); }
    setActive(0);
    root.classList.add('is-ready');
    if (picked) {
      loader.classList.add('is-done');
      root.classList.remove('is-loading');
      return;
    }
    loader.classList.add('is-choosing');
    onPick(function () {
      loader.classList.add('is-done');
      root.classList.remove('is-loading');
    });
    return;
  }

  var seen = false;
  try { seen = sessionStorage.getItem('bb-intro') === '1'; } catch (e) { /* sem armazenamento: tudo bem */ }
  var speed = seen ? 2.2 : 1;
  if (params.get('intro') === 'fast') { speed = 4; }

  setActive(0);
  gsap.set(brandChars.concat(agencyChars), { yPercent: CHAR_OFF });
  gsap.set(phraseWords[0], { yPercent: WORD_OFF });
  gsap.set('#ticks', { opacity: 0 });
  if (gl) { gl.draw(0); }                              // compila o shader antes de precisar dele
  root.classList.add('is-ready');

  var cnt = { v: 0 }, lastN = -1;
  function paint() {
    var n = Math.round(cnt.v);
    if (n !== lastN) { lastN = n; count.textContent = ('00' + n).slice(-3); }
  }

  var wobble = gsap.timeline({ repeat: -1, yoyo: true, paused: true })
    .to(dot, { borderRadius: '56% 44% 48% 52% / 46% 58% 42% 54%', scaleX: 1.14, scaleY: 0.9, rotation: 18, duration: 0.9, ease: 'sine.inOut' })
    .to(dot, { borderRadius: '47% 53% 58% 42% / 56% 44% 56% 44%', scaleX: 0.92, scaleY: 1.12, rotation: -14, duration: 0.9, ease: 'sine.inOut' });
  var dropsTl = gsap.timeline({ repeat: -1, repeatDelay: 0.25, paused: true })
    .to(drops[0], { x: -30, y: -18, duration: 0.9, ease: 'power2.out' }, 0)
    .to(drops[0], { x: 0, y: 0, duration: 0.7, ease: 'power2.in' })
    .to(drops[1], { x: 26, y: 20, duration: 1.0, ease: 'power2.out' }, 0.35)
    .to(drops[1], { x: 0, y: 0, duration: 0.7, ease: 'power2.in' });

  // espera por promessas: fontes e load, com limite de 8 s (WebHub §9.5)
  var fontsReady = Promise.all([
    document.fonts.load('800 100px "Bricolage Grotesque"'),
    document.fonts.load('600 24px "Bricolage Grotesque"'),
    document.fonts.load('400 16px "Geist"')
  ]).catch(function () {});
  var loaded = new Promise(function (res) {
    if (document.readyState === 'complete') { res(); } else { window.addEventListener('load', res, { once: true }); }
  });
  var ready = Promise.race([
    Promise.all([fontsReady, loaded]),
    new Promise(function (res) { setTimeout(res, 8000); })
  ]);

  var partA = gsap.timeline({ onComplete: function () { ready.then(askLang); } });
  partA.timeScale(speed);
  partA.fromTo(dot, { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' }, 0)
    .add(function () { wobble.play(); dropsTl.play(); }, 0.6)
    .to(cnt, { v: 92, duration: 1.8, ease: 'power2.out', onUpdate: paint }, 0.2);

  function askLang() {
    if (picked) { partB(); return; }
    gsap.to(cnt, { v: 100, duration: 0.5, ease: 'power2.out', onUpdate: paint });
    gsap.set(langBox, { autoAlpha: 1 });
    gsap.fromTo(langLinks, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 });
    onPick(function (a) {
      gsap.to(langLinks.filter(function (x) { return x !== a; }), { autoAlpha: 0, duration: 0.3, ease: 'power1.in' });
      gsap.to(a, { autoAlpha: 0, duration: 0.35, delay: 0.2, ease: 'power1.in', onComplete: function () { langBox.style.display = 'none'; partB(); } });
    });
  }

  function partB() {
    wobble.kill(); dropsTl.kill();
    var diag = Math.hypot(window.innerWidth, window.innerHeight);
    var ratio = (diag / 18) * 1.15;
    var b = gsap.timeline({ onComplete: finish });
    b.timeScale(speed);
    b.to(cnt, { v: 100, duration: 0.3, ease: 'none', onUpdate: paint }, 0)
      .to(dot, { scale: ratio, rotation: 0, borderRadius: '50%', duration: 1.0, ease: 'expo.in' }, 0.3)
      .to(drops, { opacity: 0, duration: 0.2 }, 0.3)
      .to(count, { opacity: 0, y: -12, duration: 0.4, ease: 'power2.in' }, 0.3)
      .add(function () { loader.style.background = 'transparent'; }, 1.3)
      .to(dot, { opacity: 0, duration: 0.9, ease: 'power1.out' }, 1.3)
      .to(S, { bright: 1, duration: 1.1, ease: 'power2.out' }, 1.3)
      .to(S, { introFold: 0, duration: 3.4, ease: 'power4.inOut' }, 1.4)
      .to(S, { zoom: 1, duration: 3.4, ease: 'power3.out' }, 1.3)
      .to(S, { rot: '+=5.2', duration: 4.2, ease: 'power3.out' }, 1.3)
      .to(S, { chroma: 1, duration: 3.6, ease: 'power2.out' }, 1.4)
      .fromTo(S, { burst: 0 }, { burst: 1, duration: 1.7, ease: 'power2.out' }, 1.3)
      .fromTo(S, { burst: 0 }, { burst: 1, duration: 1.5, ease: 'power2.out' }, 2.5)
      .to(brandChars, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 2.4)
      .to(agencyChars, { yPercent: 0, duration: 1.0, ease: 'expo.out', stagger: 0.05 }, 2.75)
      .to(phraseWords[0], { yPercent: 0, duration: 1.0, ease: 'expo.out', stagger: 0.05 }, 3.0)
      .to(nav, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, 3.2)
      .to('#ticks', { opacity: 1, duration: 0.6 }, 3.4);
  }

  function finish() {
    loader.classList.add('is-done');
    introDone = true;
    root.classList.remove('is-loading');
    if (lenis) { lenis.start(); }
    try { sessionStorage.setItem('bb-intro', '1'); } catch (e) { /* ok */ }
    ScrollTrigger.refresh();
    startDwell();
  }
})();
