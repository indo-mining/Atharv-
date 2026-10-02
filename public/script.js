"use strict";

/*
=========================================================
 ATHARV AI - MAIN FRONTEND SCRIPT
 Version 18.4.0
 --------------------------------------------------------
 Matches current public/index.html exactly

 FIXES:
 - Send button guaranteed event binding
 - Enter key sends message
 - API auto-detection
 - /api/chat POST
 - Loading state
 - Error handling
 - Chat history
 - User ID
 - Session ID
 - Welcome screen removal
 - Assistant/user message rendering
 - Mobile safe
 - No ES module/import dependency
 - No dependency on other JS files
=========================================================
*/

(function () {

    console.log("ATHARV AI: script.js loaded");

    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE =
        window.location.origin;

    const CHAT_API =
        API_BASE + "/api/chat";

    const STORAGE_HISTORY =
        "atharv_chat_history_v18";

    const STORAGE_USER =
        "atharv_user_id_v18";

    const STORAGE_SESSION =
        "atharv_session_id_v18";


    /* ==================================================
       ELEMENTS
    ================================================== */

    let messageInput = null;
    let sendButton = null;
    let chatMessages = null;


    function getElements() {

        messageInput =
            document.getElementById("messageInput");

        sendButton =
            document.getElementById("sendButton");

        chatMessages =
            document.getElementById("chatMessages");

        return (
            messageInput &&
            sendButton &&
            chatMessages
        );
    }


    /* ==================================================
       STORAGE
    ================================================== */

    function getUserId() {

        try {

            let id =
                localStorage.getItem(
                    STORAGE_USER
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
                    STORAGE_USER,
                    id
                );
            }

            return id;

        } catch (error) {

            return "guest";
        }
    }


    function getSessionId() {

        try {

            let id =
                localStorage.getItem(
                    STORAGE_SESSION
                );

            if (!id) {

                id =
                    "session_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 8);

                localStorage.setItem(
                    STORAGE_SESSION,
                    id
                );
            }

            return id;

        } catch (error) {

            return "guest-session";
        }
    }


    function loadHistory() {

        try {

            const raw =
                localStorage.getItem(
                    STORAGE_HISTORY
                );

            if (!raw) {
                return [];
            }

            const data =
                JSON.parse(raw);

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            console.warn(
                "ATHARV: history read failed",
                error
            );

            return [];
        }
    }


    function saveHistory(history) {

        try {

            localStorage.setItem(
                STORAGE_HISTORY,
                JSON.stringify(
                    history.slice(-100)
                )
            );

        } catch (error) {

            console.warn(
                "ATHARV: history save failed",
                error
            );
        }
    }


    /* ==================================================
       HTML ESCAPE
    ================================================== */

    function escapeHTML(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ==================================================
       SIMPLE MARKDOWN
    ================================================== */

    function formatText(text) {

        if (text === null || text === undefined) {
            return "";
        }

        let value =
            escapeHTML(String(text));

        value =
            value.replace(
                /```([\s\S]*?)```/g,
                function (_, code) {

                    return (
                        '<pre class="atharv-code"><code>' +
                        code.trim() +
                        "</code></pre>"
                    );
                }
            );

        value =
            value.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );

        value =
            value.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );

        value =
            value.replace(
                /\*(.*?)\*/g,
                "<em>$1</em>"
            );

        value =
            value.replace(
                /\n/g,
                "<br>"
            );

        return value;
    }


    /* ==================================================
       MESSAGE UI
    ================================================== */

    function removeWelcome() {

        const welcome =
            document.getElementById(
                "welcomeScreen"
            );

        if (welcome) {
            welcome.remove();
        }
    }


    function scrollToBottom() {

        if (!chatMessages) return;

        requestAnimationFrame(
            function () {

                chatMessages.scrollTop =
                    chatMessages.scrollHeight;

            }
        );
    }


    function addMessage(
        role,
        text
    ) {

        if (!chatMessages) return null;

        removeWelcome();

        const wrapper =
            document.createElement("div");

        wrapper.className =
            "atharv-message " +
            (
                role === "user"
                    ? "atharv-user-message"
                    : "atharv-ai-message"
            );

        const label =
            document.createElement("div");

        label.className =
            "atharv-message-label";

        label.textContent =
            role === "user"
                ? "You"
                : "Atharv AI";

        const body =
            document.createElement("div");

        body.className =
            "atharv-message-body";

        body.innerHTML =
            formatText(text);

        wrapper.appendChild(label);
        wrapper.appendChild(body);

        chatMessages.appendChild(wrapper);

        scrollToBottom();

        return wrapper;
    }


    /* ==================================================
       TYPING INDICATOR
    ================================================== */

    function showTyping() {

        if (!chatMessages) return null;

        removeTyping();

        const typing =
            document.createElement("div");

        typing.id =
            "atharvTyping";

        typing.className =
            "atharv-message atharv-ai-message";

        typing.innerHTML =
            `
            <div class="atharv-message-label">
                Atharv AI
            </div>

            <div class="atharv-message-body">
                <span>Thinking</span>
                <span class="atharv-dots">...</span>
            </div>
            `;

        chatMessages.appendChild(typing);

        scrollToBottom();

        return typing;
    }


    function removeTyping() {

        const typing =
            document.getElementById(
                "atharvTyping"
            );

        if (typing) {
            typing.remove();
        }
    }


    /* ==================================================
       SEND BUTTON STATE
    ================================================== */

    function setSendingState(isSending) {

        if (!sendButton) return;

        sendButton.disabled =
            Boolean(isSending);

        if (isSending) {

            sendButton.dataset.oldText =
                sendButton.textContent;

            sendButton.textContent =
                "•••";

        } else {

            sendButton.textContent =
                sendButton.dataset.oldText ||
                "➤";
        }
    }


    /* ==================================================
       RESPONSE EXTRACTION
    ================================================== */

    function extractReply(data) {

        if (!data) {
            return "";
        }

        if (typeof data === "string") {
            return data;
        }

        const possibleFields = [
            "reply",
            "response",
            "answer",
            "content",
            "text",
            "message",
            "output"
        ];

        for (
            let i = 0;
            i < possibleFields.length;
            i++
        ) {

            const key =
                possibleFields[i];

            if (
                typeof data[key] === "string" &&
                data[key].trim()
            ) {

                return data[key];
            }
        }


        if (
            data.data &&
            typeof data.data === "object"
        ) {

            return extractReply(
                data.data
            );
        }


        if (
            data.result &&
            typeof data.result === "object"
        ) {

            return extractReply(
                data.result
            );
        }


        if (
            data.choices &&
            Array.isArray(data.choices) &&
            data.choices.length
        ) {

            const choice =
                data.choices[0];

            if (
                choice &&
                choice.message &&
                typeof choice.message.content === "string"
            ) {

                return choice.message.content;
            }

            if (
                choice &&
                typeof choice.text === "string"
            ) {

                return choice.text;
            }
        }

        return "";
    }


    /* ==================================================
       API ERROR
    ================================================== */

    async function getErrorMessage(response) {

        let text = "";

        try {
            text =
                await response.text();
        } catch (_) {}


        if (!text) {

            return (
                "Server error (" +
                response.status +
                ")."
            );
        }


        try {

            const data =
                JSON.parse(text);

            return (
                data.error ||
                data.message ||
                data.detail ||
                (
                    "Server error (" +
                    response.status +
                    ")."
                )
            );

        } catch (_) {

            return text;
        }
    }


    /* ==================================================
       SEND MESSAGE
    ================================================== */

    async function sendMessage() {

        console.log(
            "ATHARV AI: sendMessage() called"
        );

        if (!getElements()) {

            console.error(
                "ATHARV AI: Required elements missing",
                {
                    messageInput,
                    sendButton,
                    chatMessages
                }
            );

            return;
        }


        if (sendButton.disabled) {
            return;
        }


        const message =
            messageInput.value.trim();


        if (!message) {

            messageInput.focus();

            return;
        }


        if (message.length > 12000) {

            alert(
                "Message is too long. Please shorten it."
            );

            return;
        }


        /* ------------------------------------------
           USER MESSAGE
        ------------------------------------------ */

        addMessage(
            "user",
            message
        );


        messageInput.value = "";

        messageInput.style.height =
            "auto";


        /* ------------------------------------------
           HISTORY
        ------------------------------------------ */

        let history =
            loadHistory();


        history.push({
            role: "user",
            content: message
        });


        /* ------------------------------------------
           UI
        ------------------------------------------ */

        setSendingState(true);

        showTyping();


        /* ------------------------------------------
           REQUEST
        ------------------------------------------ */

        const payload = {

            message: message,

            userId:
                getUserId(),

            sessionId:
                getSessionId(),

            history:
                history.slice(-20)

        };


        console.log(
            "ATHARV AI: sending request",
            CHAT_API,
            payload
        );


        try {

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    function () {
                        controller.abort();
                    },
                    120000
                );


            const response =
                await fetch(
                    CHAT_API,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                payload
                            ),

                        signal:
                            controller.signal
                    }
                );


            clearTimeout(timeout);


            console.log(
                "ATHARV AI: server status",
                response.status
            );


            if (!response.ok) {

                const errorText =
                    await getErrorMessage(
                        response
                    );

                throw new Error(
                    errorText
                );
            }


            let data;


            try {

                data =
                    await response.json();

            } catch (jsonError) {

                throw new Error(
                    "Server returned invalid JSON."
                );
            }


            console.log(
                "ATHARV AI: server response",
                data
            );


            const reply =
                extractReply(data);


            if (!reply) {

                throw new Error(
                    "Atharv AI returned an empty response."
                );
            }


            /* --------------------------------------
               SAVE HISTORY
            -------------------------------------- */

            history.push({
                role: "assistant",
                content: reply
            });

            saveHistory(history);


            /* --------------------------------------
               SHOW RESPONSE
            -------------------------------------- */

            removeTyping();

            addMessage(
                "assistant",
                reply
            );


        } catch (error) {

            console.error(
                "ATHARV AI: chat error",
                error
            );

            removeTyping();


            let errorMessage =
                "Message send nahi ho saka.";


            if (
                error &&
                error.name === "AbortError"
            ) {

                errorMessage =
                    "Server response mein bahut time lag raha hai. Please dobara try karein.";

            } else if (
                error &&
                error.message
            ) {

                errorMessage =
                    error.message;
            }


            addMessage(
                "assistant",
                "⚠️ " + errorMessage
            );


        } finally {

            setSendingState(false);

            if (messageInput) {
                messageInput.focus();
            }

        }
    }


    /* ==================================================
       BUTTON BINDING
    ================================================== */

    function bindSendButton() {

        if (!getElements()) {

            console.error(
                "ATHARV AI: Cannot bind send button."
            );

            return false;
        }


        /*
         * Remove any old property handler.
         */

        sendButton.onclick =
            null;


        /*
         * Direct click handler.
         */

        sendButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                console.log(
                    "ATHARV AI: SEND BUTTON CLICKED"
                );

                sendMessage();

            },
            false
        );


        /*
         * Extra fallback:
         * capture click even if another
         * element/script interferes.
         */

        document.addEventListener(
            "click",
            function (event) {

                const button =
                    event.target.closest &&
                    event.target.closest(
                        "#sendButton"
                    );

                if (!button) {
                    return;
                }

                if (
                    event.defaultPrevented
                ) {
                    return;
                }

                console.log(
                    "ATHARV AI: SEND FALLBACK CLICK"
                );

                sendMessage();

            },
            true
        );


        console.log(
            "ATHARV AI: Send button bound successfully"
        );

        return true;
    }


    /* ==================================================
       ENTER KEY
    ================================================== */

    function bindKeyboard() {

        if (!messageInput) return;


        messageInput.addEventListener(
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


        /*
         * Auto-grow textarea
         */

        messageInput.addEventListener(
            "input",
            function () {

                this.style.height =
                    "auto";

                this.style.height =
                    Math.min(
                        this.scrollHeight,
                        140
                    ) + "px";

            }
        );

    }


    /* ==================================================
       LOAD SAVED CHAT
    ================================================== */

    function restoreHistory() {

        if (!getElements()) {
            return;
        }


        const history =
            loadHistory();


        if (!history.length) {
            return;
        }


        /*
         * Only restore if chat is actually saved.
         */

        const validMessages =
            history.filter(
                function (item) {

                    return (
                        item &&
                        (
                            item.role === "user" ||
                            item.role === "assistant"
                        ) &&
                        typeof item.content === "string"
                    );

                }
            );


        if (!validMessages.length) {
            return;
        }


        removeWelcome();


        validMessages.forEach(
            function (item) {

                addMessage(
                    item.role,
                    item.content
                );

            }
        );


        scrollToBottom();
    }


    /* ==================================================
       MENU LIVE SEARCH
       ================================================== */

    function bindLiveSearch() {

        const button =
            document.getElementById(
                "liveSearchButton"
            );

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                /*
                 * Research/live mode is intentionally
                 * not forced here. The current backend
                 * chat endpoint remains stable.
                 */

                const input =
                    document.getElementById(
                        "messageInput"
                    );

                if (input) {

                    input.placeholder =
                        "Ask Atharv to search current information…";

                    input.focus();
                }


                closeMenuIfOpen();
            }
        );
    }


    /* ==================================================
       MENU HELPERS
    ================================================== */

    function closeMenuIfOpen() {

        const menu =
            document.getElementById(
                "atharvMenu"
            );

        const overlay =
            document.getElementById(
                "menuOverlay"
            );

        const menuButton =
            document.getElementById(
                "menuButton"
            );


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

        if (menuButton) {

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    }


    /* ==================================================
       MEMORY BUTTON
    ================================================== */

    function bindMemoryButton() {

        const button =
            document.getElementById(
                "memoryButton"
            );

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const userId =
                    getUserId();

                addMessage(
                    "assistant",
                    "🧠 Memory system is connected to this user session.\n\nUser ID: `" +
                    userId +
                    "`"
                );

                closeMenuIfOpen();

            }
        );
    }


    /* ==================================================
       HISTORY BUTTON
    ================================================== */

    function bindHistoryButton() {

        const button =
            document.getElementById(
                "historyButton"
            );

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const history =
                    loadHistory();


                if (!history.length) {

                    alert(
                        "No saved chat history."
                    );

                    closeMenuIfOpen();

                    return;
                }


                alert(
                    "Saved messages: " +
                    history.length
                );

                closeMenuIfOpen();
            }
        );
    }


    /* ==================================================
       ADD BUTTON
    ================================================== */

    function bindAddButton() {

        const button =
            document.getElementById(
                "addButton"
            );

        if (!button) return;


        button.addEventListener(
            "click",
            function () {

                const attachment =
                    document.getElementById(
                        "attachmentButton"
                    );

                if (attachment) {
                    attachment.click();
                }

            }
        );
    }


    /* ==================================================
       INITIALIZE
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: initializing..."
        );


        if (!getElements()) {

            console.error(
                "ATHARV AI: Required HTML elements were not found."
            );

            return;
        }


        console.log(
            "ATHARV AI: Required elements found",
            {
                messageInput: true,
                sendButton: true,
                chatMessages: true
            }
        );


        bindSendButton();

        bindKeyboard();

        bindLiveSearch();

        bindMemoryButton();

        bindHistoryButton();

        bindAddButton();

        restoreHistory();


        console.log(
            "ATHARV AI: initialized successfully"
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
            init
        );

    } else {

        init();
    }


    /* ==================================================
       GLOBAL DEBUG ACCESS
       Useful for testing from browser console.
    ================================================== */

    window.AtharvAI = {

        sendMessage:
            sendMessage,

        getUserId:
            getUserId,

        getSessionId:
            getSessionId,

        api:
            CHAT_API

    };


})();
