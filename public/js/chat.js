"use strict";

/*
=========================================================
 ATHARV AI - CHAT ENGINE
 Version 20.0.0

 FIXES:
 - Render cold-start timeout handling
 - 180 second request timeout
 - AbortController
 - HTTP error handling
 - JSON / text response handling
 - No permanent "thinking" state
 - Safe response extraction
 - Local chat history
 - Live research support
 - No ES-module dependency
=========================================================
*/


const AtharvChat = (() => {

  const API_BASE = window.location.origin;

  const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
  const RESEARCH_ENDPOINT = `${API_BASE}/api/chat/research`;

  const HISTORY_KEY = "atharv_chat_history_v20";

  const LIVE_KEY = "atharv_live_mode_v20";

  const MAX_HISTORY = 100;

  const REQUEST_TIMEOUT = 180000;


  let history = [];

  let sending = false;


  /* =====================================================
     DOM
  ===================================================== */

  const $ = id => document.getElementById(id);


  /* =====================================================
     STORAGE
  ===================================================== */

  function loadHistory(){

    try{

      const raw = localStorage.getItem(HISTORY_KEY);

      if(!raw){
        history = [];
        return;
      }

      const parsed = JSON.parse(raw);

      history =
        Array.isArray(parsed)
          ? parsed.slice(-MAX_HISTORY)
          : [];

    }catch(error){

      console.warn("Atharv history load error:", error);

      history = [];
    }
  }


  function saveHistory(){

    try{

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(-MAX_HISTORY))
      );

    }catch(error){

      console.warn("Atharv history save error:", error);
    }
  }


  /* =====================================================
     LIVE MODE
  ===================================================== */

  function getLive(){

    try{
      return localStorage.getItem(LIVE_KEY) === "true";
    }catch{
      return false;
    }
  }


  function setLive(value){

    try{
      localStorage.setItem(
        LIVE_KEY,
        value ? "true" : "false"
      );
    }catch{}
  }


  /* =====================================================
     TYPING
  ===================================================== */

  function showThinking(){

    const el = $("typingIndicator");

    if(!el) return;

    el.classList.remove("hidden");

    el.setAttribute("aria-hidden","false");
  }


  function hideThinking(){

    const el = $("typingIndicator");

    if(!el) return;

    el.classList.add("hidden");

    el.setAttribute("aria-hidden","true");
  }


  /* =====================================================
     ESCAPE HTML
  ===================================================== */

  function escapeHTML(value){

    return String(value ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }


  /* =====================================================
     SIMPLE MARKDOWN
  ===================================================== */

  function renderMarkdown(text){

    let value = escapeHTML(text);


    /* code blocks */

    value = value.replace(
      /```([\s\S]*?)```/g,
      (_,code) =>
        `<pre><code>${code.trim()}</code></pre>`
    );


    /* inline code */

    value = value.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );


    /* bold */

    value = value.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );


    /* italic */

    value = value.replace(
      /(^|[\s])\*(.*?)\*(?=\s|$)/g,
      "$1<em>$2</em>"
    );


    /* headings */

    value = value.replace(
      /^### (.*)$/gm,
      "<strong>$1</strong>"
    );

    value = value.replace(
      /^## (.*)$/gm,
      "<strong>$1</strong>"
    );

    value = value.replace(
      /^# (.*)$/gm,
      "<strong>$1</strong>"
    );


    /* unordered list */

    value = value.replace(
      /(?:^|\n)((?:[-*] .*(?:\n|$))+)/g,
      (_,block) => {

        const items = block
          .trim()
          .split("\n")
          .map(x => x.replace(/^[-*]\s+/,""))
          .map(x => `<li>${x}</li>`)
          .join("");

        return `<ul>${items}</ul>`;
      }
    );


    /* paragraphs */

    const parts = value.split(/\n{2,}/);

    value = parts
      .map(part => {

        if(
          part.trim().startsWith("<pre>") ||
          part.trim().startsWith("<ul>")
        ){
          return part;
        }

        return `<p>${part.replace(/\n/g,"<br>")}</p>`;
      })
      .join("");


    return value;
  }


  /* =====================================================
     RENDER MESSAGES
  ===================================================== */

  function renderMessages(){

    const container = $("messages");

    if(!container) return;

    container.innerHTML = "";


    history.forEach((message,index) => {

      const row = document.createElement("div");

      row.className =
        `message ${message.role === "user" ? "user" : "assistant"}`;


      if(message.role === "assistant"){

        const avatar = document.createElement("div");

        avatar.className = "avatar";

        avatar.textContent = "A";

        row.appendChild(avatar);
      }


      const body = document.createElement("div");

      const bubble = document.createElement("div");

      bubble.className = "bubble";

      if(message.role === "assistant"){

        bubble.innerHTML =
          renderMarkdown(message.content);

      }else{

        bubble.textContent =
          message.content;
      }


      body.appendChild(bubble);


      if(message.role === "assistant"){

        const actions =
          document.createElement("div");

        actions.className =
          "message-actions";


        const copy =
          document.createElement("button");

        copy.type = "button";

        copy.textContent = "Copy";

        copy.addEventListener("click",() => {

          navigator.clipboard
            ?.writeText(message.content)
            .then(() => showToast("Copied"))
            .catch(() => showToast("Copy failed"));

        });


        actions.appendChild(copy);


        if(index === history.length - 1){

          const regenerate =
            document.createElement("button");

          regenerate.type = "button";

          regenerate.textContent = "Regenerate";

          regenerate.addEventListener(
            "click",
            () => regenerateLast()
          );

          actions.appendChild(regenerate);
        }


        body.appendChild(actions);
      }


      row.appendChild(body);

      container.appendChild(row);

    });


    const welcome = $("welcome");

    if(welcome){

      welcome.classList.toggle(
        "hidden",
        history.length > 0
      );
    }


    requestAnimationFrame(() => {

      const area = $("chatArea");

      if(area){

        area.scrollTop =
          area.scrollHeight;
      }

    });
  }


  /* =====================================================
     TOAST
  ===================================================== */

  function showToast(message){

    const toast = $("toast");

    if(!toast) return;

    toast.textContent = message;

    toast.classList.remove("hidden");

    clearTimeout(showToast.timer);

    showToast.timer =
      setTimeout(() => {
        toast.classList.add("hidden");
      },3500);
  }


  /* =====================================================
     RESPONSE TEXT
  ===================================================== */

  function extractReply(data){

    if(!data) return "";


    if(typeof data === "string"){
      return data;
    }


    const candidates = [

      data.reply,
      data.message,
      data.content,
      data.answer,
      data.response,

      data.data?.reply,
      data.data?.message,
      data.data?.content,
      data.data?.answer,

      data.result?.reply,
      data.result?.message,
      data.result?.content

    ];


    for(const item of candidates){

      if(
        typeof item === "string" &&
        item.trim()
      ){
        return item.trim();
      }
    }


    return "";
  }


  /* =====================================================
     API REQUEST
  ===================================================== */

  async function requestJSON(
    url,
    payload,
    timeout = REQUEST_TIMEOUT
  ){

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () => controller.abort(),
        timeout
      );


    try{

      const response =
        await fetch(url,{
          method:"POST",

          headers:{
            "Content-Type":"application/json",
            "Accept":"application/json"
          },

          body:JSON.stringify(payload),

          signal:controller.signal,

          cache:"no-store",

          credentials:"same-origin"
        });


      const contentType =
        response.headers
          .get("content-type") || "";


      let data;


      if(
        contentType.includes("application/json")
      ){

        try{

          data = await response.json();

        }catch{

          data = null;
        }

      }else{

        const text =
          await response.text();

        data = text;
      }


      if(!response.ok){

        let message =
          extractReply(data);

        if(!message){

          message =
            `Server error (${response.status})`;
        }

        const error =
          new Error(message);

        error.status =
          response.status;

        throw error;
      }


      return data;


    }catch(error){

      if(error.name === "AbortError"){

        throw new Error(
          "Request timed out. Render server may be waking up. Please try again."
        );
      }


      if(
        error instanceof TypeError &&
        /fetch/i.test(error.message || "")
      ){

        throw new Error(
          "Network connection failed. Please check your internet connection and try again."
        );
      }


      throw error;


    }finally{

      clearTimeout(timer);
    }
  }


  /* =====================================================
     CHAT PAYLOAD
  ===================================================== */

  function buildPayload(message){

    return {

      message,

      prompt:message,

      history:
        history
          .slice(-20)
          .map(item => ({
            role:item.role,
            content:item.content
          })),

      messages:
        history
          .slice(-20)
          .map(item => ({
            role:item.role,
            content:item.content
          })),

      liveSearch:getLive(),

      live:getLive(),

      userId:
        getUserId(),

      sessionId:
        getSessionId()

    };
  }


  /* =====================================================
     USER ID
  ===================================================== */

  function getUserId(){

    const key =
      "atharv_user_id_v20";

    try{

      let id =
        localStorage.getItem(key);

      if(id) return id;


      id =
        "atharv_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
          .toString(36)
          .slice(2,10);


      localStorage.setItem(key,id);

      return id;

    }catch{

      return "guest";
    }
  }


  function getSessionId(){

    const key =
      "atharv_session_id_v20";

    try{

      let id =
        localStorage.getItem(key);

      if(id) return id;


      id =
        "session_" +
        Date.now().toString(36);


      localStorage.setItem(key,id);

      return id;

    }catch{

      return "session_guest";
    }
  }


  /* =====================================================
     SEND
  ===================================================== */

  async function send(message){

    if(sending){
      return;
    }


    const clean =
      String(message || "").trim();


    if(!clean){
      return;
    }


    sending = true;

    showThinking();


    history.push({
      role:"user",
      content:clean,
      timestamp:Date.now()
    });


    saveHistory();

    renderMessages();


    try{

      let data;


      if(getLive()){

        try{

          data =
            await requestJSON(
              RESEARCH_ENDPOINT,
              buildPayload(clean)
            );

        }catch(researchError){

          console.warn(
            "Research endpoint failed:",
            researchError
          );


          /*
           * If research endpoint is unavailable,
           * automatically fall back to normal chat.
           */

          data =
            await requestJSON(
              CHAT_ENDPOINT,
              buildPayload(clean)
            );
        }

      }else{

        data =
          await requestJSON(
            CHAT_ENDPOINT,
            buildPayload(clean)
          );
      }


      const reply =
        extractReply(data);


      if(!reply){

        throw new Error(
          "Server returned an empty response."
        );
      }


      history.push({

        role:"assistant",

        content:reply,

        timestamp:Date.now()

      });


      saveHistory();

      renderMessages();


    }catch(error){

      console.error(
        "Atharv chat error:",
        error
      );


      const errorMessage =
        error?.message ||
        "Unable to get a response.";


      history.push({

        role:"assistant",

        content:
          `⚠️ ${errorMessage}`,

        timestamp:Date.now(),

        error:true

      });


      saveHistory();

      renderMessages();


      showToast(errorMessage);


    }finally{

      /*
       * IMPORTANT:
       * Thinking indicator ALWAYS stops.
       * sending lock ALWAYS releases.
       */

      hideThinking();

      sending = false;

      enableComposer();

    }

  }


  /* =====================================================
     COMPOSER STATE
  ===================================================== */

  function enableComposer(){

    const sendButton =
      $("sendButton");

    if(sendButton){

      sendButton.disabled =
        false;
    }


    const input =
      $("messageInput");

    if(input){

      input.disabled =
        false;
    }
  }


  /* =====================================================
     REGENERATE
  ===================================================== */

  async function regenerateLast(){

    if(sending) return;


    let lastUser = null;


    for(
      let i = history.length - 1;
      i >= 0;
      i--
    ){

      if(history[i].role === "user"){

        lastUser =
          history[i].content;

        break;
      }
    }


    if(!lastUser) return;


    while(
      history.length &&
      history[history.length - 1].role === "assistant"
    ){

      history.pop();
    }


    saveHistory();

    renderMessages();


    await send(lastUser);
  }


  /* =====================================================
     CLEAR
  ===================================================== */

  function clearChat(){

    history = [];

    saveHistory();

    renderMessages();

    hideThinking();
  }


  /* =====================================================
     INIT
  ===================================================== */

  function init(){

    loadHistory();

    renderMessages();

    hideThinking();
  }


  /* =====================================================
     PUBLIC API
  ===================================================== */

  return {

    init,

    send,

    clearChat,

    getHistory:() =>
      history.slice(),

    getLive,

    setLive,

    showToast,

    hideThinking

  };

})();


/* Global access */

window.AtharvChat =
  AtharvChat;
