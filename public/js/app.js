"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND CONTROLLER
 Version 19.1.0
 --------------------------------------------------------
 FIX:
 - Direct /api/chat POST
 - Single send handler
 - Form submit supported
 - Enter to send
 - No duplicate send events
 - Request timeout
 - Better network error
 - Visible API errors
 - Same-origin API
 - History
 - Session
 - User ID
 - Menu
 - New chat
 - Clear chat
 - Attachments
 - Voice
 - Live Search
 - Mobile UI
=========================================================
*/

(function () {

    console.log("ATHARV AI: app.js 19.1.0 loading");


    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE =
        window.location.origin;

    const CHAT_ENDPOINT =
        API_BASE + "/api/chat";

    const RESEARCH_ENDPOINT =
        API_BASE + "/api/chat/research";

    const STORAGE = {
        userId: "atharv_user_id_v19",
        sessionId: "atharv_session_id_v19",
        history: "atharv_chat_history_v19",
        liveMode: "atharv_live_mode_v19"
    };

    const MAX_MESSAGE_LENGTH = 12000;

    const REQUEST_TIMEOUT = 120000;

    let sending = false;


    /* ==================================================
       DOM
    ================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    /* ==================================================
       HELPERS
    ================================================== */

    function safeText(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value);
    }


    function escapeHTML(value) {

        return safeText(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function formatAnswer(text) {

        let output =
            escapeHTML(text);

        output =
            output.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );

        output =
            output.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );

        output =
            output.replace(
                /\n/g,
                "<br>"
            );

        return output;
    }


    function scrollToBottom() {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        requestAnimationFrame(function () {

            container.scrollTop =
                container.scrollHeight;

        });
    }


    /* ==================================================
       USER ID
    ================================================== */

    function getUserId() {

        try {

            let id =
                localStorage.getItem(
                    STORAGE.userId
                );

            if (!id) {

                id =
                    "user_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 10);

                localStorage.setItem(
                    STORAGE.userId,
                    id
                );
            }

            return id;

        } catch (error) {

            console.warn(
                "ATHARV AI: user ID storage unavailable"
            );

            return "guest";
        }
    }


    /* ==================================================
       SESSION
    ================================================== */

    function getSessionId() {

        try {

            let id =
                localStorage.getItem(
                    STORAGE.sessionId
                );

            if (!id) {

                id =
                    "session_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 10);

                localStorage.setItem(
                    STORAGE.sessionId,
                    id
                );
            }

            return id;

        } catch (error) {

            return (
                "session_" +
                Date.now().toString(36)
            );
        }
    }


    function createNewSession() {

        const id =
            "session_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10);

        try {

            localStorage.setItem(
                STORAGE.sessionId,
                id
            );

        } catch (_) {}

        return id;
    }


    /* ==================================================
       HISTORY
    ================================================== */

    function getHistory() {

        try {

            const raw =
                localStorage.getItem(
                    STORAGE.history
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.slice(-100);

        } catch (error) {

            console.warn(
                "ATHARV AI: history read error",
                error
            );

            return [];
        }
    }


    function saveHistory(history) {

        try {

            localStorage.setItem(
                STORAGE.history,
                JSON.stringify(
                    history.slice(-100)
                )
            );

        } catch (error) {

            console.warn(
                "ATHARV AI: history save error",
                error
            );
        }
    }


    function addHistory(role, content) {

        const history =
            getHistory();

        history.push({
            role: role,
            content: safeText(content),
            timestamp:
                new Date().toISOString()
        });

        saveHistory(history);
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


    function removeWelcome() {

        const welcome =
            $("welcomeScreen");

        if (welcome) {
            welcome.remove();
        }
    }


    /* ==================================================
       MESSAGE UI
    ================================================== */

    function addUserMessage(text) {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        removeWelcome();

        const message =
            document.createElement("div");

        message.className =
            "message user-message";

        message.innerHTML = `
            <div class="message-bubble">
                ${formatAnswer(text)}
            </div>
        `;

        container.appendChild(message);

        scrollToBottom();
    }


    function addAssistantMessage(
        text,
        sources
    ) {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        removeWelcome();

        const message =
            document.createElement("div");

        message.className =
            "message assistant-message";

        let sourceHTML = "";

        if (
            Array.isArray(sources) &&
            sources.length
        ) {

            sourceHTML = `
                <div class="atharv-sources">
                    <strong>Sources</strong>
                    <ul>
                        ${
                            sources
                                .slice(0, 5)
                                .map(function (source) {

                                    const title =
                                        escapeHTML(
                                            source?.title ||
                                            source?.url ||
                                            "Source"
                                        );

                                    const url =
                                        escapeHTML(
                                            source?.url || ""
                                        );

                                    if (!url) {

                                        return `
                                            <li>
                                                ${title}
                                            </li>
                                        `;
                                    }

                                    return `
                                        <li>
                                            <a
                                                href="${url}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                ${title}
                                            </a>
                                        </li>
                                    `;

                                })
                                .join("")
                        }
                    </ul>
                </div>
            `;
        }

        message.innerHTML = `
            <div class="message-bubble">
                ${formatAnswer(text)}
                ${sourceHTML}
            </div>
        `;

        container.appendChild(message);

        scrollToBottom();
    }


    function addErrorMessage(text) {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        removeWelcome();

        const message =
            document.createElement("div");

        message.className =
            "message assistant-message error-message";

        message.innerHTML = `
            <div class="message-bubble">
                <strong>Atharv:</strong><br>
                ${formatAnswer(text)}
            </div>
        `;

        container.appendChild(message);

        scrollToBottom();
    }


    /* ==================================================
       LOADING
    ================================================== */

    function showLoading() {

        const container =
            $("chatMessages");

        if (!container) {
            return;
        }

        removeWelcome();

        removeLoading();

        const loading =
            document.createElement("div");

        loading.id =
            "atharvLoadingMessage";

        loading.className =
            "message assistant-message";

        loading.innerHTML = `
            <div class="message-bubble">
                <span>●</span>
                <span>●</span>
                <span>●</span>
            </div>
        `;

        container.appendChild(loading);

        scrollToBottom();
    }


    function removeLoading() {

        const loading =
            $("atharvLoadingMessage");

        if (loading) {
            loading.remove();
        }
    }


    /* ==================================================
       SEND STATE
    ================================================== */

    function setSendingState(active) {

        const button =
            $("sendButton");

        const input =
            $("messageInput");

        sending =
            Boolean(active);

        if (button) {

            button.disabled =
                Boolean(active);

            button.setAttribute(
                "aria-busy",
                active
                    ? "true"
                    : "false"
            );

            button.style.opacity =
                active
                    ? "0.55"
                    : "1";
        }

        /*
         * IMPORTANT:
         * Do NOT disable textarea while request is running.
         * Mobile browsers can behave badly when the focused
         * textarea suddenly becomes disabled.
         */

        if (input) {

            input.setAttribute(
                "aria-busy",
                active
                    ? "true"
                    : "false"
            );
        }
    }


    /* ==================================================
       RESPONSE
    ================================================== */

    async function parseResponse(response) {

        const raw =
            await response.text();

        let data = null;

        try {

            data =
                raw
                    ? JSON.parse(raw)
                    : null;

        } catch (_) {

            data = null;
        }


        console.log(
            "ATHARV AI: HTTP STATUS",
            response.status
        );


        if (!response.ok) {

            let message =
                "Request failed with HTTP " +
                response.status;

            if (data) {

                message =
                    data.error ||
                    data.message ||
                    message;

            } else if (raw) {

                message =
                    raw.slice(0, 700);
            }

            throw new Error(message);
        }


        if (!data) {

            throw new Error(
                "Atharv returned an empty response."
            );
        }

        return data;
    }


    function extractAnswer(data) {

        if (!data) {
            return "";
        }

        const candidates = [

            data.answer,

            data.reply,

            data.response,

            data.content,

            data.text,

            data.message,

            data?.choices?.[0]
                ?.message
                ?.content,

            data?.choices?.[0]
                ?.text
        ];

        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {

            if (
                typeof candidates[i] === "string" &&
                candidates[i].trim()
            ) {

                return candidates[i].trim();
            }
        }

        return "";
    }


    /* ==================================================
       FETCH WITH TIMEOUT
    ================================================== */

    async function fetchWithTimeout(
        url,
        options
    ) {

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                function () {

                    controller.abort();

                },
                REQUEST_TIMEOUT
            );


        try {

            console.log(
                "ATHARV AI: POST",
                url
            );


            const response =
                await fetch(
                    url,
                    {
                        ...options,
                        signal:
                            controller.signal
                    }
                );


            console.log(
                "ATHARV AI: RESPONSE",
                response.status,
                url
            );


            return response;

        } catch (error) {

            if (
                error &&
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Atharv server response timeout. Render service may be waking up. Please try again."
                );
            }


            if (
                !navigator.onLine
            ) {

                throw new Error(
                    "Internet connection is unavailable."
                );
            }


            throw new Error(
                "Atharv server se connection nahi ho paaya: " +
                safeText(
                    error?.message ||
                    "Network error"
                )
            );

        } finally {

            clearTimeout(timeout);
        }
    }


    /* ==================================================
       NORMAL CHAT
    ================================================== */

    async function sendNormalChat(message) {

        const history =
            getHistory();


        const payload = {

            message: message,

            userId:
                getUserId(),

            sessionId:
                getSessionId(),

            history:
                history
                    .slice(-20)
                    .map(function (item) {

                        return {

                            role:
                                item.role,

                            content:
                                item.content
                        };

                    })
        };


        console.log(
            "ATHARV AI: sending chat payload"
        );


        const response =
            await fetchWithTimeout(
                CHAT_ENDPOINT,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );


        return parseResponse(
            response
        );
    }


    /* ==================================================
       LIVE RESEARCH
    ================================================== */

    async function sendResearch(message) {

        const response =
            await fetchWithTimeout(
                RESEARCH_ENDPOINT,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            query:
                                message,

                            message:
                                message,

                            userId:
                                getUserId(),

                            sessionId:
                                getSessionId()
                        })
                }
            );


        return parseResponse(
            response
        );
    }


    /* ==================================================
       MAIN SEND
    ================================================== */

    async function sendMessage() {

        console.log(
            "ATHARV AI: sendMessage() called"
        );


        if (sending) {

            console.log(
                "ATHARV AI: already sending"
            );

            return;
        }


        const input =
            $("messageInput");


        if (!input) {

            addErrorMessage(
                "Message input nahi mila."
            );

            console.error(
                "ATHARV AI: #messageInput missing"
            );

            return;
        }


        const message =
            input.value.trim();


        if (!message) {

            input.focus();

            return;
        }


        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            addErrorMessage(
                "Message bahut lamba hai. Maximum " +
                MAX_MESSAGE_LENGTH +
                " characters allowed hain."
            );

            return;
        }


        /*
         * IMPORTANT:
         * Save text before clearing input.
         */

        input.value = "";

        input.style.height =
            "auto";


        addUserMessage(
            message
        );


        addHistory(
            "user",
            message
        );


        setSendingState(
            true
        );


        showLoading();


        try {

            let data = null;

            const liveMode =
                getLiveMode();


            if (liveMode) {

                console.log(
                    "ATHARV AI: LIVE SEARCH"
                );

                data =
                    await sendResearch(
                        message
                    );

            } else {

                console.log(
                    "ATHARV AI: NORMAL CHAT"
                );

                data =
                    await sendNormalChat(
                        message
                    );
            }


            console.log(
                "ATHARV AI: backend data received",
                data
            );


            const answer =
                extractAnswer(data);


            if (!answer) {

                throw new Error(
                    "Server se response mila, lekin Atharv ka answer empty hai."
                );
            }


            removeLoading();


            addAssistantMessage(
                answer,
                data.sources ||
                data.results ||
                []
            );


            addHistory(
                "assistant",
                answer
            );


        } catch (error) {

            console.error(
                "ATHARV AI SEND ERROR:",
                error
            );


            removeLoading();


            addErrorMessage(
                error?.message ||
                "Atharv se connection nahi ho paaya."
            );


        } finally {

            setSendingState(
                false
            );


            /*
             * Keep mobile composer usable.
             */

            if (input) {

                input.removeAttribute(
                    "disabled"
                );

                input.focus();
            }
        }
    }


    /* ==================================================
       SEND EVENTS
    ================================================== */

    function setupSend() {

        const button =
            $("sendButton");

        const input =
            $("messageInput");

        const composer =
            $("composer");


        if (!button) {

            console.error(
                "ATHARV AI: #sendButton missing"
            );

            return;
        }


        if (!input) {

            console.error(
                "ATHARV AI: #messageInput missing"
            );

            return;
        }


        /*
         * Prevent duplicate initialization.
         */

        if (
            button.dataset.atharvReady ===
            "true"
        ) {

            console.log(
                "ATHARV AI: send already initialized"
            );

            return;
        }


        button.dataset.atharvReady =
            "true";


        /*
         * BUTTON CLICK
         */

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                console.log(
                    "ATHARV AI: SEND BUTTON CLICK"
                );

                void sendMessage();

            },
            false
        );


        /*
         * ENTER
         */

        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.isComposing
                ) {

                    event.preventDefault();

                    event.stopPropagation();

                    console.log(
                        "ATHARV AI: ENTER SEND"
                    );

                    void sendMessage();
                }

            },
            false
        );


        /*
         * FORM SUBMIT
         *
         * Kept as backup for mobile/browser
         * submit behavior.
         */

        if (composer) {

            composer.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    console.log(
                        "ATHARV AI: FORM SUBMIT"
                    );

                    void sendMessage();

                },
                false
            );
        }


        console.log(
            "ATHARV AI: SEND SYSTEM READY"
        );
    }


    /* ==================================================
       TEXTAREA
    ================================================== */

    function setupInputResize() {

        const input =
            $("messageInput");

        if (!input) {
            return;
        }


        input.addEventListener(
            "input",
            function () {

                input.style.height =
                    "auto";

                input.style.height =
                    Math.min(
                        input.scrollHeight,
                        150
                    ) + "px";

            }
        );
    }


    /* ==================================================
       MENU
    ================================================== */

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

                    const menu =
                        $("atharvMenu");

                    if (
                        menu &&
                        menu.classList.contains(
                            "open"
                        )
                    ) {

                        closeMenu();

                    } else {

                        openMenu();
                    }
                }
            );
        }


        if (menuClose) {

            menuClose.addEventListener(
                "click",
                closeMenu
            );
        }


        if (overlay) {

            overlay.addEventListener(
                "click",
                closeMenu
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

    function resetChatUI() {

        const messages =
            $("chatMessages");

        if (!messages) {
            return;
        }

        messages.innerHTML =
            welcomeHTML();
    }


    function setupNewChat() {

        const button =
            $("newChatButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                try {

                    localStorage.removeItem(
                        STORAGE.history
                    );

                } catch (_) {}


                createNewSession();

                resetChatUI();


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


                closeMenu();
            }
        );
    }


    /* ==================================================
       CLEAR CHAT
    ================================================== */

    function setupClearChat() {

        const button =
            $("clearChatButton");

        if (!button) {
            return;
        }


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


                try {

                    localStorage.removeItem(
                        STORAGE.history
                    );

                } catch (_) {}


                createNewSession();

                resetChatUI();

                closeMenu();
            }
        );
    }


    /* ==================================================
       LOAD HISTORY
    ================================================== */

    function loadHistoryToUI() {

        const history =
            getHistory();

        if (!history.length) {
            return;
        }


        const container =
            $("chatMessages");

        if (!container) {
            return;
        }


        removeWelcome();


        history
            .slice(-100)
            .forEach(function (item) {

                if (
                    !item ||
                    !item.role ||
                    !item.content
                ) {
                    return;
                }


                if (
                    item.role === "user"
                ) {

                    addUserMessage(
                        item.content
                    );

                } else if (
                    item.role === "assistant"
                ) {

                    addAssistantMessage(
                        item.content
                    );
                }
            });


        scrollToBottom();
    }


    /* ==================================================
       ATTACHMENTS
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
            function (event) {

                event.preventDefault();

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
                    .map(function (file) {
                        return file.name;
                    })
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


                fileInput.value = "";
            }
        );
    }


    /* ==================================================
       ADD
    ================================================== */

    function setupAddButton() {

        const button =
            $("addButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

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


        if (
            !button ||
            !input
        ) {
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

                        console.warn(
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

                    console.warn(
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

    function getLiveMode() {

        try {

            return (
                localStorage.getItem(
                    STORAGE.liveMode
                ) === "true"
            );

        } catch (_) {

            return false;
        }
    }


    function setLiveMode(enabled) {

        try {

            localStorage.setItem(
                STORAGE.liveMode,
                enabled
                    ? "true"
                    : "false"
            );

        } catch (_) {}
    }


    function setupLiveSearch() {

        const button =
            $("liveSearchButton");

        const input =
            $("messageInput");


        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                const state =
                    !getLiveMode();


                setLiveMode(
                    state
                );


                closeMenu();


                if (input) {

                    input.placeholder =
                        state
                            ? "Ask Atharv to search current information…"
                            : "Message Atharv…";

                    input.focus();
                }


                button.setAttribute(
                    "aria-pressed",
                    state
                        ? "true"
                        : "false"
                );
            }
        );
    }


    /* ==================================================
       MEMORY
    ================================================== */

    function setupMemory() {

        const button =
            $("memoryButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                closeMenu();

                alert(
                    "Atharv Memory\n\n" +
                    "User ID: " +
                    getUserId() +
                    "\n\n" +
                    "Memory system is connected."
                );
            }
        );
    }


    /* ==================================================
       HISTORY BUTTON
    ================================================== */

    function setupHistory() {

        const button =
            $("historyButton");

        if (!button) {
            return;
        }


        button.addEventListener(
            "click",
            function () {

                closeMenu();

                const history =
                    getHistory();


                alert(
                    "Chat History\n\n" +
                    "Saved messages: " +
                    history.length
                );
            }
        );
    }


    /* ==================================================
       ONLINE
    ================================================== */

    function setupOnlineStatus() {

        window.addEventListener(
            "online",
            function () {

                console.log(
                    "ATHARV AI: online"
                );
            }
        );


        window.addEventListener(
            "offline",
            function () {

                console.warn(
                    "ATHARV AI: offline"
                );

                addErrorMessage(
                    "Internet connection lost."
                );
            }
        );
    }


    /* ==================================================
       DEBUG
    ================================================== */

    function debugElements() {

        const ids = [

            "chatMessages",

            "messageInput",

            "sendButton",

            "composer",

            "menuButton",

            "atharvMenu",

            "menuOverlay",

            "attachmentButton",

            "addButton",

            "voiceButton"

        ];


        ids.forEach(function (id) {

            if (!$(
                id
            )) {

                console.warn(
                    "ATHARV AI: missing #" +
                    id
                );
            }
        });


        console.log(
            "ATHARV AI API BASE:",
            API_BASE
        );


        console.log(
            "ATHARV AI CHAT:",
            CHAT_ENDPOINT
        );


        console.log(
            "ATHARV AI RESEARCH:",
            RESEARCH_ENDPOINT
        );
    }


    /* ==================================================
       INIT
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: initializing v19.1.0"
        );


        debugElements();


        getUserId();

        getSessionId();


        setupSend();

        setupInputResize();

        setupMenu();

        setupNewChat();

        setupClearChat();

        setupAttachments();

        setupAddButton();

        setupVoice();

        setupLiveSearch();

        setupMemory();

        setupHistory();

        setupOnlineStatus();


        loadHistoryToUI();


        console.log(
            "ATHARV AI: READY v19.1.0"
        );
    }


    /* ==================================================
       START
    ================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once: true
            }
        );

    } else {

        init();
    }

})();
