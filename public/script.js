"use strict";

/*
=========================================================
 ATHARV AI - CHAT ENGINE
 Version 18.4.0

 Handles:
 - Send button
 - Enter to send
 - /api/chat
 - User message
 - AI response
 - Loading
 - Error handling
 - Local history
 - Session ID
 - Mobile textarea
=========================================================
*/

(function () {

    console.log(
        "ATHARV AI: script.js loaded"
    );


    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE =
        window.location.origin;

    const CHAT_API =
        API_BASE + "/api/chat";


    const HISTORY_KEY =
        "atharv_chat_history_v18";

    const USER_KEY =
        "atharv_user_id_v18";

    const SESSION_KEY =
        "atharv_session_id_v18";


    /* ==================================================
       ELEMENTS
    ================================================== */

    let input = null;
    let send = null;
    let messages = null;


    function loadElements() {

        input =
            document.getElementById(
                "messageInput"
            );

        send =
            document.getElementById(
                "sendButton"
            );

        messages =
            document.getElementById(
                "chatMessages"
            );


        return (
            input &&
            send &&
            messages
        );
    }


    /* ==================================================
       USER ID
    ================================================== */

    function getUserId() {

        try {

            let id =
                localStorage.getItem(
                    USER_KEY
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
                    USER_KEY,
                    id
                );
            }


            return id;

        } catch (_) {

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
                    SESSION_KEY
                );


            if (!id) {

                id =
                    "session_" +
                    Date.now().toString(36) +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 9);


                localStorage.setItem(
                    SESSION_KEY,
                    id
                );
            }


            return id;

        } catch (_) {

            return "guest-session";
        }
    }


    /* ==================================================
       HISTORY
    ================================================== */

    function getHistory() {

        try {

            const raw =
                localStorage.getItem(
                    HISTORY_KEY
                );


            if (!raw) {
                return [];
            }


            const data =
                JSON.parse(raw);


            return Array.isArray(data)
                ? data
                : [];

        } catch (_) {

            return [];
        }
    }


    function saveHistory(history) {

        try {

            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(
                    history.slice(-100)
                )
            );

        } catch (error) {

            console.log(
                "ATHARV AI: history save error",
                error
            );

        }
    }


    /* ==================================================
       ESCAPE
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
       FORMAT
    ================================================== */

    function formatText(text) {

        let value =
            escapeHTML(
                String(text || "")
            );


        value =
            value.replace(
                /```([\s\S]*?)```/g,
                function (_, code) {

                    return (
                        "<pre class=\"atharv-code\"><code>" +
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
                /\n/g,
                "<br>"
            );


        return value;

    }


    /* ==================================================
       WELCOME
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


    /* ==================================================
       SCROLL
    ================================================== */

    function scrollBottom() {

        if (!messages) return;


        requestAnimationFrame(
            function () {

                messages.scrollTop =
                    messages.scrollHeight;

            }
        );

    }


    /* ==================================================
       ADD MESSAGE
    ================================================== */

    function addMessage(
        role,
        text
    ) {

        if (!messages) return;


        removeWelcome();


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            role === "user"
                ? "atharv-message atharv-user-message"
                : "atharv-message atharv-ai-message";


        const label =
            document.createElement(
                "div"
            );


        label.className =
            "atharv-message-label";


        label.textContent =
            role === "user"
                ? "You"
                : "Atharv AI";


        const body =
            document.createElement(
                "div"
            );


        body.className =
            "atharv-message-body";


        body.innerHTML =
            formatText(text);


        wrapper.appendChild(label);

        wrapper.appendChild(body);

        messages.appendChild(wrapper);


        scrollBottom();

    }


    /* ==================================================
       TYPING
    ================================================== */

    function showTyping() {

        removeTyping();


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.id =
            "atharvTyping";


        wrapper.className =
            "atharv-message atharv-ai-message";


        wrapper.innerHTML = `
            <div class="atharv-message-label">
                Atharv AI
            </div>

            <div class="atharv-message-body">
                Thinking
                <span class="atharv-dots">...</span>
            </div>
        `;


        messages.appendChild(wrapper);

        scrollBottom();

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
       BUTTON STATE
    ================================================== */

    function setLoading(value) {

        if (!send) return;


        send.disabled =
            Boolean(value);


        if (value) {

            send.dataset.original =
                send.textContent;

            send.textContent =
                "•••";

        } else {

            send.textContent =
                send.dataset.original ||
                "➤";

        }

    }


    /* ==================================================
       EXTRACT RESPONSE
    ================================================== */

    function extractReply(data) {

        if (!data) {
            return "";
        }


        if (
            typeof data ===
            "string"
        ) {

            return data;
        }


        const fields = [
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
            i < fields.length;
            i++
        ) {

            const value =
                data[fields[i]];


            if (
                typeof value ===
                "string" &&
                value.trim()
            ) {

                return value;
            }

        }


        if (
            data.data &&
            typeof data.data ===
            "object"
        ) {

            return extractReply(
                data.data
            );

        }


        if (
            data.result &&
            typeof data.result ===
            "object"
        ) {

            return extractReply(
                data.result
            );

        }


        if (
            Array.isArray(
                data.choices
            ) &&
            data.choices.length
        ) {

            const choice =
                data.choices[0];


            if (
                choice.message &&
                typeof choice.message.content ===
                "string"
            ) {

                return choice.message.content;

            }


            if (
                typeof choice.text ===
                "string"
            ) {

                return choice.text;

            }

        }


        return "";

    }


    /* ==================================================
       API ERROR
    ================================================== */

    async function readError(response) {

        try {

            const text =
                await response.text();


            if (!text) {

                return (
                    "Server error: " +
                    response.status
                );

            }


            try {

                const data =
                    JSON.parse(text);


                return (
                    data.error ||
                    data.message ||
                    data.detail ||
                    text
                );

            } catch (_) {

                return text;

            }

        } catch (_) {

            return (
                "Server error: " +
                response.status
            );

        }

    }


    /* ==================================================
       SEND
    ================================================== */

    async function sendMessage() {

        console.log(
            "ATHARV AI: sendMessage called"
        );


        if (!loadElements()) {

            console.error(
                "ATHARV AI: HTML elements missing"
            );

            return;

        }


        if (send.disabled) {
            return;
        }


        const text =
            input.value.trim();


        if (!text) {

            input.focus();

            return;

        }


        console.log(
            "ATHARV AI: sending:",
            text
        );


        const history =
            getHistory();


        addMessage(
            "user",
            text
        );


        history.push({
            role: "user",
            content: text
        });


        input.value = "";

        input.style.height =
            "auto";


        setLoading(true);

        showTyping();


        const payload = {

            message:
                text,

            userId:
                getUserId(),

            sessionId:
                getSessionId(),

            history:
                history.slice(-20)

        };


        console.log(
            "ATHARV AI: POST",
            CHAT_API
        );


        try {

            const controller =
                new AbortController();


            const timer =
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
                        method:
                            "POST",

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


            clearTimeout(timer);


            console.log(
                "ATHARV AI: HTTP",
                response.status
            );


            if (!response.ok) {

                throw new Error(
                    await readError(
                        response
                    )
                );

            }


            const data =
                await response.json();


            console.log(
                "ATHARV AI: response",
                data
            );


            const reply =
                extractReply(data);


            if (!reply) {

                throw new Error(
                    "Atharv AI returned an empty response."
                );

            }


            history.push({

                role:
                    "assistant",

                content:
                    reply

            });


            saveHistory(
                history
            );


            removeTyping();


            addMessage(
                "assistant",
                reply
            );


        } catch (error) {

            console.error(
                "ATHARV AI: request failed",
                error
            );


            removeTyping();


            let message =
                "Message send nahi ho saka.";


            if (
                error.name ===
                "AbortError"
            ) {

                message =
                    "Server response mein bahut time lag raha hai. Please dobara try karein.";

            } else if (
                error.message
            ) {

                message =
                    error.message;
            }


            addMessage(
                "assistant",
                "⚠️ " + message
            );


        } finally {

            setLoading(false);

            input.focus();

        }

    }


    /* ==================================================
       SEND BUTTON
    ================================================== */

    function setupSend() {

        if (!loadElements()) {

            console.error(
                "ATHARV AI: Cannot find send button"
            );

            return;

        }


        send.addEventListener(
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
         * Capture fallback.
         * This catches the click even if
         * another element interferes.
         */

        document.addEventListener(
            "click",
            function (event) {

                const target =
                    event.target;


                if (
                    target &&
                    target.closest &&
                    target.closest(
                        "#sendButton"
                    )
                ) {

                    console.log(
                        "ATHARV AI: SEND CAPTURE CLICK"
                    );

                }

            },
            true
        );


        console.log(
            "ATHARV AI: send button ready"
        );

    }


    /* ==================================================
       KEYBOARD
    ================================================== */

    function setupKeyboard() {

        if (!input) return;


        input.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    sendMessage();

                }

            }
        );


        input.addEventListener(
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
       RESTORE HISTORY
    ================================================== */

    function restoreHistory() {

        if (!loadElements()) {
            return;
        }


        const history =
            getHistory();


        if (!history.length) {
            return;
        }


        /*
         * Don't restore invalid records.
         */

        const valid =
            history.filter(
                function (item) {

                    return (
                        item &&
                        (
                            item.role === "user" ||
                            item.role === "assistant"
                        ) &&
                        typeof item.content ===
                        "string"
                    );

                }
            );


        if (!valid.length) {
            return;
        }


        removeWelcome();


        valid.forEach(
            function (item) {

                addMessage(
                    item.role,
                    item.content
                );

            }
        );


        scrollBottom();

    }


    /* ==================================================
       INIT
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: chat initializing"
        );


        if (!loadElements()) {

            console.error(
                "ATHARV AI: Required elements not found."
            );

            return;

        }


        setupSend();

        setupKeyboard();

        restoreHistory();


        console.log(
            "ATHARV AI: chat ready"
        );


        console.log(
            "ATHARV AI API:",
            CHAT_API
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


    /* ==================================================
       GLOBAL DEBUG
    ================================================== */

    window.AtharvAI = {

        send:
            sendMessage,

        api:
            CHAT_API,

        userId:
            getUserId,

        sessionId:
            getSessionId

    };

})();
