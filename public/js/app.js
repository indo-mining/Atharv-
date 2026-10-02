"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND CONTROLLER
 Version 19.0.0 FINAL
 --------------------------------------------------------
 Handles:
 - Chat send
 - Enter to send
 - /api/chat
 - Chat history
 - Session ID
 - User ID
 - Side menu
 - New chat
 - Clear chat
 - Attachments
 - Voice input
 - Memory
 - History
 - Live Search
 - Mobile UI
 - Loading state
 - Error handling

 IMPORTANT:
 - This file is the ONLY frontend JS controller.
 - Do NOT load another chat/send script with it.
=========================================================
*/

(function () {

    console.log("ATHARV AI: app.js loading");


    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE = window.location.origin;

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

    let sending = false;


    /* ==================================================
       HELPERS
    ================================================== */

    function $(id) {
        return document.getElementById(id);
    }


    function safeText(value) {
        if (value === null || value === undefined) {
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


        /*
         * Basic markdown-style formatting.
         */

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


        /*
         * Preserve line breaks.
         */

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

        if (!container) return;

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
       SESSION ID
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

            return "session_" +
                Date.now().toString(36);
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


    function addHistory(
        role,
        content
    ) {

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


    /* ==================================================
       MESSAGE UI
    ================================================== */

    function removeWelcome() {

        const welcome =
            $("welcomeScreen");

        if (welcome) {
            welcome.remove();
        }
    }


    function addUserMessage(text) {

        const container =
            $("chatMessages");

        if (!container) return;


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


        container.appendChild(
            message
        );


        scrollToBottom();
    }


    function addAssistantMessage(
        text,
        sources
    ) {

        const container =
            $("chatMessages");

        if (!container) return;


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

            sourceHTML =
                `
                <div class="atharv-sources">
                    <strong>Sources</strong>
                    <ul>
                        ${
                            sources
                                .slice(0, 5)
                                .map(function (source) {

                                    const title =
                                        escapeHTML(
                                            source.title ||
                                            source.url ||
                                            "Source"
                                        );

                                    const url =
                                        escapeHTML(
                                            source.url || ""
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


        container.appendChild(
            message
        );


        scrollToBottom();
    }


    function addErrorMessage(text) {

        const container =
            $("chatMessages");

        if (!container) return;


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


        container.appendChild(
            message
        );


        scrollToBottom();
    }


    /* ==================================================
       LOADING
    ================================================== */

    function showLoading() {

        const container =
            $("chatMessages");

        if (!container) return;


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


        container.appendChild(
            loading
        );


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
       SEND BUTTON STATE
    ================================================== */

    function setSendingState(active) {

        const button =
            $("sendButton");

        const input =
            $("messageInput");


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


        if (input) {

            input.disabled =
                Boolean(active);
        }


        sending =
            Boolean(active);
    }


    /* ==================================================
       RESPONSE PARSER
    ================================================== */

    async function parseResponse(response) {

        const text =
            await response.text();


        let data = null;


        try {

            data =
                text
                    ? JSON.parse(text)
                    : null;

        } catch (_) {

            data = null;
        }


        if (!response.ok) {

            let errorMessage =
                "Request failed.";


            if (data) {

                errorMessage =
                    data.error ||
                    data.message ||
                    errorMessage;

            } else if (text) {

                errorMessage =
                    text.slice(0, 500);
            }


            throw new Error(
                errorMessage
            );
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

            data?.choices?.[0]?.message?.content,

            data?.choices?.[0]?.text
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
       NORMAL CHAT
    ================================================== */

    async function sendNormalChat(
        message
    ) {

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
            "ATHARV AI: sending /api/chat"
        );


        console.log(
            "ATHARV AI: payload",
            payload
        );


        const response =
            await fetch(
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

    async function sendResearch(
        message
    ) {

        const response =
            await fetch(
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
                            query: message,

                            message: message,

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

        if (sending) {
            return;
        }


        const input =
            $("messageInput");


        if (!input) {

            console.error(
                "ATHARV AI: messageInput not found"
            );

            return;
        }


        const message =
            input.value.trim();


        if (!message) {
            return;
        }


        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            addErrorMessage(
                `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
            );

            return;
        }


        /*
         * Clear input immediately.
         */

        input.value = "";

        input.style.height =
            "auto";


        /*
         * Show user message.
         */

        addUserMessage(
            message
        );


        /*
         * Save user message.
         */

        addHistory(
            "user",
            message
        );


        /*
         * Lock UI.
         */

        setSendingState(
            true
        );


        showLoading();


        try {

            let data;


            const liveMode =
                getLiveMode();


            if (liveMode) {

                console.log(
                    "ATHARV AI: live research request"
                );


                data =
                    await sendResearch(
                        message
                    );


                /*
                 * Research endpoint may return
                 * search results instead of answer.
                 */

                const answer =
                    extractAnswer(data);


                if (answer) {

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

                } else {

                    const results =
                        Array.isArray(
                            data.results
                        )
                            ? data.results
                            : [];


                    if (
                        results.length
                    ) {

                        const text =
                            results
                                .slice(0, 5)
                                .map(
                                    function (item) {

                                        return (
                                            "• " +
                                            (
                                                item.title ||
                                                item.content ||
                                                item.url ||
                                                "Source"
                                            )
                                        );

                                    }
                                )
                                .join("\n");


                        removeLoading();

                        addAssistantMessage(
                            text,
                            results
                        );


                        addHistory(
                            "assistant",
                            text
                        );

                    } else {

                        throw new Error(
                            "Live search returned no results."
                        );
                    }
                }

            } else {

                data =
                    await sendNormalChat(
                        message
                    );


                console.log(
                    "ATHARV AI: response",
                    data
                );


                const answer =
                    extractAnswer(data);


                if (!answer) {

                    throw new Error(
                        "Atharv returned no answer."
                    );
                }


                removeLoading();


                addAssistantMessage(
                    answer,
                    data.sources || []
                );


                addHistory(
                    "assistant",
                    answer
                );
            }


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


            if (input) {

                input.disabled =
                    false;

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


        if (!button) {

            console.error(
                "ATHARV AI: sendButton not found"
            );

            return;
        }


        if (!input) {

            console.error(
                "ATHARV AI: messageInput not found"
            );

            return;
        }


        /*
         * Prevent duplicate handlers.
         */

        if (
            button.dataset.atharvSendReady ===
            "true"
        ) {
            return;
        }


        button.dataset.atharvSendReady =
            "true";


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                sendMessage();

            }
        );


        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );


        console.log(
            "ATHARV AI: send handler ready"
        );
    }


    /* ==================================================
       TEXTAREA AUTO HEIGHT
    ================================================== */

    function setupInputResize() {

        const input =
            $("messageInput");

        if (!input) return;


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

                    if (
                        document
                            .getElementById(
                                "atharvMenu"
                            )
                            ?.classList
                            .contains("open")
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

        if (!messages) return;


        messages.innerHTML =
            welcomeHTML();
    }


    function setupNewChat() {

        const button =
            $("newChatButton");

        if (!button) return;


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


                fileInput.value =
                    "";

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


        let recognition =
            null;

        let listening =
            false;


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

                        listening =
                            true;

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

                        listening =
                            false;

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

                    listening =
                        false;

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


        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const newState =
                    !getLiveMode();


                setLiveMode(
                    newState
                );


                closeMenu();


                if (input) {

                    input.placeholder =
                        newState
                            ? "Ask Atharv to search current information…"
                            : "Message Atharv…";

                    input.focus();
                }


                button.setAttribute(
                    "aria-pressed",
                    newState
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

        if (!button) return;


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

        if (!button) return;


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
       ONLINE STATUS
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

            }
        );
    }


    /* ==================================================
       PREVENT FORM RELOAD
    ================================================== */

    function setupComposerForm() {

        const composer =
            $("composer");


        if (!composer) {
            return;
        }


        if (
            composer.tagName ===
            "FORM"
        ) {

            composer.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    sendMessage();

                }
            );
        }
    }


    /* ==================================================
       DEBUG
    ================================================== */

    function debugElements() {

        const ids = [
            "chatMessages",
            "messageInput",
            "sendButton",
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
                    "ATHARV AI: missing element #" +
                    id
                );
            }

        });


        console.log(
            "ATHARV AI API:",
            CHAT_ENDPOINT
        );
    }


    /* ==================================================
       INITIALIZE
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: app.js initializing"
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

        setupComposerForm();

        setupOnlineStatus();


        loadHistoryToUI();


        console.log(
            "ATHARV AI: app.js ready"
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
