/* bandit.js — leek.ing banner bandit (v2.1, video-first) */
(() => {
  const EXPERIMENT = "vi_arcade_banner_test";
  const LOG_ENDPOINT = "/bandit/log.php";

  // Arms use base path without extension (we'll resolve .png and .mp4)
  const DEFAULT_ARMS = [
    { id: 'control_static', label: 'Icons + Play Now (static)', srcBase: '/assets/banners/control_static' },
    { id: 'games_rock',    label: 'Our games ROCK!',           srcBase: '/assets/banners/games_rock' },
    { id: 'pac_click',     label: 'Pac-style Click to Play',   srcBase: '/assets/banners/pac_click' },
    { id: 'pink_replay',   label: 'Game Over / Play Again?',   srcBase: '/assets/banners/pink_replay' },
  ];

  // Persisted settings + helpers
  const sid = (() => {
    let s = localStorage.getItem('bandit_sid');
    if (!s) { s = (crypto.randomUUID?.() || String(Math.random()).slice(2)); localStorage.setItem('bandit_sid', s); }
    return s;
  })();
  function getArms(){ try{ const t=localStorage.getItem('bandit_arms'); if(t){ const j=JSON.parse(t); if(Array.isArray(j)&&j.length) return j; } }catch{} return DEFAULT_ARMS; }
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

  // Ensure <video> exists
  function ensureVideo(anchor){
    let vid = document.getElementById('banner-video');
    if (!vid) { vid = document.createElement('video'); vid.id='banner-video'; vid.width=728; vid.height=90; anchor.appendChild(vid); }
    vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'metadata';
    return vid;
  }

  function mountAd(){
    const link = document.getElementById('banner-link');
    const img  = document.getElementById('banner-img');
    if (!link || !img) return;
    const vid = ensureVideo(link);

    const algoName = getAlgo();
    const EPS = getEps();
    const WU  = getWarmup();
    let algo = (algoName==='ucb')? new UCB1() : (algoName==='eg'? new EGreedy(EPS) : new Thompson());

    const seen = parseInt(sessionStorage.getItem('bandit_seen')||'0');
    let idx = (seen < WU)? rnd(ARMS.length) : (()=>{ const last=sessionStorage.getItem('bandit_last'); let k=algo.select(seen); if(ARMS.length>1 && last && ARMS[k].id===last) k=(k+1)%ARMS.length; return k; })();
    const arm = ARMS[idx];

    const png = arm.srcBase + '.png';
    const mp4 = arm.srcBase + '.mp4';
    const useMotion = motionEnabled();

    link.href = localStorage.getItem('bandit_dest') || '/click.html';

    // Always set poster + img src (instant paint)
    img.src = png; img.alt = arm.alt || arm.label || 'Ad';
    vid.poster = png;

    // Prepare <video> source
    while (vid.firstChild) vid.removeChild(vid.firstChild);
    const src = document.createElement('source'); src.src = mp4; src.type='video/mp4';
    vid.appendChild(src);

    function showVideo(){ img.hidden = true; vid.hidden = false; const p = vid.play(); if (p && p.catch) p.catch(()=>{ showImage(); }); }
    function showImage(){ try { vid.pause(); } catch {} vid.hidden = true; img.hidden = false; }

    // Prefer video unless reduced-motion or explicit Off
    if (useMotion) {
      showVideo();
      vid.addEventListener('error', showImage, { once:true });
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
    setDest(url){ localStorage.setItem('bandit_dest', url); },
    addArm(arm){ const list=getArms(); if(list.some(a=>a.id===arm.id)) return false; list.push(arm); localStorage.setItem('bandit_arms', JSON.stringify(list)); postLog('ad_added', { experiment_name: EXPERIMENT, arm_id: arm.id, arm_label: arm.label, srcBase: arm.srcBase }); return true; },
    listArms(){ return getArms(); },
  };

  document.addEventListener('DOMContentLoaded', mountAd);
})();
