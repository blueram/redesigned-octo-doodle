(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const DB_URL="https://minigame-c8651-default-rtdb.asia-southeast1.firebasedatabase.app";
const firebaseConfig={databaseURL:DB_URL};
let db=null;
try{firebase.initializeApp(firebaseConfig);db=firebase.database();}catch(e){console.warn(e)}
const uid=localStorage.mg_uid||(localStorage.mg_uid=crypto.randomUUID());
const deviceId=localStorage.mg_device_id||(localStorage.mg_device_id=crypto.randomUUID());
const sessionId=sessionStorage.mg_session_id||(sessionStorage.mg_session_id=crypto.randomUUID());
const playerId=sessionId;
let heartbeatTimer=null;
const animals=["호랑이","토끼","여우","판다","수달","사자","돌고래","고양이","강아지","펭귄"];
let nickname=localStorage.mg_nick||animals[Math.floor(Math.random()*animals.length)]+Math.floor(100+Math.random()*900);
let stats=JSON.parse(localStorage.mg_stats||'{}');
function blankMode(){return {played:0,wins:0,losses:0,draws:0,lastPlayed:null}}
function ensureStats(){
 stats.chosungBest=stats.chosungBest||null;stats.games=stats.games||{};
 for(const k of ["chosung","ox","fortress"]){const old=stats.games[k]||{};stats.games[k]=stats.games[k]||{};for(const m of ["solo","online"]){stats.games[k][m]=stats.games[k][m]&&typeof stats.games[k][m].played==="number"?stats.games[k][m]:blankMode()}if(typeof old.played==="number"){stats.games[k].solo={played:old.played||0,wins:old.wins||0,losses:old.losses||0,draws:old.draws||0,lastPlayed:old.lastPlayed||null}}}
}
ensureStats();
let game="", room="", isHost=false, roomRef=null, unsub=null, mode="solo";
const toast=t=>{const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)};
function saveStats(){localStorage.mg_stats=JSON.stringify(stats);renderStats()}
function screen(id){$$(".screen").forEach(x=>x.classList.remove("active"));$("#"+id).classList.add("active");$("#homeBtn").classList.toggle("hidden",id==="home");$("#titleVersion")?.classList.toggle("hidden",id!=="home")}
function renderStats(){
 const card=(key,label)=>{const a=stats.games[key].solo,b=stats.games[key].online;const line=(n,x)=>`${n} ${x.wins}승 ${x.losses}패 ${x.draws}무 · ${x.played}전`;return `<div class="player"><div class="muted">${label}</div><div class="score">${a.wins+b.wins}승</div><div class="muted">${line("PC",a)}<br>${line("온라인",b)}</div></div>`};
 $("#myStats").innerHTML=`<div class="player"><div class="muted">초성 최고</div><div class="score">${stats.chosungBest?stats.chosungBest.toFixed(1)+"초":"-"}</div></div>${card("chosung","초성퀴즈")}${card("ox","OX")}${card("fortress","포트리스")}`;
}
async function recordGame(kind,result,duration=0,playMode=mode){
 const m=playMode==="online"?"online":"solo",s=stats.games[kind][m];s.played++;if(result==="win")s.wins++;else if(result==="loss")s.losses++;else s.draws++;s.lastPlayed=Date.now();saveStats();
 if(db)await db.ref(`playerStats/${uid}`).update({nickname,lastPlayed:Date.now(),[`games/${kind}/${m}`]:s,[`recent/${Date.now()}`]:{kind,mode:m,result,duration}}).catch(()=>{});
}
function showResult(title,detail,retryText="다시하기",exitText="게임 종료"){$("#resultTitle").textContent=title;$("#resultDetail").innerHTML=detail;$("#resultRetry").textContent=retryText;$("#resultExit").textContent=exitText;$("#resultModal").classList.remove("hidden")}
function hideResult(){$("#resultModal").classList.add("hidden")}
async function requestRematch(kind){if(mode!=="online"){hideResult();return kind==="chosung"?startChosung():kind==="ox"?startOX():startTerrainSelection()}await roomRef.child("rematch/"+playerId).set(true);$("#resultDetail").textContent="상대방의 재경기 선택을 기다리는 중..."}
$("#resetStats").onclick=async()=>{if(!confirm("내 모든 전적을 삭제하시겠습니까? 복구할 수 없습니다."))return;stats={chosungBest:null,games:{}};ensureStats();saveStats();if(db)await db.ref(`playerStats/${uid}`).remove().catch(()=>{});toast("내 전적을 초기화했습니다.")};

