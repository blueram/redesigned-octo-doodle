(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB_URL="https://minigame-c8651-default-rtdb.asia-southeast1.firebasedatabase.app";
const firebaseConfig={databaseURL:DB_URL};
let db=null;
try{firebase.initializeApp(firebaseConfig);db=firebase.database();}catch(e){console.warn(e)}
const uid=localStorage.mg_uid||(localStorage.mg_uid=crypto.randomUUID());
const animals=["호랑이","토끼","여우","판다","수달","사자","돌고래","고양이","강아지","펭귄"];
let nickname=localStorage.mg_nick||animals[Math.floor(Math.random()*animals.length)]+Math.floor(100+Math.random()*900);
let stats=JSON.parse(localStorage.mg_stats||'{"chosungBest":null,"chosungWins":0,"oxWins":0,"fortressWins":0}');
let game="", room="", isHost=false, roomRef=null, unsub=null, mode="solo";
const toast=t=>{const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)};
function saveStats(){localStorage.mg_stats=JSON.stringify(stats);renderStats()}
function screen(id){$$(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");$("#homeBtn").classList.toggle("hidden",id==="home")}
function renderStats(){
 $("#myStats").innerHTML=`<div class="player"><div class="muted">초성 최고</div><div class="score">${stats.chosungBest?stats.chosungBest.toFixed(1)+"초":"-"}</div></div>
 <div class="player"><div class="muted">초성 우승</div><div class="score">${stats.chosungWins}</div></div>
 <div class="player"><div class="muted">OX 우승</div><div class="score">${stats.oxWins}</div></div>
 <div class="player"><div class="muted">포트리스 우승</div><div class="score">${stats.fortressWins}</div></div>`;
}
async function hall(){
 if(!db)return;
 const snap=await db.ref("hall").once("value"), v=snap.val()||{};
 const rows=[];
 Object.entries(v).forEach(([id,r])=>rows.push(r));
 rows.sort((a,b)=>(b.total||0)-(a.total||0));
 $("#hall").innerHTML=rows.slice(0,10).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.nick||"익명")}</td><td>${r.total||0}승</td></tr>`).join("")||'<tr><td colspan="3" class="muted">아직 기록이 없습니다.</td></tr>';
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
$("#nickname").value=nickname; renderStats(); hall();
$("#saveNick").onclick=()=>{nickname=$("#nickname").value.trim()||nickname;localStorage.mg_nick=nickname;toast("닉네임을 저장했습니다.")};
$$("[data-game]").forEach(b=>b.onclick=()=>openLobby(b.dataset.game));
$("#homeBtn").onclick=leave;
function gameName(g){return g==="chosung"?"초성게임":g==="ox"?"OX 이동게임":"포트리스"}
function openLobby(g){game=g;$("#lobbyTitle").textContent=gameName(g)+" 대기실";$("#roomPanel").classList.add("hidden");screen("lobby")}
function leave(){
 if(roomRef){roomRef.child("players/"+uid).remove();roomRef=null}
 if(unsub)unsub(); room=""; game=""; screen("home");hall();
}
$("#soloPlay").onclick=()=>startGame("solo");
$("#createRoom").onclick=async()=>{
 if(!db)return toast("Firebase 연결에 실패했습니다.");
 room=Math.random().toString(36).slice(2,8).toUpperCase();isHost=true;mode="online";
 roomRef=db.ref("rooms/"+room);
 await roomRef.set({game,status:"waiting",host:uid,created:Date.now(),players:{[uid]:{nick:nickname,score:0,online:true}}});
 roomRef.child("players/"+uid).onDisconnect().remove();showRoom();watchRoom();
};
$("#joinRoom").onclick=async()=>{
 if(!db)return toast("Firebase 연결에 실패했습니다.");
 room=$("#roomInput").value.trim().toUpperCase();
 if(room.length<4)return toast("방 코드를 확인해 주세요.");
 roomRef=db.ref("rooms/"+room);const snap=await roomRef.once("value"),v=snap.val();
 if(!v)return toast("방을 찾을 수 없습니다."); if(v.game!==game)return toast("다른 게임의 방입니다.");
 if(Object.keys(v.players||{}).length>=2&&!v.players?.[uid])return toast("방이 가득 찼습니다.");
 isHost=v.host===uid;mode="online";await roomRef.child("players/"+uid).set({nick:nickname,score:0,online:true});
 roomRef.child("players/"+uid).onDisconnect().remove();showRoom();watchRoom();
};
function showRoom(){$("#roomPanel").classList.remove("hidden");$("#roomCode").textContent=room}
function watchRoom(){
 const cb=s=>{const v=s.val();if(!v)return;renderRoomPlayers(v.players||{});isHost=v.host===uid;$("#startOnline").disabled=!isHost||Object.keys(v.players||{}).length<2;if(v.status==="playing")startGame("online",v)};
 roomRef.on("value",cb);unsub=()=>roomRef.off("value",cb);
}
function renderRoomPlayers(ps){$("#roomPlayers").innerHTML=Object.entries(ps).map(([id,p])=>`<div class="player ${id===uid?"me":""}"><b>${esc(p.nick)}</b><div class="muted">${id===uid?"나":"상대"}</div></div>`).join("")}
$("#copyRoom").onclick=()=>navigator.clipboard?.writeText(room).then(()=>toast("방 코드를 복사했습니다."));
$("#shareRoom").onclick=async()=>{const url=location.origin+location.pathname+"?game="+game+"&room="+room;try{await navigator.share({title:"MiniGame 초대",text:`${nickname}님의 ${gameName(game)} 방`,url})}catch{navigator.clipboard?.writeText(url);toast("초대 링크를 복사했습니다.")}};
$("#startOnline").onclick=async()=>{if(!isHost)return;await roomRef.update({status:"playing",started:Date.now(),state:null})};
function startGame(m,v){mode=m;if(unsub){unsub();unsub=null} if(game==="chosung")startChosung();else if(game==="ox")startOX();else startFortress()}

/* CHOSUNG */
const WORDS=["가방","가위","가족","간식","갈비","감자","강아지","거울","건물","게임","겨울","고기","고양이","공원","공책","과자","교실","구름","기차","김밥","나무","냉면","노래","눈물","다리","달력","도서관","도시","동물","라면","마음","마이크","만두","모자","무지개","문어","바나나","바다","바람","박물관","밥상","배추","버스","병원","보리","복숭아","비누","비행기","사과","사람","사진","산책","선물","수박","시장","신발","아기","아이스크림","안경","야구","약속","양말","여행","연필","영화","오렌지","우산","운동","원숭이","음악","의자","자동차","자전거","장갑","전화","지갑","지하철","창문","책상","초콜릿","치킨","친구","카메라","커피","컴퓨터","토마토","학교","햄버거","휴대폰","냉장고","세탁기","청소기","에어컨","로봇","텔레비전","선풍기","제습기","전자레인지","공기청정기","안마의자","노트북","키보드","마우스","인터넷","소파","침대","식탁","옷장","화장실","주방","거실","베란다","아파트","엘리베이터","계단","주차장","편의점","백화점","마트","식당","카페","빵집","미용실","은행","우체국","경찰서","소방서","놀이터","수영장","헬스장","축구장","야구장","공항","기차역","버스터미널","여권","비밀번호","생일","결혼식","졸업식","크리스마스","어린이날","추석","설날","봄","여름","가을","겨울","아침","점심","저녁","새벽","월요일","화요일","수요일","목요일","금요일","토요일","일요일"];
const CHO=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const toCho=w=>[...w].map(c=>{let n=c.charCodeAt(0)-44032;return n>=0&&n<11172?CHO[Math.floor(n/588)]:c}).join("");
let choList=[],choIdx=0,choStart=0,choTimer=null,choScores={};
function startChosung(){
 screen("chosung");choIdx=0;choScores={};choStart=performance.now();$("#choMode").textContent=mode==="solo"?"혼자":"온라인 10점 선승";
 if(mode==="solo"){choList=[...WORDS].sort(()=>Math.random()-.5).slice(0,10);nextCho();choTimer=setInterval(()=>$("#choTime").textContent=((performance.now()-choStart)/1000).toFixed(1)+"초",100)}
 else setupChoOnline();
}
function nextCho(){if(choIdx>=choList.length)return finishChoSolo();let w=choList[choIdx];$("#choQ").textContent=toCho(w);$("#choHint").textContent=`${w.length}글자`;$("#choRound").textContent=`${choIdx+1} / ${choList.length}`;$("#choProgress").style.width=(choIdx/choList.length*100)+"%";$("#choAnswer").value="";$("#choAnswer").focus()}
function submitCho(){
 const a=$("#choAnswer").value.trim();if(!a)return;
 if(mode==="solo"){if(a===choList[choIdx]){choIdx++;nextCho()}else toast("다시 생각해 보세요.")}
 else if(roomRef)roomRef.child("state").transaction(st=>{
  if(!st||st.answer!==a||st.roundWinner)return st;
  st.roundWinner=uid;st.scores=st.scores||{};st.scores[uid]=(st.scores[uid]||0)+1;return st;
 });
}
$("#choSubmit").onclick=submitCho;$("#choAnswer").onkeydown=e=>{if(e.key==="Enter")submitCho()};
function finishChoSolo(){clearInterval(choTimer);let t=(performance.now()-choStart)/1000;$("#choProgress").style.width="100%";$("#choQ").textContent="완료!";$("#choHint").textContent=`10문제 ${t.toFixed(1)}초`;if(!stats.chosungBest||t<stats.chosungBest)stats.chosungBest=t;saveStats();toast("최고 기록을 확인하세요.")}
async function setupChoOnline(){
 const stateRef=roomRef.child("state");
 if(isHost){let w=WORDS[Math.floor(Math.random()*WORDS.length)];await stateRef.set({type:"chosung",word:w,answer:w,round:1,scores:{},roundWinner:null})}
 const cb=s=>{let st=s.val();if(!st)return;$("#choQ").textContent=toCho(st.word);$("#choHint").textContent=`${st.word.length}글자`;$("#choRound").textContent=`${st.round||1} 라운드`;choScores=st.scores||{};renderChoScores();if(st.roundWinner&&isHost){let winScore=Math.max(...Object.values(choScores),0);setTimeout(async()=>{if(winScore>=10){await finishOnline("chosung",st.roundWinner);return}let w=WORDS[Math.floor(Math.random()*WORDS.length)];await stateRef.set({type:"chosung",word:w,answer:w,round:(st.round||1)+1,scores:choScores,roundWinner:null})},900)}};
 stateRef.on("value",cb);unsub=()=>stateRef.off("value",cb);
}
function renderChoScores(){roomRef.child("players").once("value").then(s=>{$("#choScores").innerHTML=Object.entries(s.val()||{}).map(([id,p])=>`<div class="player ${id===uid?"me":""}"><b>${esc(p.nick)}</b><div class="score">${choScores[id]||0}</div></div>`).join("")})}

/* OX - 각자 3개 배치 후 자기 말을 빈칸으로 이동 */
let ox={board:Array(9).fill(""),turn:"X",me:"X",roundWins:{X:0,O:0},over:false},oxSelected=null;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function startOX(){
 screen("ox");
 ox={board:Array(9).fill(""),turn:"X",me:"X",roundWins:{X:0,O:0},over:false};
 oxSelected=null;
 buildOX();
 if(mode==="online")setupOXOnline(); else renderOX();
}

function buildOX(){
 $("#oxBoard").innerHTML="";
 for(let i=0;i<9;i++){
   const b=document.createElement("button");
   b.className="ox-cell";
   b.onclick=()=>oxCellClick(i);
   $("#oxBoard").appendChild(b);
 }
}

function oxCount(mark){return ox.board.filter(v=>v===mark).length}
function oxPhase(mark){return oxCount(mark)<3?"place":"move"}

function oxCellClick(i){
 if(ox.over||ox.turn!==ox.me)return;
 const mark=ox.me;

 if(oxPhase(mark)==="place"){
   if(ox.board[i])return toast("빈칸을 선택해 주세요.");
   ox.board[i]=mark;
   finishOXTurn();
   return;
 }

 if(oxSelected===null){
   if(ox.board[i]!==mark)return toast("이동할 내 말을 먼저 선택해 주세요.");
   oxSelected=i;
   renderOX();
   return;
 }

 if(i===oxSelected){
   oxSelected=null;
   renderOX();
   return;
 }

 if(ox.board[i]===mark){
   oxSelected=i;
   renderOX();
   return;
 }

 if(ox.board[i])return toast("빈칸으로만 이동할 수 있습니다.");

 ox.board[i]=mark;
 ox.board[oxSelected]="";
 oxSelected=null;
 finishOXTurn();
}

function oxWinner(){
 for(const l of wins){
   if(ox.board[l[0]]&&ox.board[l[0]]===ox.board[l[1]]&&ox.board[l[1]]===ox.board[l[2]])return ox.board[l[0]];
 }
 return null;
}

function finishOXTurn(){
 const winner=oxWinner();
 if(winner){
   ox.over=true;
   ox.roundWins[winner]=(ox.roundWins[winner]||0)+1;
   renderOX();

   if(ox.roundWins[winner]>=3){
     const myWin=(mode==="solo"&&winner==="X")||(mode==="online"&&winner===ox.me);
     if(myWin){
       stats.oxWins++;
       saveStats();
       if(mode==="online")finishOnline("ox",uid);
     }
     $("#oxStatus").textContent=`${winner} 최종 승리 · 3승 달성`;
   }else{
     $("#oxStatus").textContent=`${winner} 승리 · 다음 판을 시작하세요`;
     $("#oxReset").classList.remove("hidden");
   }
   if(mode==="online")roomRef.child("state").set(ox);
   return;
 }

 ox.turn=ox.turn==="X"?"O":"X";
 renderOX();
 if(mode==="online")roomRef.child("state").set(ox);
 else if(ox.turn==="O")setTimeout(oxAIMove,450);
}

function emptyOX(){return ox.board.map((v,i)=>v?null:i).filter(v=>v!==null)}
function allOXMoves(mark){
 const own=ox.board.map((v,i)=>v===mark?i:null).filter(v=>v!==null);
 const empty=emptyOX(), result=[];
 own.forEach(from=>empty.forEach(to=>result.push({from,to})));
 return result;
}
function testPlacement(mark){
 if(oxCount(mark)>=3)return null;
 for(const i of emptyOX()){
   ox.board[i]=mark;
   const win=oxWinner()===mark;
   ox.board[i]="";
   if(win)return i;
 }
 return null;
}
function testMovement(mark){
 if(oxCount(mark)<3)return null;
 for(const m of allOXMoves(mark)){
   ox.board[m.from]="";
   ox.board[m.to]=mark;
   const win=oxWinner()===mark;
   ox.board[m.to]="";
   ox.board[m.from]=mark;
   if(win)return m;
 }
 return null;
}

function oxAIMove(){
 if(ox.over||ox.turn!=="O")return;

 if(oxPhase("O")==="place"){
   let i=testPlacement("O");
   if(i===null)i=testPlacement("X");
   if(i===null){
     const choices=[4,0,2,6,8,1,3,5,7].filter(x=>!ox.board[x]);
     i=choices[Math.floor(Math.random()*Math.min(choices.length,3))];
   }
   ox.board[i]="O";
 }else{
   let move=testMovement("O");
   if(!move)move=testMovement("X");
   if(!move){
     const choices=allOXMoves("O");
     move=choices[Math.floor(Math.random()*choices.length)];
   }
   if(move){
     ox.board[move.from]="";
     ox.board[move.to]="O";
   }
 }
 finishOXTurn();
}

$("#oxReset").onclick=()=>{
 const winsKeep={...ox.roundWins}, mark=ox.me;
 ox={board:Array(9).fill(""),turn:"X",me:mark,roundWins:winsKeep,over:false};
 oxSelected=null;
 $("#oxReset").classList.add("hidden");
 renderOX();
 if(mode==="online")roomRef.child("state").set(ox);
 else if(ox.me==="O")setTimeout(oxAIMove,350);
};

function renderOX(){
 $$("#oxBoard .ox-cell").forEach((b,i)=>{
   b.textContent=ox.board[i];
   b.style.outline=i===oxSelected?"4px solid #38bdf8":"none";
   b.style.transform=i===oxSelected?"scale(.93)":"";
 });

 if(!ox.over){
   if(ox.turn!==ox.me)$("#oxStatus").textContent="상대 차례";
   else if(oxPhase(ox.me)==="place")$("#oxStatus").textContent=`빈칸에 ${ox.me} 놓기 · ${oxCount(ox.me)+1}/3`;
   else if(oxSelected===null)$("#oxStatus").textContent="이동할 내 말을 선택하세요";
   else $("#oxStatus").textContent="이동할 빈칸을 선택하세요";
 }

 const other=ox.me==="X"?"O":"X";
 $("#oxPlayers").innerHTML=
 `<div class="player me"><b>${esc(nickname)} (${ox.me})</b><div class="score">${ox.roundWins[ox.me]||0}승 · 말 ${oxCount(ox.me)}개</div></div>
 <div class="player"><b>${mode==="solo"?"PC":"상대"} (${other})</b><div class="score">${ox.roundWins[other]||0}승 · 말 ${oxCount(other)}개</div></div>`;
}

async function setupOXOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{};
 const ids=Object.keys(ps);
 ox.me=ids[0]===uid?"X":"O";
 if(isHost)await roomRef.child("state").set(ox);

 const stateRef=roomRef.child("state");
 const cb=s=>{
   const st=s.val();
   if(!st)return;
   const myMark=ox.me;
   ox=st;
   ox.me=myMark;
   oxSelected=null;
   renderOX();
 };
 stateRef.on("value",cb);
 unsub=()=>stateRef.off("value",cb);
}

/* FORTRESS - 탱크 방향 고정, 좌우 이동, 각도/파워 별도 조절 */
const can=$("#fortCanvas"),ctx=can.getContext("2d");
let ft,anim=false,holdTimer=null,holdDelay=null;

function terrainY(x){return 315+35*Math.sin(x/105)+18*Math.sin(x/47)}
function newFT(){
 return{
   tanks:[
     {x:100,hp:100,angle:45,power:55},
     {x:760,hp:100,angle:45,power:55}
   ],
   turn:0,wins:[0,0],over:false,
   ai:{shots:0,hitAt:5+Math.floor(Math.random()*6)}
 };
}

function startFortress(){
 screen("fortress");
 ft=newFT();
 if(mode==="online")setupFortOnline();
 renderFT();
}

function drawFT(projectile=null){
 ctx.clearRect(0,0,can.width,can.height);
 const sky=ctx.createLinearGradient(0,0,0,430);
 sky.addColorStop(0,"#66c7ff");sky.addColorStop(.7,"#d7f0ff");
 ctx.fillStyle=sky;ctx.fillRect(0,0,860,430);

 ctx.beginPath();ctx.moveTo(0,terrainY(0));
 for(let x=0;x<=860;x+=4)ctx.lineTo(x,terrainY(x));
 ctx.lineTo(860,430);ctx.lineTo(0,430);ctx.closePath();
 ctx.fillStyle="#6f5439";ctx.fill();

 ft.tanks.forEach((t,i)=>{
   const y=terrainY(t.x)-13;
   ctx.fillStyle=i===0?"#2563eb":"#dc2626";
   ctx.fillRect(t.x-19,y-8,38,16);
   ctx.beginPath();ctx.arc(t.x,y-11,10,0,Math.PI*2);ctx.fill();

   // 왼쪽 탱크는 오른쪽, 오른쪽 탱크는 왼쪽만 바라봄
   const elev=t.angle*Math.PI/180;
   const dir=i===0?1:-1;
   const endX=t.x+dir*Math.cos(elev)*31;
   const endY=y-13-Math.sin(elev)*31;
   ctx.strokeStyle="#111827";ctx.lineWidth=5;ctx.lineCap="round";
   ctx.beginPath();ctx.moveTo(t.x,y-13);ctx.lineTo(endX,endY);ctx.stroke();

   ctx.fillStyle="#fff";ctx.font="bold 13px system-ui";
   ctx.fillText(`HP ${t.hp}`,t.x-20,y-31);
 });

 if(projectile){
   ctx.beginPath();ctx.arc(projectile.x,projectile.y,5,0,Math.PI*2);
   ctx.fillStyle="#111827";ctx.fill();
 }
}

function myFTIndex(){return mode==="solo"?0:(ft.me??0)}

function renderFT(){
 const me=myFTIndex(), other=1-me, t=ft.tanks[me];
 if(!ft.over)$("#fortStatus").textContent=ft.turn===me?"내 차례":"상대 차례";

 $("#fortPlayers").innerHTML=
 `<div class="player me"><b>${esc(nickname)}</b><div class="score">${ft.wins[me]}승 · HP ${ft.tanks[me].hp}</div></div>
 <div class="player"><b>${mode==="solo"?"PC":"상대"}</b><div class="score">${ft.wins[other]}승 · HP ${ft.tanks[other].hp}</div></div>`;

 $("#fortInfo").textContent=`위치 ${Math.round(t.x)} · 포신 각도 ${t.angle}° · 파워 ${t.power}`;
 const active=!ft.over&&!anim&&ft.turn===me;
 ["moveLeft","moveRight","angleDown","angleUp","powerDown","powerUp","fireBtn"].forEach(id=>$("#"+id).disabled=!active);
 drawFT();
}

function adjustFT(kind,delta){
 const me=myFTIndex();
 if(ft.over||anim||ft.turn!==me)return;
 const t=ft.tanks[me];

 if(kind==="x"){
   const min=me===0?35:465, max=me===0?395:825;
   t.x=Math.max(min,Math.min(max,t.x+delta));
 }else if(kind==="angle"){
   t.angle=Math.max(10,Math.min(80,t.angle+delta));
 }else{
   t.power=Math.max(20,Math.min(90,t.power+delta));
 }
 syncFT();
}

function bindHold(id,action){
 const el=$("#"+id);
 const stop=()=>{clearTimeout(holdDelay);clearInterval(holdTimer);holdDelay=null;holdTimer=null};
 const start=e=>{
   e.preventDefault();stop();action();
   holdDelay=setTimeout(()=>{holdTimer=setInterval(action,150)},350);
 };
 el.addEventListener("pointerdown",start);
 ["pointerup","pointercancel","pointerleave"].forEach(ev=>el.addEventListener(ev,stop));
 el.addEventListener("contextmenu",e=>e.preventDefault());
}

bindHold("moveLeft",()=>adjustFT("x",-6));
bindHold("moveRight",()=>adjustFT("x",6));
bindHold("angleDown",()=>adjustFT("angle",-1));
bindHold("angleUp",()=>adjustFT("angle",1));
bindHold("powerDown",()=>adjustFT("power",-1));
bindHold("powerUp",()=>adjustFT("power",1));
$("#fireBtn").onclick=()=>fireFT();

function syncFT(){
 renderFT();
 if(mode==="online")roomRef.child("state").set(ft);
}

function shotVector(shooter){
 const t=ft.tanks[shooter];
 const elev=t.angle*Math.PI/180;
 const dir=shooter===0?1:-1;
 const speed=t.power*.22;
 return {x:t.x,y:terrainY(t.x)-27,vx:dir*Math.cos(elev)*speed,vy:-Math.sin(elev)*speed};
}

function fireFT(forceHit=false){
 const shooter=ft.turn, me=myFTIndex();
 if(ft.over||anim)return;
 if(mode!=="solo"&&shooter!==me)return;
 if(mode==="solo"&&shooter===0&&me!==0)return;

 anim=true;
 const p=shotVector(shooter);
 const target=1-shooter;
 let step=0;

 function tick(){
   step++;
   p.x+=p.vx;p.y+=p.vy;p.vy+=.16;
   drawFT(p);

   const targetTank=ft.tanks[target];
   const targetY=terrainY(targetTank.x)-18;
   const hit=Math.hypot(p.x-targetTank.x,p.y-targetY)<25;

   if(hit)return endShot(shooter,true);
   if(p.x<0||p.x>860||p.y>terrainY(Math.max(0,Math.min(860,p.x)))||step>520){
     return endShot(shooter,false);
   }
   requestAnimationFrame(tick);
 }
 tick();
}

function endShot(shooter,hit){
 anim=false;
 const target=1-shooter;
 if(hit)ft.tanks[target].hp=Math.max(0,ft.tanks[target].hp-35);

 const dead=ft.tanks.findIndex(t=>t.hp<=0);
 if(dead>=0){
   const winner=1-dead;
   ft.wins[winner]++;
   ft.over=true;
   $("#fortNext").classList.remove("hidden");

   if(ft.wins[winner]>=3){
     const me=myFTIndex();
     if(winner===me){
       stats.fortressWins++;saveStats();
       if(mode==="online")finishOnline("fortress",uid);
     }
     $("#fortStatus").textContent="최종 경기 종료 · 3승 달성";
   }else{
     $("#fortStatus").textContent=`${winner===myFTIndex()?"내":"상대"} 승리 · 다음 판`;
   }
   syncFT();
   return;
 }

 ft.turn=target;
 syncFT();
 if(mode==="solo"&&ft.turn===1)setTimeout(pcFT,600);
}

function simulateImpact(shooter,angle,power){
 const t=ft.tanks[shooter], dir=shooter===0?1:-1;
 let x=t.x,y=terrainY(t.x)-27;
 let vx=dir*Math.cos(angle*Math.PI/180)*(power*.22);
 let vy=-Math.sin(angle*Math.PI/180)*(power*.22);
 for(let i=0;i<520;i++){
   x+=vx;y+=vy;vy+=.16;
   if(x<0||x>860||y>terrainY(Math.max(0,Math.min(860,x))))return {x,y};
 }
 return {x,y};
}

function findAIAim(wantHit){
 const target=ft.tanks[0];
 let best={angle:45,power:55,error:99999};
 for(let a=15;a<=78;a+=2){
   for(let p=25;p<=90;p+=2){
     const impact=simulateImpact(1,a,p);
     const err=Math.abs(impact.x-target.x);
     if(err<best.error)best={angle:a,power:p,error:err};
   }
 }
 if(wantHit)return best;

 // 명중 예정 전에는 일부러 좌우로 빗나가게 함
 const miss=best.error<60
   ? {...best,power:Math.max(25,Math.min(90,best.power+(Math.random()<.5?-10:10)))}
   : best;
 return miss;
}

function pcFT(){
 if(ft.over||ft.turn!==1)return;
 ft.ai=ft.ai||{shots:0,hitAt:5+Math.floor(Math.random()*6)};
 ft.ai.shots++;
 const wantHit=ft.ai.shots>=ft.ai.hitAt;
 const aim=findAIAim(wantHit);
 ft.tanks[1].angle=aim.angle;
 ft.tanks[1].power=aim.power;

 // 명중 후 다음 5~10회 계획 재설정
 if(wantHit){
   ft.ai.shots=0;
   ft.ai.hitAt=5+Math.floor(Math.random()*6);
 }
 renderFT();
 setTimeout(()=>fireFT(),400);
}

$("#fortNext").onclick=()=>{
 const keepWins=[...ft.wins];
 const keepMe=ft.me;
 ft=newFT();
 ft.wins=keepWins;
 if(mode==="online")ft.me=keepMe;
 $("#fortNext").classList.add("hidden");
 syncFT();
 if(mode==="solo"&&ft.turn===1)setTimeout(pcFT,500);
};

async function setupFortOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{};
 const ids=Object.keys(ps), me=ids.indexOf(uid);
 if(isHost){
   ft.me=0;
   await roomRef.child("state").set(ft);
 }else ft.me=me;

 const stateRef=roomRef.child("state");
 const cb=s=>{
   const st=s.val();
   if(!st)return;
   st.me=me;
   ft=st;
   renderFT();
 };
 stateRef.on("value",cb);
 unsub=()=>stateRef.off("value",cb);
}

can.addEventListener("dblclick",e=>e.preventDefault());
document.addEventListener("gesturestart",e=>e.preventDefault());

/* Hall */
async function finishOnline(kind,winner){
 if(winner!==uid)return;
 if(kind==="chosung"){stats.chosungWins++;saveStats()}
 let ref=db.ref("hall/"+uid);await ref.transaction(v=>({nick:nickname,total:(v?.total||0)+1,updated:Date.now()}));
 toast("우승 기록이 저장되었습니다.");
}
const qp=new URLSearchParams(location.search),qg=qp.get("game"),qr=qp.get("room");
if(qg&&qr){game=qg;openLobby(game);$("#roomInput").value=qr;setTimeout(()=>$("#joinRoom").click(),300)}
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();