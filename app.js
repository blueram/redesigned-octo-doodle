const socket = io();
const $ = id => document.getElementById(id);
let mySymbol = null, state = null, localMode = false, deferredPrompt = null;

const cells = Array.from({length:9}, (_, i) => {
  const btn = document.createElement('button'); btn.className='cell'; btn.setAttribute('aria-label',`${i+1}번 칸`);
  btn.addEventListener('click',()=> localMode ? localTap(i) : socket.emit('tapCell',{index:i}));
  $('board').appendChild(btn); return btn;
});

function nameValue(){return $('nameInput').value.trim()||'플레이어';}
$('createBtn').onclick=()=>{localMode=false;socket.emit('createRoom',{name:nameValue()});};
$('joinBtn').onclick=()=>{localMode=false;socket.emit('joinRoom',{code:$('roomInput').value,name:nameValue()});};
$('localBtn').onclick=()=>startLocal();
$('roomInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinBtn').click();});
$('nextRoundBtn').onclick=()=> localMode ? localNextRound() : socket.emit('nextRound');
$('resetScoresBtn').onclick=()=>{if(confirm('누적 점수와 현재 경기를 초기화할까요?')) localMode?localReset():socket.emit('resetScores');};

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').classList.remove('hidden');});
$('installBtn').onclick=async()=>{if(!deferredPrompt){alert('아이폰은 Safari 공유 버튼 → 홈 화면에 추가를 선택하세요.');return;} deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('installBtn').classList.add('hidden');};

socket.on('joined',({code,symbol})=>{mySymbol=symbol;$('roomCode').textContent=code;$('mySymbol').textContent=`나는 ${symbol}`;showGame();});
socket.on('errorMessage',msg=>$('lobbyMsg').textContent=msg);
socket.on('state',s=>{if(!localMode){state=s;render();}});

function showGame(){$('lobby').classList.add('hidden');$('game').classList.remove('hidden');}
function startLocal(){localMode=true;mySymbol=null;const saved=JSON.parse(localStorage.getItem('moveOxLocalScores')||'{"X":0,"O":0,"draw":0}');state={code:'한 기기',players:{X:{name:'플레이어 X'},O:{name:'플레이어 O'}},board:Array(9).fill(null),turn:'X',selected:null,winner:null,scores:saved,started:true};$('mySymbol').textContent='번갈아 플레이';showGame();render();}
function localTap(index){if(!state||state.winner)return;const symbol=state.turn,own=state.board.filter(v=>v===symbol).length;if(own<3){if(state.board[index])return;state.board[index]=symbol;}else{if(state.selected===null){if(state.board[index]!==symbol)return;state.selected=index;return render();}if(state.board[index]===symbol){state.selected=index;return render();}if(state.board[index])return;state.board[state.selected]=null;state.board[index]=symbol;state.selected=null;}const w=checkWinner(state.board);if(w){state.winner=w;state.scores[w]++;saveLocal();}else state.turn=symbol==='X'?'O':'X';render();}
function checkWinner(b){for(const [a,c,d] of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]])if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a];return null;}
function localNextRound(){state.board=Array(9).fill(null);state.turn=state.scores.X<=state.scores.O?'X':'O';state.selected=null;state.winner=null;render();}
function localReset(){state.scores={X:0,O:0,draw:0};saveLocal();localNextRound();}
function saveLocal(){localStorage.setItem('moveOxLocalScores',JSON.stringify(state.scores));}

function render(){if(!state)return;$('roomCode').textContent=state.code;$('xName').textContent=state.players.X?.name||'플레이어 X';$('oName').textContent=state.players.O?.name||'플레이어 O';$('xScore').textContent=state.scores.X;$('oScore').textContent=state.scores.O;$('drawScore').textContent=state.scores.draw||0;
  cells.forEach((cell,i)=>{const v=state.board[i];cell.textContent=v||'';cell.className='cell'+(v?` ${v.toLowerCase()}`:'');if(state.selected===i)cell.classList.add('selected');if(!v&&state.selected!==null&&(localMode||state.turn===mySymbol))cell.classList.add('available');});
  if(!state.started){$('status').textContent='상대방 대기 중';$('guide').textContent=`방 번호 ${state.code}를 상대방에게 알려주세요.`;$('nextRoundBtn').classList.add('hidden');return;}
  if(state.winner){$('status').textContent=`${state.winner} 승리!`;$('guide').textContent=`${state.players[state.winner]?.name||state.winner} 승리 · 누적 점수에 반영되었습니다.`;$('nextRoundBtn').classList.remove('hidden');toast('🎉 승리!');return;}
  $('nextRoundBtn').classList.add('hidden');const canPlay=localMode||state.turn===mySymbol;$('status').textContent=`${state.turn} 차례`;const ownCount=state.board.filter(v=>v===state.turn).length;if(!canPlay)$('guide').textContent='상대방이 두는 중입니다.';else if(ownCount<3)$('guide').textContent=`빈칸을 선택하세요. 현재 말 ${ownCount}/3개`;else if(state.selected===null)$('guide').textContent='이동할 말을 먼저 선택하세요.';else $('guide').textContent='선택한 말을 옮길 빈칸을 선택하세요.';}
let toastTimer;function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}
