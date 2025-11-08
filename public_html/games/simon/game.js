(() => {
  const pads = Array.from(document.querySelectorAll('.pad'));
  const roundEl = document.getElementById('round');
  const bestEl = document.getElementById('best');
  const startBtn = document.getElementById('start');
  const strictBtn = document.getElementById('strict');

  let sequence = [];
  let inputIndex = 0;
  let strictMode = false;
  let acceptingInput = false;
  let round = 0;
  let best = parseInt(localStorage.getItem('leeking_simon_best') || '0', 10);
  bestEl.textContent = best;

  function randomPad(){
    return Math.floor(Math.random() * pads.length);
  }

  function setPadsDisabled(disabled){
    pads.forEach(pad => {
      pad.classList.toggle('disabled', disabled);
    });
  }

  function flashPad(index, duration = 420){
    const pad = pads[index];
    if (!pad) return;
    pad.classList.add('active');
    setTimeout(() => pad.classList.remove('active'), duration);
  }

  function updateRoundDisplay(){
    roundEl.textContent = round;
    bestEl.textContent = best;
  }

  function showToast(text){
    let toast = document.getElementById('simon-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'simon-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1600);
  }

  function playbackSequence(){
    acceptingInput = false;
    setPadsDisabled(true);
    sequence.forEach((value, index) => {
      setTimeout(() => flashPad(value), 520 * index);
    });
    setTimeout(() => {
      acceptingInput = true;
      setPadsDisabled(false);
      inputIndex = 0;
    }, sequence.length * 520 + 100);
  }

  function startGame(){
    round = 0;
    sequence = [];
    addStep();
  }

  function addStep(){
    sequence.push(randomPad());
    round += 1;
    if (round > best) {
      best = round;
      localStorage.setItem('leeking_simon_best', String(best));
    }
    updateRoundDisplay();
    playbackSequence();
  }

  function handlePadPress(event){
    if (!acceptingInput) return;
    const padIndex = Number(event.currentTarget.dataset.pad);
    flashPad(padIndex, 260);
    const expected = sequence[inputIndex];
    if (padIndex !== expected) {
      showToast(strictMode ? 'Strict fail! Restarting…' : 'Close! Watch the pattern again.');
      acceptingInput = false;
      if (strictMode) {
        round = 0;
        sequence = [];
        updateRoundDisplay();
        setTimeout(startGame, 600);
      } else {
        setTimeout(playbackSequence, 700);
      }
      return;
    }
    inputIndex += 1;
    if (inputIndex === sequence.length) {
      acceptingInput = false;
      setTimeout(addStep, 600);
    }
  }

  pads.forEach(pad => pad.addEventListener('click', handlePadPress));
  startBtn.addEventListener('click', startGame);
  strictBtn.addEventListener('click', () => {
    strictMode = !strictMode;
    strictBtn.textContent = `Strict mode: ${strictMode ? 'On' : 'Off'}`;
    strictBtn.classList.toggle('btn--brand', strictMode);
    showToast(strictMode ? 'Strict mode enabled' : 'Strict mode off');
  });

  updateRoundDisplay();
})();
