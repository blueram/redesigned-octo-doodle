(() => {
"use strict";

// 브라우저 확대 방지
document.addEventListener("dblclick", e => e.preventDefault(), {passive:false});
document.addEventListener("gesturestart", e => e.preventDefault(), {passive:false});
let lastTouchEnd=0;
document.addEventListener("touchend", e => {
  const now=Date.now();
  if(now-lastTouchEnd<=300) e.preventDefault();
  lastTouchEnd=now;
},{passive:false});

const $=id=>document.getElementById(id);
const screens={home:$("homeScreen"),ox:$("oxScreen"),chosung:$("chosungScreen"),fortress:$("fortressScreen")};
const titles={home:"PC와 함께 즐기는 3가지 미니게임",ox:"OX 이동식 게임",chosung:"초성 퀴즈",fortress:"포트리스 PC 대전"};
function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
  $("homeBtn").classList.toggle("hidden",name==="home");
  $("subtitle").textContent=titles[name];
  if(name==="fortress") requestAnimationFrame(drawFortress);
}
document.querySelectorAll(".game-card").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.game)));
$("homeBtn").addEventListener("click",()=>showScreen("home"));

// OX 이동식 게임
const oxBoardEl=$("oxBoard");
let oxBoard,oxTurn,oxSelected,oxOver;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function oxCount(mark){return oxBoard.filter(v=>v===mark).length}
function oxWinner(){for(const w of wins) if(w.every(i=>oxBoard[i]&&oxBoard[i]===oxBoard[w[0]])) return oxBoard[w[0]];return null}
function oxAdjacent(a,b){const ar=Math.floor(a/3),ac=a%3,br=Math.floor(b/3),bc=b%3;return Math.max(Math.abs(ar-br),Math.abs(ac-bc))===1}
function oxReset(){
  oxBoard=Array(9).fill("");oxTurn="X";oxSelected=null;oxOver=false;
  $("oxStatus").textContent="내 차례입니다.";renderOx();
}
function renderOx(){
  oxBoardEl.innerHTML="";
  oxBoard.forEach((v,i)=>{
    const b=document.createElement("button");
    const movable = oxSelected!==null && !v;
    b.className=`ox-cell ${v.toLowerCase()} ${oxSelected===i?"selected":""} ${movable?"movable":""}`;
    b.textContent=v;b.addEventListener("click",()=>oxClick(i));oxBoardEl.appendChild(b);
  });
}
function oxClick(i){
  if(oxOver||oxTurn!=="X") return;
  if(oxCount("X")<3){
    if(oxBoard[i]) return;
    oxBoard[i]="X";
    return oxAfterMove();
  }
  if(oxSelected===null){
    if(oxBoard[i]==="X"){
      oxSelected=i;
      $("oxStatus").textContent="이동할 빈칸을 선택하세요.";
      renderOx();
    }
    return;
  }

  // 다른 내 말을 누르면 선택 변경
  if(oxBoard[i]==="X"){
    oxSelected=i;
    $("oxStatus").textContent="선택한 말을 이동할 빈칸을 누르세요.";
    renderOx();
    return;
  }

  // 같은 말을 다시 누르면 선택 해제
  if(i===oxSelected){
    oxSelected=null;
    $("oxStatus").textContent="이동할 내 말을 선택하세요.";
    renderOx();
    return;
  }

  // 내 말 3개를 모두 놓은 뒤에는 비어 있는 어느 칸으로든 이동 가능
  if(!oxBoard[i]){
    oxBoard[i]="X";
    oxBoard[oxSelected]="";
    oxSelected=null;
    oxAfterMove();
  }
}
function oxAfterMove(){
  renderOx();
  const w=oxWinner();
  if(w){oxOver=true;$("oxStatus").textContent=w==="X"?"내가 이겼습니다!":"PC가 이겼습니다.";return}
  oxTurn=oxTurn==="X"?"O":"X";
  if(oxTurn==="O"){ $("oxStatus").textContent="PC가 생각 중...";setTimeout(oxAi,450)}
  else $("oxStatus").textContent="내 차례입니다.";
}
function oxAi(){
  if(oxOver)return;
  const tryWin=(mark)=>{
    for(let i=0;i<9;i++) if(!oxBoard[i]){
      oxBoard[i]=mark;const win=oxWinner()===mark;oxBoard[i]="";if(win)return i;
    } return -1;
  };
  if(oxCount("O")<3){
    let i=tryWin("O");if(i<0)i=tryWin("X");
    if(i<0){const pref=[4,0,2,6,8,1,3,5,7].filter(x=>!oxBoard[x]);i=pref[Math.floor(Math.random()*Math.min(3,pref.length))]}
    oxBoard[i]="O";oxAfterMove();return;
  }
  const moves=[];
  oxBoard.forEach((v,from)=>{
    if(v!=="O")return;
    oxBoard.forEach((empty,to)=>{if(!empty&&oxAdjacent(from,to))moves.push({from,to})});
  });
  let chosen=null;
  for(const m of moves){oxBoard[m.from]="";oxBoard[m.to]="O";if(oxWinner()==="O")chosen=m;oxBoard[m.to]="";oxBoard[m.from]="O";if(chosen)break}
  if(!chosen) chosen=moves[Math.floor(Math.random()*moves.length)];
  if(!chosen){oxOver=true;$("oxStatus").textContent="이동할 수 없어 무승부입니다.";return}
  oxBoard[chosen.from]="";oxBoard[chosen.to]="O";oxAfterMove();
}
$("oxReset").addEventListener("click",oxReset);oxReset();

