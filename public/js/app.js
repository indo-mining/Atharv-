"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND CONTROLLER
 Version 20.0.0

 No ES-module imports.
 This prevents one broken module from disabling
 the complete interface.
=========================================================
*/


document.addEventListener(
  "DOMContentLoaded",
  () => {

    const $ =
      id => document.getElementById(id);


    const input =
      $("messageInput");

    const form =
      $("composer");

    const sendButton =
      $("sendButton");

    const menuButton =
      $("menuButton");

    const menuClose =
      $("menuClose");

    const menu =
      $("atharvMenu");

    const overlay =
      $("menuOverlay");

    const plusButton =
      $("plusButton");

    const liveToggle =
      $("liveSearchToggle");

    const liveState =
      $("liveState");

    const fileInput =
      $("fileInput");

    const preview =
      $("attachmentPreview");


    const chat =
      window.AtharvChat;


    /* =================================================
       SAFETY CHECK
    ================================================= */

    if(!chat){

      console.error(
        "AtharvChat engine was not loaded."
      );

      return;
    }


    chat.init();


    /* =================================================
       DRAFT
    ================================================= */

    const DRAFT_KEY =
      "atharv_draft_v20";


    function getDraft(){

      try{

        return (
          localStorage.getItem(DRAFT_KEY) ||
          ""
        );

      }catch{

        return "";
      }
    }


    function saveDraft(value){

      try{

        localStorage.setItem(
          DRAFT_KEY,
          value
        );

      }catch{}
    }


    function clearDraft(){

      try{

        localStorage.removeItem(
          DRAFT_KEY
        );

      }catch{}
    }


    if(input){

      input.value =
        getDraft();


      autoResize();


      input.addEventListener(
        "input",
        () => {

          saveDraft(
            input.value
          );

          autoResize();
        }
      );


      input.addEventListener(
        "keydown",
        event => {

          if(
            event.key === "Enter" &&
            !event.shiftKey
          ){

            event.preventDefault();

            submitMessage();
          }

        }
      );
    }


    /* =================================================
       AUTO RESIZE
    ================================================= */

    function autoResize(){

      if(!input) return;


      input.style.height =
        "auto";


      const height =
        Math.min(
          input.scrollHeight,
          140
        );


      input.style.height =
        `${height}px`;
    }


    /* =================================================
       SEND
    ================================================= */

    async function submitMessage(){

      if(!input) return;


      const value =
        input.value.trim();


      if(!value){

        input.focus();

        return;
      }


      /*
       * Prevent double click / duplicate requests.
       */

      if(
        sendButton?.disabled
      ){

        return;
      }


      if(sendButton){

        sendButton.disabled =
          true;
      }


      input.value =
        "";

      clearDraft();

      autoResize();


      try{

        await chat.send(value);

      }catch(error){

        console.error(
          "Submit error:",
          error
        );

      }finally{

        /*
         * Button NEVER stays disabled.
         */

        if(sendButton){

          sendButton.disabled =
            false;
        }


        input.focus();
      }
    }


    /* =================================================
       FORM
    ================================================= */

    if(form){

      form.addEventListener(
        "submit",
        event => {

          event.preventDefault();

          submitMessage();
        }
      );
    }


    /* =================================================
       MENU
    ================================================= */

    function openMenu(){

      if(menu){

        menu.classList.add("open");

        menu.setAttribute(
          "aria-hidden",
          "false"
        );
      }


      if(overlay){

        overlay.classList.remove(
          "hidden"
        );
      }

    }


    function closeMenu(){

      if(menu){

        menu.classList.remove(
          "open"
        );

        menu.setAttribute(
          "aria-hidden",
          "true"
        );
      }


      if(overlay){

        overlay.classList.add(
          "hidden"
        );
      }

    }


    menuButton?.addEventListener(
      "click",
      openMenu
    );


    plusButton?.addEventListener(
      "click",
      openMenu
    );


    menuClose?.addEventListener(
      "click",
      closeMenu
    );


    overlay?.addEventListener(
      "click",
      closeMenu
    );


    /* =================================================
       NEW CHAT
    ================================================= */

    function newChat(){

      chat.clearChat();

      closeMenu();

      if(input){

        input.value =
          "";

        clearDraft();

        autoResize();

        input.focus();
      }

    }


    $("newChatButton")
      ?.addEventListener(
        "click",
        newChat
      );


    $("menuNewChat")
      ?.addEventListener(
        "click",
        newChat
      );


    /* =================================================
       CLEAR CHAT
    ================================================= */

    $("clearButton")
      ?.addEventListener(
        "click",
        () => {

          chat.clearChat();

          closeMenu();

          showToast(
            "Chat cleared"
          );

          input?.focus();
        }
      );


    /* =================================================
       LIVE SEARCH
    ================================================= */

    function updateLive(){

      const enabled =
        chat.getLive();


      if(liveState){

        liveState.textContent =
          enabled
            ? "ON"
            : "OFF";
      }


      if(liveToggle){

        liveToggle.setAttribute(
          "aria-pressed",
          String(enabled)
        );
      }
    }


    updateLive();


    liveToggle?.addEventListener(
      "click",
      () => {

        const newValue =
          !chat.getLive();


        chat.setLive(
          newValue
        );


        updateLive();


        showToast(
          newValue
            ? "Live Search ON"
            : "Live Search OFF"
        );
      }
    );


    /* =================================================
       HISTORY
    ================================================= */

    $("historyButton")
      ?.addEventListener(
        "click",
        () => {

          const history =
            chat.getHistory();


          closeMenu();


          showToast(
            history.length
              ? `${history.length} messages in current chat`
              : "No messages yet"
          );
        }
      );


    /* =================================================
       MEMORY
    ================================================= */

    $("memoryButton")
      ?.addEventListener(
        "click",
        async () => {

          closeMenu();


          try{

            const userId =
              getUserId();


            const response =
              await fetch(
                `/api/memory?userId=${encodeURIComponent(userId)}`,
                {
                  method:"GET",

                  headers:{
                    "Accept":
                      "application/json"
                  },

                  cache:"no-store"
                }
              );


            if(!response.ok){

              throw new Error(
                "Memory service unavailable"
              );
            }


            const data =
              await response.json();


            const memories =
              Array.isArray(data)
                ? data
                : (
                  Array.isArray(data.memories)
                    ? data.memories
                    : []
                );


            if(!memories.length){

              showToast(
                "No saved memories"
              );

              return;
            }


            alert(
              memories
                .map(
                  item =>
                    typeof item === "string"
                      ? item
                      : (
                        item.memory ||
                        item.content ||
                        item.text ||
                        JSON.stringify(item)
                      )
                )
                .join("\n\n")
            );


          }catch(error){

            console.error(
              "Memory error:",
              error
            );


            showToast(
              "Memory could not be loaded"
            );
          }

        }
      );


    /* =================================================
       FILE ATTACHMENT
    ================================================= */

    fileInput?.addEventListener(
      "change",
      () => {

        if(!preview) return;


        preview.innerHTML =
          "";


        const files =
          [...(fileInput.files || [])];


        if(!files.length){

          preview.classList.add(
            "hidden"
          );

          return;
        }


        preview.classList.remove(
          "hidden"
        );


        files.forEach(
          file => {

            const item =
              document.createElement(
                "div"
              );


            item.className =
              "attachment";


            item.textContent =
              file.name;


            preview.appendChild(
              item
            );
          }
        );


        showToast(
          `${files.length} attachment selected`
        );

      }
    );


    /* =================================================
       VOICE
    ================================================= */

    $("voiceButton")
      ?.addEventListener(
        "click",
        () => {

          const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


          if(!SpeechRecognition){

            showToast(
              "Voice input is not supported in this browser."
            );

            return;
          }


          const recognition =
            new SpeechRecognition();


          recognition.lang =
            navigator.language ||
            "en-IN";


          recognition.interimResults =
            false;


          recognition.maxAlternatives =
            1;


          recognition.onstart =
            () => {

              showToast(
                "Listening…"
              );
            };


          recognition.onresult =
            event => {

              const transcript =
                event
                  .results[0][0]
                  .transcript;


              if(!input) return;


              input.value =
                (
                  input.value +
                  " " +
                  transcript
                ).trim();


              saveDraft(
                input.value
              );


              autoResize();

              input.focus();
            };


          recognition.onerror =
            event => {

              console.warn(
                "Voice error:",
                event
              );

              showToast(
                "Voice input stopped."
              );
            };


          recognition.onend =
            () => {};


          try{

            recognition.start();

          }catch(error){

            console.warn(
              "Voice start error:",
              error
            );
          }

        }
      );


    /* =================================================
       QUICK PROMPTS
    ================================================= */

    document
      .querySelectorAll(
        ".quick-card"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              if(!input) return;


              input.value =
                button.dataset.prompt ||
                "";


              saveDraft(
                input.value
              );


              autoResize();

              input.focus();
            }
          );

        }
      );


    /* =================================================
       INSTALL
    ================================================= */

    let deferredInstallPrompt =
      null;


    window.addEventListener(
      "beforeinstallprompt",
      event => {

        event.preventDefault();

        deferredInstallPrompt =
          event;
      }
    );


    $("installButton")
      ?.addEventListener(
        "click",
        async () => {

          closeMenu();


          if(!deferredInstallPrompt){

            showToast(
              "Install option is not available right now."
            );

            return;
          }


          deferredInstallPrompt.prompt();


          try{

            await deferredInstallPrompt.userChoice;

          }catch{}


          deferredInstallPrompt =
            null;
        }
      );


    /* =================================================
       PWA SERVICE WORKER
    ================================================= */

    if(
      "serviceWorker" in navigator
    ){

      window.addEventListener(
        "load",
        () => {

          navigator.serviceWorker
            .register(
              "/sw.js?v=20.0.0"
            )
            .catch(
              error =>
                console.warn(
                  "Service worker:",
                  error
                )
            );

        }
      );
    }


    /* =================================================
       TOAST
    ================================================= */

    function showToast(message){

      if(
        typeof chat.showToast ===
        "function"
      ){

        chat.showToast(
          message
        );
      }
    }


    /* =================================================
       USER ID
    ================================================= */

    function getUserId(){

      const key =
        "atharv_user_id_v20";


      try{

        let id =
          localStorage.getItem(
            key
          );


        if(id) return id;


        id =
          "atharv_" +
          Date.now().toString(36) +
          "_" +
          Math.random()
            .toString(36)
            .slice(2,10);


        localStorage.setItem(
          key,
          id
        );


        return id;

      }catch{

        return "guest";
      }
    }


  }
);
