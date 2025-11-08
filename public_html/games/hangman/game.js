(() => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const WORDS_URL = '/games/hangman/words.json?v=1';
  let words = ['robot', 'lemon', 'bunny', 'tulip', 'pixel', 'spark', 'candy', 'vapor', 'raven', 'siren', 'fairy', 'sugar', 'comet', 'panda', 'mercy', 'honey'];
  const maxMisses = 6;

  const hangmanEl = document.getElementById('hangman');
  const wordEl = document.getElementById('word');
  const alphabetEl = document.getElementById('alphabet');
  const newGameBtn = document.getElementById('newGame');
  const winsEl = document.getElementById('wins');
  const streakEl = document.getElementById('streak');
  const parts = Array.from(hangmanEl.querySelectorAll('.part'));

  let word = '';
  let revealed = [];
  let misses = 0;
  let wins = parseInt(localStorage.getItem('leeking_hangman_wins') || '0', 10);
  let streak = parseInt(localStorage.getItem('leeking_hangman_streak') || '0', 10);
  winsEl.textContent = wins;
  streakEl.textContent = streak;

  function showToast(text){
    let toast = document.getElementById('hang-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hang-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1600);
  }

  function pickWord(){
    return words[Math.floor(Math.random() * words.length)];
  }

  function buildAlphabet(){
    alphabetEl.innerHTML = '';
    alphabet.forEach(letter => {
      const button = document.createElement('button');
      button.textContent = letter;
      button.addEventListener('click', () => handleGuess(letter, button));
      alphabetEl.appendChild(button);
    });
  }

  function renderWord(){
    wordEl.innerHTML = '';
    revealed.forEach((flag, idx) => {
      const span = document.createElement('span');
      if (flag) {
        span.textContent = word[idx].toUpperCase();
        span.classList.add('revealed');
      } else {
        span.textContent = '';
      }
      wordEl.appendChild(span);
    });
  }

  function updateHangman(){
    parts.forEach((part, idx) => {
      part.classList.toggle('visible', idx < Math.min(misses, maxMisses));
    });
  }

  function handleGuess(letter, button){
    if (misses >= maxMisses || revealed.every(Boolean)) return;
    button.disabled = true;
    if (word.includes(letter.toLowerCase())) {
      button.classList.add('correct');
      word.split('').forEach((char, idx) => {
        if (char === letter.toLowerCase()) {
          revealed[idx] = true;
        }
      });
      renderWord();
      if (revealed.every(Boolean)) {
        wins += 1;
        streak += 1;
        localStorage.setItem('leeking_hangman_wins', String(wins));
        localStorage.setItem('leeking_hangman_streak', String(streak));
        winsEl.textContent = wins;
        streakEl.textContent = streak;
        showToast('You saved them!');
      }
    } else {
      misses += 1;
      button.classList.add('wrong');
      updateHangman();
      if (misses >= maxMisses) {
        streak = 0;
        localStorage.setItem('leeking_hangman_streak', '0');
        streakEl.textContent = streak;
        showToast(`They were thinking of "${word.toUpperCase()}"`);
        revealWord();
      }
    }
  }

  function revealWord(){
    revealed = revealed.map(() => true);
    renderWord();
  }

  function newGame(){
    word = pickWord();
    revealed = Array.from({ length: word.length }, () => false);
    misses = 0;
    buildAlphabet();
    renderWord();
    updateHangman();
  }

  async function loadWords(){
    try {
      const response = await fetch(WORDS_URL, { cache: 'reload' });
      if (response.ok) {
        const list = await response.json();
        if (Array.isArray(list) && list.length) {
          words = list.map(w => String(w).toLowerCase()).filter(w => /^[a-z]{4,10}$/.test(w));
        }
      }
    } catch (err) {
      console.warn('Hangman word list fallback in use', err);
    }
  }

  newGameBtn.addEventListener('click', () => {
    newGame();
    showToast('Fresh word ready');
  });
  window.addEventListener('keydown', e => {
    const key = e.key.toUpperCase();
    if (key.length === 1 && /[A-Z]/.test(key)) {
      const button = Array.from(alphabetEl.children).find(btn => btn.textContent === key);
      if (button && !button.disabled) {
        handleGuess(key, button);
      }
    }
  });

  loadWords().finally(newGame);
})();
