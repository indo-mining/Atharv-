"use strict";

/*
=========================================================
 ATHARV AI
 FRONTEND
 Version 18.0.0
 --------------------------------------------------------
 Professional Chat UI
 - Existing /api/chat compatible
 - Live Research
 - Conversation History
 - Memory UI
 - Attachments
 - Voice Input
 - Copy
 - Edit
 - Regenerate
 - Mobile Optimized
=========================================================
*/

(() => {

    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE = "";

    const MAX_MESSAGE_LENGTH = 12000;

    const REQUEST_TIMEOUT = 120000;

    const STORAGE = {
        userId: "atharv_user_id_v18",
        history: "atharv_chat_history_v18",
        live: "atharv_live_mode_v18"
    };


    /* ==================================================
       DOM
    ================================================== */

    const $ = (id) =>
        document.getElementById(id);

    const chatContainer =
        $("chatContainer");

    const welcome =
        $("welcome");

    const messages =
        $("messages");

    const thinking =
        $("thinking");

    const chatForm =
        $("chatForm");

    const messageInput =
        $("messageInput");

    const sendButton =
        $("sendButton");

    const liveButton =
        $("liveButton");

    const voiceButton =
        $("voiceButton");

    const attachmentButton =
        $("attachmentButton");

    const fileInput =
        $("fileInput");

    const attachmentInfo =
        $("attachmentInfo");

    const toast =
        $("toast");

    const newChatButton =
        $("newChatButton");

    const memoryButton =
        $("memoryButton");

    const memoryModal =
        $("memoryModal");

    const closeMemoryButton =
        $("closeMemoryButton");

    const memoryList =
        $("memoryList");


    /* ==================================================
       STATE
    ================================================== */

    let history = [];

    let sending = false;

    let liveMode =
        localStorage.getItem(STORAGE.live) === "true";

    let selectedFiles = [];

    let editingIndex = -1;

    let recognition = null;

    let listening = false;


    /* ==================================================
       USER ID
    ================================================== */

    function getUserId() {

        let id =
            localStorage.getItem(
                STORAGE.userId
            );

        if (id) {
            return id;
        }

        if (
            window.crypto &&
            crypto.randomUUID
        ) {

            id =
                crypto.randomUUID();

        } else {

            id =
                "atharv-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2);

        }

        localStorage.setItem(
            STORAGE.userId,
            id
        );

        return id;
    }

    const USER_ID =
        getUserId();


    /* ==================================================
       STORAGE
    ================================================== */

    function loadHistory() {

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

            return parsed
                .filter(
                    item =>
                        item &&
                        (
                            item.role === "user" ||
                            item.role === "assistant"
                        ) &&
                        typeof item.content === "string"
                )
                .slice(-80);

        } catch {

            return [];
        }
    }


    function saveHistory() {

        try {

            localStorage.setItem(
                STORAGE.history,
                JSON.stringify(
                    history.slice(-80)
                )
            );

        } catch {

            /*
             Ignore localStorage errors.
            */
        }
    }


    /* ==================================================
       TOAST
    ================================================== */

    function showToast(message) {

        if (!toast) {
            return;
        }

        toast.textContent =
            String(message || "");

        toast.classList.add("show");

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(
                () => {
                    toast.classList.remove("show");
                },
                2400
            );
    }


    /* ==================================================
       HTML ESCAPE
    ================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ==================================================
       MARKDOWN
    ================================================== */

    function formatInline(text) {

        let output =
            escapeHtml(text);

        output =
            output.replace(
                /`([^`]+)`/g,
                '<code class="inline-code">$1</code>'
            );

        output =
            output.replace(
                /\*\*([^*]+)\*\*/g,
                "<strong>$1</strong>"
            );

        output =
            output.replace(
                /\*([^*]+)\*/g,
                "<em>$1</em>"
            );

        return output;
    }


    function formatResponse(text) {

        if (!text) {
            return "";
        }

        const source =
            String(text)
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n");

        const parts =
            source.split(
                /```([\s\S]*?)```/g
            );

        let html = "";

        for (
            let i = 0;
            i < parts.length;
            i++
        ) {

            const part =
                parts[i];

            if (i % 2 === 1) {

                let code =
                    part;

                let language =
                    "code";

                const firstLine =
                    code.match(
                        /^([a-zA-Z0-9_+#.-]+)\n/
                    );

                if (firstLine) {

                    language =
                        firstLine[1];

                    code =
                        code.slice(
                            firstLine[0].length
                        );
                }

                const encoded =
                    escapeHtml(code.trim());

                html += `
                    <div class="code-block">
                        <div class="code-header">
                            <span>${escapeHtml(language)}</span>
                            <button
                                class="copy-code"
                                type="button"
                                data-code="${encodeURIComponent(code.trim())}"
                            >
                                Copy
                            </button>
                        </div>
                        <pre><code>${encoded}</code></pre>
                    </div>
                `;

                continue;
            }


            const lines =
                part.split("\n");

            let paragraph = [];

            function flushParagraph() {

                if (!paragraph.length) {
                    return;
                }

                html +=
                    `<p>${formatInline(
                        paragraph.join("\n")
                    ).replace(
                        /\n/g,
                        "<br>"
                    )}</p>`;

                paragraph = [];
            }


            for (
                const line of lines
            ) {

                const trimmed =
                    line.trim();

                if (!trimmed) {

                    flushParagraph();

                    continue;
                }


                const heading =
                    trimmed.match(
                        /^(#{1,3})\s+(.+)$/
                    );

                if (heading) {

                    flushParagraph();

                    const level =
                        heading[1].length;

                    html +=
                        `<h${level}>${formatInline(
                            heading[2]
                        )}</h${level}>`;

                    continue;
                }


                if (
                    /^[-*]\s+/.test(trimmed)
                ) {

                    flushParagraph();

                    html +=
                        `<ul>`;

                    let j = lines.indexOf(line);

                    while (
                        j < lines.length &&
                        /^[-*]\s+/.test(
                            lines[j].trim()
                        )
                    ) {

                        html +=
                            `<li>${formatInline(
                                lines[j]
                                    .trim()
                                    .replace(
                                        /^[-*]\s+/,
                                        ""
                                    )
                            )}</li>`;

                        j++;
                    }

                    html += "</ul>";

                    continue;
                }


                if (
                    /^\d+\.\s+/.test(trimmed)
                ) {

                    flushParagraph();

                    html +=
                        `<ol>`;

                    let j = lines.indexOf(line);

                    while (
                        j < lines.length &&
                        /^\d+\.\s+/.test(
                            lines[j].trim()
                        )
                    ) {

                        html +=
                            `<li>${formatInline(
                                lines[j]
                                    .trim()
                                    .replace(
                                        /^\d+\.\s+/,
                                        ""
                                    )
                            )}</li>`;

                        j++;
                    }

                    html += "</ol>";

                    continue;
                }


                paragraph.push(line);
            }

            flushParagraph();
        }

        return html;
    }


    /* ==================================================
       MESSAGE HTML
    ================================================== */

    function createMessageElement(
        item,
        index
    ) {

        const wrapper =
            document.createElement("article");

        wrapper.className =
            `message ${item.role}`;

        wrapper.dataset.index =
            String(index);


        if (item.role === "user") {

            wrapper.innerHTML = `
                <div class="message-inner">

                    <div class="user-bubble">
                        ${escapeHtml(item.content)}
                    </div>

                    <div class="message-actions">

                        <button
                            class="message-action"
                            type="button"
                            data-action="edit"
                        >
                            Edit
                        </button>

                        <button
                            class="message-action"
                            type="button"
                            data-action="copy"
                        >
                            Copy
                        </button>

                    </div>

                </div>
            `;

        } else {

            wrapper.innerHTML = `
                <div class="message-inner">

                    <div class="assistant-avatar">
                        A
                    </div>

                    <div class="assistant-content">

                        ${formatResponse(item.content)}

                        <div class="message-actions">

                            <button
                                class="message-action"
                                type="button"
                                data-action="copy"
                            >
                                Copy
                            </button>

                            <button
                                class="message-action"
                                type="button"
                                data-action="regenerate"
                            >
                                Regenerate
                            </button>

                        </div>

                    </div>

                </div>
            `;
        }


        return wrapper;
    }


    /* ==================================================
       RENDER
    ================================================== */

    function renderHistory() {

        messages.innerHTML = "";

        if (!history.length) {

            welcome.classList.remove(
                "hidden"
            );

            return;
        }

        welcome.classList.add(
            "hidden"
        );


        history.forEach(
            (item, index) => {

                messages.appendChild(
                    createMessageElement(
                        item,
                        index
                    )
                );

            }
        );

        scrollToBottom(false);
    }


    /* ==================================================
       SCROLL
    ================================================== */

    function scrollToBottom(smooth = true) {

        requestAnimationFrame(
            () => {

                chatContainer.scrollTo({
                    top:
                        chatContainer.scrollHeight,
                    behavior:
                        smooth
                            ? "smooth"
                            : "auto"
                });

            }
        );
    }


    /* ==================================================
       THINKING
    ================================================== */

    function setThinking(active) {

        if (!thinking) {
            return;
        }

        thinking.classList.toggle(
            "hidden",
            !active
        );

        if (active) {
            scrollToBottom(true);
        }
    }


    /* ==================================================
       INPUT HEIGHT
    ================================================== */

    function resizeInput() {

        messageInput.style.height =
            "auto";

        const height =
            Math.min(
                messageInput.scrollHeight,
                160
            );

        messageInput.style.height =
            `${height}px`;
    }


    /* ==================================================
       API REQUEST
    ================================================== */

    async function requestJson(
        endpoint,
        body
    ) {

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
                    API_BASE + endpoint,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(body),

                        signal:
                            controller.signal,

                        cache:
                            "no-store"
                    }
                );


            let data = {};

            try {
                data =
                    await response.json();
            } catch {
                data = {};
            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    `Request failed (${response.status})`
                );
            }


            return data;

        } finally {

            clearTimeout(timer);
        }
    }


    /* ==================================================
       RESPONSE EXTRACTION
    ================================================== */

    function extractAnswer(data) {

        if (!data) {
            return "";
        }

        const candidates = [
            data.answer,
            data.response,
            data.message,
            data.content,
            data.text,
            data.result
        ];

        for (
            const value of candidates
        ) {

            if (
                typeof value === "string" &&
                value.trim()
            ) {

                return value.trim();
            }
        }

        return "";
    }


    /* ==================================================
       SEND
    ================================================== */

    async function sendMessage(
        forcedMessage = null,
        options = {}
    ) {

        if (sending) {
            return;
        }


        const message =
            String(
                forcedMessage ??
                messageInput.value
            ).trim();


        if (!message) {
            return;
        }


        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            showToast(
                `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`
            );

            return;
        }


        sending = true;

        sendButton.disabled = true;


        if (!forcedMessage) {
            messageInput.value = "";
            resizeInput();
        }


        /*
        --------------------------------------------------
        REMOVE WELCOME
        --------------------------------------------------
        */

        welcome.classList.add(
            "hidden"
        );


        /*
        --------------------------------------------------
        ADD USER MESSAGE
        --------------------------------------------------
        */

        const userMessage = {
            role: "user",
            content: message
        };


        history.push(
            userMessage
        );

        saveHistory();

        renderHistory();


        /*
        --------------------------------------------------
        THINKING
        --------------------------------------------------
        */

        setThinking(true);


        try {

            let data;


            if (
                options.live ||
                liveMode
            ) {

                data =
                    await requestJson(
                        "/api/chat/research",
                        {
                            query: message,
                            message,
                            userId: USER_ID
                        }
                    );

            } else {

                const recentHistory =
                    history.slice(-12);

                data =
                    await requestJson(
                        "/api/chat",
                        {
                            message,

                            history:
                                recentHistory,

                            chatHistory:
                                recentHistory,

                            userId:
                                USER_ID
                        }
                    );
            }


            const answer =
                extractAnswer(data);


            if (!answer) {

                throw new Error(
                    "Atharv did not return a response."
                );
            }


            /*
            ------------------------------------------------
            ADD ASSISTANT RESPONSE
            ------------------------------------------------
            */

            history.push({
                role: "assistant",
                content: answer
            });


            saveHistory();

            renderHistory();


        } catch (error) {

            console.error(
                "ATHARV CHAT ERROR:",
                error
            );


            let errorMessage =
                "Sorry, I couldn't get a response right now.";


            if (
                error.name ===
                "AbortError"
            ) {

                errorMessage =
                    "The response took too long. Please try again.";

            } else if (
                error &&
                error.message
            ) {

                errorMessage =
                    error.message;
            }


            history.push({
                role: "assistant",
                content:
                    errorMessage
            });


            saveHistory();

            renderHistory();


        } finally {

            setThinking(false);

            sending = false;

            sendButton.disabled = false;

            messageInput.focus();

            scrollToBottom(true);
        }
    }


    /* ==================================================
       MESSAGE ACTIONS
    ================================================== */

    async function copyText(text) {

        try {

            await navigator.clipboard.writeText(
                text
            );

            showToast(
                "Copied"
            );

        } catch {

            showToast(
                "Copy failed"
            );
        }
    }


    function editMessage(index) {

        const item =
            history[index];

        if (
            !item ||
            item.role !== "user"
        ) {
            return;
        }


        editingIndex =
            index;

        messageInput.value =
            item.content;

        resizeInput();

        messageInput.focus();

        showToast(
            "Edit your message and send again"
        );
    }


    async function regenerate(index) {

        if (sending) {
            return;
        }


        if (
            !history[index] ||
            history[index].role !== "assistant"
        ) {
            return;
        }


        let userIndex =
            index - 1;


        while (
            userIndex >= 0 &&
            history[userIndex].role !== "user"
        ) {

            userIndex--;
        }


        if (userIndex < 0) {
            return;
        }


        const prompt =
            history[userIndex].content;


        history =
            history.slice(
                0,
                userIndex + 1
            );

        saveHistory();

        renderHistory();


        await sendMessage(
            prompt,
            {
                live: liveMode
            }
        );
    }


    /* ==================================================
       CODE COPY
    ================================================== */

    function handleCodeCopy(button) {

        try {

            const code =
                decodeURIComponent(
                    button.dataset.code || ""
                );

            copyText(code);

        } catch {

            showToast(
                "Could not copy code"
            );
        }
    }


    /* ==================================================
       EVENT DELEGATION
    ================================================== */

    messages.addEventListener(
        "click",
        (event) => {

            const action =
                event.target.closest(
                    "[data-action]"
                );

            if (!action) {
                return;
            }


            const article =
                action.closest(".message");

            if (!article) {
                return;
            }


            const index =
                Number(
                    article.dataset.index
                );

            const type =
                action.dataset.action;


            if (type === "copy") {

                const item =
                    history[index];

                if (item) {
                    copyText(
                        item.content
                    );
                }

            } else if (
                type === "edit"
            ) {

                editMessage(index);

            } else if (
                type === "regenerate"
            ) {

                regenerate(index);
            }
        }
    );


    messages.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
                    ".copy-code"
                );

            if (button) {
                handleCodeCopy(button);
            }
        }
    );


    /* ==================================================
       SUGGESTIONS
    ================================================== */

    document
        .querySelectorAll(
            "[data-prompt]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const prompt =
                            button.dataset.prompt;

                        if (!prompt) {
                            return;
                        }

                        sendMessage(
                            prompt
                        );
                    }
                );
            }
        );


    /* ==================================================
       FORM
    ================================================== */

    chatForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );


    /* ==================================================
       ENTER
    ================================================== */

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );


    messageInput.addEventListener(
        "input",
        resizeInput
    );


    /* ==================================================
       LIVE MODE
    ================================================== */

    function updateLiveButton() {

        liveButton.classList.toggle(
            "active",
            liveMode
        );

        liveButton.setAttribute(
            "aria-pressed",
            String(liveMode)
        );

        liveButton.title =
            liveMode
                ? "Live search ON"
                : "Live search OFF";
    }


    liveButton.addEventListener(
        "click",
        () => {

            liveMode =
                !liveMode;

            localStorage.setItem(
                STORAGE.live,
                String(liveMode)
            );

            updateLiveButton();

            showToast(
                liveMode
                    ? "Live search enabled"
                    : "Live search disabled"
            );
        }
    );


    /* ==================================================
       ATTACHMENTS
    ================================================== */

    attachmentButton.addEventListener(
        "click",
        () => {
            fileInput.click();
        }
    );


    fileInput.addEventListener(
        "change",
        () => {

            selectedFiles =
                Array.from(
                    fileInput.files || []
                );


            if (!selectedFiles.length) {

                attachmentInfo.classList.add(
                    "hidden"
                );

                attachmentInfo.textContent =
                    "";

                return;
            }


            const names =
                selectedFiles
                    .map(
                        file =>
                            file.name
                    )
                    .join(", ");


            attachmentInfo.textContent =
                `${selectedFiles.length} file${
                    selectedFiles.length > 1
                        ? "s"
                        : ""
                } selected: ${names}`;

            attachmentInfo.classList.remove(
                "hidden"
            );


            /*
            Attachment UI is ready.
            Actual server-side file processing
            can be connected without changing
            the chat composer.
            */
        }
    );


    /* ==================================================
       VOICE INPUT
    ================================================== */

    function initVoice() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            voiceButton.title =
                "Voice input is not supported";

            voiceButton.style.opacity =
                ".45";

            return;
        }


        recognition =
            new SpeechRecognition();


        recognition.continuous =
            false;

        recognition.interimResults =
            true;

        recognition.lang =
            navigator.language ||
            "en-IN";


        recognition.onstart =
            () => {

                listening = true;

                voiceButton.classList.add(
                    "listening"
                );

                voiceButton.setAttribute(
                    "aria-pressed",
                    "true"
                );

                showToast(
                    "Listening..."
                );
            };


        recognition.onresult =
            event => {

                let finalText = "";

                let interimText = "";


                for (
                    let i = event.resultIndex;
                    i < event.results.length;
                    i++
                ) {

                    const text =
                        event.results[i][0].transcript;


                    if (
                        event.results[i].isFinal
                    ) {

                        finalText += text;

                    } else {

                        interimText += text;
                    }
                }


                if (finalText) {

                    const existing =
                        messageInput.value.trim();

                    messageInput.value =
                        existing
                            ? `${existing} ${finalText}`
                            : finalText;

                    resizeInput();
                }
            };


        recognition.onerror =
            event => {

                console.warn(
                    "VOICE ERROR:",
                    event.error
                );

                if (
                    event.error ===
                    "not-allowed"
                ) {

                    showToast(
                        "Microphone permission is required."
                    );

                } else {

                    showToast(
                        "Voice input failed."
                    );
                }
            };


        recognition.onend =
            () => {

                listening = false;

                voiceButton.classList.remove(
                    "listening"
                );

                voiceButton.setAttribute(
                    "aria-pressed",
                    "false"
                );
            };
    }


    voiceButton.addEventListener(
        "click",
        () => {

            if (!recognition) {

                showToast(
                    "Voice input is not supported on this browser."
                );

                return;
            }


            if (listening) {

                recognition.stop();

                return;
            }


            try {

                recognition.lang =
                    navigator.language ||
                    "en-IN";

                recognition.start();

            } catch {

                showToast(
                    "Voice input is already active."
                );
            }
        }
    );


    /* ==================================================
       NEW CHAT
    ================================================== */

    function newChat() {

        if (sending) {
            return;
        }


        history = [];

        saveHistory();

        messages.innerHTML = "";

        welcome.classList.remove(
            "hidden"
        );

        messageInput.value = "";

        resizeInput();

        selectedFiles = [];

        fileInput.value = "";

        attachmentInfo.textContent =
            "";

        attachmentInfo.classList.add(
            "hidden"
        );

        messageInput.focus();

        showToast(
            "New chat started"
        );
    }


    newChatButton.addEventListener(
        "click",
        newChat
    );


    /* ==================================================
       MEMORY
    ================================================== */

    async function loadMemory() {

        memoryList.innerHTML = `
            <div class="memory-empty">
                Loading memory...
            </div>
        `;


        memoryModal.classList.remove(
            "hidden"
        );

        memoryModal.setAttribute(
            "aria-hidden",
            "false"
        );


        try {

            const response =
                await fetch(
                    `${API_BASE}/api/memory?userId=${encodeURIComponent(USER_ID)}`,
                    {
                        method: "GET",
                        cache: "no-store"
                    }
                );


            const data =
                await response.json();


            const memories =
                Array.isArray(data)
                    ? data
                    : (
                        Array.isArray(data.memories)
                            ? data.memories
                            : []
                    );


            if (!memories.length) {

                memoryList.innerHTML = `
                    <div class="memory-empty">
                        No saved memories yet.
                    </div>
                `;

                return;
            }


            memoryList.innerHTML =
                memories
                    .map(
                        memory => {

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
                        }
                    )
                    .join("");


        } catch {

            memoryList.innerHTML = `
                <div class="memory-empty">
                    Memory is currently unavailable.
                </div>
            `;
        }
    }


    function closeMemory() {

        memoryModal.classList.add(
            "hidden"
        );

        memoryModal.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    memoryButton.addEventListener(
        "click",
        loadMemory
    );


    closeMemoryButton.addEventListener(
        "click",
        closeMemory
    );


    memoryModal
        .querySelector(".modal-backdrop")
        .addEventListener(
            "click",
            closeMemory
        );


    /* ==================================================
       ONLINE STATUS
    ================================================== */

    window.addEventListener(
        "offline",
        () => {

            showToast(
                "You are offline."
            );
        }
    );


    window.addEventListener(
        "online",
        () => {

            showToast(
                "Connection restored."
            );
        }
    );


    /* ==================================================
       INITIALIZE
    ================================================== */

    history =
        loadHistory();

    renderHistory();

    updateLiveButton();

    resizeInput();

    initVoice();


    /* ==================================================
       PUBLIC API
    ================================================== */

    window.AtharvAI = {

        newChat,

        getHistory: () =>
            [...history],

        getUserId: () =>
            USER_ID,

        isLive: () =>
            liveMode,

        showToast,

        clearHistory: () => {

            history = [];

            saveHistory();

            renderHistory();
        },

        send: message =>
            sendMessage(message)
    };


})();
