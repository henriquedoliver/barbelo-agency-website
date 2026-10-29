/* Caleidoscópio por IMAGENS: o fundo da abertura. As imagens são as duas aprovadas (brasa e cristais).
   Mesma interface de BB.createHeroGL (draw, resize, setScale, getScale, setWordTexture, lost), então o resto do site não muda.
   Referência de comportamento: OKKAPI (uma imagem em tela cheia se dobra em facetas espelhadas, gira e se abre na imagem seguinte).
   Como funciona:
   - as imagens (assets/caleidoscopio/*.webp) viram texturas; o shader as reflete num ladrilho de triângulos
     equiláteros espelhados (grupo p3m1): cada emenda é um espelho de verdade, a imagem continua sem corte;
   - movimento: a rede gira e desliza devagar; a janela passeia pela imagem em sentido contrário; o domínio ondula;
   - transições (troca de frase): as facetas se fecham (triângulos menores) e giram, a nova imagem abre do centro
     para fora em íris, com uma onda de luz pálida nas emendas; depois as facetas voltam a abrir;
   - a cor vem das imagens (azul-aço escuro, laranja só em toques); sombra embaixo e à esquerda protege a marca e a frase.
   O estado vem do objeto S (main.js): introFold, slideFold, scrollFold, rot, scrollRot, zoom, scrollZoom, bright,
   scrollDim, seed (cada +4,3 troca a imagem), burst, mx, my. */
