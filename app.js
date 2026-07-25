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

/* OX */
let ox={board:Array(9).fill(""),turn:"X",me:"X",roundWins:{X:0,O:0},over:false},oxAI=false;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function startOX(){
 screen("ox");oxAI=mode==="solo";ox={board:Array(9).fill(""),turn:"X",me:"X",roundWins:{X:0,O:0},over:false};
 buildOX();
 if(mode==="online")setupOXOnline();else renderOX();
}
function buildOX(){$("#oxBoard").innerHTML="";for(let i=0;i<9;i++){let b=document.createElement("button");b.className="ox-cell";b.onclick=()=>oxMove(i);$("#oxBoard").appendChild(b)}}
function oxMove(i){
 if(ox.over||ox.board[i]||ox.turn!==ox.me)return;
 ox.board[i]=ox.me;afterOXMove();
 if(mode==="online")roomRef.child("state").set(ox);
 else if(!ox.over){ox.turn="O";renderOX();setTimeout(oxAIMove,400)}
}
function oxAIMove(){let empty=ox.board.map((v,i)=>v?"":i).filter(v=>v!=="");if(!empty.length)return;let i=bestOX("O")??bestOX("X")??empty[Math.floor(Math.random()*empty.length)];ox.board[i]="O";afterOXMove();if(!ox.over)ox.turn="X";renderOX()}
function bestOX(mark){for(let line of wins){let vals=line.map(i=>ox.board[i]);if(vals.filter(v=>v===mark).length===2&&vals.includes(""))return line[vals.indexOf("")]}return null}
function oxWinner(){for(let l of wins)if(ox.board[l[0]]&&ox.board[l[0]]===ox.board[l[1]]&&ox.board[l[1]]===ox.board[l[2]])return ox.board[l[0]];return ox.board.every(Boolean)?"D":null}
function afterOXMove(){let w=oxWinner();if(w){ox.over=true;if(w!=="D")ox.roundWins[w]=(ox.roundWins[w]||0)+1;renderOX();if(ox.roundWins[w]>=3){if((mode==="solo"&&w==="X")||(mode==="online"&&w===ox.me)){stats.oxWins++;saveStats();if(mode==="online")finishOnline("ox",uid)}$("#oxStatus").textContent=(w==="D"?"무승부":w+" 승리")+" · 경기 종료"}else $("#oxReset").classList.remove("hidden")}else ox.turn=ox.turn==="X"?"O":"X"}
$("#oxReset").onclick=()=>{ox.board=Array(9).fill("");ox.turn="X";ox.over=false;$("#oxReset").classList.add("hidden");if(mode==="online")roomRef.child("state").set(ox);else renderOX()};
function renderOX(){
 $$("#oxBoard .ox-cell").forEach((b,i)=>b.textContent=ox.board[i]);
 $("#oxStatus").textContent=ox.over?"한 판 종료":(ox.turn===ox.me?"내 차례":"상대 차례");
 $("#oxPlayers").innerHTML=`<div class="player me"><b>${esc(nickname)} (X)</b><div class="score">${ox.roundWins.X||0}</div></div><div class="player"><b>${mode==="solo"?"PC":"상대"} (O)</b><div class="score">${ox.roundWins.O||0}</div></div>`;
}
async function setupOXOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{},ids=Object.keys(ps);ox.me=ids[0]===uid?"X":"O";
 if(isHost)await roomRef.child("state").set(ox);
 const cb=s=>{let st=s.val();if(!st)return;let me=ox.me;ox=st;ox.me=me;renderOX()};
 roomRef.child("state").on("value",cb);unsub=()=>roomRef.child("state").off("value",cb);
}

