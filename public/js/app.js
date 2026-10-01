"use strict";

(() => {
    /*
    =====================================================
    ATHARV AI FRONTEND
    Connected to Express backend

    Backend endpoints:
      POST /api/chat
      POST /api/chat/research
      GET  /api/memory
      GET  /health
    =====================================================
    */

    const API_BASE = window.ATHARV_API_BASE || "";
    const REQUEST_TIMEOUT = 120000;
    const MAX_MESSAGE_LENGTH = 12000;

    const STORAGE = {
        userId: "atharv_user_id_v19",
        history: "atharv_chat_history_v19",
        live: "atharv_live_mode_v19"
    };

    /* =====================================================
       DOM
    ===================================================== */

    const $ = id => document.getElementById(id);

    const chatContainer = $("chatContainer");
    const welcome = $("welcome");
    const messages = $("messages");
    const thinking = $("thinking");

    const chatForm = $("chatForm");
    const messageInput = $("messageInput");
    const sendButton = $("sendButton");

    const liveButton = $("liveButton");
    const voiceButton = $("voiceButton");

    const attachmentButton = $("attachmentButton");
    const fileInput = $("fileInput");
    const attachmentInfo = $("attachmentInfo");

    const toast = $("toast");

    const menuButton = $("menuButton");
    const menuClose = $("menuClose");
    const menuOverlay = $("menuOverlay");
    const atharvMenu = $("atharvMenu");

    const newChatButton = $("newChatButton");

    const memoryButton = $("memoryButton");
    const memoryModal = $("memoryModal");
    const closeMemoryButton = $("closeMemoryButton");
    const memoryList = $("memoryList");

    /* =====================================================
       STATE
    ===================================================== */

    let history = [];
    let sending = false;
    let selectedFiles = [];
    let editingIndex = -1;

    let liveMode =
        localStorage.getItem(STORAGE.live) === "true";

    let recognition = null;
    let listening = false;

    /* =====================================================
       USER ID
    ===================================================== */

    function getUserId() {

        let id = localStorage.getItem(STORAGE.userId);

        if (id) return id;

        if (crypto?.randomUUID) {
            id = crypto.randomUUID();
        } else {
            id =
                "atharv-" +
                Date.now() +
                "-" +
                Math.random().toString(36).slice(2);
        }

        localStorage.setItem(
            STORAGE.userId,
            id
        );

        return id;
    }

    const USER_ID = getUserId();

    /* =====================================================
       TOAST
    ===================================================== */

    function showToast(message) {

        if (!toast) {
            console.log("ATHARV:", message);
            return;
        }

        toast.textContent = String(message);
        toast.classList.add("show");

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    /* =====================================================
       ESCAPE HTML
    ===================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       SIMPLE MARKDOWN
    ===================================================== */

    function formatResponse(text) {

        let html = escapeHtml(text);

        html = html.replace(
            /```([\s\S]*?)```/g,
            (_, code) => `
                <pre class="code-block">
                    <code>${escapeHtml(code.trim())}</code>
                </pre>
            `
        );

        html = html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

        html = html.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

        html = html.replace(
            /^### (.*)$/gm,
            "<h3>$1</h3>"
        );

        html = html.replace(
            /^## (.*)$/gm,
            "<h2>$1</h2>"
        );

        html = html.replace(
            /^# (.*)$/gm,
            "<h1>$1</h1>"
        );

        html = html.replace(
            /^[-*] (.*)$/gm,
            "<li>$1</li>"
        );

        html = html.replace(
            /(<li>.*<\/li>)/gs,
            "<ul>$1</ul>"
        );

        html = html.replace(
            /\n/g,
            "<br>"
        );

        return html;
    }

    /* =====================================================
       HISTORY
    ===================================================== */

    function loadHistory() {

        try {

            const data =
                JSON.parse(
                    localStorage.getItem(
                        STORAGE.history
                    ) || "[]"
                );

            return Array.isArray(data)
                ? data
                : [];

        } catch {

            return [];
        }
    }

    function saveHistory() {

        try {

            localStorage.setItem(
                STORAGE.history,
                JSON.stringify(
                    history.slice(-100)
                )
            );

        } catch {}
    }

    /* =====================================================
       RENDER
    ===================================================== */

    function renderHistory() {

        if (!messages) return;

        messages.innerHTML = "";

        if (!history.length) {

            welcome?.classList.remove("hidden");

            return;
        }

        welcome?.classList.add("hidden");

        history.forEach(
            (item, index) => {

                const article =
                    document.createElement("article");

                article.className =
                    `message ${item.role}`;

                article.dataset.index =
                    index;

                if (item.role === "user") {

                    article.innerHTML = `
                        <div class="message-inner">

                            <div class="user-bubble">
                                ${escapeHtml(item.content)}
                            </div>

                            <div class="message-actions">

                                <button
                                    type="button"
                                    class="message-action"
                                    data-action="edit"
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="message-action"
                                    data-action="copy"
                                >
                                    Copy
                                </button>

                            </div>

                        </div>
                    `;

                } else {

                    article.innerHTML = `
                        <div class="message-inner">

                            <div class="assistant-avatar">
                                A
                            </div>

                            <div class="assistant-content">

                                ${formatResponse(
                                    item.content
                                )}

                                <div class="message-actions">

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="copy"
                                    >
                                        Copy
                                    </button>

                                    <button
                                        type="button"
                                        class="message-action"
                                        data-action="regenerate"
                                    >
                                        Regenerate
                                    </button>

                                </div>

                            </div>

                        </div>
                    `;
                }

                messages.appendChild(article);
            }
        );

        scrollToBottom(false);
    }

    /* =====================================================
       SCROLL
    ===================================================== */

    function scrollToBottom(smooth = true) {

        if (!chatContainer) return;

        requestAnimationFrame(() => {

            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: smooth ? "smooth" : "auto"
            });

        });
    }

    /* =====================================================
       THINKING
    ===================================================== */

    function setThinking(active) {

        if (!thinking) return;

        thinking.hidden = !active;
        thinking.classList.toggle(
            "hidden",
            !active
        );

        if (active) {
            scrollToBottom(true);
        }
    }

    /* =====================================================
       INPUT SIZE
    ===================================================== */

    function resizeInput() {

        if (!messageInput) return;

        messageInput.style.height = "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                160
            ) + "px";
    }

    /* =====================================================
       API REQUEST
    ===================================================== */

    async function apiRequest(
        endpoint,
        options = {}
    ) {

        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => controller.abort(),
                REQUEST_TIMEOUT
            );

        try {

            const response =
                await fetch(
                    API_BASE + endpoint,
                    {
                        ...options,

                        signal:
                            controller.signal,

                        headers: {
                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json",

                            ...(options.headers || {})
                        }
                    }
                );

            const contentType =
                response.headers.get(
                    "content-type"
                ) || "";

            let data;

            if (
                contentType.includes(
                    "application/json"
                )
            ) {

                data =
                    await response.json();

            } else {

                const text =
                    await response.text();

                data = {
                    response: text
                };
            }

            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    data?.message ||
                    data?.detail ||
                    data?.response ||
                    `Server error ${response.status}`
                );
            }

            return data;

        } catch (error) {

            if (
                error.name === "AbortError"
            ) {

                throw new Error(
                    "Server timeout ho gaya. Backend response nahi de raha."
                );
            }

            if (
                error instanceof TypeError
            ) {

                throw new Error(
                    "Backend se connection nahi ho raha. Render server check karo."
                );
            }

            throw error;

        } finally {

            clearTimeout(timeout);
        }
    }

    /* =====================================================
       EXTRACT AI ANSWER
    ===================================================== */

    function extractAnswer(data) {

        if (!data) return "";

        const possible = [
            data.answer,
            data.response,
            data.reply,
            data.message,
            data.content,
            data.text,
            data.result,
            data.output
        ];

        for (const value of possible) {

            if (
                typeof value === "string" &&
                value.trim()
            ) {

                return value.trim();
            }
        }

        if (
            data.data &&
            typeof data.data === "object"
        ) {

            return extractAnswer(
                data.data
            );
        }

        return "";
    }

    /* =====================================================
       SEND MESSAGE
    ===================================================== */

    async function sendMessage(
        forcedMessage = null,
        options = {}
    ) {

        if (sending) return;

        const raw =
            forcedMessage !== null
                ? forcedMessage
                : messageInput?.value;

        const message =
            String(raw || "").trim();

        if (!message) {

            showToast(
                "Message likho."
            );

            messageInput?.focus();

            return;
        }

        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            showToast(
                "Message bahut long hai."
            );

            return;
        }

        sending = true;

        /* ---------------------------------------------
           BUTTON LOCK
        --------------------------------------------- */

        if (sendButton) {

            sendButton.disabled = true;
            sendButton.dataset.oldText =
                sendButton.textContent;

            sendButton.textContent = "...";
        }

        /* ---------------------------------------------
           CLEAR INPUT
        --------------------------------------------- */

        if (
            forcedMessage === null &&
            messageInput
        ) {

            messageInput.value = "";
            resizeInput();
        }

        /* ---------------------------------------------
           EDIT
        --------------------------------------------- */

        if (
            editingIndex >= 0 &&
            forcedMessage === null
        ) {

            history =
                history.slice(
                    0,
                    editingIndex
                );

            editingIndex = -1;
        }

        /* ---------------------------------------------
           USER MESSAGE
        --------------------------------------------- */

        history.push({
            role: "user",
            content: message
        });

        saveHistory();
        renderHistory();
        setThinking(true);

        try {

            const endpoint =
                options.live || liveMode
                    ? "/api/chat/research"
                    : "/api/chat";

            const body =
                options.live || liveMode
                    ? {
                        query: message,
                        message: message,
                        userId: USER_ID,
                        history:
                            history.slice(-12)
                    }
                    : {
                        message: message,
                        userId: USER_ID,

                        history:
                            history.slice(-12),

                        chatHistory:
                            history.slice(-12),

                        files:
                            selectedFiles.map(
                                file => ({
                                    name: file.name,
                                    type: file.type,
                                    size: file.size
                                })
                            )
                    };

            console.log(
                "ATHARV REQUEST:",
                endpoint,
                body
            );

            const data =
                await apiRequest(
                    endpoint,
                    {
                        method: "POST",
                        body:
                            JSON.stringify(body)
                    }
                );

            console.log(
                "ATHARV RESPONSE:",
                data
            );

            const answer =
                extractAnswer(data);

            if (!answer) {

                console.error(
                    "Unknown backend response:",
                    data
                );

                throw new Error(
                    "Backend ne AI response nahi bheja."
                );
            }

            /* -----------------------------------------
               ASSISTANT RESPONSE
            ----------------------------------------- */

            history.push({
                role: "assistant",
                content: answer
            });

            saveHistory();
            renderHistory();

            /* -----------------------------------------
               CLEAR FILES
            ----------------------------------------- */

            selectedFiles = [];

            if (fileInput) {
                fileInput.value = "";
            }

            if (attachmentInfo) {

                attachmentInfo.textContent = "";

                attachmentInfo.classList.add(
                    "hidden"
                );
            }

        } catch (error) {

            console.error(
                "ATHARV CHAT ERROR:",
                error
            );

            const errorText =
                error?.message ||
                "AI response nahi mila.";

            history.push({
                role: "assistant",
                content:
                    `⚠️ ${errorText}`
            });

            saveHistory();
            renderHistory();

            showToast(errorText);

        } finally {

            setThinking(false);

            sending = false;

            if (sendButton) {

                sendButton.disabled = false;

                sendButton.textContent =
                    sendButton.dataset.oldText ||
                    "➤";
            }

            resizeInput();
            messageInput?.focus();

            scrollToBottom(true);
        }
    }

    /* =====================================================
       FORM
    ===================================================== */

    chatForm?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );

    sendButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (!sending) {
                sendMessage();
            }
        }
    );

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
            ) {

                event.preventDefault();

                if (!sending) {
                    sendMessage();
                }
            }
        }
    );

    messageInput?.addEventListener(
        "input",
        resizeInput
    );

    /* =====================================================
       QUICK PROMPTS
    ===================================================== */

    document
        .querySelectorAll("[data-prompt]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    sendMessage(
                        button.dataset.prompt
                    );
                }
            );
        });

    /* =====================================================
       LIVE SEARCH
    ===================================================== */

    function updateLiveButton() {

        if (!liveButton) return;

        liveButton.classList.toggle(
            "active",
            liveMode
        );

        liveButton.setAttribute(
            "aria-pressed",
            String(liveMode)
        );
    }

    liveButton?.addEventListener(
        "click",
        () => {

            liveMode = !liveMode;

            localStorage.setItem(
                STORAGE.live,
                String(liveMode)
            );

            updateLiveButton();

            showToast(
                liveMode
                    ? "Live Search ON"
                    : "Live Search OFF"
            );
        }
    );

    /* =====================================================
       FILES
    ===================================================== */

    attachmentButton?.addEventListener(
        "click",
        () => fileInput?.click()
    );

    fileInput?.addEventListener(
        "change",
        () => {

            selectedFiles =
                Array.from(
                    fileInput.files || []
                );

            if (!selectedFiles.length) {

                attachmentInfo?.classList.add(
                    "hidden"
                );

                return;
            }

            if (attachmentInfo) {

                attachmentInfo.textContent =
                    selectedFiles
                        .map(file => file.name)
                        .join(", ");

                attachmentInfo.classList.remove(
                    "hidden"
                );
            }

            showToast(
                `${selectedFiles.length} file selected`
            );
        }
    );

    /* =====================================================
       MESSAGE ACTIONS
    ===================================================== */

    messages?.addEventListener(
        "click",
        async event => {

            const button =
                event.target.closest(
                    "[data-action]"
                );

            if (!button) return;

            const article =
                button.closest(".message");

            if (!article) return;

            const index =
                Number(article.dataset.index);

            const item =
                history[index];

            if (!item) return;

            const action =
                button.dataset.action;

            if (action === "copy") {

                try {

                    await navigator.clipboard.writeText(
                        item.content
                    );

                    showToast("Copied");

                } catch {

                    showToast(
                        "Copy failed"
                    );
                }

            } else if (
                action === "edit"
            ) {

                editingIndex = index;

                messageInput.value =
                    item.content;

                resizeInput();

                messageInput.focus();

            } else if (
                action === "regenerate"
            ) {

                let userIndex =
                    index - 1;

                while (
                    userIndex >= 0 &&
                    history[userIndex].role !==
                        "user"
                ) {

                    userIndex--;
                }

                if (userIndex < 0) return;

                const prompt =
                    history[userIndex].content;

                history =
                    history.slice(
                        0,
                        userIndex
                    );

                saveHistory();
                renderHistory();

                await sendMessage(
                    prompt
                );
            }
        }
    );

    /* =====================================================
       NEW CHAT
    ===================================================== */

    function newChat() {

        if (sending) {

            showToast(
                "Current response complete hone do."
            );

            return;
        }

        history = [];
        editingIndex = -1;

        saveHistory();
        renderHistory();

        if (messageInput) {
            messageInput.value = "";
            resizeInput();
        }

        selectedFiles = [];

        if (fileInput) {
            fileInput.value = "";
        }

        attachmentInfo?.classList.add(
            "hidden"
        );

        messageInput?.focus();

        showToast(
            "New chat started"
        );
    }

    newChatButton?.addEventListener(
        "click",
        newChat
    );

    /* =====================================================
       MEMORY
    ===================================================== */

    async function loadMemory() {

        if (!memoryModal || !memoryList) {
            return;
        }

        memoryModal.hidden = false;
        memoryModal.classList.remove(
            "hidden"
        );

        memoryList.innerHTML =
            `<div class="memory-empty">
                Loading...
            </div>`;

        try {

            const data =
                await apiRequest(
                    `/api/memory?userId=${encodeURIComponent(USER_ID)}`,
                    {
                        method: "GET"
                    }
                );

            const memories =
                Array.isArray(data)
                    ? data
                    : data.memories || [];

            if (!memories.length) {

                memoryList.innerHTML =
                    `<div class="memory-empty">
                        No saved memories yet.
                    </div>`;

                return;
            }

            memoryList.innerHTML =
                memories
                    .map(memory => {

                        const text =
                            typeof memory === "string"
                                ? memory
                                : (
                                    memory.memory ||
                                    memory.content ||
                                    memory.text ||
                                    ""
                                );

                        return `
                            <div class="memory-item">
                                ${escapeHtml(text)}
                            </div>
                        `;
                    })
                    .join("");

        } catch (error) {

            console.error(
                "MEMORY ERROR:",
                error
            );

            memoryList.innerHTML =
                `<div class="memory-empty">
                    Memory unavailable.
                </div>`;
        }
    }

    function closeMemory() {

        if (!memoryModal) return;

        memoryModal.hidden = true;

        memoryModal.classList.add(
            "hidden"
        );
    }

    memoryButton?.addEventListener(
        "click",
        loadMemory
    );

    closeMemoryButton?.addEventListener(
        "click",
        closeMemory
    );

    memoryModal
        ?.querySelector(".modal-backdrop")
        ?.addEventListener(
            "click",
            closeMemory
        );

    /* =====================================================
       MENU
    ===================================================== */

    function openMenu() {

        menuOverlay?.classList.add("open");
        atharvMenu?.classList.add("open");

        menuButton?.setAttribute(
            "aria-expanded",
            "true"
        );
    }

    function closeMenu() {

        menuOverlay?.classList.remove("open");
        atharvMenu?.classList.remove("open");

        menuButton?.setAttribute(
            "aria-expanded",
            "false"
        );
    }

    menuButton?.addEventListener(
        "click",
        () => {

            if (
                atharvMenu?.classList.contains(
                    "open"
                )
            ) {
                closeMenu();
            } else {
                openMenu();
            }
        }
    );

    menuClose?.addEventListener(
        "click",
        closeMenu
    );

    menuOverlay?.addEventListener(
        "click",
        closeMenu
    );

    /* =====================================================
       VOICE
    ===================================================== */

    function initVoice() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) return;

        recognition =
            new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang =
            navigator.language || "en-IN";

        recognition.onstart = () => {

            listening = true;

            voiceButton?.classList.add(
                "listening"
            );

            showToast(
                "Listening..."
            );
        };

        recognition.onresult =
            event => {

                const text =
                    event.results[0][0]
                        .transcript;

                if (!messageInput) return;

                messageInput.value =
                    messageInput.value
                        ? messageInput.value +
                          " " +
                          text
                        : text;

                resizeInput();
                messageInput.focus();
            };

        recognition.onerror =
            error => {

                console.error(
                    "VOICE ERROR:",
                    error
                );

                showToast(
                    "Voice input failed."
                );
            };

        recognition.onend = () => {

            listening = false;

            voiceButton?.classList.remove(
                "listening"
            );
        };
    }

    voiceButton?.addEventListener(
        "click",
        () => {

            if (!recognition) {

                showToast(
                    "Voice supported nahi hai."
                );

                return;
            }

            if (listening) {

                recognition.stop();

                return;
            }

            try {

                recognition.start();

            } catch {}
        }
    );

    /* =====================================================
       ESC
    ===================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") return;

            closeMenu();
            closeMemory();
        }
    );

    /* =====================================================
       ONLINE / OFFLINE
    ===================================================== */

    window.addEventListener(
        "offline",
        () => showToast(
            "Internet connection lost."
        )
    );

    window.addEventListener(
        "online",
        () => showToast(
            "Internet connection restored."
        )
    );

    /* =====================================================
       GLOBAL API
    ===================================================== */

    window.AtharvAI = {

        send: sendMessage,

        newChat,

        getHistory: () =>
            [...history],

        getUserId: () =>
            USER_ID,

        isLive: () =>
            liveMode,

        showToast
    };

    /* =====================================================
       INITIALIZE
    ===================================================== */

    history = loadHistory();

    renderHistory();

    updateLiveButton();

    resizeInput();

    initVoice();

    setThinking(false);

    console.log(
        "ATHARV AI frontend connected."
    );

    console.log(
        "API:",
        API_BASE || "same-origin"
    );

})();
