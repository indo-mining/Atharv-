import { CONFIG } from "./config.js";
import { chat, research } from "./api.js";
import { getHistory, saveHistory, getUserId, getLive } from "./storage.js";
import { renderAll, setThinking, toast, $ } from "./ui.js";
import { languageInstruction } from "./language.js";

let history=getHistory();

function answerFrom(data){
  return data?.reply ?? data?.message ?? data?.content ?? data?.answer ?? data?.text ?? "";
}
export function initChat(){
  renderAll(history);
  return {send};
}
export async function send(raw){
  const message=String(raw||"").trim();
  if(!message)return;
  if(message.length>CONFIG.MAX_MESSAGE){toast("Message is too long.");return}
  history.push({role:"user",content:message});
  saveHistory(history);renderAll(history);setThinking(true);
  try{
    const payload={userId:getUserId(),message,history:history.slice(-20),languageInstruction:languageInstruction(message)};
    const data=getLive()?await research(payload):await chat(payload);
    const reply=answerFrom(data)||"I couldn't generate a response.";
    history.push({role:"assistant",content:reply});
    saveHistory(history);renderAll(history);
  }catch(e){
    const msg=e.name==="AbortError"?"Request timed out. Please try again.":(e.message||"Something went wrong.");
    history.push({role:"assistant",content:"⚠️ "+msg});
    saveHistory(history);renderAll(history);
  }finally{setThinking(false)}
}
export function clearChat(){history=[];saveHistory(history);renderAll(history)}
export function getCurrentHistory(){return history}
