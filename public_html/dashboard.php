<?php
// dashboard.php — reads /bandit/logs/bandit_log.csv and renders charts + controls
$csv = __DIR__ . '/bandit/logs/bandit_log.csv';
$rows = [];
if (file_exists($csv)) {
  if (($fh = fopen($csv, 'r')) !== false) {
    while (($r = fgetcsv($fh)) !== false) {
      // ts, event, experiment_name, arm_id, arm_label, algorithm, epsilon, from, to, session_id, user_agent, referrer
      if (count($r) < 3) continue;
      $rows[] = [
        'ts' => $r[0] ?? '', 'event' => $r[1] ?? '', 'exp' => $r[2] ?? '',
        'arm_id' => $r[3] ?? '', 'arm_label' => $r[4] ?? '',
        'algorithm' => $r[5] ?? '', 'epsilon' => $r[6] ?? '',
        'from' => $r[7] ?? '', 'to' => $r[8] ?? '', 'sid' => $r[9] ?? ''
      ];
    }
    fclose($fh);
  }
}
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>leek.ing — Bandit Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;900&family=Lora:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<nav class="nav wrapper"><a class="brand" href="/">leek.ing</a><a href="/about.html">About the experiment</a></nav>
<main class="wrapper">
  <section class="panel" id="controls">
    <h2>Control panel</h2>
    <div class="row">
      <div>
        <label>Algorithm</label>
        <select id="algo">
          <option value="ts">Thompson (default)</option>
          <option value="ucb">UCB1</option>
          <option value="eg">ε‑Greedy</option>
        </select>
      </div>
      <div>
        <label>ε (only for ε‑Greedy)</label>
        <input id="eps" type="number" step="0.01" min="0" max="1" value="0.10" />
      </div>
      <div>
        <label>Warm‑up impressions</label>
        <input id="warmup" type="number" step="10" min="0" value="100" />
      </div>
      <div>
        <label>Motion (MP4 banners)</label>
        <select id="motion"><option value="false">Off</option><option value="true">On</option></select>
      </div>
      <div>
        <label>Ad click destination URL</label>
        <input id="dest" type="text" placeholder="/click.html" />
      </div>
    </div>
    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn" id="apply">Apply &amp; Log Toggle</button>
      <button class="btn secondary" id="reload">Reload Charts</button>
    </div>

    <hr style="margin:16px 0"/>
    <h2>Add advertisement (MP4 + PNG base)</h2>
    <form id="addAd">
      <div class="row">
        <div><label>Arm ID</label><input id="ad_id" type="text" placeholder="unique_id" required /></div>
        <div><label>Label</label><input id="ad_label" type="text" placeholder="Human label" required /></div>
        <div><label>Base path (no ext)</label><input id="ad_src" type="text" placeholder="/assets/banners/new_banner" required /></div>
      </div>
      <div style="margin-top:10px"><button class="btn">Add to Rotation</button></div>
      <p style="font-size:.9rem;color:#555">We assume both <code>.png</code> and <code>.mp4</code> exist at the base path.</p>
    </form>
  </section>

  <section class="kpis" id="kpis">
    <div class="kpi"><h3>Total time run</h3><div class="num" id="kpi_runtime">—</div></div>
    <div class="kpi"><h3>Total impressions</h3><div class="num" id="kpi_imp">—</div></div>
    <div class="kpi"><h3>Total clicks</h3><div class="num" id="kpi_clicks">—</div></div>
    <div class="kpi"><h3>Overall CTR</h3><div class="num" id="kpi_ctr">—</div></div>
    <div class="kpi"><h3>Active algorithm</h3><div class="num" id="kpi_algo">—</div></div>
  </section>

  <section class="panel">
    <h2>Per‑arm CTR (all algorithms)</h2>
    <canvas id="chart_ctr" height="140"></canvas>
  </section>

  <section class="panel">
    <h2>Algorithm comparisons (tabs)</h2>
    <div style="display:flex; gap:8px; margin-bottom:8px">
      <button class="btn secondary tab" data-tab="all">All</button>
      <button class="btn secondary tab" data-tab="ts">Thompson</button>
      <button class="btn secondary tab" data-tab="ucb">UCB1</button>
      <button class="btn secondary tab" data-tab="eg">ε‑Greedy</button>
    </div>
    <div id="algoSection"></div>
  </section>
</main>

  <div class="ad-slot">
    <span class="badge" aria-hidden="true">AD</span>
    <a id="banner-link" href="/click.html" rel="nofollow noopener">
      <img id="banner-img" src="/assets/banners/control_static.png" alt="VI Online Arcade — Play now" width="728" height="90" style="display:block;width:100%;height:auto">
      <video id="banner-video" width="728" height="90" muted playsinline loop preload="metadata"></video>
    </a>
  </div>
<footer>© leek.ing</footer>

