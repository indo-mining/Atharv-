"use strict";

/*
=========================================================
 ATHARV AI - CHAT ENGINE
 Version 22.0.1
 --------------------------------------------------------
 - API communication
 - Chat history
 - Persistent user ID
 - Session ID
 - Live Search
 - Request timeout
 - Error handling
 - Safe failed-message handling
=========================================================
*/

(() => {

    const VERSION = "22.0.1";

    /* ==========================================
       CONFIG
    ========================================== */

    const API_BASE =
        window.location.origin;

    const CHAT_ENDPOINT =
        `${API_BASE}/api/chat`;

    const RESEARCH_ENDPOINT =
        `${API_BASE}/api/chat/research`;

    const REQUEST_TIMEOUT =
        175000;

    const HISTORY_KEY =
        "atharv_chat_history_v22";

    const USER_ID_KEY =
        "atharv_user_id_v22";

    const SESSION_ID_KEY =
        "atharv_session_id_v22";

    const LIVE_KEY =
        "atharv_live_mode_v22";


    /* ==========================================
       STATE
    ========================================== */

    let history = [];

    let userId = "";

    let sessionId = "";

    let liveMode = false;

    let initialized = false;


    /* ==========================================
       SAFE RANDOM ID
    ========================================== */

    function randomId(prefix) {

        try {

            if (
                window.crypto &&
                typeof window.crypto.randomUUID ===
                    "function"
            ) {

                return `${prefix}_${window.crypto.randomUUID()}`;
            }

        } catch (error) {

            console.warn(
                "crypto.randomUUID unavailable:",
                error
            );
        }


        return (
            `${prefix}_` +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 12)
        );
    }


    /* ==========================================
       STORAGE READ
    ========================================== */

    function readStorage(
        key,
        fallback
    ) {

        try {

            const value =
                localStorage.getItem(key);


            if (
                value === null ||
                value === undefined
            ) {

                return fallback;
            }


            return value;

        } catch (error) {

            console.warn(
                "Storage read failed:",
                key,
                error
            );

            return fallback;
        }
    }


    /* ==========================================
       STORAGE JSON READ
    ========================================== */

    function readJSON(
        key,
        fallback
    ) {

        try {

            const raw =
                localStorage.getItem(key);


            if (!raw) {
                return fallback;
            }


            const parsed =
                JSON.parse(raw);


            return parsed;

        } catch (error) {

            console.warn(
                "JSON storage read failed:",
                key,
                error
            );

            return fallback;
        }
    }


    /* ==========================================
       STORAGE WRITE
    ========================================== */

    function writeStorage(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                value
            );

            return true;

        } catch (error) {

            console.warn(
                "Storage write failed:",
                key,
                error
            );

            return false;
        }
    }


    /* ==========================================
       SAVE HISTORY
    ========================================== */

    function saveHistory() {

        try {

            /*
             * Keep browser storage under control.
             */

            const limited =
                history.slice(-100);


            writeStorage(
                HISTORY_KEY,
                JSON.stringify(limited)
            );

        } catch (error) {

            console.warn(
                "History save failed:",
                error
            );
        }
    }


    /* ==========================================
       LOAD HISTORY
    ========================================== */

    function loadHistory() {

        const stored =
            readJSON(
                HISTORY_KEY,
                []
            );


        if (
            !Array.isArray(stored)
        ) {

            history = [];

            return;
        }


        history =
            stored
                .filter(
                    item =>
                        item &&
                        typeof item ===
                            "object"
                )
                .map(
                    item => {

                        return {
                            role:
                                item.role ===
                                    "assistant"
                                    ? "assistant"
                                    : "user",

                            content:
                                String(
                                    item.content ||
                                    ""
                                ),

                            timestamp:
                                item.timestamp ||
                                Date.now()
                        };

                    }
                )
                .filter(
                    item =>
                        item.content.trim()
                )
                .slice(-100);
    }


    /* ==========================================
       USER ID
    ========================================== */

    function getOrCreateUserId() {

        let id =
            readStorage(
                USER_ID_KEY,
                ""
            );


        if (
            !id ||
            id === "null" ||
            id === "undefined"
        ) {

            id =
                randomId(
                    "user"
                );


            writeStorage(
                USER_ID_KEY,
                id
            );
        }


        return id;
    }


    /* ==========================================
       SESSION ID
    ========================================== */

    function getOrCreateSessionId() {

        let id =
            readStorage(
                SESSION_ID_KEY,
                ""
            );


        if (
            !id ||
            id === "null" ||
            id === "undefined"
        ) {

            id =
                randomId(
                    "session"
                );


            writeStorage(
                SESSION_ID_KEY,
                id
            );
        }


        return id;
    }


    /* ==========================================
       LIVE MODE
    ========================================== */

    function loadLiveMode() {

        const value =
            readStorage(
                LIVE_KEY,
                "false"
            );


        liveMode =
            value === "true";
    }


    function saveLiveMode() {

        writeStorage(
            LIVE_KEY,
            liveMode
                ? "true"
                : "false"
        );
    }


    /* ==========================================
       UI HELPERS
    ========================================== */

    function getElement(id) {

        return document.getElementById(id);
    }


    function showWelcome() {

        const welcome =
            getElement(
                "welcome"
            );

        if (welcome) {

            welcome.classList.remove(
                "hidden"
            );
        }
    }


    function hideWelcome() {

        const welcome =
            getElement(
                "welcome"
            );

        if (welcome) {

            welcome.classList.add(
                "hidden"
            );
        }
    }


    /* ==========================================
       ESCAPE HTML
    ========================================== */

    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* ==========================================
       BASIC MARKDOWN
    ========================================== */

    function renderMarkdown(
        value
    ) {

        let text =
            escapeHTML(
                value
            );


        /*
         * Code blocks
         */

        text =
            text.replace(
                /```([\s\S]*?)```/g,
                (
                    match,
                    code
                ) => {

                    return `
                        <pre class="code-block"><code>${code.trim()}</code></pre>
                    `;
                }
            );


        /*
         * Inline code
         */

        text =
            text.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );


        /*
         * Bold
         */

        text =
            text.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );


        /*
         * Italic
         */

        text =
            text.replace(
                /(^|[^\*])\*([^*]+)\*/g,
                "$1<em>$2</em>"
            );


        /*
         * Links
         */

        text =
            text.replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );


        /*
         * Line breaks
         */

        text =
            text.replace(
                /\n/g,
                "<br>"
            );


        return text;
    }


    /* ==========================================
       RENDER HISTORY
    ========================================== */

    function renderHistory() {

        const messages =
            getElement(
                "messages"
            );


        if (!messages) {
            return;
        }


        messages.innerHTML =
            "";


        if (!history.length) {

            showWelcome();

            return;
        }


        hideWelcome();


        history.forEach(
            message => {

                renderMessage(
                    message.role,
                    message.content
                );
            }
        );


        scrollToBottom();
    }


    /* ==========================================
       RENDER MESSAGE
    ========================================== */

    function renderMessage(
        role,
        content
    ) {

        const messages =
            getElement(
                "messages"
            );


        if (!messages) {
            return;
        }


        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            `message-row ${role}`;


        const bubble =
            document.createElement(
                "div"
            );


        bubble.className =
            "message-bubble";


        if (
            role === "assistant"
        ) {

            bubble.innerHTML =
                renderMarkdown(
                    content
                );

        } else {

            bubble.textContent =
                content;
        }


        wrapper.appendChild(
            bubble
        );


        messages.appendChild(
            wrapper
        );
    }


    /* ==========================================
       SCROLL
    ========================================== */

    function scrollToBottom() {

        const messages =
            getElement(
                "messages"
            );


        if (!messages) {
            return;
        }


        requestAnimationFrame(
            () => {

                messages.scrollTop =
                    messages.scrollHeight;
            }
        );
    }


    /* ==========================================
       THINKING INDICATOR
    ========================================== */

    function setThinking(
        visible
    ) {

        const indicator =
            getElement(
                "typingIndicator"
            );


        if (!indicator) {
            return;
        }


        if (visible) {

            indicator.classList.add(
                "show"
            );

        } else {

            indicator.classList.remove(
                "show"
            );
        }


        if (visible) {
            scrollToBottom();
        }
    }


    /* ==========================================
       REQUEST
    ========================================== */

    async function request(
        endpoint,
        payload
    ) {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                REQUEST_TIMEOUT
            );


        try {

            const response =
                await fetch(
                    endpoint,
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


            let data = null;

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";


            if (
                contentType.includes(
                    "application/json"
                )
            ) {

                try {

                    data =
                        await response.json();

                } catch (error) {

                    throw new Error(
                        "Server returned invalid JSON."
                    );
                }

            } else {

                const text =
                    await response.text();


                data = {
                    error:
                        text ||
                        "Server returned an unexpected response."
                };
            }


            if (!response.ok) {

                const errorMessage =
                    data?.error ||
                    data?.message ||
                    `Request failed with status ${response.status}.`;


                throw new Error(
                    errorMessage
                );
            }


            return data;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timeout. AI server took too long to respond."
                );
            }


            if (
                error instanceof TypeError
            ) {

                throw new Error(
                    "Network error. Atharv AI server se connection nahi ho pa raha."
                );
            }


            throw error;

        } finally {

            clearTimeout(
                timeout
            );
        }
    }


    /* ==========================================
       EXTRACT REPLY
    ========================================== */

    function extractReply(
        data
    ) {

        if (!data) {
            return "";
        }


        const possible =
            [
                data.reply,
                data.message,
                data.content,
                data.answer,
                data.response
            ];


        for (
            const value of possible
        ) {

            if (
                typeof value ===
                    "string" &&
                value.trim()
            ) {

                return value.trim();
            }
        }


        /*
         * Some APIs return:
         * { choices: [{ message: { content } }] }
         */

        const choiceContent =
            data?.choices?.[0]?.message?.content;


        if (
            typeof choiceContent ===
                "string" &&
            choiceContent.trim()
        ) {

            return choiceContent.trim();
        }


        return "";
    }


    /* ==========================================
       ADD HISTORY
    ========================================== */

    function addHistory(
        role,
        content
    ) {

        if (
            !content ||
            !String(content).trim()
        ) {

            return;
        }


        history.push({

            role:
                role === "assistant"
                    ? "assistant"
                    : "user",

            content:
                String(
                    content
                ),

            timestamp:
                Date.now()
        });


        /*
         * Keep maximum 100 messages.
         */

        history =
            history.slice(-100);


        saveHistory();
    }


    /* ==========================================
       SEND CHAT
    ========================================== */

    async function send(
        userMessage
    ) {

        const message =
            String(
                userMessage ?? ""
            ).trim();


        if (!message) {

            showToast(
                "Message empty hai."
            );

            return false;
        }


        /*
         * Frontend safety limit.
         */

        if (
            message.length >
            12000
        ) {

            showToast(
                "Message bahut long hai. Please thoda short karo."
            );

            return false;
        }


        /*
         * IMPORTANT:
         *
         * User message ko history mein request
         * se pehle add kar rahe hain, lekin agar
         * API fail hoti hai to catch mein us
         * failed message ko remove kar diya jayega.
         */

        const historyBeforeSend =
            history.slice();


        addHistory(
            "user",
            message
        );


        renderHistory();

        setThinking(
            true
        );


        /*
         * Backend ko current user message se pehle
         * wali conversation bhejni hai.
         */

        const previousHistory =
            historyBeforeSend
                .slice(-20)
                .map(
                    item => ({
                        role:
                            item.role,
                        content:
                            item.content
                    })
                );


        const payload = {

            message,

            history:
                previousHistory,

            userId,

            sessionId
        };


        try {

            let data;


            /* ======================================
               LIVE SEARCH
            ====================================== */

            if (liveMode) {

                try {

                    data =
                        await request(
                            RESEARCH_ENDPOINT,
                            payload
                        );

                } catch (researchError) {

                    console.warn(
                        "Live research failed. Falling back to normal chat:",
                        researchError
                    );


                    /*
                     * Research fail hone par normal
                     * chat try hoga.
                     */

                    data =
                        await request(
                            CHAT_ENDPOINT,
                            payload
                        );
                }

            } else {

                /* ==================================
                   NORMAL CHAT
                ================================== */

                data =
                    await request(
                        CHAT_ENDPOINT,
                        payload
                    );
            }


            const reply =
                extractReply(
                    data
                );


            if (!reply) {

                throw new Error(
                    "Atharv ne empty response diya."
                );
            }


            /* ======================================
               SUCCESS
            ====================================== */

            addHistory(
                "assistant",
                reply
            );


            renderHistory();


            return true;


        } catch (error) {

            /*
             * =================================================
             * IMPORTANT CORRECTION
             * =================================================
             *
             * Failure par error ko assistant message ke
             * roop mein history mein ADD NAHI karna.
             *
             * Isse actual API/network problem hide nahi hogi.
             *
             * User ka original message bhi failed history se
             * remove kar diya jayega.
             * app.js original message ko textbox mein rakhega.
             * =================================================
             */


            history =
                historyBeforeSend.slice();


            saveHistory();

            renderHistory();


            console.error(
                "Atharv chat request failed:",
                error
            );


            const message =
                error?.message ||
                "Message send nahi hua.";


            showToast(
                message
            );


            return false;


        } finally {

            setThinking(
                false
            );
        }
    }


    /* ==========================================
       CLEAR CHAT
    ========================================== */

    function clearChat() {

        history = [];

        saveHistory();

        renderHistory();

        showWelcome();
    }


    /* ==========================================
       GET HISTORY
    ========================================== */

    function getHistory() {

        return history.slice();
    }


    /* ==========================================
       GET USER ID
    ========================================== */

    function getUserId() {

        return userId;
    }


    /* ==========================================
       GET SESSION ID
    ========================================== */

    function getSessionId() {

        return sessionId;
    }


    /* ==========================================
       LIVE GET
    ========================================== */

    function getLive() {

        return liveMode;
    }


    /* ==========================================
       LIVE SET
    ========================================== */

    function setLive(
        enabled
    ) {

        liveMode =
            Boolean(
                enabled
            );

        saveLiveMode();
    }


    /* ==========================================
       TOAST
    ========================================== */

    function showToast(
        message
    ) {

        const text =
            String(
                message || ""
            ).trim();


        if (!text) {
            return;
        }


        let toast =
            document.getElementById(
                "atharvToast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );


            toast.id =
                "atharvToast";


            toast.className =
                "atharv-toast";


            document.body.appendChild(
                toast
            );
        }


        toast.textContent =
            text;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            toast._timer
        );


        toast._timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                4000
            );
    }


    /* ==========================================
       INIT
    ========================================== */

    function init() {

        if (initialized) {
            return;
        }


        initialized = true;


        userId =
            getOrCreateUserId();


        sessionId =
            getOrCreateSessionId();


        loadLiveMode();

        loadHistory();

        renderHistory();


        console.log(
            `Atharv Chat ${VERSION} initialized`,
            {
                userId,
                sessionId,
                liveMode
            }
        );
    }


    /* ==========================================
       PUBLIC API
    ========================================== */

    window.AtharvChat = {

        VERSION,

        init,

        send,

        clearChat,

        getHistory,

        getUserId,

        getSessionId,

        getLive,

        setLive,

        showToast

    };

})();
