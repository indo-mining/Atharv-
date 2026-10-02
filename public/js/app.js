"use strict";

/*
=========================================================
 ATHARV AI - APP CONTROLLER
 Version 18.4.0

 Handles:
 - Side menu
 - New chat
 - Clear chat
 - Attachments
 - Voice input
 - Memory button
 - History button
 - Live Search mode
 - Mobile UI
 - Does NOT handle chat API/send
=========================================================
*/

(function () {

    console.log("ATHARV AI: app.js loaded");


    /* ==================================================
       HELPERS
    ================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    function closeMenu() {

        const menu =
            $("atharvMenu");

        const overlay =
            $("menuOverlay");

        const button =
            $("menuButton");


        if (menu) {
            menu.classList.remove("open");
        }

        if (overlay) {
            overlay.classList.remove("open");

            overlay.setAttribute(
                "aria-hidden",
                "true"
            );
        }

        if (button) {

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    function openMenu() {

        const menu =
            $("atharvMenu");

        const overlay =
            $("menuOverlay");

        const button =
            $("menuButton");


        if (menu) {
            menu.classList.add("open");
        }

        if (overlay) {

            overlay.classList.add("open");

            overlay.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        if (button) {

            button.setAttribute(
                "aria-expanded",
                "true"
            );
        }
    }


    /* ==================================================
       WELCOME
    ================================================== */

    function welcomeHTML() {

        return `
            <section
                id="welcomeScreen"
                class="welcome"
            >

                <div class="welcome-inner">

                    <div class="welcome-logo">
                        A
                    </div>

                    <h1>
                        How can I help you?
                    </h1>

                    <p>
                        Your AI. Every Language. Every Question.
                    </p>

                </div>

            </section>
        `;
    }


    function resetChatUI() {

        const messages =
            $("chatMessages");

        if (!messages) return;

        messages.innerHTML =
            welcomeHTML();
    }


    /* ==================================================
       MENU
    ================================================== */

    function setupMenu() {

        const menuButton =
            $("menuButton");

        const menuClose =
            $("menuClose");

        const overlay =
            $("menuOverlay");


        if (menuButton) {

            menuButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    openMenu();

                }
            );
        }


        if (menuClose) {

            menuClose.addEventListener(
                "click",
                function () {

                    closeMenu();

                }
            );
        }


        if (overlay) {

            overlay.addEventListener(
                "click",
                function () {

                    closeMenu();

                }
            );
        }


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    closeMenu();

                }

            }
        );
    }


    /* ==================================================
       NEW CHAT
    ================================================== */

    function setupNewChat() {

        const button =
            $("newChatButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                resetChatUI();


                try {

                    localStorage.removeItem(
                        "atharv_chat_history_v18"
                    );

                } catch (_) {}


                try {

                    localStorage.removeItem(
                        "atharv_session_id_v18"
                    );

                } catch (_) {}


                closeMenu();


                const input =
                    $("messageInput");

                if (input) {

                    input.value = "";

                    input.style.height =
                        "auto";

                    input.placeholder =
                        "Message Atharv…";

                    input.focus();
                }

            }
        );
    }


    /* ==================================================
       CLEAR CHAT
    ================================================== */

    function setupClearChat() {

        const button =
            $("clearChatButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const confirmed =
                    window.confirm(
                        "Clear this conversation?"
                    );


                if (!confirmed) {
                    return;
                }


                resetChatUI();


                try {

                    localStorage.removeItem(
                        "atharv_chat_history_v18"
                    );

                } catch (_) {}


                closeMenu();

            }
        );
    }


    /* ==================================================
       ATTACHMENT
    ================================================== */

    function setupAttachments() {

        const button =
            $("attachmentButton");

        const fileInput =
            $("fileInput");

        const input =
            $("messageInput");


        if (
            !button ||
            !fileInput
        ) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                fileInput.click();

            }
        );


        fileInput.addEventListener(
            "change",
            function () {

                if (
                    !fileInput.files ||
                    !fileInput.files.length
                ) {
                    return;
                }


                const names =
                    Array.from(
                        fileInput.files
                    )
                    .map(
                        function (file) {
                            return file.name;
                        }
                    )
                    .join(", ");


                if (input) {

                    const attachmentText =
                        "[Attached: " +
                        names +
                        "]";


                    input.value =
                        input.value.trim()
                            ? input.value +
                              "\n" +
                              attachmentText
                            : attachmentText;


                    input.focus();


                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles: true
                            }
                        )
                    );
                }


                /*
                 * Reset file input so the
                 * same file can be selected again.
                 */

                fileInput.value = "";

            }
        );
    }


    /* ==================================================
       ADD BUTTON
    ================================================== */

    function setupAddButton() {

        const button =
            $("addButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const attachment =
                    $("attachmentButton");

                if (attachment) {
                    attachment.click();
                }

            }
        );
    }


    /* ==================================================
       VOICE
    ================================================== */

    function setupVoice() {

        const button =
            $("voiceButton");

        const input =
            $("messageInput");


        if (!button || !input) {
            return;
        }


        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            console.log(
                "ATHARV AI: SpeechRecognition unavailable"
            );

            return;
        }


        let recognition = null;

        let listening = false;


        button.addEventListener(
            "click",
            function () {

                if (listening) {

                    try {
                        recognition.stop();
                    } catch (_) {}

                    return;
                }


                recognition =
                    new SpeechRecognition();


                recognition.lang =
                    navigator.language ||
                    "en-IN";


                recognition.interimResults =
                    false;


                recognition.continuous =
                    false;


                recognition.maxAlternatives =
                    1;


                recognition.onstart =
                    function () {

                        listening = true;

                        button.textContent =
                            "⏹️";

                    };


                recognition.onresult =
                    function (event) {

                        const result =
                            event.results &&
                            event.results[0] &&
                            event.results[0][0];


                        if (!result) {
                            return;
                        }


                        const text =
                            result.transcript;


                        input.value =
                            input.value.trim()
                                ? input.value +
                                  " " +
                                  text
                                : text;


                        input.dispatchEvent(
                            new Event(
                                "input",
                                {
                                    bubbles: true
                                }
                            )
                        );


                        input.focus();

                    };


                recognition.onerror =
                    function (event) {

                        console.log(
                            "ATHARV AI: voice error",
                            event
                        );

                    };


                recognition.onend =
                    function () {

                        listening = false;

                        button.textContent =
                            "🎙️";

                    };


                try {

                    recognition.start();

                } catch (error) {

                    console.log(
                        "ATHARV AI: voice start error",
                        error
                    );

                    listening = false;

                    button.textContent =
                        "🎙️";
                }

            }
        );
    }


    /* ==================================================
       LIVE SEARCH
    ================================================== */

    function setupLiveSearch() {

        const button =
            $("liveSearchButton");

        const input =
            $("messageInput");


        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                closeMenu();


                if (input) {

                    input.placeholder =
                        "Ask Atharv to search current information…";

                    input.focus();

                }

            }
        );
    }


    /* ==================================================
       MEMORY
    ================================================== */

    function setupMemory() {

        const button =
            $("memoryButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                closeMenu();


                const userId =
                    getUserId();


                alert(
                    "Atharv Memory\n\n" +
                    "User ID: " +
                    userId +
                    "\n\nMemory system is ready."
                );

            }
        );
    }


    /* ==================================================
       HISTORY
    ================================================== */

    function setupHistory() {

        const button =
            $("historyButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                closeMenu();


                let history = [];


                try {

                    const raw =
                        localStorage.getItem(
                            "atharv_chat_history_v18"
                        );


                    if (raw) {

                        const parsed =
                            JSON.parse(raw);


                        if (
                            Array.isArray(parsed)
                        ) {

                            history = parsed;

                        }
                    }

                } catch (_) {}


                alert(
                    "Chat History\n\n" +
                    "Saved messages: " +
                    history.length
                );

            }
        );
    }


    /* ==================================================
       USER ID
    ================================================== */

    function getUserId() {

        try {

            let id =
                localStorage.getItem(
                    "atharv_user_id_v18"
                );


            if (!id) {

                id =
                    "user_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 9);


                localStorage.setItem(
                    "atharv_user_id_v18",
                    id
                );

            }


            return id;

        } catch (_) {

            return "guest";

        }
    }


    /* ==================================================
       INITIALIZE
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: app.js initializing"
        );


        setupMenu();

        setupNewChat();

        setupClearChat();

        setupAttachments();

        setupAddButton();

        setupVoice();

        setupLiveSearch();

        setupMemory();

        setupHistory();


        /*
         * Make sure user ID exists.
         */

        getUserId();


        console.log(
            "ATHARV AI: app.js ready"
        );
    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    } else {

        init();

    }


})();
