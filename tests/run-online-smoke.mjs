import { chromium } from "playwright-core";

const baseUrl = process.argv[2] || "http://127.0.0.1:8000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

async function preparePage(context) {
  await context.addInitScript(() => {
    localStorage.setItem("attributeShogiTutorialSeen", "yes");
    localStorage.setItem("attributeShogiLanguage", "ja");
    localStorage.setItem("attributeShogiGameMode", "cpu");
    localStorage.removeItem("attributeShogiSavedGame");
    localStorage.removeItem("attributeShogiOnlineSession");
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#board .square");
  await page.click("#open-menu");
  await page.selectOption("#game-mode", "online");
  return page;
}

try {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await preparePage(hostContext);
  const guest = await preparePage(guestContext);

  await host.click("#create-online-room");
  await host.waitForFunction(() => /^[A-Z2-9]{6}$/.test(document.querySelector("#room-code")?.value || "") || document.querySelector("#online-status")?.classList.contains("error"));
  const hostError = await host.locator("#online-status.error").textContent().catch(() => null);
  if (hostError) throw new Error(hostError);
  const code = await host.inputValue("#room-code");
  await guest.fill("#room-code", code);
  await guest.click("#join-online-room");
  await guest.waitForFunction(() => document.querySelector("#online-status")?.textContent.includes("接続中"));
  await host.waitForFunction(() => document.querySelector("#online-status")?.textContent.includes("接続中"));
  await host.click("#close-menu");
  await guest.click("#close-menu");
  const guestPerspective=await guest.evaluate(()=>({
    first:[document.querySelector("#board .square")?.dataset.x,document.querySelector("#board .square")?.dataset.y],
    ownFlipped:document.querySelector("#board .piece.black .piece-symbol")?.classList.contains("flipped"),
    opponentFlipped:document.querySelector("#board .piece.white .piece-symbol")?.classList.contains("flipped"),
    xAxis:[...document.querySelectorAll(".board-axis-x span")].map(span=>span.textContent).join(""),
    ownHandOrder:getComputedStyle(document.querySelector(".hand-black")).order,
  }));
  if(guestPerspective.first.join(",")!=="8,8"||guestPerspective.ownFlipped||!guestPerspective.opponentFlipped||guestPerspective.xAxis!=="987654321"||guestPerspective.ownHandOrder!=="2")throw new Error(`Gote perspective failed: ${JSON.stringify(guestPerspective)}`);

  await host.click('.square[data-x="4"][data-y="6"]');
  await host.click('.square[data-x="4"][data-y="5"]');
  const hostAfterMove=await host.evaluate(()=>({ply:state.ply,turn:state.turn,selected:state.selected,moves:state.moves.length,connected:onlineSession?.connected,viewerColor,message:state.message,status:document.querySelector("#online-status")?.textContent}));
  if(hostAfterMove.ply!==1)throw new Error(`Host move was not executed: ${JSON.stringify(hostAfterMove)}`);
  if(!(await host.locator("#message").textContent()).includes("あなた(先手)"))throw new Error("Host did not see its own Sente label");
  await host.waitForFunction(() => document.querySelector("#online-status")?.textContent.includes("同期") || document.querySelector("#online-status")?.classList.contains("error"));
  const hostSyncStatus=await host.locator("#online-status").textContent();
  if(await host.locator("#online-status").evaluate(element=>element.classList.contains("error")))throw new Error(hostSyncStatus);
  const guestRemote=await guest.evaluate(async()=>{const room=await AttributeShogiOnline.getRoom(onlineSession.roomId);return{remoteRevision:room.revision,remotePly:room.state?.ply,localRevision:onlineSession.revision,localPly:state.ply,status:document.querySelector("#online-status")?.textContent}});
  if(guestRemote.remotePly!==1)throw new Error(`Server did not store host move: ${JSON.stringify(guestRemote)}`);
  await Promise.race([
    guest.waitForFunction(() => state?.ply === 1 && state?.board?.[5]?.[4]?.type === "pawn"),
    host.waitForFunction(() => document.querySelector("#online-status")?.classList.contains("error")),
  ]);
  const moveError = await host.locator("#online-status.error").textContent().catch(() => null);
  if (moveError) throw new Error(moveError);
  if(!(await guest.locator("#message").textContent()).includes("相手(先手)"))throw new Error("Guest did not see the opponent Sente label");

  await guest.click('.square[data-x="4"][data-y="2"]');
  await guest.click('.square[data-x="4"][data-y="3"]');
  if(!(await guest.locator("#message").textContent()).includes("あなた(後手)"))throw new Error("Guest did not see its own Gote label");
  await host.waitForFunction(() => state?.ply === 2 && state?.board?.[3]?.[4]?.type === "pawn");
  if(!(await host.locator("#message").textContent()).includes("相手(後手)"))throw new Error("Host did not see the opponent Gote label");

  const result = await host.evaluate(() => ({ ply: state.ply, turn: state.turn, revision: onlineSession?.revision, status: document.querySelector("#online-status")?.textContent }));
  if (result.ply !== 2 || result.turn !== "white" || result.revision < 2) throw new Error(`Unexpected synced state: ${JSON.stringify(result)}`);
  console.log(`PASS online invite-room smoke test: ${code} / revision ${result.revision}`);
} finally {
  await browser.close();
}
