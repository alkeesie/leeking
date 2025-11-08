(() => {
  const boardEl = document.getElementById('board');
  const keyboardEl = document.getElementById('keyboard');
  const newGameBtn = document.getElementById('newGame');
  const winsEl = document.getElementById('wins');
  const streakEl = document.getElementById('streak');

  const FALLBACK_WORDS = ['LEMON','PLANT','BERRY','ROBOT','PIXEL','QUEEN','NINJA','FRUIT','SHAPE','ALIGN','BLOOM','CLOUD','MIRTH','SWEET','TOAST','VIVID','GLARE','FRAME','MUSIC','LIGHT'];
  const SOLUTIONS_URL = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/solutions';
  const ALLOWED_URL = 'https://raw.githubusercontent.com/tabatkins/wordle-list/main/words';
  const CUSTOM_SOLUTIONS_URL = '/games/wordling/solutions.txt';
  const CUSTOM_ALLOWED_URL = '/games/wordling/allowed.txt';
  const MAX_ROWS = 6;
  const COLS = 5;

  let target = '';
  let row = 0;
  let col = 0;
  let grid = [];
  let keyboardState = new Map();
  let solutionList = FALLBACK_WORDS.slice();
  let allowedSet = new Set(FALLBACK_WORDS);
  let wins = parseInt(localStorage.getItem('leeking_wordling_wins') || '0', 10);
  let streak = parseInt(localStorage.getItem('leeking_wordling_streak') || '0', 10);
  winsEl.textContent = wins;
  streakEl.textContent = streak;

  function randomWord(){
    return solutionList[Math.floor(Math.random() * solutionList.length)];
  }

  function showToast(text){
    let toast = document.getElementById('wordling-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'wordling-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), 1600);
  }

  function buildBoard(){
    boardEl.innerHTML = '';
    grid = Array.from({ length: MAX_ROWS }, () => Array(COLS).fill(''));
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        boardEl.appendChild(tile);
      }
    }
  }

  function buildKeyboard(){
    keyboardEl.innerHTML = '';
    const rows = [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Enter','Z','X','C','V','B','N','M','⌫']
    ];
    rows.forEach(row => {
      row.forEach(label => {
        const key = createKey(label);
        if (label === 'Enter' || label === '⌫') key.classList.add('wide');
      });
    });
  }

  function createKey(label){
    const key = document.createElement('button');
    key.className = 'key';
    key.textContent = label;
    key.dataset.key = label;
    key.addEventListener('click', () => handleInput(label));
    keyboardEl.appendChild(key);
    return key;
  }

  function getTile(r, c){
    return boardEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
  }

  function updateTiles(){
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = getTile(r, c);
        const letter = grid[r][c];
        tile.textContent = letter;
        tile.classList.toggle('filled', Boolean(letter));
      }
    }
  }

  function applyStatuses(guess){
    const targetLetters = target.split('');
    const statuses = Array(COLS).fill('absent');
    const remaining = targetLetters.slice();

    // First pass for correct
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === targetLetters[i]) {
        statuses[i] = 'correct';
        remaining[i] = null;
      }
    }

    // Second pass for present
    for (let i = 0; i < COLS; i++) {
      if (statuses[i] === 'correct') continue;
      const letter = guess[i];
      const index = remaining.indexOf(letter);
      if (index !== -1) {
        statuses[i] = 'present';
        remaining[index] = null;
      }
    }

    statuses.forEach((status, i) => {
      const tile = getTile(row, i);
      tile.classList.add('flip');
      setTimeout(() => {
        tile.classList.remove('flip');
        tile.classList.remove('correct', 'present', 'absent');
        tile.classList.add(status);
      }, 300 + i * 120);
      updateKeyboardState(guess[i], status);
    });

    return statuses;
  }

  function updateKeyboardState(letter, status){
    if (!/[A-Z]/.test(letter)) return;
    const priority = { correct: 3, present: 2, absent: 1 };
    const current = keyboardState.get(letter);
    if (!current || priority[status] > priority[current]) {
      keyboardState.set(letter, status);
      const keyEl = keyboardEl.querySelector(`[data-key="${letter}"]`);
      if (keyEl) {
        keyEl.classList.remove('correct', 'present', 'absent');
        keyEl.classList.add(status);
      }
    }
  }

  function handleInput(input){
    if (row >= MAX_ROWS) return;
    if (input === 'Enter') {
      submitGuess();
      return;
    }
    if (input === '⌫' || input === 'Backspace') {
      if (col > 0) {
        col -= 1;
        grid[row][col] = '';
        updateTiles();
      }
      return;
    }
    if (!/^[A-Z]$/.test(input)) return;
    if (col >= COLS) return;
    grid[row][col] = input;
    col += 1;
    updateTiles();
  }

  function submitGuess(){
    if (col < COLS) {
      showToast('Need more letters');
      return;
    }
    const guess = grid[row].join('');
    if (!allowedSet.has(guess)) {
      showToast('Word not in list');
      return;
    }
    const statuses = applyStatuses(guess);
    if (guess === target) {
      wins += 1;
      streak += 1;
      localStorage.setItem('leeking_wordling_wins', String(wins));
      localStorage.setItem('leeking_wordling_streak', String(streak));
      winsEl.textContent = wins;
      streakEl.textContent = streak;
      showToast('You nailed it!');
      row = MAX_ROWS;
      return;
    }
    row += 1;
    col = 0;
    if (row === MAX_ROWS) {
      streak = 0;
      localStorage.setItem('leeking_wordling_streak', '0');
      streakEl.textContent = streak;
      showToast(`The word was ${target}`);
    }
  }

  function handleKeydown(e){
    handleInput(e.key.length === 1 ? e.key.toUpperCase() : e.key === 'Enter' ? 'Enter' : e.key === 'Backspace' ? '⌫' : e.key);
  }

  function newGame(){
    target = randomWord();
    row = 0;
    col = 0;
    keyboardState.clear();
    buildBoard();
    buildKeyboard();
    updateTiles();
  }

  async function loadDictionary(){
    const normalise = text => text.split(/\s+/).map(w => w.trim().toUpperCase()).filter(w => w.length === 5);

    async function fetchList(url, options){
      try {
        const response = await fetch(url, options);
        if (!response.ok) return [];
        const text = await response.text();
        return normalise(text);
      } catch (err) {
        return [];
      }
    }

    try {
      const customSolutions = await fetchList(CUSTOM_SOLUTIONS_URL, { cache: 'no-store' });
      const usingCustomSolutions = customSolutions.length > 0;
      if (usingCustomSolutions) {
        solutionList = customSolutions;
      }

      const customAllowed = await fetchList(CUSTOM_ALLOWED_URL, { cache: 'no-store' });

      const [solutionsResp, allowedResp] = await Promise.all([
        fetch(SOLUTIONS_URL, { mode: 'cors', cache: 'reload' }).catch(() => null),
        fetch(ALLOWED_URL, { mode: 'cors', cache: 'reload' }).catch(() => null)
      ]);

      if (!usingCustomSolutions && solutionsResp && solutionsResp.ok) {
        const text = await solutionsResp.text();
        const words = normalise(text);
        if (words.length) {
          solutionList = words;
        }
      }

      const allowedWords = new Set(solutionList);

      if (allowedResp && allowedResp.ok) {
        const text = await allowedResp.text();
        normalise(text).forEach(w => allowedWords.add(w));
      }

      if (customAllowed.length) {
        customAllowed.forEach(word => allowedWords.add(word));
      }

      if (!allowedWords.size) {
        FALLBACK_WORDS.forEach(w => allowedWords.add(w));
      }

      allowedSet = allowedWords;
    } catch (err) {
      console.warn('Wordling dictionary fallback in use', err);
    }
  }

  newGameBtn.addEventListener('click', () => {
    newGame();
    showToast('Fresh word loaded');
  });
  window.addEventListener('keydown', handleKeydown);

  loadDictionary().finally(newGame);
})();