async function hall(){if(!db)return;const snap=await db.ref("hall").once("value"),v=snap.val()||{};const rows=[];Object.entries(v).forEach(([id,r])=>rows.push(r));rows.sort((a,b)=>(b.total||0)-(a.total||0));$("#hall").innerHTML=rows.slice(0,10).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.nick||"익명")}</td><td>${r.total||0}승</td></tr>`).join("")||'<tr><td colspan="3" class="muted">아직 기록이 없습니다.</td></tr>'}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
$("#nickname").value=nickname; renderStats(); hall();
$("#saveNick").onclick=()=>{nickname=$("#nickname").value.trim()||nickname;localStorage.mg_nick=nickname;toast("닉네임을 저장했습니다.")};
$$('[data-game]').forEach(b=>b.onclick=()=>openLobby(b.dataset.game));
$("#homeBtn").onclick=leave;
function gameName(g){return g==="chosung"?"초성게임":g==="ox"?"OX 이동게임":"포트리스"}
function maxPlayersForGame(g=game){return g==="chosung"?4:2}
function openLobby(g){game=g;$("#lobbyTitle").textContent=gameName(g)+" 대기실";$("#roomPanel").classList.add("hidden");$("#roomGuide").textContent=g==="chosung"?"초성퀴즈는 최대 4명이며, 2명 이상이면 방장이 시작할 수 있습니다.":"방장만 시작할 수 있으며, 상대가 없으면 시작되지 않습니다.";screen("lobby")}
function stopHeartbeat(){clearInterval(heartbeatTimer);heartbeatTimer=null}
function activePlayers(players){const now=Date.now();return Object.fromEntries(Object.entries(players||{}).filter(([,p])=>p&&p.connected!==false&&now-(p.lastSeen||now)<35000))}
async function leave(){hideResult();stopHeartbeat();if(roomRef){await roomRef.child("players/"+playerId).remove().catch(()=>{});roomRef=null}if(unsub)unsub();unsub=null;room="";game="";screen("home");hall()}
function beginHeartbeat(){stopHeartbeat();const ping=()=>roomRef&&roomRef.child("players/"+playerId).update({connected:true,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(()=>{});ping();heartbeatTimer=setInterval(ping,10000)}
async function registerPlayer(asHost=false){
 const now=Date.now();
 const player={nick:nickname,userId:uid,deviceId,sessionId:playerId,score:0,ready:asHost,connected:true,lastSeen:now,joinedAt:now};
 if(asHost){
   const created=await roomRef.transaction(r=>{
     if(r)return;
     return {game,status:"waiting",host:playerId,maxPlayers:maxPlayersForGame(game),created:now,players:{[playerId]:player}};
   });
   if(!created.committed){const e=new Error("ROOM_CREATE_FAILED");e.code="ROOM_CREATE_FAILED";throw e}
 }else{
   const meta=(await roomRef.once("value")).val();
   if(!meta){const e=new Error("ROOM_NOT_FOUND");e.code="ROOM_NOT_FOUND";throw e}
   if(meta.game!==game){const e=new Error("WRONG_GAME");e.code="WRONG_GAME";throw e}
   const max=maxPlayersForGame(meta.game);
   const playersRef=roomRef.child("players");
   const joined=await playersRef.transaction(players=>{
     players=players||{};
     const live=activePlayers(players);
     Object.keys(players).forEach(id=>{if(!live[id]&&id!==playerId)delete players[id]});
     if(!players[playerId]&&Object.keys(activePlayers(players)).length>=max)return;
     players[playerId]=player;
     return players;
   },undefined,false);
   if(!joined.committed){const e=new Error("ROOM_FULL");e.code="ROOM_FULL";throw e}
   await roomRef.update({maxPlayers:max}).catch(()=>{});
   const hostSnap=await roomRef.child("host").once("value");
   if(!hostSnap.val())await roomRef.child("host").set(playerId);
 }
 roomRef.child("players/"+playerId).onDisconnect().remove();
 beginHeartbeat();
}
$("#soloPlay").onclick=()=>startGame("solo");
$("#createRoom").onclick=async()=>{if(!db)return toast("Firebase 연결에 실패했습니다.");room=Math.random().toString(36).slice(2,8).toUpperCase();isHost=true;mode="online";roomRef=db.ref("rooms/"+room);try{await registerPlayer(true);showRoom();watchRoom()}catch{toast("방을 만들지 못했습니다.")}};
$("#joinRoom").onclick=async()=>{if(!db)return toast("Firebase 연결에 실패했습니다.");room=$("#roomInput").value.trim().toUpperCase();if(room.length<4)return toast("방 코드를 확인해 주세요.");roomRef=db.ref("rooms/"+room);const snap=await roomRef.once("value"),v=snap.val();if(!v)return toast("방을 찾을 수 없습니다.");if(v.game!==game)return toast("다른 게임의 방입니다.");mode="online";try{await registerPlayer(false)}catch(e){console.warn("방 입장 실패",e);if(e?.code==="ROOM_FULL")return toast(`현재 방은 최대 ${maxPlayersForGame(v.game)}명까지 접속할 수 있습니다.`);if(e?.code==="ROOM_NOT_FOUND")return toast("방이 종료되었거나 존재하지 않습니다.");if(e?.code==="WRONG_GAME")return toast("다른 게임의 방입니다.");return toast("방 접속에 실패했습니다. 인터넷 연결 후 다시 시도해 주세요.")}const fresh=(await roomRef.once("value")).val()||{};isHost=fresh.host===playerId;showRoom();watchRoom()};
function showRoom(){$("#roomPanel").classList.remove("hidden");$("#roomCode").textContent=room}
function watchRoom(){const cb=s=>{const v=s.val();if(!v)return;const ps=activePlayers(v.players||{});renderRoomPlayers(ps);isHost=v.host===playerId;const count=Object.keys(ps).length,max=maxPlayersForGame(v.game);const allReady=Object.entries(ps).every(([id,p])=>id===v.host||p.ready);$("#roomCapacity").textContent=`참가자 ${count} / ${max}명`;$("#readyOnline").classList.toggle("hidden",isHost||v.game!=="chosung");$("#readyOnline").textContent=ps[playerId]?.ready?"준비 취소":"준비하기";$("#startOnline").disabled=!isHost||count<2||(v.game==="chosung"&&!allReady);$("#roomGuide").textContent=v.game==="chosung"?(count<2?"2명 이상 입장하면 시작할 수 있습니다.":(!allReady?"참가자 전원이 준비되면 방장이 시작할 수 있습니다.":"준비 완료! 방장이 게임을 시작할 수 있습니다.")):"방장만 시작할 수 있으며, 상대가 없으면 시작되지 않습니다.";if(v.status==="playing")startGame("online",v)};roomRef.on("value",cb);unsub=()=>roomRef.off("value",cb)}
function renderRoomPlayers(ps){$("#roomPlayers").innerHTML=Object.entries(ps).map(([id,p])=>`<div class="player ${id===playerId?"me":""}"><b>${esc(p.nick)}</b><div class="ready-dot ${p.ready?"ready-ok":"ready-wait"}">${id===playerId?"나 · ":""}${p.ready?"준비 완료":"준비 중"}</div></div>`).join("")}
$("#readyOnline").onclick=async()=>{if(!roomRef||isHost)return;const ref=roomRef.child("players/"+playerId+"/ready");const snap=await ref.once("value");await ref.set(!snap.val())}
$("#copyRoom").onclick=()=>navigator.clipboard?.writeText(room).then(()=>toast("방 코드를 복사했습니다."));
$("#shareRoom").onclick=async()=>{const url=location.origin+location.pathname+"?game="+game+"&room="+room;try{await navigator.share({title:"MiniGame 초대",text:`${nickname}님의 ${gameName(game)} 방`,url})}catch{navigator.clipboard?.writeText(url);toast("초대 링크를 복사했습니다.")}};
$("#startOnline").onclick=async()=>{if(!isHost)return;await roomRef.update({status:"playing",started:Date.now(),state:null,rematch:null})};
function startGame(m,v){mode=m;if(unsub){unsub();unsub=null}if(game==="chosung")startChosung();else if(game==="ox")startOX();else startTerrainSelection()}

/* CHOSUNG */
const WORDS=["가방","가위","가족","간식","갈비","감자","강아지","거울","건물","게임","겨울","고기","고양이","공원","공책","과자","교실","구름","기차","김밥","나무","냉면","노래","눈물","다리","달력","도서관","도시","동물","라면","마음","마이크","만두","모자","무지개","문어","바나나","바다","바람","박물관","밥상","배추","버스","병원","보리","복숭아","비누","비행기","사과","사람","사진","산책","선물","수박","시장","신발","아기","아이스크림","안경","야구","약속","양말","여행","연필","영화","오렌지","우산","운동","원숭이","음악","의자","자동차","자전거","장갑","전화","지갑","지하철","창문","책상","초콜릿","치킨","친구","카메라","커피","컴퓨터","토마토","학교","햄버거","휴대폰","냉장고","세탁기","청소기","에어컨","로봇","텔레비전","선풍기","제습기","전자레인지","공기청정기","안마의자","노트북","키보드","마우스","인터넷","소파","침대","식탁","옷장","화장실","주방","거실","베란다","아파트","엘리베이터","계단","주차장","편의점","백화점","마트","식당","카페","빵집","미용실","은행","우체국","경찰서","소방서","놀이터","수영장","헬스장","축구장","야구장","공항","기차역","버스터미널","여권","비밀번호","생일","결혼식","졸업식","크리스마스","어린이날","추석","설날","봄","여름","가을","겨울","아침","점심","저녁","새벽","월요일","화요일","수요일","목요일","금요일","토요일","일요일"];
const CHO=["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const toCho=w=>[...w].map(c=>{let n=c.charCodeAt(0)-44032;return n>=0&&n<11172?CHO[Math.floor(n/588)]:c}).join("");
let choList=[],choIdx=0,choStart=0,choTimer=null,choScores={},choHintTimers=[],choHintInterval=null,choOnlineRoundKey="",choAdvanceTimer=null,choAdvancing=false,choPlayers={};

const CHO_HINTS={
"가방":["물건","외출할 때 들고 다니는 물건","가○"],
"가위":["도구","종이나 천을 자를 때 사용","가○"],
"가족":["사람","함께 생활하는 가까운 사람들","가○"],
"간식":["음식","식사 사이에 먹는 음식","간○"],
"갈비":["음식","뼈에 붙은 고기로 만든 음식","갈○"],
"감자":["채소","땅속에서 자라는 둥근 식재료","감○"],
"강아지":["동물","집에서 많이 키우는 반려동물","강○지"],
"거울":["생활용품","얼굴이나 모습을 비춰보는 물건","거○"],
"건물":["장소","사람이 생활하거나 일하는 큰 구조물","건○"],
"게임":["놀이","규칙에 따라 즐기는 활동","게○"],
"겨울":["계절","눈이 오고 날씨가 추운 계절","겨○"],
"고기":["음식","소·돼지·닭 등에서 얻는 식재료","고○"],
"고양이":["동물","야옹하고 우는 반려동물","고○이"],
"공원":["장소","산책하거나 쉬기 좋은 야외 공간","공○"],
"공책":["학용품","글씨를 쓰거나 기록하는 책","공○"],
"과자":["음식","바삭하거나 달콤하게 먹는 간식","과○"],
"교실":["장소","학생들이 수업을 듣는 방","교○"],
"구름":["자연","하늘에 떠 있는 흰 덩어리","구○"],
"기차":["교통수단","철길 위를 달리는 긴 교통수단","기○"],
"김밥":["음식","김에 밥과 재료를 말아 만든 음식","김○"],
"나무":["식물","줄기와 가지가 있는 큰 식물","나○"],
"냉면":["음식","차갑게 먹는 면 요리","냉○"],
"노래":["음악","멜로디에 맞춰 부르는 것","노○"],
"눈물":["신체","슬프거나 감동할 때 눈에서 흐르는 것","눈○"],
"다리":["신체","걷거나 서는 데 사용하는 신체 부위","다○"],
"달력":["생활용품","날짜와 요일을 확인하는 물건","달○"],
"도서관":["장소","책을 읽거나 빌리는 곳","도○관"],
"도시":["장소","사람과 건물이 많이 모여 있는 곳","도○"],
"동물":["생물","움직이며 살아가는 생명체","동○"],
"라면":["음식","끓는 물에 익혀 먹는 면 요리","라○"],
"마음":["감정","사람의 생각이나 감정을 나타내는 말","마○"],
"마이크":["기기","목소리를 크게 전달하는 장치","마○크"],
"만두":["음식","피 안에 고기나 채소를 넣은 음식","만○"],
"모자":["의류","머리에 쓰는 물건","모○"],
"무지개":["자연","비 온 뒤 하늘에 나타나는 여러 색 띠","무○개"],
"문어":["동물","다리가 여덟 개인 바다 동물","문○"],
"바나나":["과일","노란 껍질을 벗겨 먹는 길쭉한 과일","바○나"],
"바다":["자연","소금물이 넓게 펼쳐진 곳","바○"],
"바람":["자연","공기가 움직이는 현상","바○"],
"박물관":["장소","역사·예술 자료를 전시하는 곳","박○관"],
"밥상":["생활용품","밥과 반찬을 올려놓는 상","밥○"],
"배추":["채소","김치를 담글 때 많이 사용하는 채소","배○"],
"버스":["교통수단","여러 사람이 함께 타는 도로 교통수단","버○"],
"병원":["장소","아픈 사람을 치료하는 곳","병○"],
"보리":["곡물","밥이나 차로 먹는 곡식","보○"],
"복숭아":["과일","털이 있고 달콤한 둥근 과일","복○아"],
"비누":["생활용품","손이나 몸을 씻을 때 사용하는 것","비○"],
"비행기":["교통수단","하늘을 날아 이동하는 교통수단","비○기"],
"사과":["과일","빨갛거나 초록색인 둥근 과일","사○"],
"사람":["생물","생각하고 말하며 생활하는 존재","사○"],
"사진":["기록","카메라로 찍어 남긴 이미지","사○"],
"산책":["활동","가볍게 걸으며 바람을 쐬는 활동","산○"],
"선물":["물건","축하나 감사의 뜻으로 주는 것","선○"],
"수박":["과일","여름에 많이 먹는 크고 시원한 과일","수○"],
"시장":["장소","여러 물건을 사고파는 곳","시○"],
"신발":["의류","발에 신고 다니는 물건","신○"],
"아기":["사람","아주 어린 아이","아○"],
"아이스크림":["음식","차갑고 달콤한 디저트","아○크림"],
"안경":["생활용품","눈이 잘 보이도록 얼굴에 쓰는 물건","안○"],
"야구":["스포츠","방망이와 공으로 하는 경기","야○"],
"약속":["관계","서로 지키기로 정한 일","약○"],
"양말":["의류","발에 신는 천으로 된 물건","양○"],
"여행":["활동","다른 지역이나 나라로 떠나는 것","여○"],
"연필":["학용품","글씨나 그림을 그리는 도구","연○"],
"영화":["문화","극장이나 화면으로 보는 영상 작품","영○"],
"오렌지":["과일","주황색 껍질과 과즙이 많은 과일","오○지"],
"우산":["생활용품","비가 올 때 펼쳐 쓰는 물건","우○"],
"운동":["활동","몸을 건강하게 움직이는 활동","운○"],
"원숭이":["동물","나무를 잘 타고 사람과 닮은 동물","원○이"],
"음악":["문화","소리와 리듬으로 이루어진 예술","음○"],
"의자":["가구","사람이 앉는 가구","의○"],
"자동차":["교통수단","도로 위를 달리는 탈것","자○차"],
"자전거":["교통수단","두 바퀴를 페달로 움직이는 탈것","자○거"],
"장갑":["의류","손에 끼는 물건","장○"],
"전화":["통신","멀리 있는 사람과 말하는 수단","전○"],
"지갑":["생활용품","돈이나 카드를 넣는 물건","지○"],
"지하철":["교통수단","도시의 지하나 지상 철로를 달리는 교통수단","지○철"],
"창문":["건물","빛과 바람이 들어오게 만든 벽의 틀","창○"],
"책상":["가구","책을 읽거나 공부할 때 사용하는 가구","책○"],
"초콜릿":["음식","카카오로 만든 달콤한 간식","초○릿"],
"치킨":["음식","닭을 튀기거나 구워 만든 음식","치○"],
"친구":["사람","가깝게 지내며 서로 아끼는 사람","친○"],
"카메라":["기기","사진이나 영상을 찍는 장치","카○라"],
"커피":["음료","원두로 만들어 마시는 향이 강한 음료","커○"],
"컴퓨터":["기기","문서·게임·인터넷에 사용하는 전자기기","컴○터"],
"토마토":["채소","빨갛고 둥글며 요리에 자주 쓰는 식재료","토○토"],
"학교":["장소","학생들이 공부하는 곳","학○"],
"햄버거":["음식","빵 사이에 고기와 채소를 넣은 음식","햄○거"],
"휴대폰":["기기","전화와 인터넷에 사용하는 손안의 기기","휴○폰"],
"냉장고":["가전","음식을 차갑게 보관하는 가전제품","냉○고"],
"세탁기":["가전","옷을 자동으로 빨아주는 가전제품","세○기"],
"청소기":["가전","먼지와 이물질을 빨아들이는 가전제품","청○기"],
"에어컨":["가전","실내를 시원하게 해주는 가전제품","에○컨"],
"로봇":["기계","사람 대신 일을 수행하도록 만든 기계","로○"],
"텔레비전":["가전","방송과 영상을 보는 화면 기기","텔○전"],
"선풍기":["가전","바람을 만들어 시원하게 하는 기기","선○기"],
"제습기":["가전","공기 중 습기를 줄여주는 기기","제○기"],
"전자레인지":["가전","음식을 빠르게 데우는 가전제품","전○레인지"],
"공기청정기":["가전","실내 공기를 깨끗하게 해주는 기기","공○청정기"],
"안마의자":["가전","앉아서 몸의 피로를 풀어주는 의자","안○의자"],
"노트북":["기기","들고 다닐 수 있는 컴퓨터","노○북"],
"키보드":["기기","컴퓨터에 글자를 입력하는 장치","키○드"],
"마우스":["기기","컴퓨터 화면의 포인터를 움직이는 장치","마○스"],
"인터넷":["통신","컴퓨터와 휴대폰을 연결하는 정보망","인○넷"],
"소파":["가구","거실에서 여러 사람이 앉는 가구","소○"],
"침대":["가구","누워서 잠을 자는 가구","침○"],
"식탁":["가구","식사할 때 사용하는 탁자","식○"],
"옷장":["가구","옷을 보관하는 가구","옷○"],
"화장실":["장소","씻거나 용변을 보는 공간","화○실"],
"주방":["장소","음식을 만들고 조리하는 공간","주○"],
"거실":["장소","가족이 함께 생활하는 집의 중심 공간","거○"],
"베란다":["장소","집 바깥쪽에 이어진 작은 공간","베○다"],
"아파트":["건물","여러 가구가 함께 사는 공동주택","아○트"],
"엘리베이터":["시설","사람이나 물건을 위아래로 옮기는 장치","엘○베이터"],
"계단":["시설","위층과 아래층을 걸어서 오가는 구조","계○"],
"주차장":["장소","자동차를 세워두는 곳","주○장"],
"편의점":["장소","생활용품과 음식을 가까이서 사는 가게","편○점"],
"백화점":["장소","여러 종류의 상품을 판매하는 큰 매장","백○점"],
"마트":["장소","식품과 생활용품을 판매하는 큰 가게","마○"],
"식당":["장소","돈을 내고 음식을 먹는 곳","식○"],
"카페":["장소","커피나 음료를 마시며 쉬는 곳","카○"],
"빵집":["장소","빵과 과자를 만들어 파는 가게","빵○"],
"미용실":["장소","머리를 자르거나 꾸미는 곳","미○실"],
"은행":["장소","돈을 맡기거나 금융 업무를 보는 곳","은○"],
"우체국":["장소","편지와 택배를 보내는 곳","우○국"],
"경찰서":["장소","경찰이 치안 업무를 하는 곳","경○서"],
"소방서":["장소","소방관이 화재와 구조 업무를 하는 곳","소○서"],
"놀이터":["장소","아이들이 놀이기구를 타며 노는 곳","놀○터"],
"수영장":["장소","물을 채워 수영하는 시설","수○장"],
"헬스장":["장소","운동기구로 운동하는 곳","헬○장"],
"축구장":["장소","축구 경기를 하는 운동장","축○장"],
"야구장":["장소","야구 경기를 하는 운동장","야○장"],
"공항":["장소","비행기가 출발하고 도착하는 곳","공○"],
"기차역":["장소","기차를 타고 내리는 곳","기○역"],
"버스터미널":["장소","장거리 버스를 타고 내리는 곳","버○터미널"],
"여권":["문서","외국 여행 때 신분을 증명하는 문서","여○"],
"비밀번호":["정보","계정이나 문을 보호하는 비밀 문자","비○번호"],
"생일":["기념일","태어난 날을 기념하는 날","생○"],
"결혼식":["행사","두 사람이 부부가 되는 것을 축하하는 행사","결○식"],
"졸업식":["행사","학교 과정을 마치는 것을 기념하는 행사","졸○식"],
"크리스마스":["기념일","12월 25일에 기념하는 날","크○마스"],
"어린이날":["기념일","어린이를 위한 5월의 기념일","어○이날"],
"추석":["명절","가을에 가족이 모이는 대표 명절","추○"],
"설날":["명절","새해를 맞이하는 대표 명절","설○"],
"봄":["계절","꽃이 피고 날씨가 따뜻해지는 계절","○"],
"여름":["계절","날씨가 가장 더운 계절","여○"],
"가을":["계절","단풍이 들고 날씨가 선선한 계절","가○"],
"겨울":["계절","눈이 오고 날씨가 추운 계절","겨○"],
"아침":["시간","하루가 시작되는 이른 시간","아○"],
"점심":["시간","낮에 먹는 식사 또는 그 시간","점○"],
"저녁":["시간","해가 질 무렵의 시간","저○"],
"새벽":["시간","아침이 오기 전 아주 이른 시간","새○"],
"월요일":["요일","한 주가 시작되는 요일","월○일"],
"화요일":["요일","월요일 다음 요일","화○일"],
"수요일":["요일","한 주의 가운데쯤인 요일","수○일"],
"목요일":["요일","수요일 다음 요일","목○일"],
"금요일":["요일","주말 바로 전 평일","금○일"],
"토요일":["요일","주말의 첫 번째 날","토○일"],
"일요일":["요일","한 주의 마지막 휴일","일○일"]
};

function clearChoHintTimers(){
 choHintTimers.forEach(clearTimeout);
 choHintTimers=[];
 clearInterval(choHintInterval);
 choHintInterval=null;
}

function getChoHints(word){
 const h=CHO_HINTS[word];
 if(h)return h;
 const chars=[...word];
 const masked=chars.map((c,i)=>i===0?c:"○").join("");
 return ["일상 단어",`${word.length}글자로 된 단어`,masked];
}

function startChoHints(word){
 clearChoHintTimers();
 const hints=getChoHints(word);
 $("#choCategory").textContent=hints[0]||"일상 단어";
 let step=0;

 const showHint=()=>{
   const idx=step%3;
   $("#choHint").innerHTML=`<b>${idx+1}단계 힌트</b><span>${esc(hints[idx])}</span>`;
   step++;
 };

 showHint();
 choHintInterval=setInterval(showHint,5000);
}

function startChosung(){
 screen("chosung");clearChoHintTimers();clearTimeout(choAdvanceTimer);choAdvanceTimer=null;choAdvancing=false;choOnlineRoundKey="";choIdx=0;choScores={};choStart=performance.now();$("#choMode").textContent=mode==="solo"?"혼자":"온라인 · 최대 4명";$("#choWinner").classList.remove("show");$("#choWinner").textContent="";
 if(mode==="solo"){$("#choScores").innerHTML=`<div class="cho-rank-item me"><b>👤 ${esc(nickname)}</b><span class="pts"><span id="choSoloScore">0</span> / 10</span></div>`;choList=[...WORDS].sort(()=>Math.random()-.5).slice(0,10);nextCho();choTimer=setInterval(()=>$("#choTime").textContent=((performance.now()-choStart)/1000).toFixed(1)+"초",100)}
 else {choTimer=setInterval(()=>$("#choTime").textContent=((performance.now()-choStart)/1000).toFixed(1)+"초",100);setupChoOnline();}
}
function nextCho(){
 if(choIdx>=choList.length)return finishChoSolo();
 const w=choList[choIdx];
 $("#choQ").textContent=toCho(w);
 $("#choRound").textContent=`${choIdx+1} / ${choList.length}`;
 $("#choProgress").style.width=(choIdx/choList.length*100)+"%";const soloScore=$("#choSoloScore");if(soloScore)soloScore.textContent=choIdx;
 $("#choAnswer").value="";$("#choAnswer").disabled=false;$("#choSubmit").disabled=false;$("#choWinner").classList.remove("show");
 startChoHints(w);
 $("#choAnswer").focus();
}
function submitCho(){
 const input=$("#choAnswer");
 const a=input.value.trim();
 input.value="";
 input.focus();
 if(!a)return;

 if(mode==="solo"){
   if(a===choList[choIdx]){
     choIdx++;
     nextCho();
   }else{
     toast("오답입니다. 다시 생각해 보세요.");
   }
 }else if(roomRef){
   roomRef.child("state").transaction(st=>{
     if(!st||st.type!=="chosung"||st.answer!==a||st.roundWinner)return;
     st.roundWinner=playerId;
     st.answeredAt=Date.now();
     st.scores=st.scores||{};
     st.scores[playerId]=(st.scores[playerId]||0)+1;
     return st;
   }).then(result=>{
     if(!result.committed)toast("오답이거나 다른 참가자가 먼저 맞혔습니다.");
   });
 }
}
$("#choSubmit").onclick=submitCho;$("#choAnswer").onkeydown=e=>{if(e.key==="Enter")submitCho()};
const choInput=$("#choAnswer");
function positionChoForKeyboard(){
 const card=$("#choCard"), input=$("#choAnswer");
 if(!card||!input)return;
 const vv=window.visualViewport;
 const vh=vv?vv.height:window.innerHeight;
 document.documentElement.style.setProperty("--cho-vvh",vh+"px");
 // 고정된 카드 내부에서 입력창이 맨 아래에 오도록 하여 문제·힌트·순위가 바로 위에 붙어 보이게 한다.
 requestAnimationFrame(()=>{
  card.scrollTop=card.scrollHeight;
  setTimeout(()=>{card.scrollTop=card.scrollHeight;},80);
 });
}
function setChoKeyboardMode(on){
 document.body.classList.toggle("cho-keyboard",!!on);
 if(on){
  setTimeout(positionChoForKeyboard,80);
 }else{
  document.documentElement.style.removeProperty("--cho-vvh");
  const card=$("#choCard");if(card)card.scrollTop=0;
 }
}
choInput.addEventListener("focus",()=>setChoKeyboardMode(true));
choInput.addEventListener("blur",()=>setTimeout(()=>setChoKeyboardMode(false),120));
if(window.visualViewport){
 let baseHeight=window.visualViewport.height;
 window.visualViewport.addEventListener("resize",()=>{
  const keyboardOpen=baseHeight-window.visualViewport.height>120&&document.activeElement===choInput;
  setChoKeyboardMode(keyboardOpen);
  if(keyboardOpen)setTimeout(positionChoForKeyboard,60);
  if(window.visualViewport.height>baseHeight)baseHeight=window.visualViewport.height;
 });
}
function finishChoSolo(){clearInterval(choTimer);clearChoHintTimers();let t=(performance.now()-choStart)/1000;$("#choProgress").style.width="100%";$("#choQ").textContent="완료!";$("#choHint").textContent=`10문제 ${t.toFixed(1)}초`;if(!stats.chosungBest||t<stats.chosungBest)stats.chosungBest=t;recordGame("chosung","win",t);showResult("🎉 10문제 완료",`기록 <b>${t.toFixed(1)}초</b>`);$("#resultRetry").onclick=()=>{hideResult();startChosung()};$("#resultExit").onclick=()=>{hideResult();leave()}}
async function setupChoOnline(){
 const stateRef=roomRef.child("state");

 if(isHost){
   const current=(await stateRef.once("value")).val();
   if(!current||current.type!=="chosung"){
     const w=WORDS[Math.floor(Math.random()*WORDS.length)];
     await stateRef.set({
       type:"chosung",
       word:w,
       answer:w,
       round:1,
       scores:{},
       roundWinner:null,
       answeredAt:null,
       roundToken:Date.now(),
       startedAt:Date.now()
     });
   }
 }

 const cb=s=>{
   const st=s.val();
   if(!st||st.type!=="chosung")return;

   choScores=st.scores||{};
   renderChoScores();
   const top=Math.max(...Object.values(choScores),0);$("#choProgress").style.width=Math.min(100,top*10)+"%";
   if(top>=10){clearChoHintTimers();const winner=Object.keys(choScores).find(id=>choScores[id]===top);roomRef.child("players").once("value").then(ps=>{const players=ps.val()||{},wn=players[winner]?.nick||"상대";const sec=((Date.now()-((st.startedAt)||Date.now()))/1000).toFixed(1);const ranking=Object.entries(players).sort(([a],[b])=>(choScores[b]||0)-(choScores[a]||0)).map(([id,p],i)=>`${i+1}위 ${esc(p.nick)} · ${choScores[id]||0}점`).join("<br>");showResult("🏆 "+wn+" 우승",`${ranking}<br><br>경기 시간 <b>${sec}초</b>`,"다시하기","방에서 나가기");$("#resultRetry").onclick=()=>requestRematch("chosung");$("#resultExit").onclick=()=>{hideResult();leave()}});return;}

   // 같은 문제에서 점수/정답 상태만 바뀐 경우 화면과 힌트 타이머를 다시 시작하지 않음
   const roundKey=`${st.round||1}_${st.roundToken||st.word}`;
   if(roundKey!==choOnlineRoundKey){
     choOnlineRoundKey=roundKey;
     clearChoHintTimers();
     $("#choQ").textContent=toCho(st.word);
     $("#choRound").textContent=`${st.round||1} 라운드`;
     $("#choAnswer").value="";$("#choAnswer").disabled=false;$("#choSubmit").disabled=false;$("#choWinner").classList.remove("show");$("#choWinner").textContent="";
     startChoHints(st.word);
     $("#choAnswer").focus();
   }

   if(st.roundWinner){
     $("#choAnswer").disabled=true;$("#choSubmit").disabled=true;
     const showWinner=name=>{$("#choWinner").innerHTML=`👑 ${esc(name)}님 정답! <span style="color:#facc15">${esc(st.answer)}</span>`;$("#choWinner").classList.add("show")};
     const known=choPlayers[st.roundWinner]?.nick;
     if(known)showWinner(known);else roomRef.child("players/"+st.roundWinner+"/nick").once("value").then(x=>showWinner(x.val()||"참가자"));
   }

   // 방장만 다음 문제로 이동하며, 같은 라운드에서 한 번만 예약
   if(st.roundWinner&&isHost&&!choAdvancing){
     choAdvancing=true;
     clearTimeout(choAdvanceTimer);

     const winnerScore=Math.max(...Object.values(choScores),0);
     choAdvanceTimer=setTimeout(async()=>{
       try{
         const latest=(await stateRef.once("value")).val();
         if(!latest||latest.roundWinner!==st.roundWinner||latest.round!==st.round){
           choAdvancing=false;
           return;
         }

         if(winnerScore>=10){
           await finishOnline("chosung",st.roundWinner); await roomRef.update({status:"finished",finishedAt:Date.now(),winner:st.roundWinner}); return;
         }

         let w=WORDS[Math.floor(Math.random()*WORDS.length)];
         // 바로 전 문제와 같은 단어 반복 방지
         while(w===st.word&&WORDS.length>1){
           w=WORDS[Math.floor(Math.random()*WORDS.length)];
         }

         await stateRef.set({
           type:"chosung",
           word:w,
           answer:w,
           round:(st.round||1)+1,
           scores:choScores,
           roundWinner:null,
           answeredAt:null,
           roundToken:Date.now()
         });
       }finally{
         choAdvancing=false;
       }
     },3000);
   }
 };

 const rematchRef=roomRef.child("rematch");
 const rematchCb=async snap=>{const r=snap.val()||{};if(Object.keys(r).length<2||!isHost)return;const w=WORDS[Math.floor(Math.random()*WORDS.length)];await roomRef.update({status:"playing",winner:null,finishedAt:null,rematch:null});await stateRef.set({type:"chosung",word:w,answer:w,round:1,scores:{},roundWinner:null,roundToken:Date.now(),startedAt:Date.now()});hideResult()};
 rematchRef.on("value",rematchCb);
 stateRef.on("value",cb);
 unsub=()=>{rematchRef.off("value",rematchCb);
   clearInterval(choTimer);choTimer=null;
   clearTimeout(choAdvanceTimer);
   choAdvanceTimer=null;
   choAdvancing=false;
   clearChoHintTimers();
   stateRef.off("value",cb);
 };
}
function renderChoScores(){
 roomRef.child("players").once("value").then(s=>{
   choPlayers=activePlayers(s.val()||{});
   const entries=Object.entries(choPlayers).sort(([a,pa],[b,pb])=>{
     const diff=(choScores[b]||0)-(choScores[a]||0);
     if(diff)return diff;
     if(a===playerId)return -1;if(b===playerId)return 1;
     return (pa.joinedAt||0)-(pb.joinedAt||0);
   });
   $("#choScores").innerHTML=entries.map(([id,p],i)=>
     `<div class="cho-rank-item ${id===playerId?"me":""}"><b>${["🥇","🥈","🥉","4️⃣"][i]||i+1} ${esc(p.nick)}</b><span class="pts">${choScores[id]||0}점</span></div>`
   ).join("");
 });
}

/* OX - 각자 3개 배치 후 자기 말을 빈칸으로 이동 */
let ox={type:"ox",board:Array(9).fill(""),turn:"X",me:"X",roundWins:{X:0,O:0},over:false},oxSelected=null,oxSubmitting=false;
let oxSurvivalTimer=null,oxSurvivalStarted=0,oxSurvivalTurns=0,oxSurvivalEnded=false;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function startOX(){
 screen("ox");
 clearInterval(oxSurvivalTimer);oxSurvivalTimer=null;oxSurvivalEnded=false;oxSurvivalTurns=0;
 const solo=mode==="solo";
 ox={type:"ox",board:Array(9).fill(""),turn:solo?"O":(Math.random()<.5?"X":"O"),me:"X",roundWins:{X:0,O:0},over:false,nextStarter:null};
 oxSelected=null;
 buildOX();
 $("#oxSurvival").classList.toggle("hidden",!solo);
 $("#oxReset").classList.add("hidden");
 if(solo){
   $("#oxBest").textContent=Number(localStorage.ox_survival_best||0);
   $("#oxTurns").textContent="0";$("#oxTimeLeft").textContent="20.0";
   $("#oxRule").innerHTML='<b>혼자 생존 모드 · 최상 난이도</b><br>PC가 항상 먼저 시작합니다. 20초 동안 PC의 완벽 수를 피해 최대한 많은 턴을 버티세요.';
   oxSurvivalStarted=performance.now();
   oxSurvivalTimer=setInterval(updateOXSurvivalClock,100);
   renderOX();toast("최상 난이도 PC가 먼저 시작합니다.");setTimeout(oxAIMove,500);
 }else{
   $("#oxRule").innerHTML='<b>OX 이동게임 규칙</b><br>각자 말을 3개씩 놓습니다. 3개를 모두 놓은 뒤에는 자기 말 하나를 선택해 빈칸으로 이동합니다. 가로·세로·대각선으로 먼저 3개를 잇는 사람이 승리합니다.';
   setupOXOnline();
 }
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
 if(mode==="online"){
   onlineOXCellClick(i);
   return;
 }
 if(ox.over||ox.turn!==ox.me)return;
 const mark=ox.me;

 if(oxPhase(mark)==="place"){
   if(ox.board[i])return toast("빈칸을 선택해 주세요.");
   if(oxCount(mark)>=3)return toast("말은 3개까지만 놓을 수 있습니다.");
   ox.board[i]=mark;
   if(mode==="solo")recordOXSurvivalTurn();
   finishOXTurn();
   return;
 }

 if(oxSelected===null){
   if(ox.board[i]!==mark)return toast("이동할 내 말을 먼저 선택해 주세요.");
   oxSelected=i;
   renderOX();
   return;
 }

 if(i===oxSelected){oxSelected=null;renderOX();return;}
 if(ox.board[i]===mark){oxSelected=i;renderOX();return;}
 if(ox.board[i])return toast("빈칸으로만 이동할 수 있습니다.");

 const from=oxSelected;
 oxSelected=null;
 ox.board[from]="";
 ox.board[i]=mark;
 if(mode==="solo")recordOXSurvivalTurn();
 finishOXTurn();
}

async function onlineOXCellClick(i){
 if(!roomRef||oxSubmitting||ox.over||ox.turn!==ox.me)return;
 const mark=ox.me;
 const myCount=oxCount(mark);

 // 이동 단계의 첫 클릭은 서버를 건드리지 않고 본인 말만 선택
 if(myCount>=3&&oxSelected===null){
   if(ox.board[i]!==mark)return toast("이동할 내 말을 먼저 선택해 주세요.");
   oxSelected=i;
   renderOX();
   return;
 }
 if(myCount>=3&&i===oxSelected){oxSelected=null;renderOX();return;}
 if(myCount>=3&&ox.board[i]===mark){oxSelected=i;renderOX();return;}

 const from=oxSelected;
 oxSubmitting=true;
 try{
   const result=await roomRef.child("state").transaction(st=>{
     if(!st||st.type!=="ox"||st.over||st.turn!==mark)return;
     const board=Array.isArray(st.board)?st.board.slice(0,9):Array(9).fill("");
     while(board.length<9)board.push("");
     const count=board.filter(v=>v===mark).length;

     if(count<3){
       if(board[i])return;
       board[i]=mark;
     }else{
       // 출발칸은 반드시 현재 서버에서도 내 말이어야 함
       if(from===null||from===undefined||board[from]!==mark)return;
       // 도착칸은 반드시 빈칸이어야 함. 상대 말은 절대 삭제하지 않음
       if(board[i])return;
       board[from]="";
       board[i]=mark;
     }

     // 플레이어별 최대 3개 재검증
     if(board.filter(v=>v===mark).length>3)return;
     const other=mark==="X"?"O":"X";
     if(board.filter(v=>v===other).length>3)return;

     st.board=board;
     st.roundWins=st.roundWins||{X:0,O:0};
     let winner=null;
     for(const l of wins){
       if(board[l[0]]&&board[l[0]]===board[l[1]]&&board[l[1]]===board[l[2]]){winner=board[l[0]];break;}
     }
     if(winner){
       st.over=true;
       st.roundWins[winner]=(st.roundWins[winner]||0)+1;
       st.nextStarter=winner==="X"?"O":"X";
     }else{
       st.turn=other;
     }
     return st;
   });
   if(result.committed)oxSelected=null;
   else toast("현재 보드 상태가 변경되었습니다. 다시 선택해 주세요.");
 }finally{
   oxSubmitting=false;
 }
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
   ox.nextStarter=winner==="X"?"O":"X";
   renderOX();

   if(mode==="solo"){
     endOXSurvival(winner==="O"?"PC가 완성했습니다":"내가 완성했습니다");
     return;
   }

   if(ox.roundWins[winner]>=3){
     const myWin=winner===ox.me;
     recordGame("ox",myWin?"win":"loss");
     if(mode==="online"&&myWin)finishOnline("ox",playerId);
     $("#oxStatus").textContent=`${winner} 최종 승리 · 3승 달성`;
     showResult(myWin?"🏆 OX 승리":"OX 패배",`${ox.roundWins[ox.me]||0} : ${ox.roundWins[ox.me==="X"?"O":"X"]||0}`,"다시 대전하기",mode==="online"?"방에서 나가기":"게임 종료");
     $("#resultRetry").onclick=()=>requestRematch("ox");$("#resultExit").onclick=()=>{hideResult();leave()};
   }else{
     $("#oxStatus").textContent=`${winner} 승리 · 다음 판을 시작하세요`;
     $("#oxReset").classList.remove("hidden");
   }
   return;
 }

 ox.turn=ox.turn==="X"?"O":"X";
 renderOX();
 if(mode!=="online"&&ox.turn==="O")setTimeout(oxAIMove,450);
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

function oxStateWinner(board){
 for(const l of wins)if(board[l[0]]&&board[l[0]]===board[l[1]]&&board[l[1]]===board[l[2]])return board[l[0]];
 return null;
}
function oxLegalMovesFor(board,mark){
 const count=board.filter(v=>v===mark).length, empty=board.map((v,i)=>v?null:i).filter(v=>v!==null);
 if(count<3)return empty.map(to=>({from:null,to}));
 const own=board.map((v,i)=>v===mark?i:null).filter(v=>v!==null), out=[];
 own.forEach(from=>empty.forEach(to=>out.push({from,to})));
 return out;
}
function oxApplyMove(board,mark,m){const b=board.slice();if(m.from!==null)b[m.from]="";b[m.to]=mark;return b}
function oxBoardScore(board){
 const w=oxStateWinner(board);if(w==="O")return 10000;if(w==="X")return -10000;
 let score=0;
 for(const l of wins){
   const vals=l.map(i=>board[i]),o=vals.filter(v=>v==="O").length,x=vals.filter(v=>v==="X").length;
   if(!x)score+=o===2?60:o===1?8:1;
   if(!o)score-=x===2?75:x===1?9:1;
 }
 if(board[4]==="O")score+=10;if(board[4]==="X")score-=10;
 return score;
}
function oxMinimax(board,turn,depth,alpha,beta,seen){
 const w=oxStateWinner(board);if(w||depth<=0)return oxBoardScore(board)+(w==="O"?depth:w==="X"?-depth:0);
 const key=board.join(".")+turn+depth;if(seen.has(key))return oxBoardScore(board);seen.add(key);
 const moves=oxLegalMovesFor(board,turn);
 if(turn==="O"){
   let best=-Infinity;
   for(const m of moves){best=Math.max(best,oxMinimax(oxApplyMove(board,"O",m),"X",depth-1,alpha,beta,new Set(seen)));alpha=Math.max(alpha,best);if(beta<=alpha)break;}
   return best;
 }
 let best=Infinity;
 for(const m of moves){best=Math.min(best,oxMinimax(oxApplyMove(board,"X",m),"O",depth-1,alpha,beta,new Set(seen)));beta=Math.min(beta,best);if(beta<=alpha)break;}
 return best;
}
function oxBestHardMove(){
 const moves=oxLegalMovesFor(ox.board,"O");let bestMove=moves[0],best=-Infinity;
 for(const m of moves){
   const b=oxApplyMove(ox.board,"O",m), immediate=oxStateWinner(b)==="O";
   const value=immediate?99999:oxMinimax(b,"X",9,-Infinity,Infinity,new Set());
   if(value>best){best=value;bestMove=m;}
 }
 return bestMove;
}
function oxAIMove(){
 if(ox.over||ox.turn!=="O"||oxSurvivalEnded)return;
 const move=oxBestHardMove();
 if(move){if(move.from!==null)ox.board[move.from]="";ox.board[move.to]="O";}
 finishOXTurn();
}
function recordOXSurvivalTurn(){
 if(oxSurvivalEnded)return;
 oxSurvivalTurns++;$("#oxTurns").textContent=oxSurvivalTurns;
}
function updateOXSurvivalClock(){
 if(mode!=="solo"||oxSurvivalEnded)return;
 const remain=Math.max(0,20-(performance.now()-oxSurvivalStarted)/1000);
 $("#oxTimeLeft").textContent=remain.toFixed(1);
 if(remain<=0)endOXSurvival("20초 생존 성공");
}
function endOXSurvival(reason){
 if(oxSurvivalEnded)return;oxSurvivalEnded=true;ox.over=true;clearInterval(oxSurvivalTimer);oxSurvivalTimer=null;
 const old=Number(localStorage.ox_survival_best||0),isBest=oxSurvivalTurns>old;
 if(isBest)localStorage.ox_survival_best=String(oxSurvivalTurns);
 $("#oxBest").textContent=Math.max(old,oxSurvivalTurns);
 recordGame("ox",reason.includes("성공")?"win":"loss");
 $("#oxStatus").textContent=`${reason} · ${oxSurvivalTurns}턴`;
 showResult(isBest?"🏆 최고 기록!":"🤖 생존 종료",`${reason}\n생존 ${oxSurvivalTurns}턴 · 최고 ${Math.max(old,oxSurvivalTurns)}턴`,"다시 도전","게임 종료");
 $("#resultRetry").onclick=()=>{hideResult();startOX()};$("#resultExit").onclick=()=>{hideResult();leave()};
}

$("#oxReset").onclick=()=>{
 const winsKeep={...ox.roundWins}, mark=ox.me;
 ox={board:Array(9).fill(""),turn:ox.nextStarter||"X",me:mark,roundWins:winsKeep,over:false,nextStarter:null};
 oxSelected=null;
 $("#oxReset").classList.add("hidden");
 renderOX();
 if(mode==="online"){
   roomRef.child("state").transaction(st=>{
     if(!st||st.type!=="ox")return;
     return {type:"ox",board:Array(9).fill(""),turn:st.nextStarter||"X",roundWins:st.roundWins||{X:0,O:0},over:false,nextStarter:null};
   });
 }else if(ox.turn==="O")setTimeout(oxAIMove,350);
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
 mode==="solo"?
 `<div class="player me"><b>${esc(nickname)} (${ox.me})</b><div class="score">생존 ${oxSurvivalTurns}턴 · 말 ${oxCount(ox.me)}개</div></div>
 <div class="player"><b>최상 난이도 PC (${other})</b><div class="score">완벽 수 탐색 · 말 ${oxCount(other)}개</div></div>`:
 `<div class="player me"><b>${esc(nickname)} (${ox.me})</b><div class="score">${ox.roundWins[ox.me]||0}승 · 말 ${oxCount(ox.me)}개</div></div>
 <div class="player"><b>상대 (${other})</b><div class="score">${ox.roundWins[other]||0}승 · 말 ${oxCount(other)}개</div></div>`;
}

async function setupOXOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{};
 const ids=Object.keys(ps);
 const myMark=ids[0]===playerId?"X":"O";
 ox.me=myMark;

 const stateRef=roomRef.child("state");
 if(isHost){
   const current=(await stateRef.once("value")).val();
   if(!current||current.type!=="ox"){
     await stateRef.set({type:"ox",board:Array(9).fill(""),turn:Math.random()<.5?"X":"O",roundWins:{X:0,O:0},over:false,nextStarter:null});
   }
 }

 const cb=s=>{
   const st=s.val();
   if(!st||st.type!=="ox")return;
   const board=Array.isArray(st.board)?st.board.slice(0,9):Array(9).fill("");
   while(board.length<9)board.push("");
   ox={
     type:"ox",
     board,
     turn:st.turn==="O"?"O":"X",
     roundWins:st.roundWins||{X:0,O:0},
     over:!!st.over,
     nextStarter:st.nextStarter||null,
     me:myMark
   };
   // 선택한 칸이 더 이상 내 말이 아니면 선택 해제
   if(oxSelected!==null&&ox.board[oxSelected]!==myMark)oxSelected=null;
   renderOX();
   if(!st.over&&st.roundWins?.X===0&&st.roundWins?.O===0&&st.board.every(v=>!v))$("#oxStatus").textContent=(st.turn===myMark?"내가":"상대가")+" 먼저 시작합니다.";
   if(st.over){const rw=st.roundWins||{X:0,O:0};const winner=rw.X>=3?"X":rw.O>=3?"O":null;if(winner){const key=`ox_${room}_${st.finishedAt||rw.X+"_"+rw.O}`;if(sessionStorage.getItem(key)!=="1"){sessionStorage.setItem(key,"1");const mine=winner===myMark;recordGame("ox",mine?"win":"loss",0,"online");showResult(mine?"🏆 OX 승리":"OX 패배",`${rw[myMark]||0} : ${rw[myMark==="X"?"O":"X"]||0}`,"다시 대전하기","방에서 나가기");$("#resultRetry").onclick=()=>requestRematch("ox");$("#resultExit").onclick=()=>{hideResult();leave()}}}else{$("#oxReset").classList.remove("hidden");$("#oxStatus").textContent="이번 판 종료 · 다음 판을 시작하세요"}}
 };
 const rematchRef=roomRef.child("rematch");
 const rematchCb=async snap=>{const r=snap.val()||{};if(Object.keys(r).length<2||!isHost)return;await roomRef.update({status:"playing",winner:null,finishedAt:null,rematch:null});await stateRef.set({type:"ox",board:Array(9).fill(""),turn:Math.random()<.5?"X":"O",roundWins:{X:0,O:0},over:false,nextStarter:null});hideResult()};
 rematchRef.on("value",rematchCb);
 stateRef.on("value",cb);
 unsub=()=>{stateRef.off("value",cb);rematchRef.off("value",rematchCb)};
}

/* FORTRESS TERRAIN SELECT */
const TERRAINS=[
 {id:"extreme_canyon",name:"극한 협곡",level:"아주 어려움",fn:x=>300+78*Math.sin(x/72)+34*Math.sin(x/27)},
 {id:"twin_cliff",name:"쌍봉 절벽",level:"아주 어려움",fn:x=>x<430?355-105*Math.exp(-Math.pow((x-215)/95,2)):355-105*Math.exp(-Math.pow((x-645)/95,2))},
 {id:"deep_valley",name:"깊은 계곡",level:"어려움",fn:x=>245+125*Math.exp(-Math.pow((x-430)/150,2))},
 {id:"steep_mountain",name:"급경사 산악",level:"어려움",fn:x=>335-95*Math.sin(x/115)-20*Math.sin(x/35)},
 {id:"multi_hill",name:"다중 언덕",level:"약간 어려움",fn:x=>315+48*Math.sin(x/66)+18*Math.sin(x/24)},
 {id:"central_high",name:"중앙 고지대",level:"보통",fn:x=>340-82*Math.exp(-Math.pow((x-430)/155,2))},
 {id:"soft_valley",name:"완만한 계곡",level:"보통",fn:x=>290+55*Math.exp(-Math.pow((x-430)/190,2))},
 {id:"low_hills",name:"낮은 언덕",level:"쉬움",fn:x=>315+24*Math.sin(x/105)+10*Math.sin(x/47)},
 {id:"flat_meadow",name:"평탄 초원",level:"쉬움",fn:x=>320+9*Math.sin(x/150)},
 {id:"practice",name:"연습 평지",level:"매우 쉬움",fn:x=>320}
];
let selectedTerrain=null,chosenTerrainId="low_hills",terrainWatchOff=null;
function terrainById(id){return TERRAINS.find(t=>t.id===id)||TERRAINS[7]}
function drawTerrainThumb(canvas,t){const c=canvas.getContext("2d");c.clearRect(0,0,220,78);c.fillStyle="#75c8ff";c.fillRect(0,0,220,78);c.beginPath();c.moveTo(0,t.fn(0)/6);for(let x=0;x<=220;x+=3)c.lineTo(x,t.fn(x*860/220)/6);c.lineTo(220,78);c.lineTo(0,78);c.closePath();c.fillStyle="#6f5439";c.fill()}
function renderTerrainCards(){const g=$("#terrainGrid");g.innerHTML="";TERRAINS.forEach(t=>{const b=document.createElement("button");b.className="terrain-card"+(selectedTerrain===t.id?" selected":"");b.innerHTML=`<canvas class="terrain-thumb" width="220" height="78"></canvas><div class="terrain-name">${t.name}</div><div class="terrain-level">${t.level}</div>`;b.onclick=()=>{selectedTerrain=t.id;renderTerrainCards();$("#terrainConfirm").disabled=false};g.appendChild(b);drawTerrainThumb(b.querySelector("canvas"),t)})}
async function startTerrainSelection(){screen("terrainSelect");selectedTerrain=null;$("#terrainConfirm").disabled=true;$("#terrainWait").classList.add("hidden");$("#terrainGuide").textContent=mode==="online"?"각자 지형을 선택하면 둘 중 하나가 무작위로 결정됩니다.":"플레이할 지형을 하나 선택하세요.";renderTerrainCards();if(mode==="online"){await roomRef.child("terrainChoices/"+playerId).remove().catch(()=>{});const resultRef=roomRef.child("terrainResult"),choicesRef=roomRef.child("terrainChoices");const resultCb=snap=>{const id=snap.val();if(id){chosenTerrainId=id;if(terrainWatchOff)terrainWatchOff();$("#terrainWait").classList.remove("hidden");$("#terrainWait").textContent=`이번 경기 지형: ${terrainById(id).name}`;setTimeout(()=>startFortress(),900)}};const choicesCb=async snap=>{if(!isHost)return;const v=snap.val()||{};if(Object.keys(v).length<2)return;const picks=Object.values(v),result=picks[0]===picks[1]?picks[0]:picks[Math.floor(Math.random()*2)];await roomRef.update({terrainResult:result,terrainChoices:null})};resultRef.on("value",resultCb);choicesRef.on("value",choicesCb);terrainWatchOff=()=>{resultRef.off("value",resultCb);choicesRef.off("value",choicesCb)}}}
$("#terrainConfirm").onclick=async()=>{if(!selectedTerrain)return;if(mode!=="online"){chosenTerrainId=selectedTerrain;startFortress();return}$("#terrainConfirm").disabled=true;$("#terrainWait").classList.remove("hidden");await roomRef.child("terrainChoices/"+playerId).set(selectedTerrain)}

/* FORTRESS - 탱크 방향 고정, 좌우 이동, 각도/파워 별도 조절 */
const can=$("#fortCanvas"),ctx=can.getContext("2d");
let ft,anim=false,holdTimer=null,holdDelay=null;
function baseTerrainY(x){return terrainById(chosenTerrainId).fn(x)}
function terrainY(x){let y=baseTerrainY(x);for(const c of (ft?.craters||[])){const d=Math.abs(x-c.x);if(d<c.r)y+=c.depth*(1-Math.pow(d/c.r,2));}return Math.min(410,y)}
function newFT(){
 return{
   tanks:[
     {x:100,hp:100,angle:45,power:55},
     {x:760,hp:100,angle:45,power:55}
   ],
   turn:Math.random()<.5?0:1,wins:[0,0],over:false,nextStarter:null,
   ai:{shots:0,hitAt:5+Math.floor(Math.random()*6),recentPositions:[],lastHit:null},craters:[],trajectoryUsed:[false,false],showTrajectory:false
 };
}

function startFortress(){
 screen("fortress");
 ft=newFT();ft.terrainId=chosenTerrainId;
 if(mode==="online")setupFortOnline();
 else {renderFT();toast(`${ft.turn===0?"내가":"PC가"} 먼저 시작합니다.`);if(ft.turn===1)setTimeout(pcFT,800);} 
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

 $("#fortInfo").textContent=`지형 ${terrainById(ft.terrainId||chosenTerrainId).name} · 위치 ${Math.round(t.x)} · 포신 각도 ${t.angle}° · 파워 ${t.power}`;
 const tb=$("#trajectoryBtn");tb.classList.toggle("trajectory-on",!!ft.showTrajectory&&!ft.trajectoryUsed[me]);tb.textContent=ft.trajectoryUsed[me]?"✓ 사용 완료":ft.showTrajectory?"✨ 궤적 ON":"✨ 궤적 ×1";
 const active=!ft.over&&!anim&&ft.turn===me;
 ["moveLeft","moveRight","angleDown","angleUp","powerDown","powerUp","fireBtn","trajectoryBtn"].forEach(id=>$("#"+id).disabled=!active);
 drawFT();
 if(ft.showTrajectory&&!ft.trajectoryUsed[me])drawTrajectory(me);
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


function drawTrajectory(shooter){const p=shotVector(shooter);ctx.save();ctx.shadowColor="rgba(0,0,0,.75)";ctx.shadowBlur=4;ctx.fillStyle="#fde047";for(let i=0;i<180;i++){p.x+=p.vx;p.y+=p.vy;p.vy+=.16;if(i%5===0){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill()}if(p.x<0||p.x>860||p.y>terrainY(Math.max(0,Math.min(860,p.x))))break}ctx.restore()}
$("#trajectoryBtn").onclick=()=>{const me=myFTIndex();if(ft.trajectoryUsed[me])return toast("이번 경기의 궤적 아이템을 이미 사용했습니다.");ft.showTrajectory=!ft.showTrajectory;renderFT()};
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
 if(ft.showTrajectory){ft.trajectoryUsed[shooter]=true;ft.showTrajectory=false}
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

   if(hit)return endShot(shooter,true,p.x);
   if(p.x<0||p.x>860||p.y>terrainY(Math.max(0,Math.min(860,p.x)))||step>520){
     return endShot(shooter,false,p.x);
   }
   requestAnimationFrame(tick);
 }
 tick();
}

function endShot(shooter,hit,impactX){
 anim=false;
 const target=1-shooter;
 if(Number.isFinite(impactX)&&impactX>=0&&impactX<=860)ft.craters.push({x:impactX,r:hit?34:26,depth:hit?18:14});
 if(hit){
   ft.tanks[target].hp=Math.max(0,ft.tanks[target].hp-35);
   // PC가 사용자 포탄에 맞았을 때 직전 궤적과 피격 지점을 기억한다.
   if(mode==="solo"&&shooter===0&&target===1){
     ft.ai=ft.ai||{shots:0,hitAt:5+Math.floor(Math.random()*6),recentPositions:[],lastHit:null};
     ft.ai.lastHit={
       impactX:Number.isFinite(impactX)?impactX:ft.tanks[1].x,
       shooterX:ft.tanks[0].x,
       angle:ft.tanks[0].angle,
       power:ft.tanks[0].power,
       at:Date.now()
     };
   }
 }

 const dead=ft.tanks.findIndex(t=>t.hp<=0);
 if(dead>=0){
   const winner=1-dead;
   ft.wins[winner]++;
   ft.nextStarter=dead;
   ft.over=true;
   $("#fortNext").classList.remove("hidden");

   if(ft.wins[winner]>=3){
     const me=myFTIndex();
     if(winner===me){
       recordGame("fortress","win");
       if(mode==="online")finishOnline("fortress",playerId);
     }
     $("#fortStatus").textContent="최종 경기 종료 · 3승 달성";const mine=winner===myFTIndex();if(!mine)recordGame("fortress","loss");showResult(mine?"🏆 포트리스 승리":"포트리스 패배",`${ft.wins[myFTIndex()]} : ${ft.wins[1-myFTIndex()]}`,"다시 대전하기",mode==="online"?"방에서 나가기":"게임 종료");$("#resultRetry").onclick=()=>requestRematch("fortress");$("#resultExit").onclick=()=>{hideResult();leave()};
   }else{
     $("#fortStatus").textContent=`${winner===myFTIndex()?"내":"상대"} 승리 · 다음 판`;
   }
   syncFT();
   return;
 }

 ft.turn=target;
 syncFT();
 if(mode==="solo"&&shooter===0&&hit){setTimeout(()=>animatePCMove(()=>pcFT()),350)}else if(mode==="solo"&&ft.turn===1)setTimeout(pcFT,600);
}


function sampleShotPath(shooter,angle,power){
 const t=ft.tanks[shooter],dir=shooter===0?1:-1;
 let x=t.x,y=terrainY(t.x)-27;
 let vx=dir*Math.cos(angle*Math.PI/180)*(power*.22);
 let vy=-Math.sin(angle*Math.PI/180)*(power*.22);
 const path=[];
 for(let i=0;i<520;i++){
   x+=vx;y+=vy;vy+=.16;
   if(i%2===0)path.push({x,y});
   if(x<0||x>860||y>terrainY(Math.max(0,Math.min(860,x))))break;
 }
 return path;
}
function terrainSlopeAt(x){return Math.abs(terrainY(Math.min(825,x+10))-terrainY(Math.max(465,x-10)));}
function choosePCSafePosition(){
 const t=ft.tanks[1];
 ft.ai=ft.ai||{shots:0,hitAt:5+Math.floor(Math.random()*6),recentPositions:[],lastHit:null};
 const hit=ft.ai.lastHit;
 if(!hit)return Math.max(465,Math.min(825,t.x+(Math.random()<.5?-1:1)*(36+Math.floor(Math.random()*55))));
 const path=sampleShotPath(0,hit.angle,hit.power);
 const recent=ft.ai.recentPositions||[];
 const candidates=[];
 // 현재 위치에서 최대 약 126px 범위 안의 실제 이동 가능한 지점을 비교한다.
 for(let d=-126;d<=126;d+=14){
   const x=Math.max(465,Math.min(825,t.x+d));
   if(Math.abs(x-t.x)<24)continue;
   const slope=terrainSlopeAt(x);
   if(slope>30)continue;
   const y=terrainY(x)-18;
   let minPath=999;
   for(const p of path){const dist=Math.hypot(p.x-x,p.y-y);if(dist<minPath)minPath=dist;}
   const impactGap=Math.abs(x-hit.impactX);
   const repeatPenalty=recent.some(v=>Math.abs(v-x)<25)?90:0;
   const edgePenalty=(x<485||x>805)?18:0;
   const moveBonus=Math.min(28,Math.abs(x-t.x)*.18);
   const score=minPath*1.8+impactGap*.55+moveBonus-slope*1.2-repeatPenalty-edgePenalty;
   candidates.push({x,score});
 }
 if(!candidates.length)return Math.max(465,Math.min(825,t.x+(t.x>645?-70:70)));
 candidates.sort((a,b)=>b.score-a.score);
 return candidates[0].x;
}
function animatePCMove(done){
 if(ft.over||ft.turn!==1)return done&&done();
 anim=true;
 const t=ft.tanks[1],start=t.x,target=choosePCSafePosition();
 const distance=Math.abs(target-start),frames=Math.max(12,Math.ceil(distance/5));
 let f=0;
 function roll(){
   f++;
   const eased=1-Math.pow(1-f/frames,3);
   t.x=start+(target-start)*eased;
   drawFT();
   if(f<frames)return requestAnimationFrame(roll);
   t.x=target;
   ft.ai.recentPositions=([...(ft.ai.recentPositions||[]),Math.round(target)]).slice(-3);
   ft.ai.lastHit=null;
   anim=false;
   syncFT();
   setTimeout(()=>done&&done(),280);
 }
 roll();
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
 const keepMe=ft.me, nextStarter=ft.nextStarter;
 ft=newFT();ft.terrainId=chosenTerrainId;ft.turn=nextStarter??ft.turn;
 ft.wins=keepWins;
 if(mode==="online")ft.me=keepMe;
 $("#fortNext").classList.add("hidden");
 syncFT();
 if(mode==="solo"&&ft.turn===1)setTimeout(pcFT,500);
};

async function setupFortOnline(){
 const ps=(await roomRef.child("players").once("value")).val()||{};
 const ids=Object.keys(ps), me=ids.indexOf(playerId);
 if(isHost){
   ft.me=0;ft.terrainId=chosenTerrainId;
   await roomRef.child("state").set(ft);
 }else ft.me=me;

 const stateRef=roomRef.child("state");
 const cb=s=>{
   const st=s.val();
   if(!st)return;
   st.me=me;chosenTerrainId=st.terrainId||chosenTerrainId;
   ft=st;
   renderFT();
   if((st.wins?.[0]||0)==0&&(st.wins?.[1]||0)==0&&st.tanks?.every(t=>t.hp===100))$("#fortStatus").textContent=(st.turn===me?"내가":"상대가")+" 먼저 시작합니다.";
 };
 const rematchRef=roomRef.child("rematch");
 const rematchCb=async snap=>{const r=snap.val()||{};if(Object.keys(r).length<2||!isHost)return;await roomRef.update({status:"playing",winner:null,finishedAt:null,rematch:null,state:null,terrainResult:null,terrainChoices:null});hideResult();startTerrainSelection()};
 rematchRef.on("value",rematchCb);
 stateRef.on("value",cb);
 unsub=()=>{stateRef.off("value",cb);rematchRef.off("value",rematchCb)};
}

can.addEventListener("dblclick",e=>e.preventDefault());
document.addEventListener("gesturestart",e=>e.preventDefault());

/* Hall */
async function finishOnline(kind,winner){
 if(winner!==playerId)return;
 
 let ref=db.ref("hall/"+uid);await ref.transaction(v=>({nick:nickname,total:(v?.total||0)+1,updated:Date.now()}));
 toast("우승 기록이 저장되었습니다.");
}
window.addEventListener("pagehide",()=>{stopHeartbeat()});
const qp=new URLSearchParams(location.search),qg=qp.get("game"),qr=qp.get("room");
if(qg&&qr){game=qg;openLobby(game);$("#roomInput").value=qr;setTimeout(()=>$("#joinRoom").click(),300)}
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();