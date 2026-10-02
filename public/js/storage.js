import { CONFIG } from "./config.js";

const key = name => CONFIG.STORAGE_PREFIX + name;

export function getUserId(){
  let id = localStorage.getItem(key("user_id"));
  if(!id){
    id = crypto?.randomUUID?.() || ("u_" + Date.now() + "_" + Math.random().toString(36).slice(2));
    localStorage.setItem(key("user_id"), id);
  }
  return id;
}
export function getHistory(){try{return JSON.parse(localStorage.getItem(key("history"))||"[]")}catch{return[]}}
export function saveHistory(v){localStorage.setItem(key("history"),JSON.stringify(v.slice(-100)))}
export function clearHistory(){localStorage.removeItem(key("history"))}
export function getLive(){return localStorage.getItem(key("live"))==="1"}
export function setLive(v){localStorage.setItem(key("live"),v?"1":"0")}
export function getDraft(){return localStorage.getItem(key("draft"))||""}
export function setDraft(v){localStorage.setItem(key("draft"),v)}
export function clearDraft(){localStorage.removeItem(key("draft"))}
