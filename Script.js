"use strict";

/*
=========================================================
 ATHARV AI - SCRIPT.JS
 Version 2.0.0
 --------------------------------------------------------
 Direct send-button fix
 Enter-to-send
 /api/chat
 Mobile support
 No imports
 No modules
 No external dependency
=========================================================
*/

(function () {

    console.log("ATHARV: script.js loaded");

    const API_URL = "/api/chat";
    const HISTORY_KEY = "atharv_chat_history_v18";
    const USER_KEY = "atharv_user_id_v18";

    let sending = false;


    /* =====================================================
       USER ID
    ===================================================== */

    function getUserId() {

        let id = null;

        try {
            id = localStorage.getItem(USER_KEY);
        } catch (e) {}

        if (!id) {

            id =
                "guest_" +
                Date.now().toString(36) +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 9);

            try {
                localStorage.setItem(
                    USER_KEY,
                    id
                );
            } catch (e) {}
        }

        return id;
    }


    /* =====================================================
       HISTORY
    ===================================================== */

    function getHistory() {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        HISTORY_KEY
                    ) || "[]"
                );

            return Array.isArray(data)
                ? data
                : [];

        } catch (e) {

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

        } catch (e) {}
    }


    function addHistory(role, content) {

        const history =
            getHistory();

        history.push({
            role: role,
            content: content
        });

        saveHistory(history);
    }


    /* =====================================================
       ELEMENTS
    ===================================================== */

    function input() {
        return document.getElementById(
            "messageInput"
        );
    }


    function sendButton() {
        return document.getElementById(
            "sendButton"
        );
    }


    function chat() {
        return document.getElementById(
            "chatMessages"
        );
    }


    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHTML(text) {

        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =====================================================
       SIMPLE MARKDOWN
    ===================================================== */

    function format(text) {

        let html =
            escapeHTML(text);


        html = html.replace(
            /```([\s\S]*?)```/g,
            "<pre><code>$1</code></pre>"
        );


        html = html.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );


        html = html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


        html = html.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );


        html =
            html.replace(
                /\n/g,
                "<br>"
            );


        return html;
    }


    /* =====================================================
       REMOVE WELCOME
    ===================================================== */

    function removeWelcome() {

        const welcome =
            document.getElementById(
                "welcomeScreen"
            );

        if (welcome) {
            welcome.remove();
        }
    }


    /* =====================================================
       ADD MESSAGE
    ===================================================== */

    function addMessage(
        role,
        text
    ) {

        const container =
            chat();

        if (!container) {

            console.error(
                "ATHARV: chatMessages not found"
            );

            return;
        }


        removeWelcome();


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            role === "user"
                ? "message user-message"
                : "message assistant-message";


        const bubble =
            document.createElement(
                "div"
            );


        bubble.className =
            "message-bubble";


        bubble.innerHTML =
            format(text);


        wrapper.appendChild(
            bubble
        );


        container.appendChild(
            wrapper
        );


        container.scrollTop =
            container.scrollHeight;
    }


    /* =====================================================
       TYPING
    ===================================================== */

    function showTyping() {

        const container =
            chat();

        if (!container) return;


        removeTyping();


        const el =
            document.createElement(
                "div"
            );


        el.id =
            "atharvTyping";


        el.className =
            "message assistant-message";


        el.innerHTML = `
            <div class="message-bubble">
                Atharv is thinking…
            </div>
        `;


        container.appendChild(
            el
        );


        container.scrollTop =
            container.scrollHeight;
    }


    function removeTyping() {

        const el =
            document.getElementById(
                "atharvTyping"
            );

        if (el) {
            el.remove();
        }
    }


    /* =====================================================
       BUTTON STATE
    ===================================================== */

    function buttonLoading(
        loading
    ) {

        const btn =
            sendButton();

        if (!btn) return;


        btn.disabled =
            loading;


        if (loading) {

            btn.dataset.oldText =
                btn.innerHTML;

            btn.innerHTML =
                "⏳";

        } else {

            btn.innerHTML =
                btn.dataset.oldText ||
                "➤";
        }
    }


    /* =====================================================
       SEND TO SERVER
    ===================================================== */

    async function callAPI(
        message
    ) {

        const history =
            getHistory();


        const payload = {

            message: message,

            userId:
                getUserId(),

            sessionId:
                getUserId(),

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
            "ATHARV: sending request",
            payload
        );


        const response =
            await fetch(
                API_URL,
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
                        )
                }
            );


        const text =
            await response.text();


        let data = {};


        try {

            data =
                text
                    ? JSON.parse(text)
                    : {};

        } catch (e) {

            data = {
                reply: text
            };
        }


        console.log(
            "ATHARV: server response",
            response.status,
            data
        );


        if (!response.ok) {

            throw new Error(
                data.error ||
                data.message ||
                data.reply ||
                (
                    "Server error: " +
                    response.status
                )
            );
        }


        const reply =
            data.reply ||
            data.response ||
            data.answer ||
            data.message ||
            data.content ||
            data.text;


        if (!reply) {

            throw new Error(
                "Server se response nahi mila."
            );
        }


        return reply;
    }


    /* =====================================================
       MAIN SEND
    ===================================================== */

    async function sendMessage() {

        if (sending) return;


        const field =
            input();


        if (!field) {

            alert(
                "Message box nahi mila."
            );

            console.error(
                "ATHARV: #messageInput missing"
            );

            return;
        }


        const message =
            field.value.trim();


        if (!message) {

            field.focus();

            return;
        }


        sending = true;


        field.value = "";


        field.style.height =
            "auto";


        addMessage(
            "user",
            message
        );


        addHistory(
            "user",
            message
        );


        showTyping();


        buttonLoading(
            true
        );


        try {

            const reply =
                await callAPI(
                    message
                );


            removeTyping();


            addMessage(
                "assistant",
                reply
            );


            addHistory(
                "assistant",
                reply
            );


        } catch (error) {

            removeTyping();


            console.error(
                "ATHARV SEND ERROR:",
                error
            );


            addMessage(
                "assistant",
                "⚠️ " +
                (
                    error.message ||
                    "Message send nahi ho saka."
                )
            );

        } finally {

            sending = false;

            buttonLoading(
                false
            );

            field.focus();
        }
    }


    /* =====================================================
       DIRECT BUTTON CONNECTION
    ===================================================== */

    function connectButton() {

        const btn =
            sendButton();


        if (!btn) {

            console.error(
                "ATHARV: sendButton missing"
            );

            return;
        }


        if (
            btn.dataset.atharvReady ===
            "true"
        ) {
            return;
        }


        btn.dataset.atharvReady =
            "true";


        btn.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                console.log(
                    "ATHARV: SEND BUTTON CLICKED"
                );

                sendMessage();
            },
            false
        );


        console.log(
            "ATHARV: sendButton connected"
        );
    }


    /* =====================================================
       ENTER KEY
    ===================================================== */

    function connectInput() {

        const field =
            input();


        if (!field) {

            console.error(
                "ATHARV: messageInput missing"
            );

            return;
        }


        if (
            field.dataset.atharvReady ===
            "true"
        ) {
            return;
        }


        field.dataset.atharvReady =
            "true";


        field.addEventListener(
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


        field.addEventListener(
            "input",
            function () {

                field.style.height =
                    "auto";

                field.style.height =
                    Math.min(
                        field.scrollHeight,
                        140
                    ) + "px";
            }
        );


        console.log(
            "ATHARV: messageInput connected"
        );
    }


    /* =====================================================
       DOCUMENT FALLBACK
       Even if another element interferes
    ===================================================== */

    document.addEventListener(
        "click",
        function (event) {

            const btn =
                event.target.closest(
                    "#sendButton"
                );


            if (!btn) return;


            if (
                event.__atharvHandled
            ) {
                return;
            }


            event.__atharvHandled =
                true;


            console.log(
                "ATHARV: fallback send click"
            );


            sendMessage();

        },
        true
    );


    /* =====================================================
       INIT
    ===================================================== */

    function init() {

        console.log(
            "ATHARV: initializing..."
        );


        connectButton();

        connectInput();


        setTimeout(
            function () {

                connectButton();
                connectInput();

            },
            500
        );


        setTimeout(
            function () {

                connectButton();
                connectInput();

            },
            1500
        );


        console.log(
            "ATHARV: ready"
        );
    }


    /* =====================================================
       START
    ===================================================== */

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


    /* Global function */

    window.sendMessage =
        sendMessage;

    window.atharvSend =
        sendMessage;

})();
