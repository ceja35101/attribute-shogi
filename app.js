const APP_VERSION="0.1.0-rc.1",SAVE_KEY="attributeShogiSavedGame",SAVE_VERSION=3,INVALID_SAVE_KEY=`${SAVE_KEY}InvalidBackup`;
let replayIndex=null,lastSoundSnapshot=-1,audioContext=null,saveNotice="";
let soundEnabled=localStorage.getItem("attributeShogiSound")!=="off";
let soundVolume=Number(localStorage.getItem("attributeShogiVolume")??.7);
cpuDifficulty=localStorage.getItem("attributeShogiDifficulty")||"normal";
promotionPrompt=p=>new Promise(resolve=>{
  const dialog=document.getElementById("promotion-dialog");
  document.getElementById("promotion-piece").textContent=`${PIECES[p.type].symbol}を成りますか？`;
  state.aiThinking=true;
  const decide=value=>{
    dialog.close();
    state.aiThinking=false;
    resolve(value);
  };
  document.getElementById("promote-yes").onclick=()=>decide(true);
  document.getElementById("promote-no").onclick=()=>decide(false);
  dialog.oncancel=e=>{e.preventDefault();decide(false)};
  dialog.showModal();
});

const shownState=()=>replayIndex===null?state:state.snapshots[replayIndex]?.position||state;

function saveGame(){
  if(!state||state.autoPlay||replayIndex!==null)return false;
  try{
    const snapshotStart=Math.max(0,state.snapshots.length-300),snapshots=state.snapshots.slice(snapshotStart).map((snapshot,index)=>({...snapshot,index}));
    const log=state.log.map(item=>({...item,snapshotIndex:item.snapshotIndex==null?null:Math.max(0,item.snapshotIndex-snapshotStart)}));
    const saved={version:SAVE_VERSION,savedAt:new Date().toISOString(),state:{...state,selected:null,moves:[],aiThinking:false,snapshots,log}};
    localStorage.setItem(SAVE_KEY,JSON.stringify(saved));
    return true;
  }catch(error){return false}
}

function migrateSavedPosition(position){
  if(!position||!Array.isArray(position.board)||!Array.isArray(position.clashes))return position;
  for(const row of position.board)for(const piece of row)if(piece)piece.supportLocks=Array.isArray(piece.supportLocks)?piece.supportLocks:[];
  for(const color of [HUMAN,CPU])for(const piece of position.hand?.[color]||[])piece.supportLocks=Array.isArray(piece.supportLocks)?piece.supportLocks:[];
  for(const clash of position.clashes){
    clash.id||=`legacy:${clash.startedAt??clash.expiresAt??0}:${clash.x}:${clash.y}`;
    if(!Array.isArray(clash.support))clash.support=[];
    for(const slot of clash.support){
      const piece=position.board?.[slot.y]?.[slot.x];
      if(piece&&ATTRIBUTE_DATA[piece.attr]?.beats===clash.attr&&!piece.supportLocks.includes(clash.id))piece.supportLocks.push(clash.id);
    }
  }
  return position;
}

function restoreGame(){
  const raw=localStorage.getItem(SAVE_KEY);
  if(!raw)return null;
  const reject=(reason)=>{
    saveNotice=`保存対局を復元できませんでした（${reason}）。データを退避して新しい対局を開始しました。`;
    try{localStorage.setItem(INVALID_SAVE_KEY,JSON.stringify({savedAt:new Date().toISOString(),reason,raw}));localStorage.removeItem(SAVE_KEY)}catch(error){}
    return null;
  };
  try{
    const saved=JSON.parse(raw),s=saved?.state;
    if(![2,SAVE_VERSION].includes(saved?.version))return reject(`保存形式 ${saved?.version??"不明"}`);
    if(!Array.isArray(s?.board)||s.board.length!==9||!s.board.every(row=>Array.isArray(row)&&row.length===9))return reject("盤面データ破損");
    const pieces=[...s.board.flat().filter(Boolean),...(s.hand?.white||[]),...(s.hand?.black||[])];
    if(!s.hand||!Array.isArray(s.clashes)||!pieces.every(p=>PIECES[p.type]&&ATTRIBUTE_DATA[p.attr]))return reject("駒または衝突データ破損");
    const migrated=migrateSavedPosition(s),snapshots=Array.isArray(migrated.snapshots)?migrated.snapshots:[];
    for(const snapshot of snapshots)migrateSavedPosition(snapshot?.position);
    return{...migrated,selected:null,moves:[],aiThinking:false,autoPlay:false,fullLog:Array.isArray(migrated.fullLog)?migrated.fullLog:[],log:Array.isArray(migrated.log)?migrated.log:[],snapshots,history:Array.isArray(migrated.history)?migrated.history:[]};
  }catch(error){return reject("JSON破損")}
}