(function () {
  'use strict';
  var BB = (window.BB = window.BB || {});
  var SCRIPT = document.currentScript && document.currentScript.src;
  var IMAGES = ['tex-brasa.webp', 'tex-cristais.webp'];   // as duas imagens aprovadas pelo Henrique (fotos IMG_2976 e IMG_2971)

  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes,uMouse;',
    'uniform float uTime,uFold,uRot,uZoom,uBright,uDim,uSeed,uBurst,uMix;',
    'uniform sampler2D uA,uB;',

    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',

    // textura amostrada em espelho (nunca mostra emenda na borda da imagem)
    'float mir(float x){x=mod(x,2.0);return 1.0-abs(1.0-x);}',
    'vec2 mir2(vec2 u){return vec2(mir(u.x),mir(u.y));}',

    // ladrilho de triângulos espelhados: reduz pela rede hexagonal e dobra com os 3 espelhos do vértice
    'vec2 triFold(vec2 p,float s,out float edge,out float tone,out vec2 cell){',
    '  float h=0.8660254*s;',
    '  vec2 b1=vec2(1.5*s,h),b2=vec2(0.0,2.0*h);',
    '  float x=p.x/(1.5*s);',
    '  float y=(p.y-x*h)/(2.0*h);',
    '  vec2 fl=floor(vec2(x,y));',
    '  vec2 best=fl;float bd=1e9;',
    '  for(int i=0;i<2;i++){for(int j=0;j<2;j++){',
    '    vec2 c=fl+vec2(float(i),float(j));',
    '    vec2 cp=c.x*b1+c.y*b2;',
    '    float d=dot(p-cp,p-cp);',
    '    if(d<bd){bd=d;best=c;}',
    '  }}',
    '  vec2 q=p-(best.x*b1+best.y*b2);',
    '  float r=length(q);',
    '  float araw=atan(q.y,q.x);',
    '  float par=mod(floor(araw/1.0471975),2.0);',          // faceta espelhada ou não: brilho levemente diferente
    '  float a=abs(mod(araw,2.0943951)-1.04719755);',
    '  q=r*vec2(cos(a),sin(a));',
    '  float d1=q.y;',
    '  float d2=abs(q.x*0.8660254-q.y*0.5);',
    '  float d3=abs((q.x-s)*0.8660254+q.y*0.5);',
    '  edge=min(d1,min(d2,d3));',
    '  tone=par*0.07+hash(best+3.7)*0.12+0.035*sin(uTime*0.45+hash(best+1.3)*6.2831);',   // reflexo lento: cada faceta de vidro brilha em seu tempo
    '  cell=best;',
    '  return q;',
    '}',

    // ---------- COREOGRAFIA CONTÍNUA ----------
    // Um caleidoscópio de verdade nunca para: os espelhos giram (com velocidade que varia), a imagem gira ao contrário
    // por baixo deles (como girar o tubo), as células respiram, e em ciclos de períodos diferentes (para nunca repetir
    // igual) ele DOBRA (espelhos se fecham e reabrem, com vórtice), QUEBRA (o vidro estilhaça em cacos, que giram,
    // deslocam e deixam a outra imagem aparecer, e depois se recompõe) e vira MULTIVERSO (um segundo caleidoscópio,
    // 2,6x maior e girando ao contrário, atravessa o primeiro em dupla exposição). Tudo com a mesma imagem aprovada.
    'float bump(float ph,float a,float b){return smoothstep(0.0,a,ph)*(1.0-smoothstep(a,b,ph));}',
    'void main(){',
    '  float m=sqrt(uRes.x*uRes.y);',
    '  vec2 uv0=gl_FragCoord.xy/uRes;',
    '  vec2 p=(gl_FragCoord.xy-0.5*uRes)/m;',
    '  p.y-=0.03; p+=uMouse*0.02;',
    '  float t=uTime;',
    '  float r0=length(p);',
    '  float foldA=bump(fract(t/7.3),0.10,0.30);',                // dobra a cada 7,3 s (2,2 s)
    '  float shat=bump(fract(t/11.1+0.37),0.025,0.17);',          // quebra a cada 11,1 s (ataque seco, 1,6 s para recompor)
    '  float multi=bump(fract(t/17.9+0.61),0.12,0.30);',          // multiverso a cada 17,9 s (5,4 s)
    '  float fo=max(uFold*uFold*(3.0-2.0*uFold),foldA);',          // a troca de frase e a rolagem também dobram
    '  float cellB=1.0+0.32*sin(t*0.31);',                         // células respiram (20 s)
    '  float s=0.095*cellB*mix(1.0,0.45,fo)*(1.0+0.16*(uZoom-1.0));',
    '  float ga=uRot+0.06*t+0.30*sin(t*0.23);',                   // espelhos giram; a velocidade sobe e desce
    '  p=mat2(cos(ga),-sin(ga),sin(ga),cos(ga))*p;',
    '  float tw=fo*1.1*(1.0-smoothstep(0.0,0.95,r0));',           // vórtice no centro enquanto dobra
    '  p=mat2(cos(tw),-sin(tw),sin(tw),cos(tw))*p;',
    '  p*=1.0-0.18*fo;',                                          // dobrando, aproxima
    '  p+=0.06*vec2(sin(t*0.07+uSeed),cos(t*0.057+uSeed*1.3));',
    '  float edge,tone; vec2 cell;',
    '  vec2 q=triFold(p,s,edge,tone,cell);',
    // quebra: cada caco gira e desloca um pouco; a continuidade dos espelhos se perde e volta
    '  float hc=hash(cell+1.7),hc2=hash(cell+5.3);',
    '  float ang=(hc-0.5)*1.6*shat;',
    '  q=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*q+(vec2(hc,hc2)-0.5)*0.08*shat;',
    // janela da imagem: gira ao contrário dos espelhos, passeia e ondula; cada célula mostra sempre o mesmo recorte
    '  float gb=-uRot*0.6-0.16*t-0.5*sin(t*0.17);',
    '  vec2 dr=vec2(sin(t*0.13+uSeed*0.7),cos(t*0.11+uSeed*0.5))*0.30;',
    '  vec2 w=vec2(noise(q*3.1+t*0.12+uSeed),noise(q*3.1+vec2(5.2,1.3)-t*0.10))-0.5;',
    '  float ring=smoothstep(0.17,0.0,abs(r0-uBurst*1.5))*(1.0-uBurst);',
    '  float win=0.435/s;',
    '  mat2 RB=mat2(cos(gb),-sin(gb),sin(gb),cos(gb));',
    '  vec2 uv=vec2(0.5)+dr+RB*q*win+w*0.045+normalize(p+1e-4)*ring*0.03;',
    // troca de frase: íris do centro para fora; quebra: os cacos deixam a outra imagem aparecer
    '  float reveal=smoothstep(0.0,1.0,clamp(uMix*2.0-r0*0.9,0.0,1.0));',
    '  float mixB=max(reveal,step(hc2,shat*0.9));',
    '  vec3 ca=texture2D(uA,mir2(uv)).rgb;',
    '  vec3 cb=texture2D(uB,mir2(uv+vec2(0.31,0.17))).rgb;',
    '  vec3 col=mix(ca,cb,mixB);',
    // multiverso: segundo caleidoscópio, maior, girando ao contrário, em dupla exposição
    '  if(multi>0.001){',
    '    float e2,t2; vec2 c2;',
    '    float gm=-1.4*ga;',
    '    vec2 p2=mat2(cos(gm),-sin(gm),sin(gm),cos(gm))*p;',
    '    vec2 q2=triFold(p2,s*2.6,e2,t2,c2);',
    '    vec2 uv2=vec2(0.5)-dr.yx+RB*q2*(win/2.6);',
    '    vec3 col2=mix(texture2D(uA,mir2(uv2)).rgb,texture2D(uB,mir2(uv2+vec2(0.31,0.17))).rgb,reveal);',
    '    col=mix(col,max(col,col2),multi*0.85);',
    '    edge=min(edge,mix(1.0,e2,multi));',
    '  }',
    // vidro: cunhas alternadas com brilho um pouco diferente; bisel escuro e fio claro na emenda (brilham na dobra e na quebra)
    '  float flash=1.0+1.5*max(fo,shat);',
    '  col*=0.93+tone;',
    '  col*=1.0-smoothstep(0.02,0.0,edge)*0.18;',
    '  col+=vec3(0.50,0.66,0.74)*smoothstep(0.0028,0.0,edge)*0.22*flash;',
    '  col+=vec3(0.30,0.44,0.52)*ring*0.5;',
    '  col=pow(col,vec3(0.93));',
    '  col*=uBright*(1.0-uDim);',
    // a marca é a protagonista: bordas escuras, sombra embaixo (marca) e à esquerda (frase)
    '  col*=mix(1.0,0.60,smoothstep(0.25,1.15,length((uv0-0.5)*vec2(1.0,1.2))));',
    '  col*=mix(0.52,1.0,smoothstep(0.05,0.62,uv0.y));',
    '  col*=1.0-0.30*smoothstep(0.36,0.0,uv0.x)*smoothstep(0.34,0.52,uv0.y)*smoothstep(0.88,0.62,uv0.y);',
    '  col+=(hash(gl_FragCoord.xy+fract(uTime)*91.7)-0.5)*0.016*uBright;',
    '  col=max(col,vec3(0.039,0.039,0.043));',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s) || 'shader error'); }
    return s;
  }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  BB.createKaleidoGL = function (canvas, S, opt) {
    opt = opt || {};
    var gl;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch (e) { gl = null; }
    if (!gl) { return null; }

    var prog, u = {};
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { throw new Error('link error'); }
    } catch (err) {
      if (window.console) { console.warn('[hero-gl-kal]', err.message); }
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    ['uRes', 'uMouse', 'uTime', 'uFold', 'uRot', 'uZoom', 'uBright', 'uDim', 'uSeed', 'uBurst', 'uMix', 'uA', 'uB']
      .forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(u.uA, 0);
    gl.uniform1i(u.uB, 1);

    // texturas: começam escuras (1x1) e recebem a imagem quando ela chega
    var texs = IMAGES.map(function () {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    var loaded = 0, failed = 0;
    var api = { lost: false, ready: false };
    function pot(n) { return n > 0 && (n & (n - 1)) === 0; }
    IMAGES.forEach(function (name, i) {
      var img = new Image();
      img.onload = function () {
        try {
          gl.bindTexture(gl.TEXTURE_2D, texs[i]);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          if (pot(img.width) && pot(img.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          }
          loaded++;
          if (loaded === IMAGES.length) {
            api.ready = true;
            try { api.draw(api._t || 0); } catch (e) { /* o próximo quadro desenha */ }   // movimento reduzido não redesenha sozinho
          }
        } catch (e) { failed++; }
        if (failed === IMAGES.length && opt.onLost) { opt.onLost(); }
      };
      img.onerror = function () { failed++; if (failed === IMAGES.length && opt.onLost) { opt.onLost(); } };
      img.src = SCRIPT ? new URL('../assets/caleidoscopio/' + name, SCRIPT).href : 'assets/caleidoscopio/' + name;
    });

    var scale = opt.scale || 1;
    api.setWordTexture = function () { /* este caleidoscópio usa imagens; a palavra da marca fica só no HTML */ };

    var mw = 0, mh = 0;
    function measure() { mw = canvas.clientWidth; mh = canvas.clientHeight; }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
      var cw = Math.max(2, Math.round(mw * dpr)), ch = Math.max(2, Math.round(mh * dpr));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; gl.viewport(0, 0, cw, ch); }
    }
    api.resize = function () { measure(); size(); };
    api.getScale = function () { return scale; };
    api.setScale = function (s) { scale = Math.max(0.3, s); size(); };

    var N = IMAGES.length;
    api.draw = function (timeSec) {
      if (api.lost) { return; }
      api._t = timeSec;
      var pulse = Math.max(S.introFold, S.slideFold, S.scrollFold);
      // cada +4,3 em S.seed (a cada troca de frase) passa para a imagem seguinte; a íris abre no meio do movimento
      var k = S.seed / 4.3 + 1e-4, i = Math.floor(k), f = Math.max(0, k - i);
      var ia = ((i % N) + N) % N, ib = (ia + 1) % N;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texs[ia]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texs[ib]);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform2f(u.uMouse, S.mx, S.my);
      gl.uniform1f(u.uTime, timeSec % 3600);
      gl.uniform1f(u.uFold, pulse);
      gl.uniform1f(u.uRot, S.rot + S.scrollRot);
      gl.uniform1f(u.uZoom, S.zoom + S.scrollZoom);
      gl.uniform1f(u.uBright, S.bright);
      gl.uniform1f(u.uDim, S.scrollDim);
      gl.uniform1f(u.uSeed, S.seed);
      gl.uniform1f(u.uBurst, S.burst || 0);
      gl.uniform1f(u.uMix, smooth(0.30, 0.70, f));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      api.lost = true;
      if (opt.onLost) { opt.onLost(); }
    });

    measure();
    size();
    return api;
  };
})();
