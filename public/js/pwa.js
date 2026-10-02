let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e});
export async function installApp(){
  if(!deferredPrompt){alert("If install is available, use your browser menu → Add to Home screen.");return}
  deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;
}
export function registerPWA(){
  if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js?v=19.0.0").catch(()=>{});
}
