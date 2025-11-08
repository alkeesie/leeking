/* bandit.js — leek.ing banner bandit (v2.1, video-first) */
(() => {
  const EXPERIMENT = "vi_arcade_banner_test";
  const CLIENT_VERSION = "2024-05-20";

  const scriptEl = document.currentScript;
  const ROOT = (() => {
    if (!scriptEl) return "/";
    try {
      const url = new URL(scriptEl.src, location.href);
      const path = url.pathname.replace(/\/bandit\/bandit\.js.*$/, "/");
      if (!path || path === "") return "/";
      return path.endsWith("/") ? path : path + "/";
    } catch (err) {
      return "/";
    }
  })();

  const ROOT_URL = (() => {
    try {
      return new URL(ROOT, location.origin);
    } catch (err) {
      return new URL("/", location.origin);
    }
  })();

  function resolvePath(path) {
    if (!path) return "";
    const trimmed = String(path).trim();
    if (!trimmed) return "";
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed)) return trimmed; // absolute URL
    if (trimmed.startsWith("/")) return trimmed;
    if (trimmed.startsWith("./")) return resolvePath(trimmed.replace(/^\.\//, ""));
    try {
      return new URL(trimmed, ROOT_URL).pathname;
    } catch (err) {
      return (ROOT.endsWith("/") ? ROOT : ROOT + "/") + trimmed;
    }
  }

  const LOG_ENDPOINT = resolvePath("bandit/log.php");

  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[bandit] client ${CLIENT_VERSION} ready at`, ROOT_URL.pathname);
  }

  function isPlaceholderDest(value){
    if (!value) return false;
    try {
      const parsed = new URL(String(value), location.origin);
      return parsed.hostname.replace(/^www\./, '').toLowerCase() === 'vi-online-arcade.example';
    } catch (err) {
      return /vi-online-arcade\.example/i.test(String(value));
    }
  }

  // Arms use base path without extension (we'll resolve .png and .mp4)
  const DEFAULT_ARM_DEFS = [
    { id: 'control_static', label: 'Icons + Play Now (static)', srcBase: 'assets/banners/control_static' },
    { id: 'games_rock',    label: 'Our games ROCK!',           srcBase: 'assets/banners/games_rock' },
    { id: 'pac_click',     label: 'Pac-style Click to Play',   srcBase: 'assets/banners/pac_click' },
    { id: 'pink_replay',   label: 'Game Over / Play Again?',   srcBase: 'assets/banners/pink_replay' },
  ];

  const cleanSrcBase = base => (base || '').trim().replace(/\.(mp4|png)$/i, '');
  function normaliseArm(arm){
    if (!arm || !arm.id) return null;
    const srcBase = cleanSrcBase(arm.srcBase || arm.src);
    return { ...arm, srcBase };
  }

  const DEFAULT_ARMS = DEFAULT_ARM_DEFS.map(normaliseArm).filter(Boolean);

  // Persisted settings + helpers
  const sid = (() => {
    let s = localStorage.getItem('bandit_sid');
    if (!s) { s = (crypto.randomUUID?.() || String(Math.random()).slice(2)); localStorage.setItem('bandit_sid', s); }
    return s;
  })();
  function getArms(){
    try{
      const t=localStorage.getItem('bandit_arms');
      if(t){
        const j=JSON.parse(t);
        if(Array.isArray(j)&&j.length){
          const cleaned = j.map(normaliseArm).filter(Boolean);
          if (cleaned.length) return cleaned;
        }
      }
    }catch(err){}
    return DEFAULT_ARMS.map(arm => ({ ...arm }));
  }
  function getAlgo(){ const qp=new URL(location.href).searchParams.get('algo'); return (qp || localStorage.getItem('bandit_algo') || 'ts').toLowerCase(); }
  function getEps(){ const qp=new URL(location.href).searchParams.get('eps'); return parseFloat(qp || localStorage.getItem('bandit_eps') || '0.1') || 0.1; }
  function getWarmup(){ const qp=new URL(location.href).searchParams.get('wu'); return parseInt(qp || localStorage.getItem('bandit_warmup') || '0') || 0; }
  function motionEnabled(){
    const ls = localStorage.getItem('bandit_motion');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Default to motion ON when unset; always respect reduced-motion preference
    const want = (ls === null) ? true : (ls === 'true');
    return want && !reduce;
  }

  function postLog(evt, payload, useBeacon=false){
    const body = JSON.stringify({ ...payload, event: evt, session_id: sid });
    if (useBeacon && navigator.sendBeacon) { const blob=new Blob([body],{type:'application/json'}); navigator.sendBeacon(LOG_ENDPOINT, blob); return; }
    fetch(LOG_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body });
  }
  const rnd = n => Math.floor(Math.random()*n);

  // Local page state for UCB/TS behaviour
  let ARMS = getArms();
  const state = new Map(ARMS.map(a => [a.id, { n:0, w:0 }]));

  // Algorithms
  class EGreedy { constructor(eps=0.1){ this.eps=eps; } select(){ if(Math.random()<this.eps) return rnd(ARMS.length); let best=0,bm=-1; ARMS.forEach((a,i)=>{ const s=state.get(a.id), m=s.n? s.w/s.n : 0; if(m>bm){bm=m; best=i;} }); return best; } }
  class UCB1 { select(t){ for(let i=0;i<ARMS.length;i++){ if(state.get(ARMS[i].id).n===0) return i; } let best=0,bv=-1; ARMS.forEach((a,i)=>{ const s=state.get(a.id); const mu=s.w/s.n; const bonus=Math.sqrt(2*Math.log(Math.max(2,t))/s.n); const u=mu+bonus; if(u>bv){bv=u; best=i;} }); return best; } }
  function sampleGammaShapeGE1(k){ const d=k-1/3, c=1/Math.sqrt(9*d); for(;;){ let x,v; do{ x=(Math.random()*2-1); v=1+c*x; } while(v<=0); v=v*v*v; const u=Math.random(); if(u<1-0.0331*x*x*x*x) return d*v; if(Math.log(u)<0.5*x*x + d*(1 - v + Math.log(v))) return d*v; } }
  function gammaSample(shape){ if(shape===1) return -Math.log(Math.random()); if(shape>1) return sampleGammaShapeGE1(shape); const u=Math.random(); return gammaSample(1+shape)*Math.pow(u,1/shape); }
  function betaSample(a,b){ const x=gammaSample(a), y=gammaSample(b); return x/(x+y); }
  class Thompson { select(){ let best=0,bv=-1; ARMS.forEach((a,i)=>{ const s=state.get(a.id); const alpha=1+s.w, beta=1+(s.n-s.w); const draw=betaSample(alpha,beta); if(draw>bv){bv=draw; best=i;} }); return best; } }

  function mountAd(){
    const link = document.getElementById('banner-link');
    if (!link) return;

    while (link.firstChild) link.removeChild(link.firstChild);

    let currentMedia = null;
    function setMedia(el){
      if (currentMedia && currentMedia.parentNode === link) {
        link.removeChild(currentMedia);
      }
      currentMedia = el;
      if (el) link.appendChild(el);
    }

    function createImage(src, alt){
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.width = 728;
      img.height = 90;
      return img;
    }

    function createVideo(png, mp4){
      const vid = document.createElement('video');
      vid.width = 728;
      vid.height = 90;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      vid.autoplay = true;
      vid.setAttribute('playsinline', '');
      vid.setAttribute('muted', '');
      vid.setAttribute('autoplay', '');
      vid.poster = png;
      const source = document.createElement('source');
      source.src = mp4;
      source.type = 'video/mp4';
      vid.appendChild(source);
      return vid;
    }

    const algoName = getAlgo();
    const EPS = getEps();
    const WU  = getWarmup();
    let algo = (algoName==='ucb')? new UCB1() : (algoName==='eg'? new EGreedy(EPS) : new Thompson());

    const seen = parseInt(sessionStorage.getItem('bandit_seen')||'0');
    let idx = (seen < WU)? rnd(ARMS.length) : (()=>{ const last=sessionStorage.getItem('bandit_last'); let k=algo.select(seen); if(ARMS.length>1 && last && ARMS[k].id===last) k=(k+1)%ARMS.length; return k; })();
    const arm = ARMS[idx];

    const base = (arm.srcBase || '').replace(/\.(mp4|png)$/i, '');
    const png = resolvePath(base + '.png');
    const mp4 = resolvePath(base + '.mp4');
    const useMotion = motionEnabled();

    const storedDestRaw = (localStorage.getItem('bandit_dest') || '').trim();
    const defaultDest = resolvePath('/click.html') || '/click.html';
    let destination = defaultDest;
    if (storedDestRaw) {
      if (isPlaceholderDest(storedDestRaw)) {
        localStorage.removeItem('bandit_dest');
      } else {
        const resolvedDest = resolvePath(storedDestRaw);
        if (resolvedDest && !isPlaceholderDest(resolvedDest)) {
          destination = resolvedDest;
        }
      }
    }
    try {
      link.href = new URL(destination, location.origin).toString();
    } catch (err) {
      link.href = destination || defaultDest;
    }

    // Always set poster + img src (instant paint)
    const altText = arm.alt || arm.label || 'Ad';
    link.setAttribute('aria-label', altText);

    function showImage(){
      const img = createImage(png, altText);
      setMedia(img);
    }

    function showVideo(){
      const vid = createVideo(png, mp4);
      vid.addEventListener('error', showImage, { once:true });
      setMedia(vid);
      try {
        vid.load?.();
        const p = vid.play?.();
        if (p && typeof p.catch === 'function') {
          p.catch(() => { showImage(); });
        }
      } catch (err) {
        showImage();
      }
    }

    if (useMotion) {
      showVideo();
    } else {
      showImage();
    }

    // Log impression
    postLog('arm_impression', { experiment_name: EXPERIMENT, arm_id: arm.id, arm_label: arm.label, algorithm: (algoName==='ucb'?'ucb1':algoName==='eg'?'egreedy':'thompson'), epsilon: (algoName==='eg'? String(EPS):'') });

    // Click logs before nav
    link.addEventListener('click', () => {
      postLog('arm_click', { experiment_name: EXPERIMENT, arm_id: arm.id, arm_label: arm.label, algorithm: (algoName==='ucb'?'ucb1':algoName==='eg'?'egreedy':'thompson'), epsilon: (algoName==='eg'? String(EPS):''), value:1 }, true);
      const s = state.get(arm.id); s.w += 1; // local update
    }, { capture:true });

    const s = state.get(arm.id); s.n += 1;
    sessionStorage.setItem('bandit_seen', String(seen+1));
    sessionStorage.setItem('bandit_last', arm.id);
  }

  // Controls
  window.BanditControls = {
    setAlgorithm(nextAlgo, eps){ const prev = localStorage.getItem('bandit_algo') || 'ts'; localStorage.setItem('bandit_algo', nextAlgo); if(typeof eps==='number') localStorage.setItem('bandit_eps', String(eps)); postLog('algo_toggle', { experiment_name: EXPERIMENT, from: prev, to: nextAlgo, epsilon: String(eps||'') }); },
    setWarmup(n){ localStorage.setItem('bandit_warmup', String(n|0)); },
    setMotion(on){ localStorage.setItem('bandit_motion', on?'true':'false'); },
    setDest(url){
      const trimmed = String(url || '').trim();
      if (!trimmed || isPlaceholderDest(trimmed)) {
        localStorage.removeItem('bandit_dest');
        return;
      }
      localStorage.setItem('bandit_dest', trimmed);
    },
    addArm(arm){
      const list=getArms();
      if(list.some(a=>a.id===arm.id)) return false;
      const normalized = normaliseArm(arm);
      if (!normalized) return false;
      list.push(normalized);
      localStorage.setItem('bandit_arms', JSON.stringify(list));
      ARMS = list.slice();
      if (!state.has(normalized.id)) state.set(normalized.id, { n:0, w:0 });
      postLog('ad_added', { experiment_name: EXPERIMENT, arm_id: normalized.id, arm_label: normalized.label, srcBase: resolvePath(normalized.srcBase) });
      return true;
    },
    listArms(){ return getArms(); },
  };

  document.addEventListener('DOMContentLoaded', mountAd);
})();
