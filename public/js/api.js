import { CONFIG } from "./config.js";

function base(){return CONFIG.API_BASE || location.origin}
async function request(path, options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(), CONFIG.REQUEST_TIMEOUT);
  try{
    const res=await fetch(base()+path,{
      ...options,
      signal:controller.signal,
      headers:{"Content-Type":"application/json",...(options.headers||{})}
    });
    const text=await res.text();
    let data; try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
    if(!res.ok) throw new Error(data.error||data.message||`Request failed (${res.status})`);
    return data;
  }finally{clearTimeout(timer)}
}
export async function chat(payload){return request(CONFIG.CHAT_ENDPOINT,{method:"POST",body:JSON.stringify(payload)})}
export async function research(payload){return request(CONFIG.RESEARCH_ENDPOINT,{method:"POST",body:JSON.stringify(payload)})}
export async function getMemory(userId){return request(`${CONFIG.MEMORY_ENDPOINT}?userId=${encodeURIComponent(userId)}`)}
export async function saveMemory(payload){return request(CONFIG.MEMORY_ENDPOINT,{method:"POST",body:JSON.stringify(payload)})}
export async function version(){return request(CONFIG.VERSION_ENDPOINT)}
