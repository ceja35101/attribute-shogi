const APP_VERSION="0.1.0-rc.1",SAVE_KEY="attributeShogiSavedGame",SAVE_VERSION=3,INVALID_SAVE_KEY=`${SAVE_KEY}InvalidBackup`;
let replayIndex=null,lastSoundSnapshot=-1,audioContext=null,saveNotice="";
let soundEnabled=localStorage.getItem("attributeShogiSound")!=="off";
let soundVolume=Number(localStorage.getItem("attributeShogiVolume")??.7);
cpuDifficulty=localStorage.getItem("attributeShogiDifficulty")||"normal";
promotionPrompt=p=>new Promise(resolve=>{
  const dialog=document.getElementById("promotion-dialog");
  document.getElementById("promotion-piece").textContent=uiLanguage==="en"?`Promote ${PIECES[p.type].en}?`:`${PIECES[p.type].symbol}を成りますか？`;
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
const bilingual=(ja,en)=>uiLanguage==="en"?en:ja;

const STATIC_TRANSLATIONS={
  "#reset":["初期化","Reset"],"#resign":["投了","Resign"],"#new-game":["もう一度対局する","Play again"],
  "#menu-title":["ルール・設定","Rules & Settings"],"#close-menu":["閉じる","Close"],
  "#rule-summary-title":["ルール概要","Rule Summary"],"#open-rules":["詳しい遊び方・ルール","How to Play"],
  "#settings-title":["設定","Settings"],"#tools-title":["その他の操作","Other Actions"],
  "#undo-turn":["待った","Undo"],"#save-game":["対局を保存","Save Game"],"#export-record":["棋譜を出力","Export Record"],
  "#copy-diagnostics":["診断情報をコピー","Copy Diagnostics"],"#feedback-title":["ベータテスト","Beta Test"],
  "#copy-feedback-template":["感想テンプレートをコピー","Copy Feedback Template"],
  "#rules-title":["属性将棋の遊び方","How to Play Elemental Shogi"],
  "#practice-reset":["やり直す","Reset"],"#practice-prev":["前へ","Previous"],
  "#promote-yes":["成る","Promote"],"#promote-no":["成らない","Do not promote"],
  "#resign-title":["投了しますか？","Resign?"],"#resign-yes":["投了する","Resign"],"#resign-no":["戻る","Back"],
  "#replay-prev":["◀ 前の手","◀ Previous"],"#replay-next":["次の手 ▶","Next ▶"],"#replay-current":["現在局面へ戻る","Return to current"]
};

function applyLanguage(){
  document.documentElement.lang=uiLanguage;
  document.title=bilingual("属性付き将棋","Elemental Shogi");
  const title=document.querySelector(".game-header h1");
  if(title?.firstChild)title.firstChild.nodeValue=bilingual("属性付き将棋 ","Elemental Shogi ");
  document.querySelector(".beta-label").textContent=bilingual("無料ベータ","Free Beta");
  document.getElementById("open-menu").setAttribute("aria-label",bilingual("ルールと設定を開く","Open rules and settings"));
  for(const [selector,texts] of Object.entries(STATIC_TRANSLATIONS)){
    const element=document.querySelector(selector);
    if(element)element.textContent=texts[uiLanguage==="en"?1:0];
  }
  const handTitles=document.querySelectorAll(".hand-panel h2");
  if(handTitles[0])handTitles[0].textContent=bilingual("後手の持ち駒","CPU Pieces in Hand");
  if(handTitles[1])handTitles[1].textContent=bilingual("先手の持ち駒","Your Pieces in Hand");
  const logTitle=document.querySelector(".log-panel h2");
  if(logTitle)logTitle.textContent=bilingual("直近5手","Last 5 Moves");
  const feedback=document.querySelector(".beta-feedback > p");
  if(feedback)feedback.textContent=bilingual("遊びにくかった点、不具合、面白かった局面をお知らせください。対局内容は自動送信されません。","Tell us what was confusing, any bugs, and memorable positions. Game data is never sent automatically.");
  const feedbackLinks=document.querySelectorAll(".beta-feedback .button-link");
  if(feedbackLinks[0])feedbackLinks[0].textContent=bilingual("不具合・感想を送る","Send Bug Report / Feedback");
  if(feedbackLinks[1]){feedbackLinks[1].textContent=bilingual("テスト参加案内","Beta Test Guide");feedbackLinks[1].href=bilingual("BETA_TEST_GUIDE.md","BETA_TEST_GUIDE_EN.md")}
  const legendItems=document.querySelectorAll(".menu-section .legend li"),attrs=["fire","water","wind"],beats=["wind","fire","water"];
  legendItems.forEach((item,index)=>{
    const chip=item.querySelector(".chip");if(!chip)return;
    const image=chip.querySelector("img");
    chip.textContent=attrLabel(attrs[index]);if(image)chip.prepend(image);
    if(item.lastChild)item.lastChild.textContent=bilingual(`${ATTRIBUTE_DATA[beats[index]].label}に勝つ`,` beats ${ATTRIBUTE_DATA[beats[index]].labelEn}`);
  });
  const resultLegend=document.querySelector(".menu-section .result-legend"),resultSpans=resultLegend?.querySelectorAll("span");
  const resultLabels=uiLanguage==="en"?["WIN","LOSE","SAME","AID"]:["有利","不利","同","援"];
  resultSpans?.forEach((span,index)=>span.textContent=resultLabels[index]);
  if(resultLegend?.lastChild)resultLegend.lastChild.textContent=bilingual(" 王の耐久は4。弱属性攻撃は1、同属性膠着の自然解消は2ダメージです。援軍は強属性のみ有効です。"," King durability is 4. Weak-element attacks deal 1; unresolved same-element clashes deal 2. Only a strong element can reinforce.");
  const tutorialSections=document.querySelectorAll(".tutorial-grid section");
  const tutorialCopy=[
    ["1. 基本操作","1. Basic Controls","自分の駒を選び、色の付いた移動先を選びます。持ち駒は盤面下から選択できます。","Select one of your pieces, then a highlighted destination. Select a captured piece from your hand to drop it."],
    ["2. 属性戦闘","2. Element Battles","火 → 風 → 水 → 火 の順で有利です。候補マスの「有利」「不利」「同」の文字で戦闘結果を確認できます。","Fire beats Wind, Wind beats Water, and Water beats Fire. Move markers show Advantage, Disadvantage, or Same."],
    ["3. 衝突と援軍","3. Clashes & Reinforcements","同属性は衝突してマスを封鎖します。「衝1」と同じ番号の「援1」へ、衝突前から盤上にいた強属性駒を移動すると制圧できます。","Pieces of the same element clash and block the square. Move an eligible strong-element piece to the matching reinforcement square to resolve it."],
    ["4. 王と勝敗","4. King & Victory","王の耐久は4です。弱属性の短期膠着で1、同属性膠着の自然解消で2を失い、耐久0で敗北します。強属性援軍は膠着を即決着させます。","The King has 4 durability. A weak-element attack deals 1 after a short clash; a same-element clash deals 2. At 0 durability, the King loses."],
    ["5. 直前手と棋譜","5. Last Move & Record","青紫の枠が直前手です。ログや前後ボタンから過去局面を確認できます。「待った」は直前の自分の着手前まで戻し、それ以降の棋譜を破棄します。","Blue-violet borders show the last move. Use the record controls to review positions. Undo returns to before your previous move and branches the record."]
  ];
  tutorialSections.forEach((section,index)=>{
    const copy=tutorialCopy[index];if(!copy)return;
    section.querySelector("h3").textContent=copy[uiLanguage==="en"?1:0];
    const paragraph=section.querySelector("p");if(paragraph)paragraph.textContent=copy[uiLanguage==="en"?3:2];
  });
  const reinforcementExtra=tutorialSections[2]?.querySelectorAll("p")[1];
  if(reinforcementExtra)reinforcementExtra.textContent=bilingual("衝突開始時に援軍位置へいた強属性駒には「援1×」が付き、その衝突には使用できません。別の未使用の強属性駒へ入れ替えると援軍が成立します。","A strong piece already on the reinforcement square is marked “AID 1 ×” and cannot support that clash. Replace it with a different eligible piece.");
  const skip=document.querySelector(".tutorial-check");
  if(skip?.lastChild)skip.lastChild.textContent=bilingual(" 次回から起動時に表示しない"," Do not show at startup again");
  document.querySelector(".tutorial-start").textContent=bilingual("対局を始める","Start Game");
  document.getElementById("practice-hand-label").textContent=bilingual("相手の持ち駒","Pieces in Hand");
  document.querySelector("#promotion-dialog p").textContent=bilingual("成ると駒の動きが変わります。属性は変化しません。","Promotion changes movement. The element does not change.");
  document.querySelector("#resign-dialog p").textContent=bilingual("投了するとCPUの勝利となり、対局は終了します。","Resigning ends the game with a CPU victory.");
  document.querySelector(".app-footer").textContent=bilingual("属性将棋 Ver0.1.0-rc.1","Elemental Shogi Ver0.1.0-rc.1");
  document.getElementById("language-select").value=uiLanguage;
  if(state?.message==="あなたの番です。駒または持ち駒を選んでください。"||state?.message==="Your turn. Select a piece or a piece in hand.")state.message=bilingual("あなたの番です。駒または持ち駒を選んでください。","Your turn. Select a piece or a piece in hand.");
  renderPracticeTutorial();
}

const PRACTICE_SCENARIOS=[
  {attacker:{type:"pawn",attr:"fire"},defender:{type:"silver",attr:"wind"},expected:"capture",
    ja:["有利属性で攻撃","火の歩を選び、風の銀を攻撃してください。","火は風に勝ちます。","攻撃成功。銀を取り、歩がそのマスへ進みました。"],
    en:["Attack with an advantage","Select the Fire Pawn, then attack the Wind Silver.","Fire beats Wind.","Success. The Pawn captured the Silver and moved onto its square."]},
  {attacker:{type:"silver",attr:"fire"},defender:{type:"gold",attr:"fire"},expected:"same",
    ja:["同属性で攻撃","火の銀で、同じ火の金を攻撃してください。","同属性は衝突します。","両駒が衝突し、そのマスは一時的に封鎖されました。"],
    en:["Attack the same element","Attack the Fire Gold with the Fire Silver.","Matching elements cause a clash.","The pieces clashed, temporarily blocking that square."]},
  {attacker:{type:"pawn",attr:"wind"},defender:{type:"rook",attr:"fire"},expected:"retaliation",
    ja:["不利属性で攻撃","風の歩で、強い火の飛車を攻撃してください。","風は火に不利です。","返り討ち。両駒が盤上から消え、攻撃した歩は相手の持ち駒になりました。"],
    en:["Attack at a disadvantage","Attack the stronger Fire Rook with the Wind Pawn.","Wind is weak against Fire.","Countered. Both pieces left the board, and the attacking Pawn entered the defender's hand."]},
  {attacker:{type:"rook",attr:"water"},defender:{type:"king",attr:"fire"},expected:"capture",
    ja:["王を攻撃","水の飛車で火の王を攻撃してください。","王も属性を持ちます。水は火に勝ちます。","有利属性で王を取りました。攻撃側の勝利です。"],
    en:["Attack the King","Attack the Fire King with the Water Rook.","The King also has an element. Water beats Fire.","The King was captured with an element advantage. The attacker wins."]
  }
];
let practiceStep=0,practiceSelected=false,practiceResolved=false,practiceCompleted=false,practiceAnimating=false;

function resetPracticeTutorial(){practiceSelected=false;practiceResolved=false;practiceCompleted=false;practiceAnimating=false;renderPracticeTutorial()}
function practicePieceHtml(spec,color){
  const p={...spec,color,promoted:false};
  return `<span class="square-attribute-bg attr-${p.attr}" aria-hidden="true">${attributeIcon(p.attr)}</span><span class="piece piece-attr-${p.attr} ${color}"><span class="piece-symbol ${color===CPU&&uiLanguage==="ja"?"flipped":""}">${symbol(p)}</span></span>`;
}
function resolvePracticeAttack(){
  if(!practiceSelected||practiceResolved||practiceAnimating)return;
  const scenario=PRACTICE_SCENARIOS[practiceStep],resultType=combat(scenario.attacker.attr,scenario.defender.attr);
  if(resultType!==scenario.expected)throw Error("Tutorial combat mismatch");
  if(resultType!=="retaliation"){practiceResolved=true;renderPracticeTutorial();return}
  practiceAnimating=true;
  const source=document.querySelector(".practice-square.selectable .piece"),target=document.getElementById("practice-captured");
  if(!source||!target){practiceAnimating=false;practiceResolved=true;renderPracticeTutorial();return}
  const from=source.getBoundingClientRect(),to=target.getBoundingClientRect(),flyer=source.cloneNode(true);
  flyer.classList.add("practice-captured-flyer");
  Object.assign(flyer.style,{left:`${from.left}px`,top:`${from.top}px`,right:"auto",bottom:"auto",width:`${from.width}px`,height:`${from.height}px`});
  document.body.appendChild(flyer);
  requestAnimationFrame(()=>Object.assign(flyer.style,{transform:`translate(${to.left+to.width/2-from.left-from.width/2}px, ${to.top+to.height/2-from.top-from.height/2}px) scale(.72)`,opacity:".9"}));
  setTimeout(()=>{flyer.remove();practiceAnimating=false;practiceResolved=true;renderPracticeTutorial()},420);
}
function renderPracticeTutorial(){
  const board=document.getElementById("practice-board");if(!board||!ATTRIBUTE_DATA)return;
  const scenario=PRACTICE_SCENARIOS[practiceStep],copy=scenario[uiLanguage];
  document.getElementById("practice-progress").textContent=bilingual(`実戦 ${practiceStep+1} / ${PRACTICE_SCENARIOS.length}`,`Practice ${practiceStep+1} / ${PRACTICE_SCENARIOS.length}`);
  document.getElementById("practice-title").textContent=copy[0];
  document.getElementById("practice-instruction").textContent=copy[1];
  const result=document.getElementById("practice-result");
  result.textContent=practiceCompleted?bilingual("4つの実戦を完了しました。対局で属性戦闘を試してください。","You completed all four battles. Try the element system in a real game."):practiceResolved?copy[3]:practiceSelected?bilingual("相手の駒を選んで攻撃してください。","Now select the opposing piece to attack."):copy[2];
  result.className=`practice-result${practiceResolved?` ${scenario.expected==="capture"?"success":scenario.expected==="same"?"warning":"error"}`:""}`;
  const captured=document.getElementById("practice-captured");
  captured.innerHTML=practiceResolved&&scenario.expected==="retaliation"?practicePieceHtml(scenario.attacker,CPU):"";
  board.innerHTML="";
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){
    const square=document.createElement("button");square.type="button";square.className="practice-square";
    const attacker=x===2&&y===3,defender=x===2&&y===2;
    if(!practiceResolved&&attacker){square.innerHTML=practicePieceHtml(scenario.attacker,HUMAN);square.classList.add("selectable");if(practiceSelected)square.classList.add("selected");square.onclick=()=>{practiceSelected=true;renderPracticeTutorial()}}
    if(!practiceResolved&&defender){square.innerHTML=practicePieceHtml(scenario.defender,CPU);if(practiceSelected)square.classList.add("target");square.onclick=resolvePracticeAttack}
    if(practiceResolved&&defender&&scenario.expected==="capture")square.innerHTML=practicePieceHtml(scenario.attacker,HUMAN);
    if(practiceResolved&&defender&&scenario.expected==="same")square.innerHTML=`<span class="practice-clash">${bilingual("衝突","CLASH")}</span>`;
    square.setAttribute("aria-label",attacker?bilingual("攻撃する駒","Attacking piece"):defender?bilingual("攻撃対象","Target"):"");
    board.appendChild(square);
  }
  document.getElementById("practice-prev").disabled=practiceStep===0;
  const next=document.getElementById("practice-next");
  next.disabled=!practiceResolved||practiceCompleted||practiceAnimating;
  next.textContent=practiceCompleted?bilingual("完了済み","Completed"):practiceStep===PRACTICE_SCENARIOS.length-1?bilingual("完了","Complete"):bilingual("次へ","Next");
}

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
  const moves=(state.fullLog?.length?state.fullLog:[...state.log].reverse()).map(item=>`${item.number}. ${item.color===HUMAN?bilingual("先手","You"):bilingual("後手","CPU")} ${item.text}`);
  const content=uiLanguage==="en"?["Elemental Shogi Game Record",`Exported: ${new Date().toLocaleString("en")}`,`Moves: ${state.ply}`,`Result: ${state.winner?state.winner==="draw"?"Draw":`${owner(state.winner)} won`:"In progress"}`,"",...moves].join("\n"):["属性将棋 棋譜",`出力日時: ${new Date().toLocaleString("ja-JP")}`,`手数: ${state.ply}`,`結果: ${state.winner?state.winner==="draw"?"引き分け":`${owner(state.winner)}の勝利`:"対局中"}`,"",...moves].join("\n");
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`attribute-shogi-${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function copyDiagnostics(){
  const details=[bilingual("属性将棋 診断情報","Elemental Shogi Diagnostics"),`Version: ${APP_VERSION}`,`UserAgent: ${navigator.userAgent}`,`${bilingual("手数","Moves")}: ${state.ply}`,`${bilingual("手番","Turn")}: ${state.turn}`,`${bilingual("勝者","Winner")}: ${state.winner||bilingual("なし","none")}`,`${bilingual("衝突数","Clashes")}: ${state.clashes.length}`,bilingual("直近ログ:","Recent log:"),...state.log.map(item=>`${item.number}. ${item.text}`)].join("\n");
  try{await navigator.clipboard.writeText(details);state.message=bilingual("診断情報をクリップボードへコピーしました。","Diagnostics copied to the clipboard.");state.tone="success"}catch(error){state.message=bilingual("診断情報をコピーできませんでした。HTTPSまたはlocalhostで開いてください。","Could not copy diagnostics. Open through HTTPS or localhost.");state.tone="error"}render();
}

async function copyFeedbackTemplate(){
  const template=(uiLanguage==="en"?[
    "Elemental Shogi Free Beta Feedback",
    `Version: ${APP_VERSION}`,
    `Device / Browser: ${navigator.userAgent}`,
    "",
    "1. Shogi experience (none / some / frequent):",
    "2. Element rules were understandable (1–5):",
    "3. Fun (1–5):",
    "4. Ease of use (1–5):",
    "5. Memorable or confusing moments:",
    "6. Bugs and reproduction steps:",
    "7. Features you want:",
    "8. Would you buy a ¥500 full version? (yes / maybe / no):",
    "9. Other comments:"
  ]:[
    "属性将棋 無料ベータ 感想",
    `Version: ${APP_VERSION}`,
    `端末・ブラウザー: ${navigator.userAgent}`,
    "",
    "1. 将棋経験（なし／少し／よく遊ぶ）:",
    "2. 属性ルールは理解できましたか（1～5）:",
    "3. 面白さ（1～5）:",
    "4. 操作の分かりやすさ（1～5）:",
    "5. 面白かった・迷った場面:",
    "6. 発生した不具合と再現手順:",
    "7. 追加してほしい機能:",
    "8. 500円の買い切り正式版を購入したいですか（はい／検討する／いいえ）:",
    "9. その他:"
  ]).join("\n");
  const button=document.getElementById("copy-feedback-template");
  try{
    await navigator.clipboard.writeText(template);
    button.textContent=bilingual("コピーしました","Copied");
  }catch(error){
    button.textContent=bilingual("コピーできませんでした","Copy failed");
  }
  setTimeout(()=>button.textContent=bilingual("感想テンプレートをコピー","Copy Feedback Template"),1800);
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
  button.textContent=soundEnabled?bilingual("🔊 効果音","🔊 Sound"):bilingual("🔇 ミュート","🔇 Muted");
  button.setAttribute("aria-pressed",String(!soundEnabled));
}

function selectBoard(x,y){
  if(replayIndex!==null)return;
  const p=state.board[y][x];
  state.selected={kind:"board",x,y};
  state.moves=boardMoves(p,x,y);
  if(!state.moves.length&&kingThreatened(HUMAN)){
    const origins=[...new Set(allMoves(HUMAN).filter(m=>m.kind==="board").map(m=>coord(m.fromX,m.fromY)))];
    state.message=uiLanguage==="en"?`This ${symbol(p)} cannot answer the check.${origins.length?` Move a piece marked “Check response” (${origins.join(", ")}).`:""}`:`王手中です。この${symbol(p)}では回避できません。${origins.length?`「王手回避可」と表示された駒（${origins.join("、")}）を動かしてください。`:""}`;
    state.tone="warning";
  }else{
    state.message=uiLanguage==="en"?`${symbol(p)} (${attrLabel(p.attr)}) selected.`:`${symbol(p)}（${attrLabel(p.attr)}属性）を選択中。`;
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
  state.message=uiLanguage==="en"?`${symbol(p)} (${attrLabel(p.attr)}) selected from hand.`:`持ち駒 ${symbol(p)}（${attrLabel(p.attr)}属性）を選択中。`;
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
    state.message=bilingual("自分の駒または持ち駒を選んでください。","Select one of your pieces or a piece in hand.");
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
      b.title=uiLanguage==="en"?`${clash.weakCollision?"Short weak-element King clash":`${clash.kingCollision?"King ":""}${attrLabel(clash.attr)} clash`} · ${remaining} turns left`:`${clash.weakCollision?"王への弱属性短期膠着":`${clash.kingCollision?"王の":""}${attrLabel(clash.attr)}属性衝突`}・残り${remaining}ターン`;
      b.innerHTML=`<span class="clash-id">${bilingual("衝","C")}${shown.clashes.indexOf(clash)+1}</span><span class="clash-icon">${attributeIcon(clash.attr)}</span><span class="clash-pieces">${clash.pieces.map(q=>symbol(q)).join("×")}</span><span class="clash-turns">${remaining}</span>`;
    }else if(p){
      const lockText=lockedClashes.length?` / 衝突${lockedClashes.map(c=>shown.clashes.indexOf(c)+1).join("・")}への援軍権使用済み`:"";
      b.title=`${symbol(p)} / ${attrLabel(p.attr)}${uiLanguage==="ja"?"属性":""}${p.type==="king"?` / ${bilingual("耐久","Durability")} ${4-(p.weakHits||0)}/4`:""}${lockText}`;
      const lockBadge=lockedClashes.length?`<span class="support-used-badge">援${lockedClashes.map(c=>shown.clashes.indexOf(c)+1).join("・")}×</span>`:"";
      b.innerHTML=`<span class="square-attribute-bg attr-${p.attr}" aria-hidden="true">${attributeIcon(p.attr)}</span><span class="piece piece-attr-${p.attr} ${p.color}"><span class="piece-symbol ${p.color===CPU&&uiLanguage==="ja"?"flipped":""}">${symbol(p)}</span>${p.type==="king"&&p.weakHits?`<span class="king-damage">${4-p.weakHits}/4</span>`:""}${lockBadge}</span>`;
      if(checkEvasions.has(`${x},${y}`)){
        const badge=document.createElement("span");
        badge.className="check-evasion-badge";
        badge.textContent=bilingual("王手回避可","Check response");
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
      const resultBadge=document.createElement("span"),labels=uiLanguage==="en"?{capture:"WIN",retaliation:"LOSE",same:"SAME",support:"AID"}:{capture:"有利",retaliation:"不利",same:"同",support:"援"};
      resultBadge.className=`move-result-badge result-${m.result}`;
      if(m.result==="support"&&supportSlot){
        const supportAttr=Object.keys(ATTRIBUTE_DATA).find(attr=>ATTRIBUTE_DATA[attr].beats===supportSlot.attr);
        if(supportAttr)resultBadge.classList.add(`support-attr-${supportAttr}`);
      }
      resultBadge.textContent=labels[m.result]||"";
      b.appendChild(resultBadge);
      b.setAttribute("aria-label",`${coord(x,y)} ${labels[m.result]||"移動"}`);
    }else b.setAttribute("aria-label",`${coord(x,y)}${p?` ${symbol(p)} ${attrLabel(p.attr)}${uiLanguage==="ja"?"属性":""}`:bilingual(" 空きマス"," empty")}${supportSlot?bilingual(` 衝突${clashNumber}の強属性援軍位置${selectedLocked?"・選択中の駒は援軍権使用済み":""}`,` strong-element reinforcement square for clash ${clashNumber}${selectedLocked?"; selected piece already used":""}`):""}`);
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
  return `<span class="hand-piece-icon ${c}"><span class="hand-piece-attr attr-${p.attr}">${attributeIcon(p.attr)}</span><span class="hand-piece-symbol ${c===CPU&&uiLanguage==="ja"?"flipped":""}">${symbol(p)}</span></span>`;
}

function renderHand(c,listId,stockId){
  const shown=shownState(),list=document.getElementById(listId),stock=document.getElementById(stockId);
  list.innerHTML="";
  stock.innerHTML="";
  shown.hand[c].forEach((p,i)=>{
    const label=`${symbol(p)} · ${attrLabel(p.attr)}${uiLanguage==="ja"?"属性":""}`,content=handPieceHtml(p,c),li=document.createElement("li");
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
  if(!shown.hand[c].length)stock.textContent=bilingual("持ち駒なし","No pieces");
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
  state={...previous,...position,snapshots,fullLog,log,history:(previous.history||[]).slice(0,target.targetPly+1),selected:null,moves:[],aiThinking:false,autoPlay:false,winner:position.winner||null,message:bilingual("待ったを使用し、直前の自分の着手前へ戻りました。ここから棋譜が分岐します。","Undone to before your previous move. The game record now branches from this position."),tone:"warning"};
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
    const actor=item.color===HUMAN?bilingual("先手","You"):item.color===CPU?bilingual("後手","CPU"):item.number%2?bilingual("先手","You"):bilingual("後手","CPU");
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
    li.textContent=bilingual("まだ着手はありません。","No moves yet.");
    el.appendChild(li);
  }
}

function renderReplayControls(){
  const count=state.snapshots.length,current=replayIndex===null?count-1:replayIndex;
  document.getElementById("replay-prev").disabled=current<=0;
  document.getElementById("replay-next").disabled=replayIndex===null||current>=count-1;
  document.getElementById("replay-current").disabled=replayIndex===null;
  document.getElementById("undo-turn").disabled=!undoTarget();
  document.getElementById("replay-status").textContent=replayIndex===null?bilingual("現在局面","Current position"):bilingual(`棋譜再生: ${current}手目 / ${count-1}手`,`Replay: move ${current} / ${count-1}`);
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
  document.getElementById("turn").textContent=replayIndex!==null?bilingual(`${shown.ply}手目`,`Move ${shown.ply}`):state.winner?bilingual("対局終了","Game over"):bilingual(`手番: ${owner(state.turn)}`,`Turn: ${owner(state.turn)}`);
  const msg=document.getElementById("message");
  msg.textContent=replayIndex!==null?(shown.message||bilingual("過去局面を表示中です。","Viewing a previous position.")):state.message;
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
  const language=document.getElementById("language-select");
  language.value=uiLanguage;
  language.addEventListener("change",()=>{
    uiLanguage=language.value==="en"?"en":"ja";
    localStorage.setItem("attributeShogiLanguage",uiLanguage);
    state.message=bilingual("表示言語を日本語へ変更しました。","Display language changed to English.");
    applyLanguage();
    updateSoundButton();
    render();
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
    resetPracticeTutorial();
    dialog.showModal();
  });
  dialog.addEventListener("close",()=>{
    if(skip.checked)localStorage.setItem("attributeShogiTutorialSeen","yes");
  });
  updateSoundButton();
  document.getElementById("new-game").addEventListener("click",()=>document.getElementById("reset").click());
  document.getElementById("save-game").addEventListener("click",()=>{
    const ok=saveGame();state.message=ok?bilingual("現在の対局をこのブラウザーへ保存しました。","Game saved in this browser."):bilingual("保存できませんでした。ブラウザーの保存設定を確認してください。","Could not save. Check your browser storage settings.");state.tone=ok?"success":"error";render();
  });
  document.getElementById("export-record").addEventListener("click",exportRecord);
  document.getElementById("copy-diagnostics").addEventListener("click",copyDiagnostics);
  document.getElementById("copy-feedback-template").addEventListener("click",copyFeedbackTemplate);
  document.getElementById("practice-reset").addEventListener("click",resetPracticeTutorial);
  document.getElementById("practice-prev").addEventListener("click",()=>{if(practiceStep>0){practiceStep--;resetPracticeTutorial()}});
  document.getElementById("practice-next").addEventListener("click",()=>{
    if(!practiceResolved)return;
    if(practiceStep<PRACTICE_SCENARIOS.length-1){practiceStep++;resetPracticeTutorial()}
    else{practiceCompleted=true;renderPracticeTutorial()}
  });
  document.getElementById("app-version").textContent=APP_VERSION;
  const resignDialog=document.getElementById("resign-dialog");
  document.getElementById("resign").addEventListener("click",()=>{if(!state.winner&&state.turn===HUMAN&&!state.aiThinking)resignDialog.showModal()});
  document.getElementById("resign-yes").addEventListener("click",()=>{
    resignDialog.close();state.winner=CPU;state.selected=null;state.moves=[];state.message=uiLanguage==="en"?`You resigned. ${resultForViewer(CPU)}`:`あなたが投了しました。${resultForViewer(CPU)}`;state.tone="success";addLog(bilingual("先手 投了","You resigned"),HUMAN);render();
  });
  document.getElementById("resign-no").addEventListener("click",()=>resignDialog.close());
}

async function bootstrap(){
  try{
    const r=await fetch("attributes.json",{cache:"no-store"});
    if(!r.ok)throw Error(bilingual("属性設定を読み込めません","Could not load element settings"));
    ATTRIBUTE_DATA=await r.json();
    state=restoreGame()||initialState();
    if(saveNotice){state.message=saveNotice;state.tone="warning"}
    else if(state.ply>0&&!state.winner){state.message=bilingual(`保存した対局を${state.ply}手目から再開しました。`,`Resumed the saved game from move ${state.ply}.`);state.tone="info"}
    bind();
    applyLanguage();
    render();
    if(localStorage.getItem("attributeShogiTutorialSeen")!=="yes")document.getElementById("rules-dialog").showModal();
    if(state.turn===CPU&&!state.winner){state.aiThinking=true;setTimeout(runAi,450)}
  }catch(e){
    const message=document.getElementById("message");
    message.textContent=bilingual(`起動エラー: ${e.message}。HTTPサーバーから開いてください。`,`Startup error: ${e.message}. Open the game through an HTTP server.`);
    message.className="message error";
    const retry=document.createElement("button");
    retry.textContent=bilingual("再読み込み","Reload");
    retry.onclick=()=>location.reload();
    message.append(" ",retry);
  }
}

document.addEventListener("DOMContentLoaded",bootstrap);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(()=>{}));