<script>
  const EXPERIMENT = 'vi_arcade_banner_test';
  const rows = <?php echo json_encode($rows, JSON_UNESCAPED_SLASHES); ?>;

  function humanDur(ms){ const s=Math.floor(ms/1000); const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60); const r=s%60; const parts=[]; if(d) parts.push(d+'d'); if(h) parts.push(h+'h'); if(m) parts.push(m+'m'); parts.push(r+'s'); return parts.join(' '); }

  function renderKPIs(rows){
    if (!rows.length){ document.getElementById('kpi_runtime').textContent='—'; return; }
    const imps = rows.filter(r=>r.event==='arm_impression' && r.exp===EXPERIMENT);
    const clicks = rows.filter(r=>r.event==='arm_click' && r.exp===EXPERIMENT);
    if (rows.length){ const t0=new Date(rows[0].ts).getTime(), t1=new Date(rows[rows.length-1].ts).getTime(); document.getElementById('kpi_runtime').textContent=humanDur(t1-t0); }
    document.getElementById('kpi_imp').textContent = imps.length;
    document.getElementById('kpi_clicks').textContent = clicks.length;
    document.getElementById('kpi_ctr').textContent = imps.length ? ((clicks.length/imps.length*100).toFixed(2)+'%') : '—';
    const activeAlgo = localStorage.getItem('bandit_algo') || 'ts';
    document.getElementById('kpi_algo').textContent = ({ts:'Thompson',ucb:'UCB1',eg:'ε‑Greedy'})[activeAlgo] || activeAlgo;
  }

  function groupByArm(rows){
    const stats = new Map();
    rows.forEach(r=>{
      if (r.exp!==EXPERIMENT) return;
      if (r.event!=='arm_impression' && r.event!=='arm_click') return;
      const rec = stats.get(r.arm_id) || { label:r.arm_label||r.arm_id, plays:0, wins:0 };
      if (r.event==='arm_impression') rec.plays++;
      if (r.event==='arm_click') rec.wins++;
      stats.set(r.arm_id, rec);
    });
    return [...stats.entries()].map(([id,s]) => ({ id, ...s, ctr: s.plays ? s.wins/s.plays : 0 }));
  }

  let chartCTR;
  function renderCTR(rows){
    const data = groupByArm(rows);
    const ctx = document.getElementById('chart_ctr');
    if (chartCTR) chartCTR.destroy();
    chartCTR = new Chart(ctx, {
      type: 'bar',
      data: { labels: data.map(d=>d.label), datasets: [{ label: 'CTR', data: data.map(d=> (d.ctr*100).toFixed(2)), borderWidth:1 }]},
      options: { scales: { y: { beginAtZero: true, ticks: { callback: v=> v+'%' }}}}
    });
  }

  function renderAlgoTabs(rows){
    const sec = document.getElementById('algoSection');
    function sectionFor(tag, rows){
      const imps = rows.filter(r=>r.event==='arm_impression' && r.exp===EXPERIMENT);
      const clicks = rows.filter(r=>r.event==='arm_click' && r.exp===EXPERIMENT);
      const byArm = groupByArm(rows);
      const totalCTR = imps.length ? (clicks.length/imps.length*100).toFixed(2)+'%' : '—';
      const html = [`<div class="kpis">`,
        `<div class="kpi"><h3>${tag} impressions</h3><div class="num">${imps.length}</div></div>`,
        `<div class="kpi"><h3>${tag} clicks</h3><div class="num">${clicks.length}</div></div>`,
        `<div class="kpi"><h3>${tag} CTR</h3><div class="num">${totalCTR}</div></div>`,
      `</div>`,
      `<table class="table"><thead><tr><th>Arm</th><th>Plays</th><th>Wins</th><th>CTR</th></tr></thead><tbody>`,
      ...byArm.map(d=>`<tr><td>${d.label}<br><small>${d.id}</small></td><td>${d.plays}</td><td>${d.wins}</td><td>${(d.ctr*100).toFixed(2)}%</td></tr>`),
      `</tbody></table>`].join('');
      return html;
    }
    sec.innerHTML = sectionFor('All', rows);
    document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
      const t = btn.dataset.tab;
      if (t==='all') { sec.innerHTML = sectionFor('All', rows); return; }
      const algoKey = (t==='ucb'?'ucb1':t==='eg'?'egreedy':'thompson');
      const sub = rows.filter(r => r.algorithm === algoKey);
      sec.innerHTML = sectionFor(btn.textContent, sub);
    });
  }

  function initControls(){
    const algo = localStorage.getItem('bandit_algo')||'ts';
    const eps  = localStorage.getItem('bandit_eps')||'0.1';
    const wu   = localStorage.getItem('bandit_warmup')||'0';
    const mot  = (localStorage.getItem('bandit_motion') ?? 'true'); // default ON
    const dest = localStorage.getItem('bandit_dest')||'/click.html';
    document.getElementById('algo').value = algo;
    document.getElementById('eps').value = eps;
    document.getElementById('warmup').value = wu;
    document.getElementById('motion').value = mot;
    document.getElementById('dest').value = dest;
  }

  document.getElementById('apply').onclick = () => {
    const algo = document.getElementById('algo').value;
    const eps  = parseFloat(document.getElementById('eps').value||'0.1');
    const wu   = parseInt(document.getElementById('warmup').value||'0');
    const mot  = document.getElementById('motion').value === 'true';
    const dest = document.getElementById('dest').value || '/click.html';
    if (window.BanditControls) {
      if (dest) window.BanditControls.setDest(dest);
      window.BanditControls.setWarmup(wu);
      window.BanditControls.setMotion(mot);
      window.BanditControls.setAlgorithm(algo, eps); // logs algo_toggle
      alert('Applied. Algorithm set to '+algo.toUpperCase()+ (algo==='eg'?` (ε=${eps})`:''));
    } else {
      alert('BanditControls not available. Load bandit/bandit.js somewhere on this page.');
    }
  };
  document.getElementById('reload').onclick = () => { renderKPIs(rows); renderCTR(rows); renderAlgoTabs(rows); };

  initControls();
  renderKPIs(rows); renderCTR(rows); renderAlgoTabs(rows);
</script>
<script defer src="bandit/bandit.js"></script>
</body>
</html>
