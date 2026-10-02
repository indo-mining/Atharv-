"use strict";

/*
=========================================================
 ATHARV AI - CHAT ENGINE
 Version 22.0.0
 --------------------------------------------------------
 - API communication
 - Chat history
 - Live Search
 - Memory-compatible
 - Typing indicator
 - Markdown rendering
 - Copy
 - Regenerate
 - Error handling
 - Long request timeout
=========================================================
*/

(() => {

    const VERSION = "22.0.0";

    const API_BASE =
        window.location.origin;

    const CHAT_ENDPOINT =
        `${API_BASE}/api/chat`;

    const RESEARCH_ENDPOINT =
        `${API_BASE}/api/chat/research`;

    const HISTORY_KEY =
        "atharv_chat_history_v22";

    const USER_ID_KEY =
        "atharv_user_id_v22";

    const SESSION_KEY =
        "atharv_session_id_v22";

    const LIVE_KEY =
        "atharv_live_mode_v22";

    const REQUEST_TIMEOUT =
        175000;


    /* ==================================================
       DOM
    ================================================== */

    const get = id =>
        document.getElementById(id);


    const messagesEl =
        get("messages");

    const welcomeEl =
        get("welcome");

    const typingEl =
        get("typingIndicator");

    const messageInput =
        get("messageInput");


    /* ==================================================
       USER ID
    ================================================== */

    function createId(prefix) {
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


    function getUserId() {

        try {

            let id =
                localStorage.getItem(
                    USER_ID_KEY
                );

            if (!id) {

                id = createId("user");

                localStorage.setItem(
                    USER_ID_KEY,
                    id
                );
            }

            return id;

        } catch {

            return "guest";
        }
    }


    function getSessionId() {

        try {

            let id =
                localStorage.getItem(
                    SESSION_KEY
                );

            if (!id) {

                id = createId("session");

                localStorage.setItem(
                    SESSION_KEY,
                    id
                );
            }

            return id;

        } catch {

            return "session";
        }
    }


    /* ==================================================
       STORAGE
    ================================================== */

    function readHistory() {

        try {

            const raw =
                localStorage.getItem(
                    HISTORY_KEY
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            return Array.isArray(parsed)
                ? parsed
                : [];

        } catch {

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

        } catch {
            // Ignore local storage errors.
        }
    }


    let history =
        readHistory();


    /* ==================================================
       LIVE MODE
    ================================================== */

    let liveMode = false;

    try {
        liveMode =
            localStorage.getItem(
                LIVE_KEY
            ) === "true";
    } catch {
        liveMode = false;
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

        let value =
            escapeHtml(text);


        const codeBlocks = [];

        value =
            value.replace(
                /```([\w+-]*)\n?([\s\S]*?)```/g,
                (_, language, code) => {

                    const index =
                        codeBlocks.length;

                    codeBlocks.push({
                        language:
                            language || "",
                        code
                    });

                    return `@@CODEBLOCK_${index}@@`;
                }
            );


        value =
            value.replace(
                /`([^`]+)`/g,
                "<code>$1</code>"
            );


        value =
            value.replace(
                /\*\*(.+?)\*\*/g,
                "<strong>$1</strong>"
            );


        value =
            value.replace(
                /\*(.+?)\*/g,
                "<em>$1</em>"
            );


        value =
            value.replace(
                /^### (.+)$/gm,
                "<h4>$1</h4>"
            );


        value =
            value.replace(
                /^## (.+)$/gm,
                "<h3>$1</h3>"
            );


        value =
            value.replace(
                /^# (.+)$/gm,
                "<h2>$1</h2>"
            );


        value =
            value.replace(
                /^[-*] (.+)$/gm,
                "<li>$1</li>"
            );


        value =
            value.replace(
                /(<li>.*<\/li>)/gs,
                "<ul>$1</ul>"
            );


        value =
            value.replace(
                /\n/g,
                "<br>"
            );


        codeBlocks.forEach(
            (block, index) => {

                const html =
                    `<pre><code>${block.code}</code></pre>`;

                value =
                    value.replace(
                        `@@CODEBLOCK_${index}@@`,
                        html
                    );
            }
        );


        return value;
    }


    /* ==================================================
       MESSAGE RENDER
    ================================================== */

    function renderMessage(
        role,
        content,
        index
    ) {

        const wrapper =
            document.createElement(
                "article"
            );

        wrapper.className =
            `message-row ${role}`;

        wrapper.dataset.index =
            String(index);


        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "message-avatar";

        avatar.textContent =
            role === "user"
                ? "You"
                : "A";


        const body =
            document.createElement(
                "div"
            );

        body.className =
            "message-content";


        const text =
            document.createElement(
                "div"
            );

        text.className =
            "message-text";

        text.innerHTML =
            renderMarkdown(content);


        body.appendChild(text);


        if (role === "assistant") {

            const actions =
                document.createElement(
                    "div"
                );

            actions.className =
                "message-actions";


            const copyButton =
                document.createElement(
                    "button"
                );

            copyButton.type =
                "button";

            copyButton.className =
                "message-action";

            copyButton.textContent =
                "Copy";

            copyButton.addEventListener(
                "click",
                () =>
                    copyText(content)
            );


            const regenerate =
                document.createElement(
                    "button"
                );

            regenerate.type =
                "button";

            regenerate.className =
                "message-action";

            regenerate.textContent =
                "Regenerate";

            regenerate.addEventListener(
                "click",
                () =>
                    regenerateMessage(
                        index
                    )
            );


            actions.appendChild(
                copyButton
            );

            actions.appendChild(
                regenerate
            );

            body.appendChild(
                actions
            );
        }


        wrapper.appendChild(
            avatar
        );

        wrapper.appendChild(
            body
        );

        messagesEl.appendChild(
            wrapper
        );
    }


    function renderAll() {

        if (!messagesEl) {
            return;
        }

        messagesEl.innerHTML = "";

        history.forEach(
            (item, index) => {

                renderMessage(
                    item.role,
                    item.content,
                    index
                );
            }
        );

        if (welcomeEl) {

            welcomeEl.classList.toggle(
                "hidden",
                history.length > 0
            );
        }

        scrollToBottom();
    }


    /* ==================================================
       SCROLL
    ================================================== */

    function scrollToBottom() {

        requestAnimationFrame(() => {

            const chatArea =
                get("chatArea");

            if (chatArea) {

                chatArea.scrollTo({
                    top:
                        chatArea.scrollHeight,
                    behavior: "smooth"
                });
            }

            window.scrollTo({
                top:
                    document.body.scrollHeight,
                behavior: "smooth"
            });
        });
    }


    /* ==================================================
       TYPING
    ================================================== */

    function setThinking(
        visible
    ) {

        if (!typingEl) {
            return;
        }

        typingEl.classList.toggle(
            "hidden",
            !visible
        );

        if (visible) {
            scrollToBottom();
        }
    }


    /* ==================================================
       FETCH
    ================================================== */

    async function request(
        endpoint,
        payload
    ) {

        const controller =
            new AbortController();

        const timer =
            setTimeout(
                () =>
                    controller.abort(),
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


            const raw =
                await response.text();


            let data = {};

            try {
                data =
                    raw
                        ? JSON.parse(raw)
                        : {};
            } catch {
                data = {
                    raw
                };
            }


            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    data?.raw ||
                    `HTTP ${response.status}`
                );
            }


            return data;

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Request timeout. AI server took too long to respond."
                );
            }

            throw error;

        } finally {

            clearTimeout(timer);
        }
    }


    /* ==================================================
       EXTRACT REPLY
    ================================================== */

    function extractReply(data) {

        const candidates = [
            data?.reply,
            data?.message,
            data?.content,
            data?.answer,
            data?.data?.reply,
            data?.data?.message,
            data?.data?.content
        ];


        for (
            const candidate
            of candidates
        ) {

            if (
                typeof candidate ===
                    "string" &&
                candidate.trim()
            ) {

                return candidate.trim();
            }
        }


        return "";
    }


    /* ==================================================
       SEND
    ================================================== */

    async function send(
        userMessage
    ) {

        const message =
            String(
                userMessage || ""
            ).trim();


        if (!message) {
            return false;
        }


        if (
            message.length >
            12000
        ) {

            showToast(
                "Message is too long."
            );

            return false;
        }


        history.push({
            role: "user",
            content: message,
            timestamp:
                new Date().toISOString()
        });


        saveHistory(history);

        renderAll();

        setThinking(true);


        try {

            const payload = {

                message,

                history:
                    history
                        .slice(
                            -21,
                            -1
                        ),

                userId:
                    getUserId(),

                sessionId:
                    getSessionId()
            };


            let data;


            if (liveMode) {

                try {

                    data =
                        await request(
                            RESEARCH_ENDPOINT,
                            payload
                        );

                } catch (researchError) {

                    console.warn(
                        "Live search failed. Trying normal chat.",
                        researchError
                    );

                    data =
                        await request(
                            CHAT_ENDPOINT,
                            payload
                        );
                }

            } else {

                data =
                    await request(
                        CHAT_ENDPOINT,
                        payload
                    );
            }


            const reply =
                extractReply(data);


            if (!reply) {

                throw new Error(
                    "AI returned an empty response."
                );
            }


            history.push({
                role: "assistant",
                content: reply,
                timestamp:
                    new Date().toISOString()
            });


            saveHistory(history);

            renderAll();

            return true;

        } catch (error) {

            console.error(
                "ATHARV CHAT ERROR:",
                error
            );


            const errorText =
                `Sorry, I couldn't complete that request.\n\n${error.message}`;


            history.push({
                role: "assistant",
                content: errorText,
                timestamp:
                    new Date().toISOString(),
                error: true
            });


            saveHistory(history);

            renderAll();


            showToast(
                error.message ||
                "Something went wrong."
            );


            return false;

        } finally {

            setThinking(false);
        }
    }


    /* ==================================================
       CLEAR
    ================================================== */

    function clearChat() {

        history = [];

        saveHistory(history);

        renderAll();

        showToast(
            "New chat started."
        );
    }


    /* ==================================================
       REGENERATE
    ================================================== */

    async function regenerateMessage(
        assistantIndex
    ) {

        if (
            assistantIndex < 0 ||
            assistantIndex >= history.length
        ) {
            return;
        }


        if (
            history[assistantIndex]?.role !==
            "assistant"
        ) {
            return;
        }


        let userIndex =
            assistantIndex - 1;


        while (
            userIndex >= 0 &&
            history[userIndex].role !==
                "user"
        ) {
            userIndex--;
        }


        if (userIndex < 0) {
            return;
        }


        const userMessage =
            history[userIndex].content;


        history.splice(
            assistantIndex,
            1
        );


        saveHistory(history);

        renderAll();


        await sendRegeneration(
            userMessage
        );
    }


    async function sendRegeneration(
        message
    ) {

        setThinking(true);

        try {

            const payload = {

                message,

                history:
                    history.slice(-20),

                userId:
                    getUserId(),

                sessionId:
                    getSessionId()
            };


            const data =
                liveMode
                    ? await request(
                        RESEARCH_ENDPOINT,
                        payload
                    )
                    : await request(
                        CHAT_ENDPOINT,
                        payload
                    );


            const reply =
                extractReply(data);


            if (!reply) {
                throw new Error(
                    "AI returned an empty response."
                );
            }


            history.push({
                role: "assistant",
                content: reply,
                timestamp:
                    new Date().toISOString()
            });


            saveHistory(history);

            renderAll();

        } catch (error) {

            showToast(
                error.message ||
                "Regeneration failed."
            );

        } finally {

            setThinking(false);
        }
    }


    /* ==================================================
       COPY
    ================================================== */

    async function copyText(
        text
    ) {

        try {

            await navigator.clipboard.writeText(
                text
            );

            showToast(
                "Copied."
            );

        } catch {

            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value = text;

            document.body.appendChild(
                textarea
            );

            textarea.select();

            document.execCommand(
                "copy"
            );

            textarea.remove();

            showToast(
                "Copied."
            );
        }
    }


    /* ==================================================
       TOAST
    ================================================== */

    let toastTimer = null;

    function showToast(
        message
    ) {

        const toast =
            get("toast");

        if (!toast) {
            return;
        }

        toast.textContent =
            String(message || "");

        toast.classList.add(
            "show"
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "show"
                );

            }, 3000);
    }


    /* ==================================================
       PUBLIC API
    ================================================== */

    window.AtharvChat = {

        version: VERSION,

        init() {

            getUserId();

            getSessionId();

            renderAll();

        },

        send,

        clearChat,

        getHistory() {
            return [...history];
        },

        setLive(value) {

            liveMode =
                Boolean(value);

            try {

                localStorage.setItem(
                    LIVE_KEY,
                    String(liveMode)
                );

            } catch {}

            return liveMode;
        },

        getLive() {
            return liveMode;
        },

        getUserId,

        showToast
    };

})();