function exportRecord(){
  const moves=(state.fullLog?.length?state.fullLog:[...state.log].reverse()).map(item=>`${item.number}. ${item.color===HUMAN?"先手":"後手"} ${item.text}`);
  const content=["属性将棋 棋譜",`出力日時: ${new Date().toLocaleString("ja-JP")}`,`手数: ${state.ply}`,`結果: ${state.winner?state.winner==="draw"?"引き分け":`${owner(state.winner)}の勝利`:"対局中"}`,"",...moves].join("\n");
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`attribute-shogi-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function copyDiagnostics(){
  const details=["属性将棋 診断情報",`Version: ${APP_VERSION}`,`UserAgent: ${navigator.userAgent}`,`手数: ${state.ply}`,`手番: ${state.turn}`,`勝者: ${state.winner||"なし"}`,`衝突数: ${state.clashes.length}`,"直近ログ:",...state.log.map(item=>`${item.number}. ${item.text}`)].join("\n");
  try{await navigator.clipboard.writeText(details);state.message="診断情報をクリップボードへコピーしました。";state.tone="success"}catch(error){state.message="診断情報をコピーできませんでした。HTTPSまたはlocalhostで開いてください。";state.tone="error"}render();
}

function playMoveSound(lastMove,tone){
  if(!soundEnabled||!lastMove)return;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  audioContext||=new AudioCtx();
  if(audioContext.state==="suspended")audioContext.resume();
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
  const frequency=lastMove.kind==="support"?660:lastMove.kind==="drop"?430:tone==="error"?170:300;
  oscillator.type=lastMove.kind==="support"?"triangle":"sine";
  oscillator.frequency.setValueAtTime(frequency,now);
  gain.gain.setValueAtTime(.0001,now);
  gain.gain.exponentialRampToValueAtTime(Math.max(.001,.09*soundVolume),now+.018);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.16);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now+.18);
}

function updateSoundButton(){
  const button=document.getElementById("sound-toggle");
  button.textContent=soundEnabled?"🔊 効果音":"🔇 ミュート";
  button.setAttribute("aria-pressed",String(!soundEnabled));
}

function selectBoard(x,y){
  if(replayIndex!==null)return;
  const p=state.board[y][x];
  state.selected={kind:"board",x,y};
  state.moves=boardMoves(p,x,y);
  if(!state.moves.length&&kingThreatened(HUMAN)){
    const origins=[...new Set(allMoves(HUMAN).filter(m=>m.kind==="board").map(m=>coord(m.fromX,m.fromY)))];
    state.message=`王手中です。この${symbol(p)}では回避できません。${origins.length?`「王手回避可」と表示された駒（${origins.join("、")}）を動かしてください。`:""}`;
    state.tone="warning";
  }else{
    state.message=`${symbol(p)}（${ATTRIBUTE_DATA[p.attr].label}属性）を選択中。`;
    state.tone="info";
  }
  render();
}

function selectHand(i){
  if(replayIndex!==null)return;
  const p=state.hand[HUMAN][i];
  if(!p)return;
  state.selected={kind:"hand",index:i};
  state.moves=dropMoves(p).map(m=>({...m,handIndex:i}));
  state.message=`持ち駒 ${symbol(p)}（${ATTRIBUTE_DATA[p.attr].label}属性）を選択中。`;
  render();
}

function clickSquare(x,y){
  if(replayIndex!==null||state.winner||state.aiThinking||state.turn!==HUMAN)return;
  const m=state.moves.find(v=>v.x===x&&v.y===y);
  if(m){
    if(m.kind==="board")Object.assign(m,{fromX:state.selected.x,fromY:state.selected.y});
    execute(m);
    return;
  }
  const p=state.board[y][x];
  if(p&&p.color===HUMAN)selectBoard(x,y);
  else{
    state.selected=null;
    state.moves=[];
    state.message="自分の駒または持ち駒を選んでください。";
    render();
  }
}

function appendMoveArrow(el,lastMove,recent){
  if(!lastMove?.from||!recent)return;
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.classList.add("move-arrow");
  svg.setAttribute("viewBox","0 0 9 9");
  svg.setAttribute("aria-hidden","true");
  svg.innerHTML=`<defs><marker id="move-arrow-head" markerWidth=".55" markerHeight=".55" refX=".43" refY=".275" orient="auto"><path d="M0,0 L.55,.275 L0,.55 Z"></path></marker></defs><line x1="${lastMove.from.x+.5}" y1="${lastMove.from.y+.5}" x2="${lastMove.to.x+.5}" y2="${lastMove.to.y+.5}" marker-end="url(#move-arrow-head)"></line>`;
  el.appendChild(svg);
}

function renderBoard(){
  const shown=shownState(),el=document.getElementById("board"),last=shown.lastMove;
  const recent=replayIndex===null&&last&&Date.now()-last.at<1400;
  const checkEvasions=replayIndex===null&&shown.turn===HUMAN&&kingThreatened(HUMAN)
    ?new Set(allMoves(HUMAN).filter(m=>m.kind==="board").map(m=>`${m.fromX},${m.fromY}`))
    :new Set();
  el.innerHTML="";
  shown.board.forEach((row,y)=>row.forEach((p,x)=>{
    const b=document.createElement("button");
    const clash=shown.clashes.find(c=>c.x===x&&c.y===y);
    const supportSlot=shown.clashes.find(c=>c.support.some(slot=>slot.x===x&&slot.y===y));
    const clashNumber=supportSlot?shown.clashes.indexOf(supportSlot)+1:0;
    const lockedClashes=p?shown.clashes.filter(c=>c.id&&p.supportLocks?.includes(c.id)):[];
    const selectedPiece=replayIndex===null&&state.selected?.kind==="board"?state.board[state.selected.y]?.[state.selected.x]:null;
    const selectedLocked=supportSlot&&selectedPiece?.supportLocks?.includes(supportSlot.id);
    b.type="button";
    b.className=`square ${(x+y)%2?"dark":"light"}`;
    b.dataset.x=x;
    b.dataset.y=y;
    b.onclick=()=>clickSquare(x,y);
    b.disabled=replayIndex!==null;
    if(last?.from?.x===x&&last.from.y===y)b.classList.add("last-move-from");
    if(last?.to.x===x&&last.to.y===y){
      b.classList.add("last-move-to");
      if(recent)b.classList.add("recent-move",`effect-${shown.tone||"info"}`);
    }
    if(supportSlot)b.classList.add("support-slot",selectedLocked?"support-unavailable":"support-available");
    if(checkEvasions.has(`${x},${y}`))b.classList.add("check-evasion-piece");
    if(replayIndex===null&&state.selected?.kind==="board"&&state.selected.x===x&&state.selected.y===y)b.classList.add("selected");
    const m=replayIndex===null&&state.moves.find(v=>v.x===x&&v.y===y);
    if(m)b.classList.add(m.result==="capture"?"capture-target":m.result==="retaliation"?"retaliation-target":m.result==="same"?"same-target":m.result==="support"?"support-target":"move-target");
    if(clash){
      const remaining=clash.expiresAt-shown.ply;
      b.classList.add("clash-square");
      if(clash.kingCollision)b.classList.add("king-clash");
      if(clash.weakCollision)b.classList.add("weak-king-clash");
      b.disabled=true;
      b.title=`${clash.weakCollision?"王への弱属性短期膠着":`${clash.kingCollision?"王の":""}${ATTRIBUTE_DATA[clash.attr].label}属性衝突`}・残り${remaining}ターン`;
      b.innerHTML=`<span class="clash-id">衝${shown.clashes.indexOf(clash)+1}</span><span class="clash-icon">${attributeIcon(clash.attr)}</span><span class="clash-pieces">${clash.pieces.map(q=>symbol(q)).join("×")}</span><span class="clash-turns">${remaining}</span>`;
    }else if(p){
      const lockText=lockedClashes.length?` / 衝突${lockedClashes.map(c=>shown.clashes.indexOf(c)+1).join("・")}への援軍権使用済み`:"";
      b.title=`${symbol(p)} / ${ATTRIBUTE_DATA[p.attr].label}属性${p.type==="king"?` / 耐久 ${4-(p.weakHits||0)}/4`:""}${lockText}`;
      const lockBadge=lockedClashes.length?`<span class="support-used-badge">援${lockedClashes.map(c=>shown.clashes.indexOf(c)+1).join("・")}×</span>`:"";
      b.innerHTML=`<span class="square-attribute-bg attr-${p.attr}" aria-hidden="true">${attributeIcon(p.attr)}</span><span class="piece piece-attr-${p.attr} ${p.color}"><span class="piece-symbol ${p.color===CPU?"flipped":""}">${symbol(p)}</span>${p.type==="king"&&p.weakHits?`<span class="king-damage">${4-p.weakHits}/4</span>`:""}${lockBadge}</span>`;
      if(checkEvasions.has(`${x},${y}`)){
        const badge=document.createElement("span");
        badge.className="check-evasion-badge";
        badge.textContent="王手回避可";
        b.appendChild(badge);
      }
    }
    if(last?.to.x===x&&last.to.y===y&&last.badge){
      const badge=document.createElement("span");
      badge.className="last-move-badge";
      badge.textContent=last.badge;
      b.appendChild(badge);
    }
    if(m&&m.result!=="move"){
      const resultBadge=document.createElement("span"),labels={capture:"有利",retaliation:"不利",same:"同",support:"援"};
      resultBadge.className=`move-result-badge result-${m.result}`;
      if(m.result==="support"&&supportSlot){
        const supportAttr=Object.keys(ATTRIBUTE_DATA).find(attr=>ATTRIBUTE_DATA[attr].beats===supportSlot.attr);
        if(supportAttr)resultBadge.classList.add(`support-attr-${supportAttr}`);
      }
      resultBadge.textContent=labels[m.result]||"";
      b.appendChild(resultBadge);
      b.setAttribute("aria-label",`${coord(x,y)} ${labels[m.result]||"移動"}`);
    }else b.setAttribute("aria-label",`${coord(x,y)}${p?` ${symbol(p)} ${ATTRIBUTE_DATA[p.attr].label}属性`:" 空きマス"}${supportSlot?` 衝突${clashNumber}の強属性援軍位置${selectedLocked?"・選択中の駒は援軍権使用済み":""}`:""}`);
    if(supportSlot&&!clash){
      const marker=document.createElement("span"),supportAttr=Object.keys(ATTRIBUTE_DATA).find(attr=>ATTRIBUTE_DATA[attr].beats===supportSlot.attr);
      if(supportAttr){
        const supportIcon=document.createElement("span");
        supportIcon.className=`square-attribute-bg support-attribute-bg attr-${supportAttr}`;
        supportIcon.setAttribute("aria-hidden","true");
        supportIcon.innerHTML=attributeIcon(supportAttr);
        b.appendChild(supportIcon);
      }
      marker.className=`support-slot-badge${supportAttr?` support-attr-${supportAttr}`:""}`;
      marker.textContent=`援${clashNumber}${selectedLocked?"×":""}`;
      marker.setAttribute("aria-hidden","true");
      b.appendChild(marker);
    }
    el.appendChild(b);
  }));
  appendMoveArrow(el,last,recent);
}

function handPieceHtml(p,c){
  return `<span class="hand-piece-icon ${c}"><span class="hand-piece-attr attr-${p.attr}">${attributeIcon(p.attr)}</span><span class="hand-piece-symbol ${c===CPU?"flipped":""}">${symbol(p)}</span></span>`;
}

function renderHand(c,listId,stockId){
  const shown=shownState(),list=document.getElementById(listId),stock=document.getElementById(stockId);
  list.innerHTML="";
  stock.innerHTML="";
  shown.hand[c].forEach((p,i)=>{
    const label=`${symbol(p)}・${ATTRIBUTE_DATA[p.attr].label}属性`,content=handPieceHtml(p,c),li=document.createElement("li");
    li.innerHTML=content;
    li.title=label;
    li.setAttribute("aria-label",label);
    list.appendChild(li);
    const b=document.createElement("button");
    b.type="button";
    b.className=`stock-piece${replayIndex===null&&c===HUMAN&&state.selected?.kind==="hand"&&state.selected.index===i?" selected-hand":""}`;
    b.innerHTML=content;
    b.title=label;
    b.setAttribute("aria-label",label);
    b.disabled=replayIndex!==null||c!==HUMAN||state.turn!==HUMAN||state.aiThinking;
    b.dataset.handIndex=i;
    stock.appendChild(b);
  });
  if(!shown.hand[c].length)stock.textContent="持ち駒なし";
}

function showReplay(index){
  if(!state.snapshots.length)return;
  replayIndex=Math.max(0,Math.min(index,state.snapshots.length-1));
  state.selected=null;
  state.moves=[];
  render();
}

function returnToCurrent(){
  replayIndex=null;
  render();
}

function undoTarget(){
  if(!state||state.autoPlay||state.aiThinking||replayIndex!==null)return null;
  const lastHuman=[...(state.fullLog||[])].reverse().find(item=>item.color===HUMAN);
  if(!lastHuman)return null;
  const targetPly=Math.max(0,lastHuman.number-1);
  let snapshotIndex=-1;
  for(let i=state.snapshots.length-1;i>=0;i--)if(state.snapshots[i].position?.ply===targetPly){snapshotIndex=i;break}
  return snapshotIndex<0?null:{targetPly,snapshotIndex};
}

function undoLastTurn(){
  const target=undoTarget();
  if(!target)return false;
  const previous=state,position=JSON.parse(JSON.stringify(previous.snapshots[target.snapshotIndex].position));
  const snapshots=previous.snapshots.slice(0,target.snapshotIndex+1);
  const fullLog=(previous.fullLog||[]).filter(item=>item.number<=target.targetPly).map(item=>({...item}));
  const log=fullLog.slice(-5).reverse().map(item=>{
    let snapshotIndex=null;
    for(let i=snapshots.length-1;i>=0;i--)if(snapshots[i].position?.ply===item.number){snapshotIndex=i;break}
    return{...item,snapshotIndex};
  });
  state={...previous,...position,snapshots,fullLog,log,history:(previous.history||[]).slice(0,target.targetPly+1),selected:null,moves:[],aiThinking:false,autoPlay:false,winner:position.winner||null,message:"待ったを使用し、直前の自分の着手前へ戻りました。ここから棋譜が分岐します。",tone:"warning"};
  replayIndex=null;
  lastSoundSnapshot=target.snapshotIndex;
  render();
  return true;
}

function renderLog(){
  const el=document.getElementById("move-log");
  el.innerHTML="";
  state.log.forEach(item=>{
    const li=document.createElement("li"),button=document.createElement("button");
    const actor=item.color===HUMAN?"先手":item.color===CPU?"後手":item.number%2?"先手":"後手";
    button.type="button";
    button.className="log-move-button";
    button.textContent=`${actor}　${item.text}`;
    button.disabled=item.snapshotIndex==null;
    button.onclick=()=>showReplay(item.snapshotIndex);
    li.appendChild(button);
    el.appendChild(li);
  });
  if(!state.log.length){
    const li=document.createElement("li");
    li.className="log-empty";
    li.textContent="まだ着手はありません。";
    el.appendChild(li);
  }
}

function renderReplayControls(){
  const count=state.snapshots.length,current=replayIndex===null?count-1:replayIndex;
  document.getElementById("replay-prev").disabled=current<=0;
  document.getElementById("replay-next").disabled=replayIndex===null||current>=count-1;
  document.getElementById("replay-current").disabled=replayIndex===null;
  document.getElementById("undo-turn").disabled=!undoTarget();
  document.getElementById("replay-status").textContent=replayIndex===null?"現在局面":`棋譜再生: ${current}手目 / ${count-1}手`;
}

function render(){
  if(state.autoPlay)return;
  const snapshotIndex=recordSnapshot();
  if(replayIndex===null&&snapshotIndex>0&&snapshotIndex!==lastSoundSnapshot){
    playMoveSound(state.lastMove,state.tone);
    lastSoundSnapshot=snapshotIndex;
  }
  renderBoard();
  renderHand(CPU,"black-hand","cpu-stock");
  renderHand(HUMAN,"white-hand","human-stock");
  renderLog();
  renderReplayControls();
  const shown=shownState();
  document.getElementById("turn").textContent=replayIndex!==null?`${shown.ply}手目`:state.winner?"対局終了":`手番: ${owner(state.turn)}`;
  const msg=document.getElementById("message");
  msg.textContent=replayIndex!==null?(shown.message||"過去局面を表示中です。"):state.message;
  msg.className=`message ${replayIndex!==null?(shown.tone||"info"):state.tone}`;
  document.getElementById("end-actions").hidden=!state.winner;
  saveGame();
}

function bind(){
  document.getElementById("human-stock").addEventListener("click",e=>{
    const b=e.target.closest("[data-hand-index]");
    if(b)selectHand(+b.dataset.handIndex);
  });
  document.getElementById("reset").addEventListener("click",()=>{
    replayIndex=null;
    localStorage.removeItem(SAVE_KEY);
    state=initialState();
    render();
  });
  document.getElementById("replay-prev").addEventListener("click",()=>showReplay((replayIndex===null?state.snapshots.length-1:replayIndex)-1));
  document.getElementById("replay-next").addEventListener("click",()=>showReplay(replayIndex+1));
  document.getElementById("replay-current").addEventListener("click",returnToCurrent);
  document.getElementById("undo-turn").addEventListener("click",undoLastTurn);
  document.getElementById("board").addEventListener("keydown",e=>{
    const square=e.target.closest(".square");
    if(!square||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
    e.preventDefault();
    const dx=e.key==="ArrowLeft"?-1:e.key==="ArrowRight"?1:0,dy=e.key==="ArrowUp"?-1:e.key==="ArrowDown"?1:0;
    const x=Math.max(0,Math.min(8,+square.dataset.x+dx)),y=Math.max(0,Math.min(8,+square.dataset.y+dy));
    document.querySelector(`.square[data-x="${x}"][data-y="${y}"]`)?.focus();
  });
  const difficulty=document.getElementById("cpu-difficulty");
  difficulty.value=cpuDifficulty;
  difficulty.addEventListener("change",()=>{
    cpuDifficulty=difficulty.value;
    localStorage.setItem("attributeShogiDifficulty",cpuDifficulty);
  });
  document.getElementById("sound-toggle").addEventListener("click",()=>{
    soundEnabled=!soundEnabled;
    localStorage.setItem("attributeShogiSound",soundEnabled?"on":"off");
    updateSoundButton();
  });
  const volume=document.getElementById("sound-volume");
  volume.value=String(soundVolume);
  volume.addEventListener("input",()=>{
    soundVolume=Number(volume.value);
    localStorage.setItem("attributeShogiVolume",String(soundVolume));
  });
  const menuDialog=document.getElementById("menu-dialog"),dialog=document.getElementById("rules-dialog"),skip=document.getElementById("skip-tutorial");
  document.getElementById("open-menu").addEventListener("click",()=>menuDialog.showModal());
  document.getElementById("close-menu").addEventListener("click",()=>menuDialog.close());
  document.getElementById("open-rules").addEventListener("click",()=>{
    menuDialog.close();
    dialog.showModal();
  });
  dialog.addEventListener("close",()=>{
    if(skip.checked)localStorage.setItem("attributeShogiTutorialSeen","yes");
  });
  updateSoundButton();
  document.getElementById("new-game").addEventListener("click",()=>document.getElementById("reset").click());
  document.getElementById("save-game").addEventListener("click",()=>{
    const ok=saveGame();state.message=ok?"現在の対局をこのブラウザーへ保存しました。":"保存できませんでした。ブラウザーの保存設定を確認してください。";state.tone=ok?"success":"error";render();
  });
  document.getElementById("export-record").addEventListener("click",exportRecord);
  document.getElementById("copy-diagnostics").addEventListener("click",copyDiagnostics);
  const resignDialog=document.getElementById("resign-dialog");
  document.getElementById("resign").addEventListener("click",()=>{if(!state.winner&&state.turn===HUMAN&&!state.aiThinking)resignDialog.showModal()});
  document.getElementById("resign-yes").addEventListener("click",()=>{
    resignDialog.close();state.winner=CPU;state.selected=null;state.moves=[];state.message=`あなたが投了しました。${resultForViewer(CPU)}`;state.tone="success";addLog("先手 投了",HUMAN);render();
  });
  document.getElementById("resign-no").addEventListener("click",()=>resignDialog.close());
}

async function bootstrap(){
  try{
    const r=await fetch("attributes.json",{cache:"no-store"});
    if(!r.ok)throw Error("属性設定を読み込めません");
    ATTRIBUTE_DATA=await r.json();
    state=restoreGame()||initialState();
    if(saveNotice){state.message=saveNotice;state.tone="warning"}
    else if(state.ply>0&&!state.winner){state.message=`保存した対局を${state.ply}手目から再開しました。`;state.tone="info"}
    bind();
    render();
    if(localStorage.getItem("attributeShogiTutorialSeen")!=="yes")document.getElementById("rules-dialog").showModal();
    if(state.turn===CPU&&!state.winner){state.aiThinking=true;setTimeout(runAi,450)}
  }catch(e){
    const message=document.getElementById("message");
    message.textContent=`起動エラー: ${e.message}。HTTPサーバーから開いてください。`;
    message.className="message error";
    const retry=document.createElement("button");
    retry.textContent="再読み込み";
    retry.onclick=()=>location.reload();
    message.append(" ",retry);
  }
}

document.addEventListener("DOMContentLoaded",bootstrap);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
