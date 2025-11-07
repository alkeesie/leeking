(function(){
  const mantissaInput = document.getElementById('mantissa');
  const exponentInput = document.getElementById('exponent');
  const exponentDisplay = document.getElementById('exponent-display');
  const guessPreview = document.getElementById('guess-preview');
  const targetValue = document.getElementById('target-value');
  const resultBox = document.getElementById('result');
  const roundLabel = document.getElementById('googol-round-label');
  const roundsPlayed = document.getElementById('rounds-played');
  const scoreTotal = document.getElementById('score-total');
  const bestPrecision = document.getElementById('best-precision');
  const form = document.getElementById('googol-form');
  const submitBtn = document.getElementById('submit-guess');
  const nextRoundBtn = document.getElementById('next-round');
  const historyBody = document.getElementById('history-body');
  const historyEmpty = document.getElementById('history-empty');
  const historyTable = document.querySelector('.googol-history');

  if (!mantissaInput || !exponentInput || !form) return;

  const state = {
    current: null,
    rounds: 0,
    score: 0,
    bestDiff: Infinity
  };

  const MIN_EXP = parseInt(exponentInput.min || '1', 10) || 1;
  const MAX_EXP = parseInt(exponentInput.max || '120', 10) || 120;

  function randomTarget(){
    const exponent = Math.floor(Math.random() * (MAX_EXP - MIN_EXP + 1)) + MIN_EXP;
    const mantissa = +(1 + Math.random() * 8.98).toFixed(2);
    return { mantissa, exponent };
  }

  function formatSci(mantissa, exponent){
    return `${mantissa.toFixed(2)} × 10<sup>${exponent}</sup>`;
  }

  function formatDiff(diff){
    if (!isFinite(diff)) return '—';
    if (diff < 0.005) return '10<sup>0.00</sup> (bullseye!)';
    return `10<sup>${diff.toFixed(2)}</sup>`;
  }

  function updatePreview(){
    const mantissa = clampMantissa(parseFloat(mantissaInput.value));
    const exponent = clampExponent(parseInt(exponentInput.value, 10));
    mantissaInput.value = mantissa.toFixed(2);
    exponentDisplay.textContent = exponent.toString();
    guessPreview.innerHTML = formatSci(mantissa, exponent);
  }

  function clampMantissa(value){
    if (!isFinite(value) || value <= 0) return 1;
    const min = parseFloat(mantissaInput.min || '0.01');
    const max = parseFloat(mantissaInput.max || '9.99');
    return Math.min(Math.max(value, min), max);
  }

  function clampExponent(value){
    if (!isFinite(value)) return MIN_EXP;
    return Math.min(Math.max(value, MIN_EXP), MAX_EXP);
  }

  function updateScoreboard(){
    roundsPlayed.textContent = state.rounds.toString();
    scoreTotal.textContent = state.score.toString();
    bestPrecision.innerHTML = state.bestDiff === Infinity ? '—' : formatDiff(state.bestDiff);
  }

  function appendHistory(round, guessMantissa, guessExponent, points, diff){
    if (!historyBody) return;
    const row = document.createElement('tr');
    row.innerHTML = `<td>${round}</td><td>${formatSci(guessMantissa, guessExponent)}</td><td>${formatSci(state.current.mantissa, state.current.exponent)}</td><td>${points}</td><td>${formatDiff(diff)}</td>`;
    historyBody.appendChild(row);
    if (historyEmpty) historyEmpty.hidden = true;
    if (historyTable) historyTable.hidden = false;
  }

  function describeResult(diff, bigger){
    if (!isFinite(diff)) return '';
    if (diff < 0.005) return '<span>Perfect! You matched the target scale exactly.</span>';
    const direction = bigger ? 'bigger' : 'smaller';
    return `<span>Your guess was about 10<sup>${diff.toFixed(2)}</sup> times ${direction} than the target.</span>`;
  }

  function scoreFromDiff(diff){
    if (!isFinite(diff)) return 0;
    const raw = Math.max(0, 100 - Math.round(diff * 20));
    return raw;
  }

  function playRound(){
    state.current = randomTarget();
    resultBox.innerHTML = '';
    nextRoundBtn.hidden = true;
    submitBtn.disabled = false;
    mantissaInput.disabled = false;
    exponentInput.disabled = false;
    mantissaInput.value = '1.00';
    exponentInput.value = Math.round((MIN_EXP + MAX_EXP) / 2).toString();
    updatePreview();
    targetValue.innerHTML = formatSci(state.current.mantissa, state.current.exponent);
    roundLabel.textContent = `Round ${state.rounds + 1}`;
    if (!historyBody || !historyBody.children.length) {
      if (historyEmpty) historyEmpty.hidden = false;
      if (historyTable) historyTable.hidden = true;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!state.current) return;

    const mantissa = clampMantissa(parseFloat(mantissaInput.value));
    const exponent = clampExponent(parseInt(exponentInput.value, 10));
    mantissaInput.value = mantissa.toFixed(2);
    exponentInput.value = exponent.toString();

    const guessLog = Math.log10(mantissa) + exponent;
    const targetLog = Math.log10(state.current.mantissa) + state.current.exponent;
    const diff = Math.abs(guessLog - targetLog);
    const points = scoreFromDiff(diff);

    state.rounds += 1;
    state.score += points;
    state.bestDiff = Math.min(state.bestDiff, diff);

    const bigger = guessLog >= targetLog;
    resultBox.innerHTML = `<strong>You scored ${points} points.</strong>${describeResult(diff, bigger)}`;
    appendHistory(state.rounds, mantissa, exponent, points, diff);
    updateScoreboard();

    submitBtn.disabled = true;
    mantissaInput.disabled = true;
    exponentInput.disabled = true;
    nextRoundBtn.hidden = false;
  });

  nextRoundBtn.addEventListener('click', () => {
    playRound();
  });

  mantissaInput.addEventListener('change', updatePreview);
  mantissaInput.addEventListener('input', updatePreview);
  exponentInput.addEventListener('input', updatePreview);

  playRound();
})();