// 초성 퀴즈
const quizData=[
 {c:"음식",i:"ㅂㅂ",h:"비 오는 날 생각나는 전 요리",a:"빈대떡"},
 {c:"동물",i:"ㄱㄹ",h:"목이 긴 초식동물",a:"기린"},
 {c:"과일",i:"ㅅㄱ",h:"빨갛거나 초록색인 과일",a:"사과"},
 {c:"나라",i:"ㄷㅎㅁㄱ",h:"우리가 살고 있는 나라",a:"대한민국"},
 {c:"가전",i:"ㄴㅈㄱ",h:"음식을 차갑게 보관",a:"냉장고"},
 {c:"직업",i:"ㅅㅂㄱ",h:"불을 끄고 사람을 구조",a:"소방관"},
 {c:"교통",i:"ㅈㅎㅊ",h:"전기로 달리는 철도 교통수단",a:"지하철"},
 {c:"스포츠",i:"ㅊㄱ",h:"발로 공을 차는 경기",a:"축구"},
 {c:"장소",i:"ㄷㅅㄱ",h:"책을 빌려 읽는 곳",a:"도서관"},
 {c:"음식",i:"ㄱㅂ",h:"김과 밥으로 돌돌 만 음식",a:"김밥"}
];
let quizOrder=[],quizIndex=0,quizScore=0,quizLocked=false;
function quizStart(){
  quizOrder=[...quizData].sort(()=>Math.random()-.5);quizIndex=0;quizScore=0;quizLocked=false;
  $("quizRestart").classList.add("hidden");$("quizAnswer").classList.remove("hidden");$("quizSubmit").classList.remove("hidden");$("quizSkip").classList.remove("hidden");
  renderQuiz();
}
function renderQuiz(){
  if(quizIndex>=quizOrder.length){
    $("quizProgress").textContent="완료";$("quizCategory").textContent="결과";$("quizInitial").textContent=`${quizScore}점`;
    $("quizHint").textContent=quizScore>=80?"초성 달인입니다!":"한 번 더 도전해 보세요.";
    $("quizAnswer").classList.add("hidden");$("quizSubmit").classList.add("hidden");$("quizSkip").classList.add("hidden");$("quizRestart").classList.remove("hidden");return;
  }
  const q=quizOrder[quizIndex];
  $("quizProgress").textContent=`${quizIndex+1} / ${quizOrder.length}`;$("quizScore").textContent=`점수 ${quizScore}`;
  $("quizCategory").textContent=q.c;$("quizInitial").textContent=q.i;$("quizHint").textContent=q.h;$("quizMessage").textContent="";
  $("quizAnswer").value="";$("quizAnswer").focus();quizLocked=false;
}
function checkQuiz(skip=false){
  if(quizLocked)return;quizLocked=true;const q=quizOrder[quizIndex];
  const answer=$("quizAnswer").value.replace(/\s/g,"");
  if(!skip&&answer===q.a){quizScore+=10;$("quizMessage").textContent="정답입니다! 🎉"}
  else $("quizMessage").textContent=`정답은 '${q.a}'입니다.`;
  $("quizScore").textContent=`점수 ${quizScore}`;
  setTimeout(()=>{quizIndex++;renderQuiz()},900);
}
$("quizSubmit").addEventListener("click",()=>checkQuiz(false));$("quizSkip").addEventListener("click",()=>checkQuiz(true));
$("quizAnswer").addEventListener("keydown",e=>{if(e.key==="Enter")checkQuiz(false)});$("quizRestart").addEventListener("click",quizStart);quizStart();

