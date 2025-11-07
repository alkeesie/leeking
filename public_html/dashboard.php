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
  <link rel="stylesheet" href="/styles.css?v=3" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<nav class="nav wrapper"><a class="brand" href="/">leek.ing</a><a href="/dashboard.php" aria-current="page">Bandit dashboard</a><a href="/control.html">Control panel</a><a href="/about.html">About the experiment</a></nav>
<main class="wrapper">
  <section class="hero" aria-labelledby="dashboard-title">
    <div class="hero-brand" aria-hidden="true">leek.ing</div>
    <h1 class="h1" id="dashboard-title"><span class="hero-heading-light">Bandit findings </span><span class="hero-heading-serif">Performance snapshot</span></h1>
    <p class="hero-subtitle">All metrics below come from the live banner rotation. Need to tweak algorithms or destinations? Head over to the <a href="/control.html">control panel</a>.</p>
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
    <h2>Regret by arm</h2>
    <p class="note" id="regret-empty">No impressions logged yet. Check back after the experiment collects data.</p>
    <p class="note" id="regret-summary" hidden></p>
    <table class="table" id="regret-table" hidden>
      <thead><tr><th>Arm</th><th>Plays</th><th>Wins</th><th>CTR</th><th>Regret rate</th><th>Expected regret</th></tr></thead>
      <tbody id="regret-body"></tbody>
    </table>
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
      <img id="banner-img" src="/assets/banners/control_static.png" alt="VI Online Arcade — Play now" width="728" height="90">
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

  function computeArmStats(rows){
    const stats = groupByArm(rows);
    const bestCtr = stats.reduce((max, d) => (d.plays ? Math.max(max, d.ctr) : max), 0);
    return {
      stats: stats.map(d => {
        const regretRate = bestCtr ? Math.max(0, bestCtr - d.ctr) : 0;
        const expectedRegret = regretRate * d.plays;
        return { ...d, regretRate, expectedRegret };
      }),
      bestCtr
    };
  }

  let chartCTR;
  function renderCTR(rows){
    const { stats } = computeArmStats(rows);
    const ctx = document.getElementById('chart_ctr');
    if (chartCTR) chartCTR.destroy();
    chartCTR = new Chart(ctx, {
      type: 'bar',
      data: { labels: stats.map(d=>d.label), datasets: [{ label: 'CTR', data: stats.map(d=> (d.ctr*100).toFixed(2)), borderWidth:1 }]},
      options: { scales: { y: { beginAtZero: true, ticks: { callback: v=> v+'%' }}}}
    });
  }

  function formatPercent(value){
    if (!isFinite(value)) return '—';
    return (value*100).toFixed(2) + '%';
  }

  function formatRegret(value){
    if (!isFinite(value)) return '—';
    return value.toFixed(2);
  }

  function renderRegret(rows){
    const { stats, bestCtr } = computeArmStats(rows);
    const empty = document.getElementById('regret-empty');
    const summary = document.getElementById('regret-summary');
    const table = document.getElementById('regret-table');
    const body = document.getElementById('regret-body');
    if (!stats.length){
      empty.hidden = false;
      summary.hidden = true;
      table.hidden = true;
      body.innerHTML = '';
      return;
    }
    empty.hidden = true;
    summary.hidden = false;
    summary.textContent = `Current best arm CTR: ${formatPercent(bestCtr)}. Regret compares every arm to that leader.`;
    table.hidden = false;
    body.innerHTML = stats.map(d =>
      `<tr><td>${d.label}<br><small>${d.id}</small></td><td>${d.plays}</td><td>${d.wins}</td><td>${formatPercent(d.ctr)}</td><td>${formatPercent(d.regretRate)}</td><td>${formatRegret(d.expectedRegret)}</td></tr>`
    ).join('');
  }

  function renderAlgoTabs(rows){
    const sec = document.getElementById('algoSection');
    function sectionFor(tag, rows){
      const imps = rows.filter(r=>r.event==='arm_impression' && r.exp===EXPERIMENT);
      const clicks = rows.filter(r=>r.event==='arm_click' && r.exp===EXPERIMENT);
      const { stats, bestCtr } = computeArmStats(rows);
      const totalCTR = imps.length ? (clicks.length/imps.length*100).toFixed(2)+'%' : '—';
      const html = [`<div class="kpis">`,
        `<div class="kpi"><h3>${tag} impressions</h3><div class="num">${imps.length}</div></div>`,
        `<div class="kpi"><h3>${tag} clicks</h3><div class="num">${clicks.length}</div></div>`,
        `<div class="kpi"><h3>${tag} CTR</h3><div class="num">${totalCTR}</div></div>`,
      `</div>`,
      stats.length ? `<p class="note">Best CTR in this slice: ${formatPercent(bestCtr)}</p>` : '',
      `<table class="table"><thead><tr><th>Arm</th><th>Plays</th><th>Wins</th><th>CTR</th><th>Regret rate</th><th>Expected regret</th></tr></thead><tbody>`,
      ...stats.map(d=>`<tr><td>${d.label}<br><small>${d.id}</small></td><td>${d.plays}</td><td>${d.wins}</td><td>${formatPercent(d.ctr)}</td><td>${formatPercent(d.regretRate)}</td><td>${formatRegret(d.expectedRegret)}</td></tr>`),
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
  renderKPIs(rows);
  renderCTR(rows);
  renderRegret(rows);
  renderAlgoTabs(rows);
</script>
<script defer src="/bandit/bandit.js?v=3"></script>
</body>
</html>
