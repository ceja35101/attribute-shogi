const SAVE_KEY="attributeShogiSavedGame",SAVE_VERSION=2;
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

function restoreGame(){
  try{
    const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||"null"),s=saved?.state;
    if(saved?.version!==SAVE_VERSION||!Array.isArray(s?.board)||s.board.length!==9||!s.board.every(row=>Array.isArray(row)&&row.length===9))return null;
    const pieces=[...s.board.flat().filter(Boolean),...(s.hand?.white||[]),...(s.hand?.black||[])];
    if(!s.hand||!s.clashes||!pieces.every(p=>PIECES[p.type]&&ATTRIBUTE_DATA[p.attr]))return null;
    return{...s,selected:null,moves:[],aiThinking:false,autoPlay:false,fullLog:Array.isArray(s.fullLog)?s.fullLog:[],log:Array.isArray(s.log)?s.log:[],snapshots:Array.isArray(s.snapshots)?s.snapshots:[],history:Array.isArray(s.history)?s.history:[]};
  }catch(error){return null}
}

function exportRecord(){
  const moves=(state.fullLog?.length?state.fullLog:[...state.log].reverse()).map(item=>`${item.number}. ${item.color===HUMAN?"先手":"後手"} ${item.text}`);
  const content=["属性将棋 棋譜",`出力日時: ${new Date().toLocaleString("ja-JP")}`,`手数: ${state.ply}`,`結果: ${state.winner?state.winner==="draw"?"引き分け":`${owner(state.winner)}の勝利`:"対局中"}`,"",...moves].join("\n");
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`attribute-shogi-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function copyDiagnostics(){
  const details=["属性将棋 診断情報","Version: 0.1.0-beta.3",`UserAgent: ${navigator.userAgent}`,`手数: ${state.ply}`,`手番: ${state.turn}`,`勝者: ${state.winner||"なし"}`,`衝突数: ${state.clashes.length}`,"直近ログ:",...state.log.map(item=>`${item.number}. ${item.text}`)].join("\n");
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
  state.message=`${symbol(p)}（${ATTRIBUTE_DATA[p.attr].label}属性）を選択中。`;
  state.tone="info";
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
  el.innerHTML="";
  shown.board.forEach((row,y)=>row.forEach((p,x)=>{
    const b=document.createElement("button");
    const clash=shown.clashes.find(c=>c.x===x&&c.y===y);
    const supportSlot=shown.clashes.find(c=>c.support.some(slot=>slot.x===x&&slot.y===y));
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
    if(supportSlot)b.classList.add("support-slot");
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
      b.innerHTML=`<span class="clash-icon">${attributeIcon(clash.attr)}</span><span class="clash-pieces">${clash.pieces.map(q=>symbol(q)).join("×")}</span><span class="clash-turns">${remaining}</span>`;
    }else if(p){
      b.title=`${symbol(p)} / ${ATTRIBUTE_DATA[p.attr].label}属性${p.type==="king"?` / 耐久 ${4-(p.weakHits||0)}/4`:""}`;
      b.innerHTML=`<span class="piece ${p.color}"><span class="piece-symbol ${p.color===CPU?"flipped":""}">${symbol(p)}</span><span class="attr attr-${p.attr}">${attributeIcon(p.attr)}</span>${p.type==="king"&&p.weakHits?`<span class="king-damage">${4-p.weakHits}/4</span>`:""}</span>`;
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
      resultBadge.textContent=labels[m.result]||"";
      b.appendChild(resultBadge);
      b.setAttribute("aria-label",`${coord(x,y)} ${labels[m.result]||"移動"}`);
    }else b.setAttribute("aria-label",`${coord(x,y)}${p?` ${symbol(p)} ${ATTRIBUTE_DATA[p.attr].label}属性`:" 空きマス"}${supportSlot?" 強属性援軍位置":""}`);
    if(supportSlot&&!clash){const marker=document.createElement("span");marker.className="support-slot-badge";marker.textContent="援";marker.setAttribute("aria-hidden","true");b.appendChild(marker)}
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

function renderLog(){
  const el=document.getElementById("move-log");
  el.innerHTML="";
  state.log.forEach(item=>{
    const li=document.createElement("li"),button=document.createElement("button");
    button.type="button";
    button.className="log-move-button";
    button.textContent=item.text;
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
  msg.textContent=replayIndex!==null?"過去局面を表示中です。現在局面へ戻ると対局を再開できます。":state.message;
  msg.className=`message ${replayIndex!==null?"info":state.tone}`;
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
  const dialog=document.getElementById("rules-dialog"),skip=document.getElementById("skip-tutorial");
  document.getElementById("open-rules").addEventListener("click",()=>dialog.showModal());
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
    if(state.ply>0&&!state.winner){state.message=`保存した対局を${state.ply}手目から再開しました。`;state.tone="info"}
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