// 포트리스
const canvas=$("fortressCanvas"),ctx=canvas.getContext("2d");
const W=canvas.width,H=canvas.height,gravity=210;
let terrain=[],player,ai,projectile,fortressState,aiShotTarget,aiShotsUntilHit,aiShotsTaken,explosion;
function groundY(x){const idx=Math.max(0,Math.min(W-1,Math.round(x)));return terrain[idx]??430}
function makeTerrain(){
  terrain=Array.from({length:W},(_,x)=>390+34*Math.sin(x/115)+20*Math.sin(x/43)+Math.max(0,80-Math.abs(x-500)*.42));
}
function tankAt(x,side){
  return {x,y:groundY(x)-16,side,hp:100,angle:side==="player"?45:135,power:60};
}
function fortressReset(){
  makeTerrain();player=tankAt(130,"player");ai=tankAt(870,"ai");projectile=null;explosion=null;
  fortressState="player";aiShotsTaken=0;aiShotsUntilHit=5+Math.floor(Math.random()*6); // 5~10회
  updateFortressUi();$("fortressMessage").textContent=`PC는 ${aiShotsUntilHit}발 이내에 조준을 완성합니다.`;drawFortress();
}
function updateFortressUi(){
  $("angleValue").textContent=`${Math.round(player.angle)}°`;$("powerValue").textContent=Math.round(player.power);
  $("playerHp").style.width=`${player.hp}%`;$("aiHp").style.width=`${ai.hp}%`;
  $("playerHpText").textContent=player.hp;$("aiHpText").textContent=ai.hp;
  $("fortressTurn").textContent=fortressState==="player"?"내 차례":fortressState==="ai"?"PC 차례":"게임 종료";
  const disabled=fortressState!=="player"||!!projectile;
  document.querySelectorAll(".hold-btn").forEach(b=>b.disabled=disabled);$("fireBtn").disabled=disabled;
}
function modify(action){
  if(fortressState!=="player"||projectile)return;
  if(action==="moveLeft") player.x=Math.max(35,player.x-5);
  if(action==="moveRight") player.x=Math.min(455,player.x+5);
  player.y=groundY(player.x)-16;
  if(action==="angleDown") player.angle=Math.max(10,player.angle-1);
  if(action==="angleUp") player.angle=Math.min(80,player.angle+1);
  if(action==="powerDown") player.power=Math.max(20,player.power-1);
  if(action==="powerUp") player.power=Math.min(100,player.power+1);
  updateFortressUi();drawFortress();
}
document.querySelectorAll(".hold-btn").forEach(btn=>{
  let timer=null,started=false;
  const start=e=>{e.preventDefault();if(started)return;started=true;modify(btn.dataset.action);timer=setInterval(()=>modify(btn.dataset.action),115)};
  const stop=()=>{started=false;if(timer){clearInterval(timer);timer=null}};
  btn.addEventListener("pointerdown",start);btn.addEventListener("pointerup",stop);btn.addEventListener("pointercancel",stop);btn.addEventListener("pointerleave",stop);
});
function barrelEnd(t){
  const rad=t.angle*Math.PI/180,len=34;
  return {x:t.x+Math.cos(rad)*len,y:t.y-Math.sin(rad)*len};
}
function launch(t,angle=t.angle,power=t.power){
  const p=barrelEnd({...t,angle});const rad=angle*Math.PI/180;const speed=power*6;
  projectile={x:p.x,y:p.y,vx:Math.cos(rad)*speed,vy:-Math.sin(rad)*speed,owner:t.side,last:performance.now()};
  requestAnimationFrame(stepProjectile);
}
$("fireBtn").addEventListener("click",()=>{
  if(fortressState!=="player"||projectile)return;
  $("fortressMessage").textContent="포탄 발사!";launch(player);
});
function stepProjectile(now){
  if(!projectile)return;
  const dt=Math.min(.035,(now-projectile.last)/1000);projectile.last=now;
  projectile.vy+=gravity*dt;projectile.x+=projectile.vx*dt;projectile.y+=projectile.vy*dt;
  if(projectile.x<0||projectile.x>W||projectile.y>H){finishShot(null);return}
  if(projectile.y>=groundY(projectile.x)){finishShot({x:projectile.x,y:groundY(projectile.x)});return}
  drawFortress();requestAnimationFrame(stepProjectile);
}
function finishShot(hit){
  const owner=projectile.owner;projectile=null;
  if(hit){
    explosion={x:hit.x,y:hit.y,r:1};
    const target=owner==="player"?ai:player;const d=Math.abs(hit.x-target.x);
    if(d<58){const damage=d<22?40:25;target.hp=Math.max(0,target.hp-damage);$("fortressMessage").textContent=`명중! ${damage} 피해`}
    else $("fortressMessage").textContent=d<110?"아깝습니다! 근처에 떨어졌습니다.":"빗나갔습니다.";
    animateExplosion();
  }
  updateFortressUi();
  if(player.hp<=0||ai.hp<=0){fortressState="over";$("fortressMessage").textContent=ai.hp<=0?"승리했습니다! 🏆":"PC가 승리했습니다.";updateFortressUi();drawFortress();return}
  if(owner==="player"){fortressState="ai";updateFortressUi();setTimeout(aiTurn,800)}
  else{fortressState="player";updateFortressUi()}
}
function animateExplosion(){
  if(!explosion)return;explosion.r+=5;drawFortress();
  if(explosion.r<45)requestAnimationFrame(animateExplosion);else{explosion=null;drawFortress()}
}
function ballisticAngleForDistance(distance,power,high=false){
  const v=power*6;const s=Math.min(.98,gravity*distance/(v*v));
  if(s<=0||s>1)return 45;
  let rad=.5*Math.asin(s);if(high)rad=Math.PI/2-rad;
  return rad*180/Math.PI;
}
function aiTurn(){
  if(fortressState!=="ai")return;
  aiShotsTaken++;
  ai.x=Math.max(545,Math.min(965,ai.x+(Math.random()>.5?1:-1)*(5+Math.floor(Math.random()*4))));
  ai.y=groundY(ai.x)-16;
  const distance=ai.x-player.x;
  const forceHit=aiShotsTaken>=aiShotsUntilHit;
  const basePower=62;
  let angle=180-ballisticAngleForDistance(distance,basePower,false);
  // 발사 횟수가 늘수록 오차가 줄고, 지정된 5~10번째 발에는 거의 정확히 명중
  const remaining=Math.max(0,aiShotsUntilHit-aiShotsTaken);
  const error=forceHit?0:(Math.random()*2-1)*(3+remaining*1.6);
  ai.angle=Math.max(100,Math.min(170,angle+error));
  ai.power=basePower+(forceHit?0:(Math.random()*2-1)*(2+remaining*.7));
  $("fortressMessage").textContent=`PC 발사 ${aiShotsTaken}회째`;drawFortress();setTimeout(()=>launch(ai,ai.angle,ai.power),500);
}
function drawTank(t,color){
  ctx.save();ctx.translate(t.x,t.y);
  ctx.fillStyle="#111827";ctx.fillRect(-25,6,50,12);
  ctx.fillStyle=color;ctx.fillRect(-20,-8,40,18);ctx.beginPath();ctx.arc(0,-10,13,Math.PI,0);ctx.fill();
  const rad=t.angle*Math.PI/180;ctx.strokeStyle=color;ctx.lineWidth=8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(Math.cos(rad)*34,-Math.sin(rad)*34-8);ctx.stroke();
  ctx.fillStyle="#020617";[-17,0,17].forEach(x=>{ctx.beginPath();ctx.arc(x,16,7,0,Math.PI*2);ctx.fill()});ctx.restore();
}
function drawFortress(){
  ctx.clearRect(0,0,W,H);
  const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#60a5fa");sky.addColorStop(1,"#dbeafe");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  ctx.fillStyle="#ffffffaa";[[150,80,50],[420,120,65],[760,70,55]].forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r*.45,0,7);ctx.arc(x+r*.45,y-8,r*.55,0,7);ctx.arc(x+r,y,r*.4,0,7);ctx.fill()});
  ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,terrain[0]);terrain.forEach((y,x)=>ctx.lineTo(x,y));ctx.lineTo(W,H);ctx.closePath();
  const grd=ctx.createLinearGradient(0,350,0,H);grd.addColorStop(0,"#65a30d");grd.addColorStop(1,"#365314");ctx.fillStyle=grd;ctx.fill();
  drawTank(player,"#2563eb");drawTank(ai,"#dc2626");
  if(projectile){ctx.fillStyle="#111";ctx.beginPath();ctx.arc(projectile.x,projectile.y,7,0,Math.PI*2);ctx.fill()}
  if(explosion){const g=ctx.createRadialGradient(explosion.x,explosion.y,2,explosion.x,explosion.y,explosion.r);g.addColorStop(0,"#fff");g.addColorStop(.25,"#fde047");g.addColorStop(.7,"#f97316");g.addColorStop(1,"#ef444400");ctx.fillStyle=g;ctx.beginPath();ctx.arc(explosion.x,explosion.y,explosion.r,0,Math.PI*2);ctx.fill()}
}
$("fortressReset").addEventListener("click",fortressReset);fortressReset();

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();