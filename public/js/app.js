"use strict";

/*
=========================================================
 ATHARV AI
 FRONTEND
 Version 18.2.0
 --------------------------------------------------------
 MATCHED WITH:
 - Current index.html v18.x
 - Current style.css v18.x
 - /api/chat
 - /api/chat/research
 - Memory API
 - Menu UI
 - Mobile Composer
 - Voice Input
 - Attachments
 - History
 - Copy / Edit / Regenerate
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
       DOM HELPER
    ================================================== */

    const $ = (id) =>
        document.getElementById(id);


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
       REQUIRED DOM CHECK
    ================================================== */

    const requiredElements = {
        chatContainer,
        welcome,
        messages,
        thinking,
        chatForm,
        messageInput,
        sendButton,
        liveButton,
        voiceButton,
        attachmentButton,
        fileInput,
        attachmentInfo,
        toast,
        newChatButton,
        memoryButton,
        memoryModal,
        closeMemoryButton,
        memoryList
    };

    const missingElements =
        Object.entries(requiredElements)
            .filter(
                ([, element]) => !element
            )
            .map(
                ([name]) => name
            );

    if (missingElements.length) {

        console.error(
            "ATHARV AI: Missing HTML elements:",
            missingElements
        );

        return;
    }


    /* ==================================================
       STATE
    ================================================== */

    let history = [];

    let sending = false;

    let liveMode =
        localStorage.getItem(
            STORAGE.live
        ) === "true";

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

        try {

            if (
                window.crypto &&
                typeof window.crypto.randomUUID ===
                    "function"
            ) {

                id =
                    window.crypto.randomUUID();

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
                        typeof item.content ===
                            "string"
                )
                .slice(-80);

        } catch (error) {

            console.warn(
                "History load failed:",
                error
            );

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

        } catch (error) {

            console.warn(
                "History save failed:",
                error
            );
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

        toast.classList.add(
            "show"
        );

        clearTimeout(
            showToast.timer
        );

        showToast.timer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                2400
            );
    }


    /* ==================================================
       HTML ESCAPE
    ================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
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


    /* ==================================================
       MARKDOWN INLINE
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


    /* ==================================================
       RESPONSE FORMATTER
    ================================================== */

    function formatResponse(text) {

        if (!text) {
            return "";
        }

        const source =
            String(text)
                .replace(
                    /\r\n/g,
                    "\n"
                )
                .replace(
                    /\r/g,
                    "\n"
                );

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

            /*
            ---------------------------------------------
            CODE BLOCK
            ---------------------------------------------
            */

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

                const cleanCode =
                    code.trim();

                const encoded =
                    escapeHtml(
                        cleanCode
                    );

                html += `
                    <div class="code-block">

                        <div class="code-header">

                            <span>
                                ${escapeHtml(language)}
                            </span>

                            <button
                                class="copy-code"
                                type="button"
                                data-code="${encodeURIComponent(cleanCode)}"
                            >
                                Copy
                            </button>

                        </div>

                        <pre><code>${encoded}</code></pre>

                    </div>
                `;

                continue;
            }


            /*
            ---------------------------------------------
            NORMAL TEXT
            ---------------------------------------------
            */

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


            let index = 0;


            while (
                index <
                lines.length
            ) {

                const line =
                    lines[index];

                const trimmed =
                    line.trim();


                /*
                -----------------------------------------
                EMPTY
                -----------------------------------------
                */

                if (!trimmed) {

                    flushParagraph();

                    index++;

                    continue;
                }


                /*
                -----------------------------------------
                HEADING
                -----------------------------------------
                */

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

                    index++;

                    continue;
                }


                /*
                -----------------------------------------
                BULLET LIST
                -----------------------------------------
                */

                if (
                    /^[-*]\s+/.test(
                        trimmed
                    )
                ) {

                    flushParagraph();

                    html += "<ul>";

                    while (
                        index <
                            lines.length &&
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

                        html +=
                            `<li>${formatInline(
                                item
                            )}</li>`;

                        index++;
                    }

                    html += "</ul>";

                    continue;
                }


                /*
                -----------------------------------------
                NUMBERED LIST
                -----------------------------------------
                */

                if (
                    /^\d+\.\s+/.test(
                        trimmed
                    )
                ) {

                    flushParagraph();

                    html += "<ol>";

                    while (
                        index <
                            lines.length &&
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

                        html +=
                            `<li>${formatInline(
                                item
                            )}</li>`;

                        index++;
                    }

                    html += "</ol>";

                    continue;
                }


                /*
                -----------------------------------------
                BLOCKQUOTE
                -----------------------------------------
                */

                if (
                    trimmed.startsWith(">")
                ) {

                    flushParagraph();

                    const quote =
                        trimmed
                            .replace(
                                /^>\s?/,
                                ""
                            );

                    html +=
                        `<blockquote>${formatInline(
                            quote
                        )}</blockquote>`;

                    index++;

                    continue;
                }


                /*
                -----------------------------------------
                NORMAL LINE
                -----------------------------------------
                */

                paragraph.push(
                    line
                );

                index++;
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
            document.createElement(
                "article"
            );

        wrapper.className =
            `message ${item.role}`;

        wrapper.dataset.index =
            String(index);


        /*
        -----------------------------------------------
        USER
        -----------------------------------------------
        */

        if (
            item.role === "user"
        ) {

            wrapper.innerHTML = `
                <div class="message-inner">

                    <div class="user-bubble">
                        ${escapeHtml(
                            item.content
                        )}
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


            /*
            -------------------------------------------
            ASSISTANT
            -------------------------------------------
            */

            wrapper.innerHTML = `
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

        if (!messages) {
            return;
        }

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

    function scrollToBottom(
        smooth = true
    ) {

        if (!chatContainer) {
            return;
        }

        requestAnimationFrame(
            () => {

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

            }
        );
    }


    /* ==================================================
       THINKING
    ================================================== */

    function setThinking(
        active
    ) {

        if (!thinking) {
            return;
        }


        if (active) {

            thinking.classList.remove(
                "hidden"
            );

            thinking.hidden =
                false;

            scrollToBottom(true);

        } else {

            thinking.classList.add(
                "hidden"
            );

            thinking.hidden =
                true;
        }
    }


    /* ==================================================
       INPUT SIZE
    ================================================== */

    function resizeInput() {

        if (!messageInput) {
            return;
        }

        messageInput.style.height =
            "auto";


        const height =
            Math.min(
                messageInput.scrollHeight,
                160
            );


        messageInput.style.height =
            `${Math.max(
                height,
                42
            )}px`;
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
                () => {

                    controller.abort();

                },
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

        } catch (error) {

            if (
                error &&
                error.name ===
                    "AbortError"
            ) {

                const timeoutError =
                    new Error(
                        "Atharv server response timeout. Please try again."
                    );

                timeoutError.name =
                    "AbortError";

                throw timeoutError;
            }


            throw error;

        } finally {

            clearTimeout(
                timer
            );
        }
    }


    /* ==================================================
       RESPONSE EXTRACTION
    ================================================== */

    function extractAnswer(
        data
    ) {

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
                typeof value ===
                    "string" &&
                value.trim()
            ) {

                return value.trim();
            }
        }


        /*
        -----------------------------------------------
        Some APIs return nested data
        -----------------------------------------------
        */

        if (
            data.data &&
            typeof data.data ===
                "object"
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

        if (sending) {
            return;
        }


        const rawMessage =
            forcedMessage !== null
                ? forcedMessage
                : messageInput.value;


        const message =
            String(
                rawMessage || ""
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

        sendButton.disabled =
            true;


        /*
        -----------------------------------------------
        CLEAR INPUT
        -----------------------------------------------
        */

        if (
            forcedMessage === null
        ) {

            messageInput.value =
                "";

            resizeInput();
        }


        /*
        -----------------------------------------------
        EXIT EDIT MODE
        -----------------------------------------------
        */

        editingIndex = -1;


        /*
        -----------------------------------------------
        WELCOME OFF
        -----------------------------------------------
        */

        welcome.classList.add(
            "hidden"
        );


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


        /*
        -----------------------------------------------
        THINKING ON
        -----------------------------------------------
        */

        setThinking(true);


        try {

            let data;


            /*
            =============================================
            LIVE RESEARCH
            =============================================
            */

            if (
                options.live ||
                liveMode
            ) {

                data =
                    await requestJson(
                        "/api/chat/research",
                        {
                            query: message,
                            message: message,
                            userId: USER_ID
                        }
                    );

            } else {


                /*
                =========================================
                NORMAL CHAT
                =========================================
                */

                const recentHistory =
                    history.slice(-12);


                data =
                    await requestJson(
                        "/api/chat",
                        {
                            message: message,

                            history:
                                recentHistory,

                            chatHistory:
                                recentHistory,

                            userId:
                                USER_ID
                        }
                    );
            }


            /*
            -----------------------------------------------
            RESPONSE
            -----------------------------------------------
            */

            const answer =
                extractAnswer(
                    data
                );


            if (!answer) {

                console.error(
                    "ATHARV EMPTY RESPONSE:",
                    data
                );

                throw new Error(
                    "Atharv server se valid response nahi mila."
                );
            }


            /*
            -----------------------------------------------
            ASSISTANT MESSAGE
            -----------------------------------------------
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
                "Sorry, response nahi mil paaya.";


            if (
                error &&
                error.name ===
                    "AbortError"
            ) {

                errorMessage =
                    "Atharv server se response aane mein bahut time lag raha hai. Please try again.";

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


            /*
            =============================================
            VERY IMPORTANT
            THINKING ALWAYS OFF
            =============================================
            */

            setThinking(false);


            sending = false;


            sendButton.disabled =
                false;


            /*
            ---------------------------------------------
            FOCUS BACK TO COMPOSER
            ---------------------------------------------
            */

            try {

                messageInput.focus();

            } catch {}


            scrollToBottom(true);
        }
    }


    /* ==================================================
       COPY TEXT
    ================================================== */

    async function copyText(
        text
    ) {

        const value =
            String(text || "");


        if (!value) {
            return;
        }


        try {

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText ===
                    "function"
            ) {

                await navigator.clipboard.writeText(
                    value
                );

            } else {

                const textarea =
                    document.createElement(
                        "textarea"
                    );

                textarea.value =
                    value;

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


            showToast(
                "Copied"
            );

        } catch (error) {

            console.warn(
                "Copy failed:",
                error
            );

            showToast(
                "Copy failed"
            );
        }
    }


    /* ==================================================
       EDIT MESSAGE
    ================================================== */

    function editMessage(
        index
    ) {

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


    /* ==================================================
       REGENERATE
    ================================================== */

    async function regenerate(
        index
    ) {

        if (sending) {
            return;
        }


        const assistantMessage =
            history[index];


        if (
            !assistantMessage ||
            assistantMessage.role !==
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


        if (userIndex < 0) {
            return;
        }


        const prompt =
            history[userIndex].content;


        /*
        Keep user message.
        Remove old assistant response
        and everything after it.
        */

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
                live:
                    liveMode
            }
        );
    }


    /* ==================================================
       CODE COPY
    ================================================== */

    function handleCodeCopy(
        button
    ) {

        try {

            const code =
                decodeURIComponent(
                    button.dataset.code ||
                        ""
                );


            copyText(code);

        } catch (error) {

            console.warn(
                "Code copy failed:",
                error
            );

            showToast(
                "Could not copy code"
            );
        }
    }


    /* ==================================================
       MESSAGE ACTIONS
    ================================================== */

    messages.addEventListener(
        "click",
        event => {

            const codeButton =
                event.target.closest(
                    ".copy-code"
                );


            if (codeButton) {

                handleCodeCopy(
                    codeButton
                );

                return;
            }


            const action =
                event.target.closest(
                    "[data-action]"
                );


            if (!action) {
                return;
            }


            const article =
                action.closest(
                    ".message"
                );


            if (!article) {
                return;
            }


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


            if (
                type === "copy"
            ) {

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

                editMessage(
                    index
                );

            } else if (
                type === "regenerate"
            ) {

                regenerate(
                    index
                );
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
       FORM SUBMIT
    ================================================== */

    chatForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            sendMessage();
        }
    );


    /* ==================================================
       ENTER TO SEND
    ================================================== */

    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
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
        event => {

            /*
            Prevent menu click from
            causing unwanted propagation.
            */

            event.stopPropagation();


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


            if (
                !selectedFiles.length
            ) {

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


            showToast(
                `${selectedFiles.length} attachment selected`
            );
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

                let finalText =
                    "";


                for (
                    let i =
                        event.resultIndex;
                    i <
                        event.results.length;
                    i++
                ) {

                    const text =
                        event.results[i][0]
                            .transcript;


                    if (
                        event.results[i]
                            .isFinal
                    ) {

                        finalText +=
                            text;
                    }
                }


                if (finalText) {

                    const existing =
                        messageInput.value
                            .trim();


                    messageInput.value =
                        existing
                            ? `${existing} ${finalText}`
                            : finalText;


                    resizeInput();

                    messageInput.focus();
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

                } else if (
                    event.error ===
                    "no-speech"
                ) {

                    showToast(
                        "No speech detected."
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

            } catch (error) {

                console.warn(
                    "Voice start:",
                    error
                );


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

            showToast(
                "Please wait for the current response."
            );

            return;
        }


        history = [];

        editingIndex = -1;

        saveHistory();


        messages.innerHTML =
            "";


        welcome.classList.remove(
            "hidden"
        );


        messageInput.value =
            "";


        resizeInput();


        selectedFiles =
            [];


        fileInput.value =
            "";


        attachmentInfo.textContent =
            "";


        attachmentInfo.classList.add(
            "hidden"
        );


        setThinking(false);


        messageInput.focus();


        scrollToBottom(false);


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


        memoryModal.hidden =
            false;


        memoryModal.setAttribute(
            "aria-hidden",
            "false"
        );


        try {

            const response =
                await fetch(
                    `${API_BASE}/api/memory?userId=${encodeURIComponent(
                        USER_ID
                    )}`,
                    {
                        method: "GET",

                        headers: {
                            "Accept":
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

            } catch {

                data = {};
            }


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    data.message ||
                    "Memory request failed."
                );
            }


            const memories =
                Array.isArray(data)
                    ? data
                    : (
                        Array.isArray(
                            data.memories
                        )
                            ? data.memories
                            : []
                    );


            if (
                !memories.length
            ) {

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
                                    ${escapeHtml(
                                        text
                                    )}
                                </div>
                            `;
                        }
                    )
                    .join("");


        } catch (error) {

            console.warn(
                "Memory error:",
                error
            );


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


        memoryModal.hidden =
            true;


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


    const memoryBackdrop =
        memoryModal.querySelector(
            ".modal-backdrop"
        );


    if (memoryBackdrop) {

        memoryBackdrop.addEventListener(
            "click",
            closeMemory
        );
    }


    /* ==================================================
       ESC KEY
    ================================================== */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                if (
                    memoryModal &&
                    !memoryModal.classList.contains(
                        "hidden"
                    )
                ) {

                    closeMemory();
                }
            }
        }
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

    function handleKeyboardViewport() {

        if (
            !window.visualViewport
        ) {
            return;
        }


        window.visualViewport.addEventListener(
            "resize",
            () => {

                setTimeout(
                    () => {

                        scrollToBottom(
                            false
                        );

                    },
                    80
                );
            }
        );


        window.visualViewport.addEventListener(
            "scroll",
            () => {

                setTimeout(
                    () => {

                        if (
                            document.activeElement ===
                                messageInput
                        ) {

                            scrollToBottom(
                                false
                            );
                        }

                    },
                    30
                );
            }
        );
    }


    /* ==================================================
       MENU COMPATIBILITY
       -----------------------------------------------
       HTML menu can use these IDs.
       We intentionally do not duplicate the
       menu open/close system if index.html
       already provides it.
    ================================================== */

    const menuButton =
        $("menuButton");

    const menuClose =
        $("menuClose");

    const menuOverlay =
        $("menuOverlay");

    const atharvMenu =
        $("atharvMenu");

    const menuAttachmentButton =
        $("menuAttachmentButton");

    const menuVoiceButton =
        $("menuVoiceButton");

    const historyButton =
        $("historyButton");

    const installAppButton =
        $("installAppButton");

    const settingsButton =
        $("settingsButton");

    const profileButton =
        $("profileButton");


    function closeMenu() {

        if (menuOverlay) {

            menuOverlay.classList.remove(
                "open"
            );
        }


        if (atharvMenu) {

            atharvMenu.classList.remove(
                "open"
            );
        }


        document.body.classList.remove(
            "menu-open"
        );
    }


    function openMenu() {

        if (menuOverlay) {

            menuOverlay.classList.add(
                "open"
            );
        }


        if (atharvMenu) {

            atharvMenu.classList.add(
                "open"
            );
        }


        document.body.classList.add(
            "menu-open"
        );
    }


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                const isOpen =
                    atharvMenu &&
                    atharvMenu.classList.contains(
                        "open"
                    );


                if (isOpen) {

                    closeMenu();

                } else {

                    openMenu();
                }
            }
        );
    }


    if (menuClose) {

        menuClose.addEventListener(
            "click",
            closeMenu
        );
    }


    if (menuOverlay) {

        menuOverlay.addEventListener(
            "click",
            closeMenu
        );
    }


    if (menuAttachmentButton) {

        menuAttachmentButton.addEventListener(
            "click",
            () => {

                closeMenu();

                setTimeout(
                    () => {
                        attachmentButton.click();
                    },
                    80
                );
            }
        );
    }


    if (menuVoiceButton) {

        menuVoiceButton.addEventListener(
            "click",
            () => {

                closeMenu();

                setTimeout(
                    () => {
                        voiceButton.click();
                    },
                    80
                );
            }
        );
    }


    if (historyButton) {

        historyButton.addEventListener(
            "click",
            () => {

                closeMenu();

                showToast(
                    history.length
                        ? `${history.length} messages in this chat`
                        : "No chat history yet"
                );
            }
        );
    }


    if (settingsButton) {

        settingsButton.addEventListener(
            "click",
            () => {

                closeMenu();

                showToast(
                    "Settings coming soon."
                );
            }
        );
    }


    if (installAppButton) {

        installAppButton.addEventListener(
            "click",
            () => {

                closeMenu();

                showToast(
                    "Use your browser's Add to Home Screen option."
                );
            }
        );
    }


    if (profileButton) {

        profileButton.addEventListener(
            "click",
            () => {

                showToast(
                    "Atharv profile"
                );
            }
        );
    }


    /* ==================================================
       INITIALIZE
    ================================================== */

    history =
        loadHistory();


    renderHistory();


    updateLiveButton();


    resizeInput();


    initVoice();


    handleKeyboardViewport();


    setThinking(false);


    /*
    -----------------------------------------------
    Initial composer focus only on desktop.
    Avoid opening keyboard automatically on mobile.
    -----------------------------------------------
    */

    if (
        window.innerWidth >= 768
    ) {

        setTimeout(
            () => {

                try {
                    messageInput.focus();
                } catch {}

            },
            100
        );
    }


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

            if (sending) {
                return;
            }

            history = [];

            saveHistory();

            renderHistory();
        },

        send: message =>
            sendMessage(message)
    };


    console.log(
        "ATHARV AI Frontend 18.2.0 initialized."
    );

})();
