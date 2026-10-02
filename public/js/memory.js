import { getUserId } from "./storage.js";
import { getMemory, saveMemory } from "./api.js";
import { toast } from "./ui.js";

export async function showMemory(){
  try{
    const data=await getMemory(getUserId());
    const list=data.memories||data.data||data||[];
    if(Array.isArray(list)&&list.length) alert("Saved memory:\n\n"+list.map(x=>typeof x==="string"?x:(x.content||x.memory||JSON.stringify(x))).join("\n"));
    else alert("No saved memories yet.");
  }catch(e){toast("Memory could not be loaded")}
}
export async function remember(content){
  if(!content)return;
  try{await saveMemory({userId:getUserId(),content})}catch{}
}
