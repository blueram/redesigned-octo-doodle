const $ = id => document.getElementById(id);
let state = null;
let deferredPrompt = null;

const cells = Array.from({ length: 9 }, (_, i) => {
  const btn = document.createElement('button');
  btn.className = 'cell';
  btn.setAttribute('aria-label', `${i + 1}번 칸`);
  btn.addEventListener('click', () => tap(i));
  $('board').appendChild(btn);
  return btn;
});

$('localBtn').onclick = startGame;
$('nextRoundBtn').onclick = nextRound;
$('homeBtn').onclick = () => {
  $('game').classList.add('hidden');
  $('lobby').classList.remove('hidden');
};
$('resetScoresBtn').onclick = () => {
  if (confirm('누적 점수와 현재 경기를 초기화할까요?')) {
    state.scores = { X: 0, O: 0, draw: 0 };
    saveScores();
    nextRound();
  }
};

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $('installBtn').classList.remove('hidden');
});
$('installBtn').onclick = async () => {
  if (!deferredPrompt) {
    alert('아이폰은 Safari 공유 버튼 → 홈 화면에 추가를 선택하세요.');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBtn').classList.add('hidden');
};

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem('moveOxScores')) || { X: 0, O: 0, draw: 0 };
  } catch {
    return { X: 0, O: 0, draw: 0 };
  }
}

function startGame() {
  state = {
    board: Array(9).fill(null),
    turn: 'X',
    selected: null,
    winner: null,
    scores: loadScores()
  };
  $('lobby').classList.add('hidden');
  $('game').classList.remove('hidden');
  render();
}

function tap(index) {
  if (!state || state.winner) return;
  const symbol = state.turn;
  const ownCount = state.board.filter(v => v === symbol).length;

  if (ownCount < 3) {
    if (state.board[index]) return;
    state.board[index] = symbol;
  } else {
    if (state.selected === null) {
      if (state.board[index] !== symbol) return;
      state.selected = index;
      render();
      return;
    }
    if (state.board[index] === symbol) {
      state.selected = index;
      render();
      return;
    }
    if (state.board[index]) return;
    state.board[state.selected] = null;
    state.board[index] = symbol;
    state.selected = null;
  }

  const winner = checkWinner(state.board);
  if (winner) {
    state.winner = winner;
    state.scores[winner] += 1;
    saveScores();
    if (navigator.vibrate) navigator.vibrate([100, 50, 180]);
  } else {
    state.turn = symbol === 'X' ? 'O' : 'X';
  }
  render();
}

function checkWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function nextRound() {
  state.board = Array(9).fill(null);
  state.turn = state.scores.X <= state.scores.O ? 'X' : 'O';
  state.selected = null;
  state.winner = null;
  render();
}

function saveScores() {
  localStorage.setItem('moveOxScores', JSON.stringify(state.scores));
}

function render() {
  $('xScore').textContent = state.scores.X;
  $('oScore').textContent = state.scores.O;
  $('drawScore').textContent = state.scores.draw || 0;

  cells.forEach((cell, i) => {
    const value = state.board[i];
    cell.textContent = value || '';
    cell.className = 'cell' + (value ? ` ${value.toLowerCase()}` : '');
    if (state.selected === i) cell.classList.add('selected');
    if (!value && state.selected !== null) cell.classList.add('available');
  });

  if (state.winner) {
    $('status').textContent = `${state.winner} 승리!`;
    $('guide').textContent = '누적 점수에 반영되었습니다.';
    $('nextRoundBtn').classList.remove('hidden');
    toast(`🎉 ${state.winner} 승리!`);
    return;
  }

  $('nextRoundBtn').classList.add('hidden');
  $('status').textContent = `${state.turn} 차례`;
  const ownCount = state.board.filter(v => v === state.turn).length;
  if (ownCount < 3) $('guide').textContent = `빈칸을 선택하세요. 현재 말 ${ownCount}/3개`;
  else if (state.selected === null) $('guide').textContent = '이동할 자신의 말을 먼저 선택하세요.';
  else $('guide').textContent = '선택한 말을 옮길 빈칸을 선택하세요.';
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
