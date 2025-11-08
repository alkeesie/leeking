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
  <link rel="stylesheet" href="/styles.css?v=4" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<nav class="nav wrapper"><a class="brand" href="/">leek.ing</a><a href="/dashboard.php" aria-current="page">Bandit dashboard</a><a href="/about.html">About the experiment</a></nav>
<main class="wrapper">
  <section class="hero" aria-labelledby="dashboard-title">
    <div class="hero-brand" aria-hidden="true">leek.ing</div>
    <h1 class="h1" id="dashboard-title"><span class="hero-heading-light">Bandit findings </span><span class="hero-heading-serif">Performance snapshot</span></h1>
    <p class="hero-subtitle">All metrics below come from the live banner rotation.</p>
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
    <h2>Algorithm pacing</h2>
    <p class="note" id="algo-summary-empty">We’ll list each algorithm once impressions are logged.</p>
    <table class="table" id="algo-summary-table" hidden>
      <thead><tr><th>Algorithm</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Share of impressions</th><th>Avg ε (if applicable)</th></tr></thead>
      <tbody id="algo-summary-body"></tbody>
    </table>
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
    <h2>CTR trend by arm</h2>
    <p class="note" id="trend-empty">We’ll chart each arm once impressions start rolling in.</p>
    <canvas id="chart_trend" height="200" hidden></canvas>
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
      <img id="banner-fallback" src="/assets/banners/control_static.png" alt="VI Online Arcade — Play now" width="728" height="90">
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
    const enriched = stats.map(d => {
      const regretRate = bestCtr ? Math.max(0, bestCtr - d.ctr) : 0;
      const expectedRegret = regretRate * d.plays;
      return { ...d, regretRate, expectedRegret };
    });
    const totalRegret = enriched.reduce((sum, d) => sum + d.expectedRegret, 0);
    return { stats: enriched, bestCtr, totalRegret };
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

  function normaliseAlgo(key){
    if (!key) return '';
    const normal = key.toLowerCase();
    if (normal.includes('thompson')) return 'thompson';
    if (normal.includes('ucb')) return 'ucb1';
    if (normal.includes('eg')) return 'egreedy';
    return normal;
  }

  function computeAlgoSummary(rows){
    const labelMap = { thompson: 'Thompson', ucb1: 'UCB1', egreedy: 'ε‑Greedy' };
    const summary = new Map();
    let totalImpressions = 0;
    rows.forEach(r => {
      if (r.exp !== EXPERIMENT) return;
      const algo = normaliseAlgo(r.algorithm);
      if (!algo) return;
      const record = summary.get(algo) || { key: algo, label: labelMap[algo] || algo, impressions: 0, clicks: 0, eps: [] };
      if (r.event === 'arm_impression') {
        record.impressions += 1;
        totalImpressions += 1;
        const eps = parseFloat(r.epsilon);
        if (algo === 'egreedy' && Number.isFinite(eps)) record.eps.push(eps);
      }
      if (r.event === 'arm_click') {
        record.clicks += 1;
      }
      summary.set(algo, record);
    });
    return { list: Array.from(summary.values()), totalImpressions };
  }

  function renderRegret(rows){
    const { stats, bestCtr, totalRegret } = computeArmStats(rows);
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
    summary.textContent = `Current best arm CTR: ${formatPercent(bestCtr)}. Total expected regret (missed clicks) so far: ${formatRegret(totalRegret)}.`;
    table.hidden = false;
    body.innerHTML = stats.map(d =>
      `<tr><td>${d.label}<br><small>${d.id}</small></td><td>${d.plays}</td><td>${d.wins}</td><td>${formatPercent(d.ctr)}</td><td>${formatPercent(d.regretRate)}</td><td>${formatRegret(d.expectedRegret)}</td></tr>`
    ).join('');
  }

  function renderAlgoSummary(rows){
    const { list, totalImpressions } = computeAlgoSummary(rows);
    const empty = document.getElementById('algo-summary-empty');
    const table = document.getElementById('algo-summary-table');
    const body = document.getElementById('algo-summary-body');
    if (!list.length) {
      empty.hidden = false;
      table.hidden = true;
      body.innerHTML = '';
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    body.innerHTML = list.map(entry => {
      const ctr = entry.impressions ? entry.clicks / entry.impressions : 0;
      const share = totalImpressions ? entry.impressions / totalImpressions : 0;
      const avgEps = entry.eps.length ? (entry.eps.reduce((sum, val) => sum + val, 0) / entry.eps.length).toFixed(2) : '—';
      return `<tr><td>${entry.label}</td><td>${entry.impressions}</td><td>${entry.clicks}</td><td>${formatPercent(ctr)}</td><td>${formatPercent(share)}</td><td>${entry.key === 'egreedy' ? avgEps : '—'}</td></tr>`;
    }).join('');
  }

  let chartTrend;
  function renderTrend(rows){
    const events = rows
      .filter(r => r.exp === EXPERIMENT && (r.event === 'arm_impression' || r.event === 'arm_click'))
      .map(r => {
        const ts = new Date(r.ts).getTime();
        return Number.isFinite(ts) ? { ...r, ts } : null;
      })
      .filter(Boolean)
      .sort((a,b) => a.ts - b.ts);

    const totals = new Map();
    const datasets = new Map();

    events.forEach(evt => {
      if (!evt.arm_id) return;
      if (!totals.has(evt.arm_id)) {
        totals.set(evt.arm_id, { plays:0, wins:0, label: evt.arm_label || evt.arm_id });
      }
      if (!datasets.has(evt.arm_id)) {
        datasets.set(evt.arm_id, []);
      }
      const tally = totals.get(evt.arm_id);
      if (evt.event === 'arm_impression') tally.plays += 1;
      if (evt.event === 'arm_click') tally.wins += 1;
      const ctr = tally.plays ? (tally.wins / tally.plays) * 100 : 0;
      datasets.get(evt.arm_id).push({ x: evt.ts, y: ctr });
    });

    const empty = document.getElementById('trend-empty');
    const canvas = document.getElementById('chart_trend');

    if (!datasets.size || !canvas) {
      if (empty) empty.hidden = false;
      if (canvas) canvas.hidden = true;
      if (chartTrend) { chartTrend.destroy(); chartTrend = null; }
      return;
    }

    if (empty) empty.hidden = true;
    canvas.hidden = false;
    const palette = ['#7A2D27', '#2F3D52', '#C27BA0', '#1E1B1E', '#F9A03F', '#5A6FF0'];
    let i = 0;
    const datasetList = [...datasets.entries()].map(([id,data]) => {
      const color = palette[i++ % palette.length];
      const label = totals.get(id)?.label || id;
      return {
        label,
        data,
        borderColor: color,
        backgroundColor: color,
        fill: false,
        spanGaps: true,
        tension: 0.25,
        pointRadius: 2,
      };
    });

    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { datasets: datasetList },
      options: {
        parsing: false,
        animation: false,
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: 'Time' },
            ticks: {
              callback: value => {
                const date = new Date(Number(value));
                if (!Number.isFinite(date.getTime())) return '';
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }
            }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: {
              callback: value => `${Number(value).toFixed(0)}%`
            },
            title: { display: true, text: 'CTR (%)' }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              title(items){
                if (!items?.length) return '';
                const date = new Date(Number(items[0].parsed.x));
                return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
              },
              label(ctx){
                const pct = ctx.parsed?.y ?? 0;
                return `${ctx.dataset?.label || 'Arm'}: ${pct.toFixed(2)}%`;
              }
            }
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
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
  renderAlgoSummary(rows);
  renderRegret(rows);
  renderTrend(rows);
  renderAlgoTabs(rows);
</script>
<script defer src="/bandit/bandit.js?v=4"></script>
</body>
</html>
