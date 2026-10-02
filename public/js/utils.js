export function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
export function formatText(text=""){
  let s=escapeHtml(text);
  s=s.replace(/```([\s\S]*?)```/g,(_,x)=>`<pre><code>${x.trim()}</code></pre>`);
  s=s.replace(/`([^`]+)`/g,"<code>$1</code>");
  s=s.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  s=s.replace(/\*([^*]+)\*/g,"<em>$1</em>");
  s=s.replace(/\n/g,"<br>");
  return s;
}
export function autoResize(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,140)+"px"}
export function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
