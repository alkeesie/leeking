(() => {
  const SIZE = 4;
  const gridEl = document.getElementById('grid');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const restartBtn = document.getElementById('restart');

  let board = [];
  let score = 0;
  let best = parseInt(localStorage.getItem('leeking_2048_best') || '0', 10);
  bestEl.textContent = best;

  function createBoard(){
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function getEmptyCells(){
    const empties = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) empties.push({ r, c });
      }
    }
    return empties;
  }

  function randomEmptyCell(){
    const empties = getEmptyCells();
    if (!empties.length) return null;
    return empties[Math.floor(Math.random() * empties.length)];
  }

  function spawnTile(){
    const cell = randomEmptyCell();
    if (!cell) return null;
    board[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    return cell;
  }

  function formatValue(value){
    if (value < 2048) return String(value);
    const approx = value / 1024;
    if (approx >= 1000) {
      return `${Math.round(approx / 1000)}M`;
    }
    return `${Math.round(approx)}K`;
  }

  function tileClass(value){
    if (value >= 2048) return 'tile-super';
    return `tile-${value}`;
  }

  function updateUI(newTile, mergedCells = new Set()){
    gridEl.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        if (board[r][c]) {
          const tileEl = document.createElement('div');
          tileEl.className = `tile ${tileClass(board[r][c])}`;
          const span = document.createElement('span');
          span.textContent = formatValue(board[r][c]);
          tileEl.appendChild(span);
          if (newTile && newTile.r === r && newTile.c === c) tileEl.classList.add('new');
          if (mergedCells.has(`${r}-${c}`)) tileEl.classList.add('merge');
          cellEl.appendChild(tileEl);
        }
        gridEl.appendChild(cellEl);
      }
    }
    scoreEl.textContent = score;
    bestEl.textContent = best;
  }

  function slideLine(values, reverse = false){
    const working = reverse ? values.slice().reverse() : values.slice();
    const filtered = working.filter(v => v !== 0);
    const mergedIndices = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] !== 0 && filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        score += filtered[i];
        filtered.splice(i + 1, 1);
        mergedIndices.push(i);
      }
    }
    while (filtered.length < SIZE) filtered.push(0);
    const result = reverse ? filtered.slice().reverse() : filtered;
    const actualMerged = mergedIndices.map(idx => reverse ? SIZE - 1 - idx : idx);
    return { line: result, merged: actualMerged };
  }

  function move(direction){
    let moved = false;
    const mergedCells = new Set();
    if (direction === 'left' || direction === 'right') {
      const reverse = direction === 'right';
      for (let r = 0; r < SIZE; r++) {
        const { line, merged } = slideLine(board[r], reverse);
        if (!arraysEqual(line, board[r])) {
          moved = true;
          board[r] = line;
        }
        merged.forEach(idx => mergedCells.add(`${r}-${idx}`));
      }
    } else {
      const reverse = direction === 'down';
      for (let c = 0; c < SIZE; c++) {
        const column = [];
        for (let r = 0; r < SIZE; r++) column.push(board[r][c]);
        const { line, merged } = slideLine(column, reverse);
        if (!arraysEqual(line, column)) {
          moved = true;
          for (let r = 0; r < SIZE; r++) {
            board[r][c] = line[r];
          }
        }
        merged.forEach(idx => {
          const rowIndex = idx;
          const actualRow = reverse ? SIZE - 1 - rowIndex : rowIndex;
          mergedCells.add(`${actualRow}-${c}`);
        });
      }
    }
    if (!moved) return false;
    if (score > best) {
      best = score;
      localStorage.setItem('leeking_2048_best', String(best));
    }
    const newTile = spawnTile();
    updateUI(newTile, mergedCells);
    if (isGameOver()) {
      showToast('No more moves. Restart to try again.');
    }
    return true;
  }

  function arraysEqual(a, b){
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function isGameOver(){
    if (getEmptyCells().length) return false;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const value = board[r][c];
        if ((board[r][c + 1] ?? null) === value) return false;
        if ((board[r + 1]?.[c] ?? null) === value) return false;
      }
    }
    return true;
  }

  let toastTimer = null;
  function showToast(text){
    let toast = document.getElementById('twenty-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'twenty-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2000);
  }

  function restart(){
    score = 0;
    createBoard();
    const first = spawnTile();
    const second = spawnTile();
    updateUI(second || first, new Set());
  }

  function handleKey(e){
    const key = e.key.toLowerCase();
    const map = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
    if (map[key]) {
      e.preventDefault();
      move(map[key]);
    }
  }

  let touchStart = null;
  function handleTouchStart(e){
    e.preventDefault();
    const touch = e.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }
  function handleTouchEnd(e){
    e.preventDefault();
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    touchStart = null;
    if (Math.max(absX, absY) < 24) return;
    if (absX > absY) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }

  restartBtn.addEventListener('click', restart);
  window.addEventListener('keydown', handleKey);
  gridEl.addEventListener('touchstart', handleTouchStart, { passive: false });
  gridEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  gridEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  restart();
})();
