import { CONFIG } from "./config.js";
import { getDraft,setDraft,clearDraft,getLive,setLive } from "./storage.js";
import { $, toast, openMenu, closeMenu, renderAll } from "./ui.js";
import { initChat, send, clearChat, getCurrentHistory } from "./chat.js";
import { installApp, registerPWA } from "./pwa.js";
import { showMemory } from "./memory.js";
import { autoResize } from "./utils.js";

document.addEventListener("DOMContentLoaded",()=>{
  const input=$("messageInput"), form=$("composer"), sendBtn=$("sendButton");
  const menuButton=$("menuButton"), menuClose=$("menuClose"), overlay=$("menuOverlay");
  const liveToggle=$("liveSearchToggle"), liveState=$("liveState");
  const fileInput=$("fileInput"), preview=$("attachmentPreview");

  initChat();
  registerPWA();

  if(input){input.value=getDraft();autoResize(input);input.addEventListener("input",()=>{setDraft(input.value);autoResize(input)});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form?.requestSubmit()}})}
  const updateLive=()=>{const on=getLive();if(liveState)liveState.textContent=on?"ON":"OFF";liveToggle?.setAttribute("aria-pressed",String(on))};
  updateLive();

  form?.addEventListener("submit",async e=>{
    e.preventDefault(); const value=input?.value.trim();if(!value)return;
    if(sendBtn)sendBtn.disabled=true; if(input){input.value="";clearDraft();autoResize(input)}
    await send(value); if(sendBtn)sendBtn.disabled=false;input?.focus();
  });

  $("voiceButton")?.addEventListener("click",()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){toast("Voice input is not supported in this browser.");return}
    const rec=new SR();rec.lang=navigator.language||"en-IN";rec.interimResults=false;
    rec.onresult=e=>{input.value=(input.value+" "+e.results[0][0].transcript).trim();setDraft(input.value);autoResize(input)};
    rec.onerror=()=>toast("Voice input stopped.");rec.start();toast("Listening…");
  });

  $("plusButton")?.addEventListener("click",openMenu);
  menuButton?.addEventListener("click",openMenu);menuClose?.addEventListener("click",closeMenu);overlay?.addEventListener("click",closeMenu);
  $("menuNewChat")?.addEventListener("click",()=>{clearChat();closeMenu();input?.focus()});
  $("newChatButton")?.addEventListener("click",()=>{clearChat();input?.focus()});
  $("clearButton")?.addEventListener("click",()=>{clearChat();closeMenu();toast("Chat cleared")});
  liveToggle?.addEventListener("click",()=>{setLive(!getLive());updateLive();toast(getLive()?"Live Search ON":"Live Search OFF")});
  $("memoryButton")?.addEventListener("click",()=>{showMemory();closeMenu()});
  $("historyButton")?.addEventListener("click",()=>{const h=getCurrentHistory();alert(h.length?`Current chat has ${h.length} messages.`:"No messages in this chat.");closeMenu()});
  $("installButton")?.addEventListener("click",installApp);

  $("fileInput")?.addEventListener("change",()=>{
    preview.innerHTML="";
    const files=[...fileInput.files];
    if(!files.length){preview.classList.add("hidden");return}
    preview.classList.remove("hidden");
    files.forEach(f=>{const x=document.createElement("div");x.className="attachment";x.textContent=f.name;preview.appendChild(x)});
    toast("Attachment selected. File content is not sent automatically.");
  });

  document.querySelectorAll(".quick-card").forEach(btn=>btn.addEventListener("click",()=>{
    input.value=btn.dataset.prompt||"";setDraft(input.value);autoResize(input);input.focus();
  }));
});
