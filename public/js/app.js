"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND
 Version 18.4.0
 --------------------------------------------------------
 FIXES
 - Send button reliable
 - Form submit reliable
 - Enter key reliable
 - No duplicate send
 - API error handling
 - Same-origin API support
 - Backend response compatibility
 - History
 - New chat
 - Edit
 - Copy
 - Regenerate
 - Live search
 - Voice input
 - Attachments
 - Memory
 - Menu
 - Mobile composer
 - Offline/online handling
=========================================================
*/

(() => {

    /* ==================================================
       CONFIG
    ================================================== */

    const API_BASE = "";

    const MAX_MESSAGE_LENGTH = 12000;
    const REQUEST_TIMEOUT = 120000;
    const MAX_HISTORY = 100;

    const STORAGE = {
        userId: "atharv_user_id_v18",
        history: "atharv_chat_history_v18",
        live: "atharv_live_mode_v18"
    };


    /* ==================================================
       HELPERS
    ================================================== */

    const $ = (id) => document.getElementById(id);

    const safeString = (value) =>
        value === null || value === undefined
            ? ""
            : String(value);


    /* ==================================================
       DOM
    ================================================== */

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

    const newChatButton = $("newChatButton");

    const memoryButton = $("memoryButton");
    const memoryModal = $("memoryModal");
    const closeMemoryButton = $("closeMemoryButton");
    const memoryList = $("memoryList");

    const menuButton = $("menuButton");
    const menuClose = $("menuClose");
    const menuOverlay = $("menuOverlay");
    const atharvMenu = $("atharvMenu");


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

        let id = null;

        try {
            id = localStorage.getItem(STORAGE.userId);
        } catch {}

        if (id) return id;

        try {

            if (window.crypto?.randomUUID) {
                id = window.crypto.randomUUID();
            } else {
                id =
                    "atharv-" +
                    Date.now() +
                    "-" +
                    Math.random()
                        .toString(36)
                        .slice(2);

            }

        } catch {

            id =
                "atharv-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2);

        }

        try {
            localStorage.setItem(
                STORAGE.userId,
                id
            );
        } catch {}

        return id;
    }

    const USER_ID = getUserId();


    /* ==================================================
       TOAST
    ================================================== */

    function showToast(message) {

        const text = safeString(message);

        if (!toast) {
            console.log("ATHARV:", text);
            return;
        }

        toast.textContent = text;
        toast.classList.add("show");

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }


    /* ==================================================
       HTML ESCAPE
    ================================================== */

    function escapeHtml(value) {

        return safeString(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ==================================================
       INLINE MARKDOWN
    ================================================== */

    function formatInline(text) {

        let output = escapeHtml(text);

        output = output.replace(
            /`([^`]+)`/g,
            '<code class="inline-code">$1</code>'
        );

        output = output.replace(
            /\*\*([^*]+)\*\*/g,
            "<strong>$1</strong>"
        );

        output = output.replace(
            /(?<!\*)\*([^*]+)\*(?!\*)/g,
            "<em>$1</em>"
        );

        output = output.replace(
            /(https?:\/\/[^\s<]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        return output;
    }


    /* ==================================================
       MARKDOWN FORMATTER
    ================================================== */

    function formatResponse(text) {

        if (!text) return "";

        const source = safeString(text)
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

        const parts =
            source.split(/```([\s\S]*?)```/g);

        let html = "";

        for (
            let partIndex = 0;
            partIndex < parts.length;
            partIndex++
        ) {

            const part = parts[partIndex];

            /* CODE BLOCK */

            if (partIndex % 2 === 1) {

                let code = part;
                let language = "code";

                const firstLine =
                    code.match(
                        /^([a-zA-Z0-9_+#.-]+)\n/
                    );

                if (firstLine) {

                    language = firstLine[1];

                    code =
                        code.slice(
                            firstLine[0].length
                        );
                }

                const cleanCode = code.trim();

                html += `
                    <div class="code-block">
                        <div class="code-header">
                            <span>${escapeHtml(language)}</span>
                            <button
                                class="copy-code"
                                type="button"
                                data-code="${encodeURIComponent(cleanCode)}"
                            >
                                Copy
                            </button>
                        </div>

                        <pre><code>${escapeHtml(cleanCode)}</code></pre>
                    </div>
                `;

                continue;
            }


            /* NORMAL TEXT */

            const lines = part.split("\n");

            let paragraph = [];

            const flushParagraph = () => {

                if (!paragraph.length) return;

                html += `
                    <p>
                        ${formatInline(
                            paragraph.join("\n")
                        ).replace(/\n/g, "<br>")}
                    </p>
                `;

                paragraph = [];
            };


            let index = 0;

            while (index < lines.length) {

                const rawLine = lines[index];
                const trimmed = rawLine.trim();


                if (!trimmed) {

                    flushParagraph();
                    index++;
                    continue;
                }


                /* HEADING */

                const heading =
                    trimmed.match(
                        /^(#{1,3})\s+(.+)$/
                    );

                if (heading) {

                    flushParagraph();

                    const level =
                        heading[1].length;

                    html += `
                        <h${level}>
                            ${formatInline(heading[2])}
                        </h${level}>
                    `;

                    index++;
                    continue;
                }


                /* BULLET */

                if (/^[-*]\s+/.test(trimmed)) {

                    flushParagraph();

                    html += "<ul>";

                    while (
                        index < lines.length &&
                        /^[-*]\s+/.test(
                            lines[index].trim()
                        )
                    ) {

                        const item =
                            lines[index]
                                .trim()
                                .replace(
                                    /^[-*]\s+/,
                                    ""
                                );

                        html += `
                            <li>
                                ${formatInline(item)}
                            </li>
                        `;

                        index++;
                    }

                    html += "</ul>";

                    continue;
                }


                /* NUMBERED LIST */

                if (/^\d+\.\s+/.test(trimmed)) {

                    flushParagraph();

                    html += "<ol>";

                    while (
                        index < lines.length &&
                        /^\d+\.\s+/.test(
                            lines[index].trim()
                        )
                    ) {

                        const item =
                            lines[index]
                                .trim()
                                .replace(
                                    /^\d+\.\s+/,
                                    ""
                                );

                        html += `
                            <li>
                                ${formatInline(item)}
                            </li>
                        `;

                        index++;
                    }

                    html += "</ol>";

                    continue;
                }


                /* QUOTE */

                if (trimmed.startsWith(">")) {

                    flushParagraph();

                    html += `
                        <blockquote>
                            ${formatInline(
                                trimmed.replace(
                                    /^>\s?/,
                                    ""
                                )
                            )}
                        </blockquote>
                    `;

                    index++;
                    continue;
                }


                paragraph.push(rawLine);

                index++;
            }

            flushParagraph();
        }

        return html;
    }


    /* ==================================================
       HISTORY
    ================================================== */

    function loadHistory() {

        try {

            const raw =
                localStorage.getItem(
                    STORAGE.history
                );

            if (!raw) return [];

            const parsed = JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed
                .filter(item =>
                    item &&
                    (
                        item.role === "user" ||
                        item.role === "assistant"
                    ) &&
                    typeof item.content === "string"
                )
                .slice(-MAX_HISTORY);

        } catch {

            return [];
        }
    }


    function saveHistory() {

        try {

            localStorage.setItem(
                STORAGE.history,
                JSON.stringify(
                    history.slice(-MAX_HISTORY)
                )
            );

        } catch {}
    }


    /* ==================================================
       MESSAGE ELEMENT
    ================================================== */

    function createMessageElement(item, index) {

        const article =
            document.createElement("article");

        article.className =
            `message ${item.role}`;

        article.dataset.index =
            String(index);


        /* USER */

        if (item.role === "user") {

            article.innerHTML = `
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

            return article;
        }


        /* ASSISTANT */

        article.innerHTML = `
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

        return article;
    }


    /* ==================================================
       RENDER
    ================================================== */

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

        if (!chatContainer) return;

        requestAnimationFrame(() => {

            try {

                chatContainer.scrollTo({
                    top:
                        chatContainer.scrollHeight,
                    behavior:
                        smooth
                            ? "smooth"
                            : "auto"
                });

            } catch {

                chatContainer.scrollTop =
                    chatContainer.scrollHeight;
            }

        });
    }


    /* ==================================================
       THINKING
    ================================================== */

    function setThinking(active) {

        if (!thinking) return;

        if (active) {

            thinking.classList.remove(
                "hidden"
            );

            thinking.hidden = false;

            scrollToBottom(true);

        } else {

            thinking.classList.add(
                "hidden"
            );

            thinking.hidden = true;
        }
    }


    /* ==================================================
       INPUT SIZE
    ================================================== */

    function resizeInput() {

        if (!messageInput) return;

        messageInput.style.height = "auto";

        const height =
            Math.min(
                messageInput.scrollHeight,
                160
            );

        messageInput.style.height =
            `${Math.max(height, 42)}px`;
    }


    /* ==================================================
       API URL
    ================================================== */

    function apiUrl(endpoint) {

        return `${API_BASE}${endpoint}`;
    }


    /* ==================================================
       API REQUEST
    ================================================== */

    async function requestJson(
        endpoint,
        body
    ) {

        if (window.location.protocol === "file:") {

            throw new Error(
                "HTML file ko direct open mat karo. Render URL ya localhost/Live Server se app chalao."
            );
        }


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
                    apiUrl(endpoint),
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
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

                const serverMessage =
                    data?.error ||
                    data?.message ||
                    data?.detail ||
                    data?.response;

                throw new Error(
                    serverMessage ||
                    `Server error (${response.status})`
                );
            }


            return data;

        } catch (error) {

            if (
                error?.name ===
                "AbortError"
            ) {

                throw new Error(
                    "Atharv server timeout. Backend response late aa raha hai."
                );
            }


            if (
                error instanceof TypeError
            ) {

                throw new Error(
                    "Server se connection nahi ho raha. Render/backend check karo."
                );
            }


            throw error;

        } finally {

            clearTimeout(timeout);
        }
    }


    /* ==================================================
       RESPONSE EXTRACTION
    ================================================== */

    function extractAnswer(data) {

        if (!data) return "";

        const candidates = [
            data.answer,
            data.response,
            data.message,
            data.content,
            data.text,
            data.result,
            data.reply,
            data.output
        ];


        for (const value of candidates) {

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


    /* ==================================================
       SEND MESSAGE
    ================================================== */

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
            safeString(raw).trim();


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
                `Message maximum ${MAX_MESSAGE_LENGTH} characters ka ho sakta hai.`
            );

            return;
        }


        /* LOCK */

        sending = true;


        if (sendButton) {

            sendButton.disabled = true;

            sendButton.setAttribute(
                "aria-busy",
                "true"
            );

            sendButton.dataset.oldText =
                sendButton.textContent;

            sendButton.textContent =
                "...";
        }


        if (
            forcedMessage === null &&
            messageInput
        ) {

            messageInput.value = "";

            resizeInput();
        }


        welcome?.classList.add(
            "hidden"
        );


        /*
        -----------------------------------------------
        EDIT MODE
        -----------------------------------------------
        */

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


        /*
        -----------------------------------------------
        USER MESSAGE
        -----------------------------------------------
        */

        history.push({
            role: "user",
            content: message
        });


        saveHistory();

        renderHistory();

        setThinking(true);


        try {

            let data;


            /*
            -------------------------------------------
            LIVE SEARCH
            -------------------------------------------
            */

            if (
                options.live ||
                liveMode
            ) {

                data =
                    await requestJson(
                        "/api/chat/research",
                        {
                            query:
                                message,

                            message:
                                message,

                            userId:
                                USER_ID,

                            history:
                                history.slice(
                                    -12
                                )
                        }
                    );


            } else {


                /*
                ---------------------------------------
                NORMAL CHAT
                ---------------------------------------
                */

                data =
                    await requestJson(
                        "/api/chat",
                        {
                            message:
                                message,

                            history:
                                history.slice(
                                    -12
                                ),

                            chatHistory:
                                history.slice(
                                    -12
                                ),

                            userId:
                                USER_ID,

                            files:
                                selectedFiles.map(
                                    file => file.name
                                )
                        }
                    );
            }


            console.log(
                "ATHARV API RESPONSE:",
                data
            );


            const answer =
                extractAnswer(data);


            if (!answer) {

                throw new Error(
                    "Server ne empty response diya."
                );
            }


            /*
            -------------------------------------------
            ASSISTANT MESSAGE
            -------------------------------------------
            */

            history.push({
                role:
                    "assistant",

                content:
                    answer
            });


            saveHistory();

            renderHistory();


            /*
            -------------------------------------------
            CLEAR ATTACHMENTS
            -------------------------------------------
            */

            selectedFiles = [];

            if (fileInput) {
                fileInput.value = "";
            }

            if (attachmentInfo) {

                attachmentInfo.textContent =
                    "";

                attachmentInfo.classList.add(
                    "hidden"
                );
            }


        } catch (error) {

            console.error(
                "ATHARV SEND ERROR:",
                error
            );


            const errorMessage =
                error?.message ||
                "Response nahi mila.";


            /*
            -------------------------------------------
            ERROR MESSAGE
            -------------------------------------------
            */

            history.push({
                role:
                    "assistant",

                content:
                    `⚠️ ${errorMessage}`
            });


            saveHistory();

            renderHistory();

            showToast(
                errorMessage
            );


        } finally {

            setThinking(false);

            sending = false;


            if (sendButton) {

                sendButton.disabled =
                    false;

                sendButton.removeAttribute(
                    "aria-busy"
                );

                sendButton.textContent =
                    sendButton.dataset.oldText ||
                    "Send";
            }


            resizeInput();

            messageInput?.focus();

            scrollToBottom(true);
        }
    }


    /* ==================================================
       COPY
    ================================================== */

    async function copyText(text) {

        const value =
            safeString(text);

        if (!value) return;


        try {

            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {

                await navigator.clipboard.writeText(
                    value
                );

            } else {

                const textarea =
                    document.createElement(
                        "textarea"
                    );

                textarea.value = value;

                textarea.style.position =
                    "fixed";

                textarea.style.opacity =
                    "0";

                document.body.appendChild(
                    textarea
                );

                textarea.select();

                document.execCommand(
                    "copy"
                );

                textarea.remove();
            }


            showToast("Copied");

        } catch {

            showToast(
                "Copy failed"
            );
        }
    }


    /* ==================================================
       EDIT
    ================================================== */

    function editMessage(index) {

        const item =
            history[index];

        if (
            !item ||
            item.role !== "user"
        ) {
            return;
        }


        editingIndex = index;


        if (messageInput) {

            messageInput.value =
                item.content;

            resizeInput();

            messageInput.focus();

            messageInput.setSelectionRange(
                messageInput.value.length,
                messageInput.value.length
            );
        }


        showToast(
            "Message edit karo aur Send dabao."
        );
    }


    /* ==================================================
       REGENERATE
    ================================================== */

    async function regenerate(index) {

        if (sending) return;

        const assistant =
            history[index];

        if (
            !assistant ||
            assistant.role !==
                "assistant"
        ) {
            return;
        }


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
            prompt,
            {
                live:
                    liveMode
            }
        );
    }


    /* ==================================================
       MESSAGE ACTIONS
    ================================================== */

    messages?.addEventListener(
        "click",
        async (event) => {

            const target =
                event.target;


            /*
            -------------------------------------------
            CODE COPY
            -------------------------------------------
            */

            const codeButton =
                target.closest(
                    ".copy-code"
                );


            if (codeButton) {

                try {

                    const code =
                        decodeURIComponent(
                            codeButton.dataset.code ||
                            ""
                        );

                    await copyText(code);

                } catch {

                    showToast(
                        "Code copy nahi hua."
                    );
                }

                return;
            }


            /*
            -------------------------------------------
            MESSAGE ACTION
            -------------------------------------------
            */

            const action =
                target.closest(
                    "[data-action]"
                );


            if (!action) return;


            const article =
                action.closest(
                    ".message"
                );


            if (!article) return;


            const index =
                Number(
                    article.dataset.index
                );


            if (
                Number.isNaN(index)
            ) {
                return;
            }


            const type =
                action.dataset.action;


            const item =
                history[index];


            if (type === "copy") {

                copyText(
                    item?.content || ""
                );

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


    /* ==================================================
       QUICK PROMPTS
    ================================================== */

    document
        .querySelectorAll(
            "[data-prompt]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const prompt =
                        button.dataset.prompt;

                    if (prompt) {
                        sendMessage(
                            prompt
                        );
                    }
                }
            );
        });


    /* ==================================================
       FORM SUBMIT
    ================================================== */

    chatForm?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            event.stopPropagation();

            sendMessage();
        }
    );


    /* ==================================================
       SEND BUTTON
    ================================================== */

    sendButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            if (!sending) {
                sendMessage();
            }
        }
    );


    /* ==================================================
       ENTER KEY
    ================================================== */

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


    /* ==================================================
       INPUT
    ================================================== */

    messageInput?.addEventListener(
        "input",
        resizeInput
    );


    /* ==================================================
       LIVE MODE
    ================================================== */

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

        liveButton.title =
            liveMode
                ? "Live search ON"
                : "Live search OFF";
    }


    liveButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            liveMode =
                !liveMode;


            try {

                localStorage.setItem(
                    STORAGE.live,
                    String(liveMode)
                );

            } catch {}


            updateLiveButton();


            showToast(
                liveMode
                    ? "Live search ON"
                    : "Live search OFF"
            );
        }
    );


    /* ==================================================
       ATTACHMENTS
    ================================================== */

    attachmentButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            fileInput?.click();
        }
    );


    fileInput?.addEventListener(
        "change",
        () => {

            selectedFiles =
                Array.from(
                    fileInput.files || []
                );


            if (
                !selectedFiles.length
            ) {

                attachmentInfo?.classList.add(
                    "hidden"
                );

                return;
            }


            if (attachmentInfo) {

                attachmentInfo.textContent =
                    `${selectedFiles.length} file${
                        selectedFiles.length > 1
                            ? "s"
                            : ""
                    }: ${
                        selectedFiles
                            .map(
                                file =>
                                    file.name
                            )
                            .join(", ")
                    }`;

                attachmentInfo.classList.remove(
                    "hidden"
                );
            }


            showToast(
                `${selectedFiles.length} attachment selected`
            );
        }
    );


    /* ==================================================
       VOICE
    ================================================== */

    function initVoice() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            if (voiceButton) {

                voiceButton.style.opacity =
                    "0.45";

                voiceButton.title =
                    "Voice supported nahi hai";
            }

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

                voiceButton?.classList.add(
                    "listening"
                );

                voiceButton?.setAttribute(
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


                for (
                    let i =
                        event.resultIndex;
                    i <
                        event.results.length;
                    i++
                ) {

                    if (
                        event.results[i]
                            .isFinal
                    ) {

                        finalText +=
                            event.results[i][0]
                                .transcript;
                    }
                }


                if (
                    finalText &&
                    messageInput
                ) {

                    const old =
                        messageInput.value.trim();


                    messageInput.value =
                        old
                            ? `${old} ${finalText}`
                            : finalText;


                    resizeInput();

                    messageInput.focus();
                }
            };


        recognition.onerror =
            event => {

                console.error(
                    "VOICE ERROR:",
                    event.error
                );


                if (
                    event.error ===
                    "not-allowed"
                ) {

                    showToast(
                        "Microphone permission chahiye."
                    );

                } else if (
                    event.error ===
                    "no-speech"
                ) {

                    showToast(
                        "Awaz nahi aayi."
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

                voiceButton?.classList.remove(
                    "listening"
                );

                voiceButton?.setAttribute(
                    "aria-pressed",
                    "false"
                );
            };
    }


    voiceButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            if (!recognition) {

                showToast(
                    "Is browser mein voice supported nahi hai."
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
                    "Voice already active hai."
                );
            }
        }
    );


    /* ==================================================
       NEW CHAT
    ================================================== */

    function newChat() {

        if (sending) {

            showToast(
                "Pehle current response complete hone do."
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


        if (attachmentInfo) {

            attachmentInfo.textContent =
                "";

            attachmentInfo.classList.add(
                "hidden"
            );
        }


        setThinking(false);

        messageInput?.focus();

        scrollToBottom(false);

        showToast(
            "New chat started"
        );
    }


    newChatButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            newChat();
        }
    );


    /* ==================================================
       MEMORY
    ================================================== */

    async function loadMemory() {

        if (
            !memoryList ||
            !memoryModal
        ) {
            return;
        }


        memoryList.innerHTML =
            `<div class="memory-empty">Loading...</div>`;


        memoryModal.classList.remove(
            "hidden"
        );

        memoryModal.hidden = false;


        try {

            const response =
                await fetch(
                    `${API_BASE}/api/memory?userId=${encodeURIComponent(USER_ID)}`,
                    {
                        method: "GET",

                        headers: {
                            Accept:
                                "application/json"
                        },

                        cache:
                            "no-store"
                    }
                );


            let data = {};

            try {

                data =
                    await response.json();

            } catch {}


            if (!response.ok) {

                throw new Error(
                    data?.error ||
                    "Memory unavailable"
                );
            }


            const memories =
                Array.isArray(data)
                    ? data
                    : Array.isArray(
                        data.memories
                    )
                        ? data.memories
                        : [];


            if (!memories.length) {

                memoryList.innerHTML =
                    `<div class="memory-empty">No saved memories yet.</div>`;

                return;
            }


            memoryList.innerHTML =
                memories
                    .map(memory => {

                        const text =
                            typeof memory ===
                            "string"
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
                `<div class="memory-empty">Memory unavailable.</div>`;
        }
    }


    function closeMemory() {

        if (!memoryModal) return;

        memoryModal.classList.add(
            "hidden"
        );

        memoryModal.hidden = true;
    }


    memoryButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            loadMemory();
        }
    );


    closeMemoryButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            closeMemory();
        }
    );


    memoryModal
        ?.querySelector(
            ".modal-backdrop"
        )
        ?.addEventListener(
            "click",
            closeMemory
        );


    /* ==================================================
       ESC
    ================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                if (
                    memoryModal &&
                    !memoryModal.classList.contains(
                        "hidden"
                    )
                ) {

                    closeMemory();
                }

                if (
                    atharvMenu?.classList.contains(
                        "open"
                    )
                ) {

                    closeMenu();
                }
            }
        }
    );


    /* ==================================================
       MENU
    ================================================== */

    function openMenu() {

        menuOverlay?.classList.add(
            "open"
        );

        atharvMenu?.classList.add(
            "open"
        );

        document.body.classList.add(
            "menu-open"
        );
    }


    function closeMenu() {

        menuOverlay?.classList.remove(
            "open"
        );

        atharvMenu?.classList.remove(
            "open"
        );

        document.body.classList.remove(
            "menu-open"
        );
    }


    menuButton?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();


            const open =
                atharvMenu?.classList.contains(
                    "open"
                );


            if (open) {
                closeMenu();
            } else {
                openMenu();
            }
        }
    );


    menuClose?.addEventListener(
        "click",
        event => {

            event.preventDefault();

            closeMenu();
        }
    );


    menuOverlay?.addEventListener(
        "click",
        closeMenu
    );


    /* ==================================================
       ONLINE / OFFLINE
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
       MOBILE KEYBOARD
    ================================================== */

    if (window.visualViewport) {

        window.visualViewport.addEventListener(
            "resize",
            () => {

                if (
                    document.activeElement ===
                    messageInput
                ) {

                    setTimeout(
                        () => {
                            scrollToBottom(
                                true
                            );
                        },
                        50
                    );
                }
            }
        );
    }


    /* ==================================================
       GLOBAL API
    ================================================== */

    window.AtharvAI = {

        newChat,

        send: message =>
            sendMessage(message),

        getHistory: () =>
            [...history],

        getUserId: () =>
            USER_ID,

        isLive: () =>
            liveMode,

        showToast,

        clearHistory: () => {

            if (sending) return;

            history = [];

            saveHistory();

            renderHistory();
        },

        focusInput: () => {
            messageInput?.focus();
        }
    };


    /* ==================================================
       INIT
    ================================================== */

    history =
        loadHistory();


    renderHistory();

    updateLiveButton();

    resizeInput();

    initVoice();

    setThinking(false);


    if (
        window.innerWidth >= 768
    ) {

        setTimeout(
            () => {
                messageInput?.focus();
            },
            150
        );
    }


    console.log(
        "ATHARV AI Frontend 18.4.0 initialized."
    );

})();
