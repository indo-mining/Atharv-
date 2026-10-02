import { formatText } from "./utils.js";

export const $ = id => document.getElementById(id);

export function toast(message){
  const el=$("toast"); if(!el)return;
  el.textContent=message;el.classList.remove("hidden");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add("hidden"),2400);
}
export function setThinking(v){$("typingIndicator")?.classList.toggle("hidden",!v)}
export function openMenu(){ $("atharvMenu")?.classList.add("open");$("menuOverlay")?.classList.remove("hidden");$("atharvMenu")?.setAttribute("aria-hidden","false")}
export function closeMenu(){ $("atharvMenu")?.classList.remove("open");$("menuOverlay")?.classList.add("hidden");$("atharvMenu")?.setAttribute("aria-hidden","true")}
export function renderMessage(msg,index=0){
  const wrap=document.createElement("div");
  wrap.className=`message ${msg.role==="user"?"user":"assistant"}`;
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=msg.role==="user"?"You":"A";
  const body=document.createElement("div");
  const bubble=document.createElement("div");bubble.className="bubble";bubble.innerHTML=formatText(msg.content||"");
  body.appendChild(bubble);
  if(msg.role==="assistant"){
    const actions=document.createElement("div");actions.className="message-actions";
    const copy=document.createElement("button");copy.textContent="Copy";copy.onclick=()=>navigator.clipboard?.writeText(msg.content||"").then(()=>toast("Copied"));
    actions.appendChild(copy);body.appendChild(actions);
  }
  if(msg.role==="user") {body.appendChild(avatar);wrap.appendChild(body)} else {wrap.appendChild(avatar);wrap.appendChild(body)}
  return wrap;
}
export function renderAll(history){
  const box=$("messages");if(!box)return;
  box.innerHTML="";
  $("welcome")?.classList.toggle("hidden",history.length>0);
  history.forEach((m,i)=>box.appendChild(renderMessage(m,i)));
  requestAnimationFrame(()=>{$("chatArea")?.scrollTo({top:$("chatArea").scrollHeight,behavior:"smooth"})});
}
