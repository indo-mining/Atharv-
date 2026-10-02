"use strict";

/*
=========================================================
 ATHARV AI - CHAT ENGINE
 Version 22.0.2
 --------------------------------------------------------
 - /api/chat
 - /api/chat/research
 - Groq response handling
 - Send protection
 - Failed request protection
 - Local history
 - User ID
 - Session ID
 - Live Search
 - Thinking indicator
 - Toast
=========================================================
*/

(() => {

    const VERSION = "22.0.2";

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


    /* ==================================================
       STATE
    ================================================== */

    let history = [];

    let userId = "";

    let sessionId = "";

    let liveMode = false;

    let initialized = false;


    /* ==================================================
       DOM HELPERS
    ================================================== */

    function getMessagesElement() {

        return document.getElementById(
            "messages"
        );
    }


    function getTypingElement() {

        return document.getElementById(
            "typingIndicator"
        );
    }


    /* ==================================================
       STORAGE
    ================================================== */

    function safeGet(
        key,
        fallback = null
    ) {

        try {

            const value =
                localStorage.getItem(
                    key
                );

            return value === null
                ? fallback
                : value;

        } catch {

            return fallback;
        }
    }


    function safeSet(
        key,
        value
    ) {

        try {

            localStorage.setItem(
                key,
                value
            );

            return true;

        } catch {

            return false;
        }
    }


    function safeRemove(
        key
    ) {

        try {

            localStorage.removeItem(
                key
            );

        } catch {}
    }


    /* ==================================================
       ID
    ================================================== */

    function createId(
        prefix
    ) {

        return (
            prefix +
            "_" +
            Date.now().toString(36) +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }


    function loadIdentity() {

        userId =
            safeGet(
                USER_ID_KEY,
                ""
            );


        if (!userId) {

            userId =
                createId(
                    "user"
                );

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
                createId(
                    "session"
                );

            safeSet(
                SESSION_ID_KEY,
                sessionId
            );
        }
    }


    /* ==================================================
       HISTORY
    ================================================== */

    function loadHistory() {

        try {

            const raw =
                safeGet(
                    HISTORY_KEY,
                    "[]"
                );


            const parsed =
                JSON.parse(
                    raw
                );


            if (
                Array.isArray(
                    parsed
                )
            ) {

                history =
                    parsed
                        .filter(
                            item =>
                                item &&
                                (
                                    item.role ===
                                        "user" ||
                                    item.role ===
                                        "assistant"
                                ) &&
                                typeof item.content ===
                                    "string"
                        )
                        .slice(
                            -100
                        );

            } else {

                history = [];

            }

        } catch {

            history = [];
        }
    }


    function saveHistory() {

        try {

            safeSet(
                HISTORY_KEY,
                JSON.stringify(
                    history.slice(
                        -100
                    )
                )
            );

        } catch {}
    }


    /* ==================================================
       LIVE MODE
    ================================================== */

    function loadLiveMode() {

        liveMode =
            safeGet(
                LIVE_KEY,
                "false"
            ) === "true";
    }


    function setLive(
        enabled
    ) {

        liveMode =
            Boolean(
                enabled
            );

        safeSet(
            LIVE_KEY,
            String(
                liveMode
            )
        );
    }


    function getLive() {

        return liveMode;
    }


    /* ==================================================
       MARKDOWN
    ================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value || ""
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


    function renderMarkdown(
        text
    ) {

        let value =
            escapeHtml(
                text
            );


        const codeBlocks = [];


        value =
            value.replace(
                /```([\s\S]*?)```/g,
                (
                    match,
                    code
                ) => {

                    const token =
                        `___ATHARV_CODE_${codeBlocks.length}___`;

                    codeBlocks.push(
                        `<pre><code>${code.trim()}</code></pre>`
                    );

                    return token;
                }
            );


        value =
            value.replace(
                /\*\*(.*?)\*\*/g,
                "<strong>$1</strong>"
            );


        value =
            value.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );


        value =
            value.replace(
                /^### (.*)$/gm,
                "<h4>$1</h4>"
            );


        value =
            value.replace(
                /^## (.*)$/gm,
                "<h3>$1</h3>"
            );


        value =
            value.replace(
                /^# (.*)$/gm,
                "<h2>$1</h2>"
            );


        value =
            value.replace(
                /\n/g,
                "<br>"
            );


        codeBlocks.forEach(
            (
                block,
                index
            ) => {

                value =
                    value.replace(
                        `___ATHARV_CODE_${index}___`,
                        block
                    );
            }
        );


        return value;
    }


    /* ==================================================
       RENDER
    ================================================== */

    function renderMessage(
        role,
        content
    ) {

        const container =
            getMessagesElement();


        if (!container) {
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


        container.appendChild(
            wrapper
        );


        container.scrollTop =
            container.scrollHeight;
    }


    function renderHistory() {

        const container =
            getMessagesElement();


        if (!container) {
            return;
        }


        container.innerHTML =
            "";


        history.forEach(
            item => {

                renderMessage(
                    item.role,
                    item.content
                );
            }
        );
    }


    /* ==================================================
       THINKING
    ================================================== */

    function setThinking(
        active
    ) {

        const element =
            getTypingElement();


        if (!element) {
            return;
        }


        element.classList.toggle(
            "show",
            Boolean(
                active
            )
        );


        element.setAttribute(
            "aria-hidden",
            active
                ? "false"
                : "true"
        );


        const container =
            getMessagesElement();


        if (
            active &&
            container
        ) {

            container.scrollTop =
                container.scrollHeight;
        }
    }


    /* ==================================================
       TOAST
    ================================================== */

    function showToast(
        message
    ) {

        const text =
            String(
                message ||
                ""
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
                3500
            );
    }


    /* ==================================================
       REQUEST
    ================================================== */

    async function request(
        url,
        payload
    ) {

        console.log(
            "[Atharv AI] Request:",
            url
        );


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
                    url,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Accept:
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


            const text =
                await response.text();


            let data = null;


            try {

                data =
                    text
                        ? JSON.parse(
                            text
                        )
                        : {};

            } catch {

                data = {
                    raw: text
                };
            }


            console.log(
                "[Atharv AI] Response:",
                response.status,
                data
            );


            if (
                !response.ok
            ) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    `Server error (${response.status})`
                );
            }


            if (
                data?.ok === false
            ) {

                throw new Error(
                    data?.error ||
                    "AI request failed."
                );
            }


            return data;

        } catch (
            error
        ) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timed out. Please try again."
                );
            }


            throw error;

        } finally {

            clearTimeout(
                timeout
            );
        }
    }


    /* ==================================================
       EXTRACT REPLY
    ================================================== */

    function extractReply(
        data
    ) {

        const reply =
            data?.reply ??
            data?.message ??
            data?.content ??
            data?.answer ??
            "";


        if (
            typeof reply !==
                "string"
        ) {

            return "";
        }


        return reply.trim();
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

                history:
                    previousHistory,

                userId,

                sessionId
            }
        );
    }


    /* ==================================================
       RESEARCH CHAT
    ================================================== */

    async function researchChat(
        message,
        previousHistory
    ) {

        return request(
            RESEARCH_ENDPOINT,
            {
                message,

                history:
                    previousHistory,

                userId,

                sessionId
            }
        );
    }


    /* ==================================================
       SEND
    ================================================== */

    async function send(
        userMessage
    ) {

        const message =
            String(
                userMessage ||
                ""
            ).trim();


        if (!message) {

            showToast(
                "Message empty hai."
            );

            return false;
        }


        if (
            message.length >
            12000
        ) {

            showToast(
                "Message bahut lamba hai."
            );

            return false;
        }


        /*
         * User message ko local history mein
         * request se pehle save karte hain.
         */
        const previousHistory =
            history.slice(
                -20
            );


        history.push({
            role:
                "user",

            content:
                message
        });


        saveHistory();

        renderHistory();

        setThinking(
            true
        );


        try {

            let data;


            if (
                liveMode
            ) {

                try {

                    data =
                        await researchChat(
                            message,
                            previousHistory
                        );

                } catch (
                    researchError
                ) {

                    console.warn(
                        "Live Search failed, using normal AI:",
                        researchError
                    );


                    showToast(
                        "Live Search unavailable. Normal AI se answer de raha hoon."
                    );


                    data =
                        await normalChat(
                            message,
                            previousHistory
                        );
                }

            } else {

                data =
                    await normalChat(
                        message,
                        previousHistory
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


            history.push({
                role:
                    "assistant",

                content:
                    reply
            });


            saveHistory();

            renderHistory();


            return true;

        } catch (
            error
        ) {

            console.error(
                "[Atharv AI] CHAT SEND ERROR:",
                error
            );


            /*
             * Failed request ko assistant
             * history mein add nahi karna.
             *
             * User ka typed message composer
             * mein bana rahega.
             */
            history =
                history.filter(
                    (
                        item,
                        index
                    ) =>
                        !(
                            index ===
                                history.length - 1 &&
                            item.role ===
                                "user" &&
                            item.content ===
                                message
                        )
                );


            saveHistory();

            renderHistory();


            showToast(
                error?.message ||
                "Message send nahi hua."
            );


            return false;

        } finally {

            setThinking(
                false
            );
        }
    }


    /* ==================================================
       CLEAR CHAT
    ================================================== */

    function clearChat() {

        history = [];

        saveHistory();

        renderHistory();

        setThinking(
            false
        );
    }


    /* ==================================================
       INIT
    ================================================== */

    function init() {

        if (
            initialized
        ) {
            renderHistory();
            return;
        }


        initialized =
            true;


        loadIdentity();

        loadHistory();

        loadLiveMode();

        renderHistory();


        console.log(
            `[Atharv AI] Chat engine ${VERSION} initialized`,
            {
                API_BASE,
                userId,
                sessionId,
                liveMode
            }
        );
    }


    /* ==================================================
       PUBLIC API
    ================================================== */

    window.AtharvChat = {

        version:
            VERSION,

        init,

        send,

        clearChat,

        getHistory: () =>
            [...history],

        getUserId: () =>
            userId,

        getSessionId: () =>
            sessionId,

        getLive,

        setLive,

        showToast,

        renderHistory,

        setThinking
    };

})();