/* FORTRESS */
const can=$("#fortCanvas"),ctx=can.getContext("2d");
let ft,anim=false;
function terrainY(x){return 315+35*Math.sin(x/105)+18*Math.sin(x/47)}
function newFT(){return{tanks:[{x:100,hp:100,angle:45,power:55},{x:760,hp:100,angle:135,power:55}],turn:0,wins:[0,0],over:false}}
function startFortress(){screen("fortress");ft=newFT();if(mode==="online")setupFortOnline();drawFT();renderFT()}
function drawFT(){
 ctx.clearRect(0,0,can.width,can.height);let g=ctx.createLinearGradient(0,0,0,430);g.addColorStop(0,"#66c7ff");g.addColorStop(.7,"#d7f0ff");ctx.fillStyle=g;ctx.fillRect(0,0,860,430);
 ctx.beginPath();ctx.moveTo(0,terrainY(0));for(let x=0;x<=860;x+=4)ctx.lineTo(x,terrainY(x));ctx.lineTo(860,430);ctx.lineTo(0,430);ctx.closePath();ctx.fillStyle="#6f5439";ctx.fill();
 ft.tanks.forEach((t,i)=>{let y=terrainY(t.x)-13;ctx.fillStyle=i===0?"#2563eb":"#dc2626";ctx.fillRect(t.x-18,y-8,36,16);ctx.beginPath();ctx.arc(t.x,y-10,10,0,Math.PI*2);ctx.fill();let rad=t.angle*Math.PI/180;ctx.strokeStyle="#111827";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(t.x,y-12);ctx.lineTo(t.x+Math.cos(rad)*28,y-12-Math.sin(rad)*28);ctx.stroke();ctx.fillStyle="#fff";ctx.fillText(`${t.hp}`,t.x-9,y-28)});
}
function renderFT(){
 let me=mode==="solo"?0:ft.me??0;$("#fortStatus").textContent=ft.over?"한 판 종료":(ft.turn===me?"내 차례":"상대 차례");
 $("#fortPlayers").innerHTML=`<div class="player ${me===0?"me":""}"><b>${me===0?esc(nickname):(mode==="solo"?"나":"상대")}</b><div class="score">${ft.wins[0]}승 · HP ${ft.tanks[0].hp}</div></div><div class="player ${me===1?"me":""}"><b>${mode==="solo"?"PC":(me===1?esc(nickname):"상대")}</b><div class="score">${ft.wins[1]}승 · HP ${ft.tanks[1].hp}</div></div>`;
 let t=ft.tanks[me];$("#fortInfo").textContent=`각도 ${t.angle}° · 파워 ${t.power}`;
 let active=!ft.over&&!anim&&ft.turn===me;["moveLeft","moveRight","angleDown","angleUp","powerDown","powerUp","fireBtn"].forEach(id=>$("#"+id).disabled=!active);
 drawFT();
}
function adjust(kind,d){let me=mode==="solo"?0:ft.me??0,t=ft.tanks[me];if(ft.turn!==me||ft.over)return;if(kind==="x")t.x=Math.max(35,Math.min(825,t.x+d));else t[kind]=Math.max(kind==="angle"?10:20,Math.min(kind==="angle"?170:90,t[kind]+d));syncFT()}
$("#moveLeft").onclick=()=>adjust("x",-8);$("#moveRight").onclick=()=>adjust("x",8);$("#angleDown").onclick=()=>adjust("angle",-3);$("#angleUp").onclick=()=>adjust("angle",3);$("#powerDown").onclick=()=>adjust("power",-3);$("#powerUp").onclick=()=>adjust("power",3);$("#fireBtn").onclick=fireFT;
function syncFT(){renderFT();if(mode==="online")roomRef.child("state").set(ft)}
function fireFT(){
 let me=mode==="solo"?0:ft.me??0;if(ft.turn!==me||anim)return;anim=true;let t=ft.tanks[me],rad=t.angle*Math.PI/180,x=t.x,y=terrainY(x)-25,v=t.power*0.22,vx=Math.cos(rad)*v,vy=-Math.sin(rad)*v,step=0;
 function tick(){step++;x+=vx;y+=vy;vy+=.16;drawFT();ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle="#111";ctx.fill();let target=ft.tanks[1-me],ty=terrainY(target.x)-15;if(Math.hypot(x-target.x,y-ty)<24){target.hp=Math.max(0,target.hp-35);return endShot()}if(x<0||x>860||y>terrainY(Math.max(0,Math.min(860,x)))||step>500)return endShot();requestAnimationFrame(tick)}
 tick();
}
function endShot(){anim=false;let dead=ft.tanks.findIndex(t=>t.hp<=0);if(dead>=0){let win=1-dead;ft.wins[win]++;ft.over=true;$("#fortNext").classList.remove("hidden");if(ft.wins[win]>=3){let me=mode==="solo"?0:ft.me??0;if(win===me){stats.fortressWins++;saveStats();if(mode==="online")finishOnline("fortress",uid)}$("#fortStatus").textContent="경기 종료"}syncFT();return}ft.turn=1-ft.turn;syncFT();if(mode==="solo"&&ft.turn===1)setTimeout(pcFT,550)}
function pcFT(){if(ft.over)return;let p=ft.tanks[1],target=ft.tanks[0],dx=target.x-p.x;let tries=5+Math.floor(Math.random()*6);p.angle=135+Math.floor(Math.random()*12-6);p.power=Math.max(30,Math.min(85,Math.abs(dx)/12+25+(Math.random()-.5)*tries*2));renderFT();setTimeout(fireFT,350)}
$("#fortNext").onclick=()=>{let wins=ft.wins;ft=newFT();ft.wins=wins;if(mode==="online")ft.me=arguments;$("#fortNext").classList.add("hidden");syncFT()};
async function setupFortOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{},ids=Object.keys(ps),me=ids.indexOf(uid);
 if(isHost){ft.me=0;await roomRef.child("state").set(ft)}else ft.me=me;
 const cb=s=>{let st=s.val();if(!st)return;st.me=me;ft=st;renderFT()};
 roomRef.child("state").on("value",cb);unsub=()=>roomRef.child("state").off("value",cb);
}

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