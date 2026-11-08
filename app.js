import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase.js";

const $ = id => document.getElementById(id);
const setupScreen = $("setupScreen"), gameScreen = $("gameScreen");
let app, auth, db, uid = null, roomId = null, roomData = null, stopRoomListener = null;
let localBoard = Array(25).fill("");
let isEditing = false;

const configReady = firebaseConfig.apiKey !== "AIzaSyAhx3wH97DlUW0pLqRvNBChNKIYLN1GFig" &&
                    firebaseConfig.databaseURL.startsWith("https://");

function showSetup(message = "") {
  setupScreen.classList.remove("hidden"); gameScreen.classList.add("hidden");
  $("setupMessage").textContent = message;
}
function showGame() { setupScreen.classList.add("hidden"); gameScreen.classList.remove("hidden"); }
function setConnection(online) {
  $("connection").textContent = online ? "Connected" : "Offline";
  $("connection").className = "connection " + (online ? "online" : "offline");
}
function msg(id, text, good=false) {
  $(id).textContent = text;
  $(id).style.color = good ? "#6ee7b7" : "#fda4af";
}
function makeCode() { return Math.random().toString(36).slice(2,8).toUpperCase(); }
function playerIndex(room) {
  if (!room || !uid) return -1;
  return room.players?.[0]?.uid === uid ? 0 : room.players?.[1]?.uid === uid ? 1 : -1;
}
function myBoard() {
  const i = playerIndex(roomData);
  return i < 0 ? [] : (roomData.players?.[i]?.board || []);
}
function validBoard(board) {
  if (board.length !== 25) return false;
  const nums = board.map(Number);
  return nums.every(n => Number.isInteger(n) && n >= 1 && n <= 25) && new Set(nums).size === 25;
}
function winningLines() {
  const lines = [];
  for (let r=0;r<5;r++) lines.push(Array.from({length:5},(_,c)=>r*5+c));
  for (let c=0;c<5;c++) lines.push(Array.from({length:5},(_,r)=>r*5+c));
  lines.push([0,6,12,18,24], [4,8,12,16,20]);
  return lines;
}
function completedLine(board, called) {
  const marked = new Set(called || []);
  return winningLines().find(line => line.every(index => marked.has(Number(board[index])))) || null;
}
function render() {
  if (!roomData) return;
  showGame();
  const me = playerIndex(roomData), other = me === 0 ? 1 : 0;
  $("roomCodeDisplay").textContent = roomId;
  [0,1].forEach(i => {
    const p = roomData.players?.[i];
    $(`playerName${i}`).textContent = p?.name || (i===0?"Player 1":"Player 2");
    $(`playerStatus${i}`).textContent = !p ? "Waiting to join" : p.ready ? "Ready" : "Filling board";
    $(`playerCard${i}`).classList.toggle("active", roomData.status === "playing" && roomData.turn === i);
  });
  const status = roomData.status;
  const current = roomData.players?.[roomData.turn]?.name || "Player";
  $("turnText").textContent = status === "waiting" ? "Waiting for player 2" :
    status === "setup" ? "Fill your board" :
    status === "finished" ? "Game finished" :
    `${current}'s turn`;
  $("gameStatus").textContent = status === "setup" ? "Both players must submit a valid board to start." :
    status === "playing" ? (roomData.turn === me ? "It's your turn. Choose one unused number." : `Waiting for ${current} to choose a number.`) :
    status === "finished" ? `${roomData.winner?.name || "A player"} won the game.` :
    "Share the room code with your second player.";
  $("boardTitle").textContent = roomData.players?.[me]?.ready ? "Your board" : "Fill your numbers";
  $("boardHint").textContent = roomData.players?.[me]?.ready ? "Board locked" : "Use 1–25 once each";
  const board = roomData.players?.[me]?.board || localBoard;
  const canEdit = status === "setup" && !roomData.players?.[me]?.ready;
  $("editControls").classList.toggle("hidden", !canEdit);
  renderBoard(board, canEdit, roomData.called || []);
  const canPlay = status === "playing" && roomData.turn === me;
  $("callHelp").textContent = status !== "playing" ? "Number selection becomes available when both players are ready." :
    canPlay ? "Your turn: choose one unused number." : `Waiting for ${current} to play.`;
  renderPicker(roomData.called || [], canPlay);
  $("pickedCount").textContent = `${(roomData.called || []).length} / 25 called`;
  const line = completedLine(board, roomData.called || []);
  $("bingoButton").disabled = !line || status !== "playing" || roomData.winner;
  $("calledNumbers").innerHTML = "";
  if (!(roomData.called || []).length) $("calledNumbers").innerHTML = '<span class="muted">No numbers called yet.</span>';
  (roomData.called || []).forEach(n => {
    const chip = document.createElement("span"); chip.className="called-chip"; chip.textContent=n; $("calledNumbers").append(chip);
  });
  if (roomData.winner) showWinner(roomData.winner.name, roomData.winner.lineType);
}
function renderBoard(board, editable, called) {
  const root = $("board"); root.innerHTML = "";
  for (let i=0;i<25;i++) {
    const value = board[i] ?? "";
    const cell = document.createElement("div"); cell.className = "cell";
    if (editable) {
      const input = document.createElement("input");
      input.type="number"; input.min="1"; input.max="25"; input.inputMode="numeric";
      input.value=value; input.placeholder="·"; input.setAttribute("aria-label",`Row ${Math.floor(i/5)+1}, column ${i%5+1}`);
      input.addEventListener("input", () => { localBoard[i]=input.value; validateLocalBoard(); });
      cell.append(input);
    } else {
      cell.textContent = value || "·";
      if ((called || []).includes(Number(value))) cell.classList.add("marked");
    }
    root.append(cell);
  }
}
function renderPicker(called, canPlay) {
  const root = $("numberPicker"); root.innerHTML="";
  for (let n=1;n<=25;n++) {
    const used = called.includes(n);
    const b=document.createElement("button"); b.className="pick-number"+(used?" used":"");
    b.textContent=n; b.disabled=used || !canPlay;
    b.addEventListener("click",()=>chooseNumber(n));
    root.append(b);
  }
}
function validateLocalBoard() {
  const nums=localBoard.map(Number).filter(n=>n);
  const duplicates=nums.length!==new Set(nums).size;
  const invalid=localBoard.some(v=>v!=="" && (!Number.isInteger(Number(v)) || Number(v)<1 || Number(v)>25));
  $("readyButton").disabled = !validBoard(localBoard);
  msg("boardMessage", duplicates ? "Duplicate number detected. Each number must be unique." :
      invalid ? "Use only whole numbers from 1 to 25." :
      validBoard(localBoard) ? "All 25 numbers are valid. You can get ready." :
      `${nums.length} of 25 cells filled.`, validBoard(localBoard));
}
async function saveBoardAndReady() {
  if (!validBoard(localBoard)) return msg("boardMessage","Enter every number from 1 to 25 exactly once.");
  const i=playerIndex(roomData); if(i<0) return;
  const players=roomData.players.slice(); players[i]={...players[i],board:localBoard.map(Number),ready:true};
  const bothReady=players.length===2 && players.every(p=>p?.ready);
  await update(ref(db,`rooms/${roomId}`),{players,status:bothReady?"playing":"setup",turn:0,updatedAt:serverTimestamp()});
}
async function chooseNumber(n) {
  if (!roomData || roomData.status!=="playing") return;
  const me=playerIndex(roomData);
  if (me<0 || roomData.turn!==me) return;
  const roomRef=ref(db,`rooms/${roomId}`);
  const result=await runTransaction(roomRef,current=>{
    if(!current || current.status!=="playing" || current.turn!==me || (current.called||[]).includes(n) || current.winner) return;
    current.called=current.called||[]; current.called.push(n);
    current.turn=1-me; current.updatedAt=Date.now();
    return current;
  });
  if(!result.committed) msg("claimMessage","That move was not accepted. It may no longer be your turn.");
}
async function claimBingo() {
  const me=playerIndex(roomData), board=myBoard(), called=roomData.called||[];
  const line=completedLine(board,called);
  if(!line || roomData.status!=="playing") return;
  const lineType=line[0]===0 && line[4]===24 || line[0]===4 && line[4]===20 ? "diagonal" :
    Math.floor(line[0]/5)===Math.floor(line[4]/5) ? "row" : "column";
  const winner={uid,name:roomData.players[me].name,lineType,at:Date.now()};
  const result=await runTransaction(ref(db,`rooms/${roomId}`),current=>{
    if(!current || current.status!=="playing" || current.winner) return;
    const currentBoard=current.players?.[me]?.board||[];
    if(!completedLine(currentBoard,current.called||[])) return;
    current.winner=winner; current.status="finished"; return current;
  });
  if(!result.committed) msg("claimMessage","BINGO could not be claimed. Check the board and try again.");
}
function showWinner(name,lineType) {
  $("winnerTitle").textContent = `${name} wins!`;
  $("winnerDescription").textContent = `BINGO confirmed — completed a ${lineType}.`;
  $("winnerModal").classList.remove("hidden");
}
async function enterRoom(code) {
  roomId=code.toUpperCase();
  const snap=await get(ref(db,`rooms/${roomId}`));
  if(!snap.exists()) throw new Error("Room not found. Check the code.");
  const room=snap.val();
  if(room.players?.some(p=>p?.uid===uid)) { listenRoom(); return; }
  if(room.players?.filter(Boolean).length>=2) throw new Error("This room already has two players.");
  const slot=room.players?.[0] ? 1 : 0;
  const players=room.players||[null,null];
  players[slot]={uid,name:$("playerName").value.trim(),board:[],ready:false};
  await update(ref(db,`rooms/${roomId}`),{players,status:"setup",updatedAt:serverTimestamp()});
  listenRoom();
}
function listenRoom() {
  if(stopRoomListener) stopRoomListener();
  stopRoomListener=onValue(ref(db,`rooms/${roomId}`),snap=>{
    if(!snap.exists()){showSetup("This room no longer exists.");return;}
    roomData=snap.val(); setConnection(true); render();
  },err=>{setConnection(false);msg("setupMessage",err.message);});
}
async function createRoom() {
  const name=$("playerName").value.trim();
  if(!name) return msg("setupMessage","Enter your name first.");
  if(!auth.currentUser) return msg("setupMessage","Connecting to Firebase. Please try again in a moment.");
  uid=auth.currentUser.uid;
  for(let attempt=0;attempt<5;attempt++){
    const code=makeCode();
    const roomRef=ref(db,`rooms/${code}`);
    const result=await runTransaction(roomRef,current=>current||{
      players:[{uid,name,board:[],ready:false},null],called:[],turn:0,status:"waiting",createdAt:Date.now()
    });
    if(result.committed){roomId=code;listenRoom();return;}
  }
  msg("setupMessage","Could not create a room. Please try again.");
}
async function joinRoom() {
  const name=$("playerName").value.trim(), code=$("roomCodeInput").value.trim();
  if(!name) return msg("setupMessage","Enter your name first.");
  if(!/^[A-Z0-9]{6}$/.test(code.toUpperCase())) return msg("setupMessage","Enter a valid 6-character room code.");
  try { uid=auth.currentUser.uid; await enterRoom(code); }
  catch(e){msg("setupMessage",e.message);}
}
async function leaveRoom() {
  if(stopRoomListener) stopRoomListener();
  // The room is intentionally retained so a temporary disconnect does not destroy a live match.
  roomId=null; roomData=null; localBoard=Array(25).fill(""); $("winnerModal").classList.add("hidden"); showSetup();
}
$("createRoom").addEventListener("click",createRoom);
$("joinRoom").addEventListener("click",joinRoom);
$("readyButton").addEventListener("click",saveBoardAndReady);
$("bingoButton").addEventListener("click",claimBingo);
$("copyRoomCode").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(roomId);$("copyRoomCode").textContent="Copied!";}catch{$("copyRoomCode").textContent=roomId;}});
$("leaveRoom").addEventListener("click",leaveRoom);
$("newGameButton").addEventListener("click",leaveRoom);

if(!configReady){
  setConnection(false);
  showSetup("First connect Firebase: add your web app settings in firebase.js. See README.");
} else {
  app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
  onAuthStateChanged(auth,async user=>{
    if(user){uid=user.uid;setConnection(true);}
    else {try{await signInAnonymously(auth);}catch(e){setConnection(false);showSetup("Firebase sign-in failed: "+e.message);}}
  });
}
