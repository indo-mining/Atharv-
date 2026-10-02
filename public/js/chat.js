"use strict";

/*
=========================================================
 ATHARV AI
 CHAT ENGINE
 Version 22.0.4 DEBUG
 --------------------------------------------------------
 - Console ki zarurat nahi
 - Screen DEBUG panel
 - Exact API request/status/response
 - Backend response extraction
 - Mobile friendly
 - Existing composer compatible
 - /api/chat
 - /api/chat/research
=========================================================
*/

(() => {

    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE = window.location.origin;

    const CHAT_ENDPOINT =
        `${API_BASE}/api/chat`;

    const RESEARCH_ENDPOINT =
        `${API_BASE}/api/chat/research`;

    const REQUEST_TIMEOUT = 175000;

    const HISTORY_KEY =
        "atharv_chat_history_v22";

    const USER_ID_KEY =
        "atharv_user_id_v22";

    const SESSION_ID_KEY =
        "atharv_session_id_v22";

    const LIVE_KEY =
        "atharv_live_mode_v22";


    /* ==================================================
       STATE
    ================================================== */

    let history = [];
    let userId = "";
    let sessionId = "";
    let liveMode = false;

    let initialized = false;
    let sending = false;


    /* ==================================================
       DEBUG PANEL
    ================================================== */

    function ensureDebugPanel() {

        let panel = document.getElementById("atharvDebugPanel");

        if (panel) return panel;

        panel = document.createElement("div");

        panel.id = "atharvDebugPanel";

        panel.innerHTML = `
            <div class="atharv-debug-head">
                <strong>Atharv Debug</strong>
                <button type="button" id="atharvDebugClear">Clear</button>
                <button type="button" id="atharvDebugClose">×</button>
            </div>

            <div id="atharvDebugBody" class="atharv-debug-body">
                Ready...
            </div>
        `;

        Object.assign(panel.style, {
            position: "fixed",
            left: "10px",
            right: "10px",
            bottom: "10px",
            zIndex: "999999",
            background: "#ffffff",
            color: "#111111",
            border: "1px solid #d9d9d9",
            borderRadius: "14px",
            boxShadow: "0 8px 30px rgba(0,0,0,.18)",
            fontFamily: "system-ui, sans-serif",
            fontSize: "12px",
            overflow: "hidden",
            maxHeight: "45vh"
        });

        const head = panel.querySelector(".atharv-debug-head");

        Object.assign(head.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 10px",
            borderBottom: "1px solid #eeeeee",
            background: "#f7f7f7"
        });

        head.querySelector("strong").style.flex = "1";

        panel.querySelectorAll("button").forEach(btn => {

            Object.assign(btn.style, {
                border: "1px solid #ddd",
                background: "#fff",
                borderRadius: "7px",
                padding: "3px 8px",
                cursor: "pointer"
            });

        });

        const body = panel.querySelector(".atharv-debug-body");

        Object.assign(body.style, {
            padding: "9px",
            overflowY: "auto",
            maxHeight: "36vh",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word"
        });

        document.body.appendChild(panel);

        panel.querySelector("#atharvDebugClear")
            .addEventListener("click", () => {
                body.textContent = "";
            });

        panel.querySelector("#atharvDebugClose")
            .addEventListener("click", () => {
                panel.remove();
            });

        return panel;
    }


    function debug(message, data = null) {

        const panel = ensureDebugPanel();

        const body =
            panel.querySelector("#atharvDebugBody");

        const time =
            new Date().toLocaleTimeString();

        let text =
            `[${time}] ${message}`;

        if (data !== null) {

            try {

                if (typeof data === "string") {
                    text += `\n${data}`;
                } else {
                    text += `\n${JSON.stringify(data, null, 2)}`;
                }

            } catch {
                text += `\n${String(data)}`;
            }
        }

        const line =
            document.createElement("div");

        line.textContent = text;

        line.style.padding = "5px 0";
        line.style.borderBottom =
            "1px solid #f0f0f0";

        body.appendChild(line);

        body.scrollTop = body.scrollHeight;
    }


    /* ==================================================
       STORAGE
    ================================================== */

    function safeGet(key, fallback = null) {

        try {

            const value =
                localStorage.getItem(key);

            return value === null
                ? fallback
                : value;

        } catch {

            return fallback;
        }
    }


    function safeSet(key, value) {

        try {

            localStorage.setItem(
                key,
                value
            );

        } catch (error) {

            debug(
                "Storage write failed",
                error.message
            );
        }
    }


    function loadHistory() {

        try {

            const raw =
                safeGet(HISTORY_KEY, "[]");

            const parsed =
                JSON.parse(raw);

            if (Array.isArray(parsed)) {

                history =
                    parsed.filter(item =>
                        item &&
                        typeof item.role === "string" &&
                        typeof item.content === "string"
                    );

            }

        } catch {

            history = [];
        }
    }


    function saveHistory() {

        try {

            safeSet(
                HISTORY_KEY,
                JSON.stringify(history.slice(-100))
            );

        } catch (error) {

            debug(
                "History save failed",
                error.message
            );
        }
    }


    /* ==================================================
       IDS
    ================================================== */

    function makeId(prefix) {

        return `${prefix}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 10)}`;
    }


    function loadIdentity() {

        userId =
            safeGet(
                USER_ID_KEY,
                ""
            );

        if (!userId) {

            userId =
                makeId("user");

            safeSet(
                USER_ID_KEY,
                userId
            );
        }


        sessionId =
            safeGet(
                SESSION_ID_KEY,
                ""
            );

        if (!sessionId) {

            sessionId =
                makeId("session");

            safeSet(
                SESSION_ID_KEY,
                sessionId
            );
        }


        liveMode =
            safeGet(
                LIVE_KEY,
                "false"
            ) === "true";
    }


    /* ==================================================
       MARKDOWN
    ================================================== */

    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function renderMarkdown(text) {

        let html =
            escapeHtml(text);


        html =
            html.replace(
                /```([\s\S]*?)```/g,
                "<pre><code>$1</code></pre>"
            );


        html =
            html.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );


        html =
            html.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );


        html =
            html.replace(
                /\*(.*?)\*/g,
                "<em>$1</em>"
            );


        html =
            html.replace(
                /\n/g,
                "<br>"
            );


        return html;
    }


    /* ==================================================
       MESSAGE UI
    ================================================== */

    function getMessagesElement() {

        return document.getElementById("messages");
    }


    function renderMessage(role, content) {

        const messages =
            getMessagesElement();

        if (!messages) {

            debug(
                "ERROR: #messages element not found"
            );

            return;
        }


        const row =
            document.createElement("div");

        row.className =
            `message-row ${role}`;


        const bubble =
            document.createElement("div");

        bubble.className =
            `message-bubble ${role}`;


        bubble.innerHTML =
            renderMarkdown(content);


        row.appendChild(bubble);

        messages.appendChild(row);

        messages.scrollTop =
            messages.scrollHeight;
    }


    function renderHistory() {

        const messages =
            getMessagesElement();

        if (!messages) {

            debug(
                "ERROR: #messages missing"
            );

            return;
        }


        messages.innerHTML = "";


        history.forEach(item => {

            renderMessage(
                item.role,
                item.content
            );

        });
    }


    /* ==================================================
       THINKING
    ================================================== */

    function setThinking(active) {

        const indicator =
            document.getElementById(
                "typingIndicator"
            );

        if (!indicator) return;

        indicator.hidden =
            !active;

        if (active) {

            const messages =
                getMessagesElement();

            if (messages) {

                messages.scrollTop =
                    messages.scrollHeight;
            }
        }
    }


    /* ==================================================
       TOAST
    ================================================== */

    function showToast(message) {

        let toast =
            document.getElementById("toast");

        if (!toast) {

            toast =
                document.getElementById(
                    "atharvToast"
                );
        }

        if (!toast) {

            toast =
                document.createElement("div");

            toast.id =
                "atharvToast";

            Object.assign(toast.style, {
                position: "fixed",
                left: "50%",
                bottom: "90px",
                transform: "translateX(-50%)",
                zIndex: "999998",
                background: "#111",
                color: "#fff",
                padding: "10px 15px",
                borderRadius: "10px",
                maxWidth: "90%",
                textAlign: "center"
            });

            document.body.appendChild(toast);
        }


        toast.textContent =
            message;

        toast.hidden = false;

        clearTimeout(
            toast._timer
        );

        toast._timer =
            setTimeout(() => {

                toast.hidden = true;

            }, 3500);
    }


    /* ==================================================
       EXTRACT REPLY
    ================================================== */

    function extractReply(data) {

        if (!data) return "";


        const candidates = [

            data.reply,
            data.response,
            data.answer,
            data.content,
            data.message,
            data.text,

            data.result?.reply,
            data.result?.response,
            data.result?.answer,
            data.result?.content,
            data.result?.message,
            data.result?.text,

            data.data?.reply,
            data.data?.response,
            data.data?.answer,
            data.data?.content,
            data.data?.message,
            data.data?.text,

            data.choices?.[0]?.message?.content,
            data.choices?.[0]?.text
        ];


        for (const item of candidates) {

            if (
                typeof item === "string" &&
                item.trim()
            ) {

                return item.trim();
            }
        }


        return "";
    }


    /* ==================================================
       REQUEST
    ================================================== */

    async function request(
        url,
        payload
    ) {

        debug(
            "POST REQUEST",
            {
                url,
                payload
            }
        );


        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () => controller.abort(),
                REQUEST_TIMEOUT
            );


        try {

            const response =
                await fetch(
                    url,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body:
                            JSON.stringify(payload),

                        signal:
                            controller.signal
                    }
                );


            debug(
                "HTTP STATUS",
                `${response.status} ${response.statusText}`
            );


            const raw =
                await response.text();


            debug(
                "RAW RESPONSE",
                raw || "(EMPTY RESPONSE)"
            );


            let data = null;


            try {

                data =
                    raw
                        ? JSON.parse(raw)
                        : null;

            } catch (error) {

                debug(
                    "JSON PARSE ERROR",
                    error.message
                );

                throw new Error(
                    `Server ne valid JSON nahi bheja. HTTP ${response.status}`
                );
            }


            if (!response.ok) {

                const serverMessage =
                    extractReply(data) ||
                    data?.error ||
                    data?.detail ||
                    `HTTP ${response.status}`;

                throw new Error(
                    serverMessage
                );
            }


            if (
                data &&
                data.ok === false
            ) {

                throw new Error(
                    data.error ||
                    data.message ||
                    "Server returned ok:false"
                );
            }


            return data;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                debug(
                    "REQUEST TIMEOUT"
                );

                throw new Error(
                    "Server response mein bahut time lag raha hai."
                );
            }


            debug(
                "REQUEST ERROR",
                error?.message || String(error)
            );

            throw error;

        } finally {

            clearTimeout(timer);
        }
    }


    /* ==================================================
       NORMAL CHAT
    ================================================== */

    async function normalChat(
        message,
        previousHistory
    ) {

        return request(
            CHAT_ENDPOINT,
            {
                message,
                history: previousHistory,
                userId,
                sessionId
            }
        );
    }


    /* ==================================================
       LIVE RESEARCH
    ================================================== */

    async function researchChat(
        message,
        previousHistory
    ) {

        return request(
            RESEARCH_ENDPOINT,
            {
                message,
                history: previousHistory,
                userId,
                sessionId
            }
        );
    }


    /* ==================================================
       SEND
    ================================================== */

    async function send(userMessage) {

        const message =
            String(userMessage || "")
                .trim();


        if (!message) {

            debug(
                "SEND CANCELLED: empty message"
            );

            return false;
        }


        if (message.length > 12000) {

            showToast(
                "Message bahut lamba hai."
            );

            return false;
        }


        if (sending) {

            debug(
                "SEND IGNORED: another request already running"
            );

            return false;
        }


        sending = true;


        debug(
            "SEND STARTED",
            message
        );


        const previousHistory =
            history.slice(-20);


        history.push({
            role: "user",
            content: message
        });


        saveHistory();

        renderMessage(
            "user",
            message
        );

        setThinking(true);


        try {

            let data;


            if (liveMode) {

                debug(
                    "LIVE MODE ON"
                );


                try {

                    data =
                        await researchChat(
                            message,
                            previousHistory
                        );

                } catch (researchError) {

                    debug(
                        "LIVE SEARCH FAILED - NORMAL CHAT FALLBACK",
                        researchError.message
                    );


                    data =
                        await normalChat(
                            message,
                            previousHistory
                        );
                }

            } else {

                debug(
                    "NORMAL CHAT MODE"
                );


                data =
                    await normalChat(
                        message,
                        previousHistory
                    );
            }


            debug(
                "PARSED RESPONSE",
                data
            );


            const reply =
                extractReply(data);


            debug(
                "EXTRACTED REPLY",
                reply || "(EMPTY)"
            );


            if (!reply) {

                throw new Error(
                    "Backend response mila, lekin reply text nahi mila."
                );
            }


            history.push({
                role: "assistant",
                content: reply
            });


            saveHistory();

            renderMessage(
                "assistant",
                reply
            );


            debug(
                "SEND SUCCESS"
            );


            return true;

        } catch (error) {

            debug(
                "SEND FAILED",
                error?.message || String(error)
            );


            const lastUserIndex =
                history
                    .map(item => item.role)
                    .lastIndexOf("user");


            if (
                lastUserIndex !== -1
            ) {

                history.splice(
                    lastUserIndex,
                    1
                );

                saveHistory();
            }


            showToast(
                error?.message ||
                "Message send nahi hua."
            );


            return false;

        } finally {

            setThinking(false);

            sending = false;


            debug(
                "SEND FINISHED"
            );
        }
    }


    /* ==================================================
       FORM BINDING
    ================================================== */

    function bindForm() {

        const form =
            document.getElementById(
                "composer"
            );


        if (!form) {

            debug(
                "ERROR: #composer not found"
            );

            return;
        }


        if (
            form.dataset
                .atharvBound === "true"
        ) {

            return;
        }


        form.dataset
            .atharvBound = "true";


        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const input =
                    document.getElementById(
                        "messageInput"
                    );


                if (!input) {

                    debug(
                        "ERROR: #messageInput not found"
                    );

                    return;
                }


                const value =
                    input.value.trim();


                if (!value) {

                    debug(
                        "SUBMIT: empty input"
                    );

                    return;
                }


                debug(
                    "FORM SUBMIT",
                    value
                );


                const success =
                    await send(value);


                if (success) {

                    input.value = "";

                    try {

                        localStorage.removeItem(
                            "atharv_draft_v22"
                        );

                    } catch {}
                }


                input.focus();
            }
        );


        debug(
            "Composer submit listener attached"
        );
    }


    /* ==================================================
       CLEAR CHAT
    ================================================== */

    function clearChat() {

        history = [];

        saveHistory();

        renderHistory();

        debug(
            "CHAT CLEARED"
        );
    }


    /* ==================================================
       LIVE MODE
    ================================================== */

    function getLive() {

        return liveMode;
    }


    function setLive(value) {

        liveMode =
            Boolean(value);

        safeSet(
            LIVE_KEY,
            String(liveMode)
        );


        debug(
            "LIVE MODE",
            liveMode
        );
    }


    /* ==================================================
       INIT
    ================================================== */

    function init() {

        if (initialized) {

            return;
        }


        initialized = true;


        debug(
            "Atharv Chat v22.0.4 starting..."
        );


        loadIdentity();

        loadHistory();

        bindForm();

        renderHistory();


        debug(
            "API BASE",
            API_BASE
        );


        debug(
            "CHAT ENDPOINT",
            CHAT_ENDPOINT
        );


        debug(
            "USER ID",
            userId
        );


        debug(
            "SESSION ID",
            sessionId
        );


        debug(
            "HISTORY COUNT",
            history.length
        );


        debug(
            "READY - Message bhejo."
        );
    }


    /* ==================================================
       PUBLIC API
    ================================================== */

    window.AtharvChat = {

        version:
            "22.0.4",

        init,

        send,

        clearChat,

        getHistory:
            () => [...history],

        getUserId:
            () => userId,

        getSessionId:
            () => sessionId,

        getLive,

        setLive,

        showToast,

        renderHistory,

        setThinking,

        debug
    };


    /* ==================================================
       AUTO INIT
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
