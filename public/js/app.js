"use strict";

/*
=========================================================
 ATHARV AI FRONTEND
 Version 17.2.0
 --------------------------------------------------------
 Features:
 - Normal Chat
 - Live Research
 - Voice Input
 - Attachments UI
 - Memory
 - Chat History
 - New Chat
 - Copy
 - Edit
 - Regenerate
 - Code Copy
 - Auto textarea resize
 - Mobile friendly
 - PWA compatible
=========================================================
*/


/* ======================================================
   CONFIG
====================================================== */

const API_BASE = "";

const MAX_MESSAGE_LENGTH = 12000;

const REQUEST_TIMEOUT = 120000;

const STORAGE_KEYS = {
    USER_ID: "atharv_user_id_v17",
    HISTORY: "atharv_chat_history_v17",
    LIVE: "atharv_live_mode_v17"
};


/* ======================================================
   DOM
====================================================== */

const chatForm =
    document.getElementById("chatForm");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const messages =
    document.getElementById("messages");

const thinking =
    document.getElementById("thinking");

const welcome =
    document.getElementById("welcome");

const newChatButton =
    document.getElementById("newChatButton");

const memoryButton =
    document.getElementById("memoryButton");

const liveButton =
    document.getElementById("liveButton");

const attachmentButton =
    document.getElementById("attachmentButton");

const fileInput =
    document.getElementById("fileInput");

const attachmentInfo =
    document.getElementById("attachmentInfo");

const voiceButton =
    document.getElementById("voiceButton");

const toast =
    document.getElementById("toast");

const memoryModal =
    document.getElementById("memoryModal");

const closeMemoryButton =
    document.getElementById("closeMemoryButton");

const memoryList =
    document.getElementById("memoryList");


/* ======================================================
   STATE
====================================================== */

let history = [];

let sending = false;

let liveMode =
    localStorage.getItem(
        STORAGE_KEYS.LIVE
    ) === "true";

let selectedFiles = [];

let editingIndex = -1;


/* ======================================================
   USER ID
====================================================== */

function getUserId() {

    let userId =
        localStorage.getItem(
            STORAGE_KEYS.USER_ID
        );

    if (!userId) {

        userId =
            "user_" +
            cryptoRandom();

        localStorage.setItem(
            STORAGE_KEYS.USER_ID,
            userId
        );
    }

    return userId;
}


function cryptoRandom() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2)
    );
}


const USER_ID = getUserId();


/* ======================================================
   STORAGE
====================================================== */

function loadHistory() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEYS.HISTORY
            );

        if (!raw) {
            return [];
        }

        const parsed =
            JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];

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
            STORAGE_KEYS.HISTORY,
            JSON.stringify(history.slice(-100))
        );

    } catch (error) {

        console.warn(
            "History save failed:",
            error
        );
    }
}


/* ======================================================
   INITIALIZATION
====================================================== */

function init() {

    history =
        loadHistory();

    updateLiveButton();

    renderHistory();

    bindEvents();

    resizeInput();

    updateOnlineStatus();

    initVoiceInput();

    window.addEventListener(
        "online",
        updateOnlineStatus
    );

    window.addEventListener(
        "offline",
        updateOnlineStatus
    );

    if (history.length === 0) {
        showWelcome();
    } else {
        hideWelcome();
    }
}


/* ======================================================
   EVENTS
====================================================== */

function bindEvents() {

    if (chatForm) {

        chatForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                handleSend();

            }
        );
    }


    if (messageInput) {

        messageInput.addEventListener(
            "input",
            resizeInput
        );


        messageInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {

                    event.preventDefault();

                    handleSend();

                }

            }
        );
    }


    if (sendButton) {

        sendButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                handleSend();

            }
        );
    }


    if (newChatButton) {

        newChatButton.addEventListener(
            "click",
            newChat
        );
    }


    if (memoryButton) {

        memoryButton.addEventListener(
            "click",
            openMemory
        );
    }


    if (closeMemoryButton) {

        closeMemoryButton.addEventListener(
            "click",
            closeMemory
        );
    }


    if (memoryModal) {

        const backdrop =
            memoryModal.querySelector(
                ".modal-backdrop"
            );

        if (backdrop) {

            backdrop.addEventListener(
                "click",
                closeMemory
            );
        }
    }


    if (liveButton) {

        liveButton.addEventListener(
            "click",
            toggleLive
        );
    }


    if (attachmentButton) {

        attachmentButton.addEventListener(
            "click",
            function () {

                if (fileInput) {
                    fileInput.click();
                }

            }
        );
    }


    if (fileInput) {

        fileInput.addEventListener(
            "change",
            handleFiles
        );
    }


    bindPromptButtons();

    bindGlobalMessageActions();
}


/* ======================================================
   PROMPT BUTTONS
====================================================== */

function bindPromptButtons() {

    document
        .querySelectorAll(
            ".suggestion, .example-chip"
        )
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const prompt =
                        button.dataset.prompt ||
                        button.textContent.trim();

                    if (!prompt) return;

                    messageInput.value =
                        prompt;

                    resizeInput();

                    handleSend();

                }
            );

        });
}


/* ======================================================
   LIVE MODE
====================================================== */

function toggleLive() {

    liveMode = !liveMode;

    localStorage.setItem(
        STORAGE_KEYS.LIVE,
        String(liveMode)
    );

    updateLiveButton();

    showToast(
        liveMode
            ? "Live search enabled"
            : "Live search disabled"
    );
}


function updateLiveButton() {

    if (!liveButton) return;

    liveButton.setAttribute(
        "aria-pressed",
        String(liveMode)
    );

    liveButton.classList.toggle(
        "active",
        liveMode
    );
}


/* ======================================================
   SEND
====================================================== */

async function handleSend() {

    if (sending) {
        return;
    }

    const text =
        messageInput.value.trim();

    if (!text) {
        return;
    }

    if (
        text.length >
        MAX_MESSAGE_LENGTH
    ) {

        showToast(
            "Message is too long."
        );

        return;
    }


    const userMessage = {
        role: "user",
        content: text
    };


    if (editingIndex >= 0) {

        history =
            history.slice(
                0,
                editingIndex
            );

        editingIndex = -1;

    }


    history.push(
        userMessage
    );

    saveHistory();

    hideWelcome();

    renderHistory();

    messageInput.value = "";

    resizeInput();

    clearAttachments();

    setSending(true);


    try {

        let result;

        if (liveMode) {

            result =
                await requestLive(
                    text
                );

        } else {

            result =
                await requestChat(
                    text
                );

        }


        const answer =
            extractAnswer(result);


        if (!answer) {

            throw new Error(
                "No response received"
            );
        }


        history.push({
            role: "assistant",
            content: answer
        });

        saveHistory();

        renderHistory();

        scrollToBottom(true);

    } catch (error) {

        console.error(
            "Chat error:",
            error
        );

        const errorMessage =
            getErrorMessage(error);

        history.push({
            role: "assistant",
            content:
                "Sorry, I couldn't complete that request.\n\n" +
                errorMessage
        });

        saveHistory();

        renderHistory();

        showToast(
            errorMessage
        );

    } finally {

        setSending(false);

    }
}


/* ======================================================
   API
====================================================== */

async function requestChat(message) {

    return requestJSON(
        "/api/chat",
        {
            message,
            history: history.slice(-12),
            chatHistory: history.slice(-12),
            userId: USER_ID
        }
    );
}


async function requestLive(message) {

    return requestJSON(
        "/api/chat/research",
        {
            query: message,
            message,
            userId: USER_ID
        }
    );
}


/* ======================================================
   REQUEST
====================================================== */

async function requestJSON(
    endpoint,
    payload
) {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            function () {
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
                        JSON.stringify(
                            payload
                        ),

                    signal:
                        controller.signal
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
                text
            };
        }


        if (!response.ok) {

            throw new Error(
                data?.error ||
                data?.message ||
                data?.text ||
                `Request failed (${response.status})`
            );
        }


        return data;

    } finally {

        clearTimeout(timeout);

    }
}


/* ======================================================
   RESPONSE EXTRACTION
====================================================== */

function extractAnswer(data) {

    if (!data) {
        return "";
    }


    if (typeof data === "string") {
        return data;
    }


    return (
        data.answer ||
        data.response ||
        data.message ||
        data.content ||
        data.text ||
        data.result ||
        ""
    );
}


/* ======================================================
   ERROR
====================================================== */

function getErrorMessage(error) {

    if (!navigator.onLine) {

        return "Internet connection is unavailable.";
    }


    if (
        error &&
        error.name === "AbortError"
    ) {

        return "The request took too long. Please try again.";
    }


    return (
        error?.message ||
        "Something went wrong. Please try again."
    );
}


/* ======================================================
   RENDER HISTORY
====================================================== */

function renderHistory() {

    if (!messages) {
        return;
    }

    messages.innerHTML = "";

    history.forEach(
        function (item, index) {

            renderMessage(
                item,
                index
            );

        }
    );

    if (history.length > 0) {
        hideWelcome();
    }

    scrollToBottom(false);
}


/* ======================================================
   RENDER MESSAGE
====================================================== */

function renderMessage(
    item,
    index
) {

    const row =
        document.createElement(
            "div"
        );

    row.className =
        "message-row " +
        (
            item.role === "user"
                ? "user"
                : "assistant"
        );


    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "message";


    if (item.role === "assistant") {

        bubble.innerHTML =
            formatResponse(
                item.content || ""
            );

    } else {

        bubble.textContent =
            item.content || "";

    }


    row.appendChild(
        bubble
    );


    addMessageActions(
        row,
        item,
        index
    );


    messages.appendChild(
        row
    );
}


/* ======================================================
   MESSAGE ACTIONS
====================================================== */

function addMessageActions(
    row,
    item,
    index
) {

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "atharv-message-actions";


    if (item.role === "assistant") {

        actions.appendChild(
            actionButton(
                "Copy",
                "copy",
                index
            )
        );

        actions.appendChild(
            actionButton(
                "Regenerate",
                "regenerate",
                index
            )
        );

    } else {

        actions.appendChild(
            actionButton(
                "Edit",
                "edit",
                index
            )
        );

        actions.appendChild(
            actionButton(
                "Copy",
                "copy",
                index
            )
        );
    }


    row.appendChild(
        actions
    );
}


function actionButton(
    label,
    action,
    index
) {

    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.className =
        "atharv-message-action";

    button.dataset.action =
        action;

    button.dataset.index =
        String(index);

    button.textContent =
        label;

    return button;
}


/* ======================================================
   GLOBAL MESSAGE ACTIONS
====================================================== */

function bindGlobalMessageActions() {

    if (!messages) {
        return;
    }


    messages.addEventListener(
        "click",
        async function (event) {

            const button =
                event.target.closest(
                    ".atharv-message-action"
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.action;


            const index =
                Number(
                    button.dataset.index
                );


            if (
                Number.isNaN(index) ||
                !history[index]
            ) {
                return;
            }


            if (action === "copy") {

                await copyText(
                    history[index].content
                );

                showToast(
                    "Copied"
                );

            }


            if (action === "edit") {

                editMessage(
                    index
                );

            }


            if (action === "regenerate") {

                regenerateMessage(
                    index
                );

            }

        }
    );


    messages.addEventListener(
        "click",
        async function (event) {

            const button =
                event.target.closest(
                    ".atharv-copy-code"
                );


            if (!button) {
                return;
            }


            const code =
                button
                    .closest(
                        ".atharv-code-block"
                    )
                    ?.querySelector(
                        "code"
                    );


            if (!code) {
                return;
            }


            await copyText(
                code.textContent
            );

            button.textContent =
                "Copied";

            setTimeout(
                function () {
                    button.textContent =
                        "Copy Code";
                },
                1200
            );

        }
    );
}


/* ======================================================
   EDIT
====================================================== */

function editMessage(index) {

    const item =
        history[index];

    if (!item) {
        return;
    }

    messageInput.value =
        item.content || "";

    editingIndex =
        index;

    resizeInput();

    messageInput.focus();

    showToast(
        "Edit your message and send again"
    );
}


/* ======================================================
   REGENERATE
====================================================== */

async function regenerateMessage(
    assistantIndex
) {

    if (sending) {
        return;
    }


    const previousUserIndex =
        assistantIndex - 1;


    if (
        previousUserIndex < 0 ||
        history[previousUserIndex]?.role !== "user"
    ) {

        showToast(
            "Unable to regenerate this response."
        );

        return;
    }


    const prompt =
        history[
            previousUserIndex
        ].content;


    history =
        history.slice(
            0,
            assistantIndex
        );

    saveHistory();

    renderHistory();

    setSending(true);


    try {

        const result =
            liveMode
                ? await requestLive(prompt)
                : await requestChat(prompt);


        const answer =
            extractAnswer(result);


        if (!answer) {
            throw new Error(
                "No response received"
            );
        }


        history.push({
            role: "assistant",
            content: answer
        });

        saveHistory();

        renderHistory();

    } catch (error) {

        console.error(
            "Regenerate error:",
            error
        );

        showToast(
            getErrorMessage(error)
        );

    } finally {

        setSending(false);

    }
}


/* ======================================================
   FORMAT RESPONSE
====================================================== */

function formatResponse(text) {

    if (!text) {
        return "";
    }


    const escaped =
        escapeHTML(text);


    const codeParts =
        [];


    const withCode =
        escaped.replace(
            /```([\w+-]*)\n?([\s\S]*?)```/g,
            function (
                full,
                language,
                code
            ) {

                const token =
                    `@@ATHARV_CODE_${codeParts.length}@@`;

                codeParts.push({
                    language:
                        language ||
                        "code",

                    code:
                        code.trim()
                });

                return token;
            }
        );


    let html =
        withCode;


    html =
        html.replace(
            /^### (.+)$/gm,
            "<h4>$1</h4>"
        );


    html =
        html.replace(
            /^## (.+)$/gm,
            "<h3>$1</h3>"
        );


    html =
        html.replace(
            /^# (.+)$/gm,
            "<h2>$1</h2>"
        );


    html =
        html.replace(
            /\*\*(.+?)\*\*/g,
            "<strong>$1</strong>"
        );


    html =
        html.replace(
            /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
            "<em>$1</em>"
        );


    html =
        html.replace(
            /`([^`\n]+)`/g,
            "<code>$1</code>"
        );


    html =
        html.replace(
            /^[-*] (.+)$/gm,
            "<li>$1</li>"
        );


    html =
        html.replace(
            /(<li>.*<\/li>)/gs,
            "<ul>$1</ul>"
        );


    html =
        html.replace(
            /^\d+\.\s+(.+)$/gm,
            "<li>$1</li>"
        );


    html =
        html.replace(
            /(?:<li>.*<\/li>)/gs,
            function (block) {

                if (
                    block.includes("<ul>")
                ) {
                    return block;
                }

                return block;
            }
        );


    html =
        html.replace(
            /\n{2,}/g,
            "</p><p>"
        );


    html =
        html.replace(
            /\n/g,
            "<br>"
        );


    html =
        "<p>" +
        html +
        "</p>";


    codeParts.forEach(
        function (part, index) {

            const token =
                `@@ATHARV_CODE_${index}@@`;


            const codeHTML =
                `
                <div class="atharv-code-block">

                    <div class="atharv-code-header">

                        <span>
                            ${escapeHTML(part.language)}
                        </span>

                        <button
                            type="button"
                            class="atharv-copy-code"
                        >
                            Copy Code
                        </button>

                    </div>

                    <pre><code>${escapeHTML(part.code)}</code></pre>

                </div>
                `;


            html =
                html.replace(
                    token,
                    codeHTML
                );
        }
    );


    return html;
}


/* ======================================================
   HTML ESCAPE
====================================================== */

function escapeHTML(value) {

    return String(value)
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


/* ======================================================
   COPY
====================================================== */

async function copyText(text) {

    if (!text) {
        return;
    }


    try {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                text
            );

            return;
        }

    } catch (error) {

        console.warn(
            "Clipboard API failed:",
            error
        );

    }


    const textarea =
        document.createElement(
            "textarea"
        );

    textarea.value =
        text;

    textarea.style.position =
        "fixed";

    textarea.style.left =
        "-9999px";

    document.body.appendChild(
        textarea
    );

    textarea.select();

    try {
        document.execCommand(
            "copy"
        );
    } catch (error) {
        console.warn(
            "Fallback copy failed:",
            error
        );
    }

    textarea.remove();
}


/* ======================================================
   ATTACHMENTS
====================================================== */

function handleFiles(event) {

    selectedFiles =
        Array.from(
            event.target.files || []
        );


    if (
        selectedFiles.length === 0
    ) {

        clearAttachments();

        return;
    }


    const names =
        selectedFiles
            .map(
                function (file) {
                    return file.name;
                }
            )
            .slice(0, 3);


    const more =
        selectedFiles.length > 3
            ? ` +${selectedFiles.length - 3} more`
            : "";


    if (attachmentInfo) {

        attachmentInfo.hidden =
            false;

        attachmentInfo.textContent =
            names.join(", ") +
            more;
    }


    showToast(
        `${selectedFiles.length} file selected`
    );
}


function clearAttachments() {

    selectedFiles = [];


    if (fileInput) {
        fileInput.value = "";
    }


    if (attachmentInfo) {

        attachmentInfo.hidden =
            true;

        attachmentInfo.textContent =
            "";
    }
}


/* ======================================================
   VOICE INPUT
====================================================== */

function initVoiceInput() {

    if (
        !voiceButton ||
        !messageInput
    ) {
        return;
    }


    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        voiceButton.disabled =
            true;

        voiceButton.title =
            "Voice input is not supported in this browser";

        voiceButton.setAttribute(
            "aria-label",
            "Voice input is not supported"
        );

        return;
    }


    const recognition =
        new SpeechRecognition();


    recognition.continuous =
        false;

    recognition.interimResults =
        true;

    recognition.maxAlternatives =
        1;


    /*
     * Indian English is a useful default.
     * Browser recognition can still vary by device/browser.
     */
    recognition.lang =
        navigator.language ||
        "en-IN";


    let listening =
        false;

    let baseText =
        "";

    let finalText =
        "";


    function setListening(
        active
    ) {

        listening =
            active;


        voiceButton.classList.toggle(
            "is-listening",
            active
        );


        voiceButton.setAttribute(
            "aria-pressed",
            String(active)
        );


        if (active) {

            voiceButton.title =
                "Stop voice input";

            voiceButton.setAttribute(
                "aria-label",
                "Stop voice input"
            );

            voiceButton.innerHTML =
                '<span aria-hidden="true">⏹</span>';

        } else {

            voiceButton.title =
                "Voice input";

            voiceButton.setAttribute(
                "aria-label",
                "Voice input"
            );

            voiceButton.innerHTML =
                '<span aria-hidden="true">🎤</span>';
        }
    }


    voiceButton.addEventListener(
        "click",
        function () {

            if (listening) {

                try {
                    recognition.stop();
                } catch (error) {
                    console.warn(
                        "Voice stop error:",
                        error
                    );
                }

                return;
            }


            baseText =
                messageInput.value.trim();

            finalText =
                "";


            try {

                recognition.start();

            } catch (error) {

                console.warn(
                    "Voice start error:",
                    error
                );

            }
        }
    );


    recognition.onstart =
        function () {

            setListening(
                true
            );

            showToast(
                "Listening..."
            );
        };


    recognition.onresult =
        function (event) {

            let interimText =
                "";


            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {

                const transcript =
                    event.results[i][0].transcript;


                if (
                    event.results[i].isFinal
                ) {

                    finalText +=
                        transcript + " ";

                } else {

                    interimText +=
                        transcript;
                }
            }


            const voiceText =
                (
                    finalText +
                    interimText
                ).trim();


            const combined =
                baseText
                    ? baseText +
                      (
                          voiceText
                              ? " " + voiceText
                              : ""
                      )
                    : voiceText;


            messageInput.value =
                combined.trim();


            resizeInput();

        };


    recognition.onerror =
        function (event) {

            console.warn(
                "Speech recognition error:",
                event.error
            );


            setListening(
                false
            );


            let errorMessage =
                "Voice input could not be started.";


            if (
                event.error ===
                "not-allowed"
            ) {

                errorMessage =
                    "Microphone permission is required.";

            } else if (
                event.error ===
                "no-speech"
            ) {

                errorMessage =
                    "No speech detected.";

            } else if (
                event.error ===
                "network"
            ) {

                errorMessage =
                    "Voice recognition network error.";
            }


            showToast(
                errorMessage
            );
        };


    recognition.onend =
        function () {

            setListening(
                false
            );


            try {

                messageInput.focus();

                const length =
                    messageInput.value.length;

                messageInput.setSelectionRange(
                    length,
                    length
                );

            } catch (error) {

                console.warn(
                    "Voice focus error:",
                    error
                );
            }
        };


    window.AtharvVoice = {

        start: function () {

            if (!listening) {

                try {
                    recognition.start();
                } catch (error) {
                    console.warn(
                        "Voice start error:",
                        error
                    );
                }
            }
        },


        stop: function () {

            if (listening) {

                try {
                    recognition.stop();
                } catch (error) {
                    console.warn(
                        "Voice stop error:",
                        error
                    );
                }
            }
        },


        isListening:
            function () {
                return listening;
            }

    };
}


/* ======================================================
   INPUT RESIZE
====================================================== */

function resizeInput() {

    if (!messageInput) {
        return;
    }


    messageInput.style.height =
        "auto";


    const maxHeight =
        window.innerWidth <= 600
            ? 140
            : 220;


    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            maxHeight
        ) + "px";
}


/* ======================================================
   SENDING STATE
====================================================== */

function setSending(
    active
) {

    sending =
        active;


    if (sendButton) {

        sendButton.disabled =
            active;

        sendButton.setAttribute(
            "aria-busy",
            String(active)
        );

        sendButton.innerHTML =
            active
                ? '<span aria-hidden="true">…</span>'
                : '<span aria-hidden="true">➤</span>';
    }


    if (thinking) {

        thinking.hidden =
            !active;
    }


    if (active) {

        scrollToBottom(
            true
        );
    }
}


/* ======================================================
   WELCOME
====================================================== */

function showWelcome() {

    if (welcome) {
        welcome.hidden =
            false;
    }
}


function hideWelcome() {

    if (welcome) {
        welcome.hidden =
            true;
    }
}


/* ======================================================
   NEW CHAT
====================================================== */

function newChat() {

    if (sending) {
        return;
    }


    if (
        history.length > 0 &&
        !window.confirm(
            "Start a new chat?"
        )
    ) {
        return;
    }


    history = [];

    editingIndex = -1;

    saveHistory();

    clearAttachments();

    if (messageInput) {

        messageInput.value =
            "";

        resizeInput();
    }


    if (messages) {
        messages.innerHTML =
            "";
    }


    showWelcome();

    showToast(
        "New chat started"
    );
}


/* ======================================================
   MEMORY
====================================================== */

async function openMemory() {

    if (!memoryModal) {
        return;
    }


    memoryModal.hidden =
        false;


    if (memoryList) {

        memoryList.innerHTML =
            `
            <div class="memory-empty">
                Loading memory...
            </div>
            `;
    }


    try {

        const response =
            await fetch(
                "/api/memory?userId=" +
                encodeURIComponent(
                    USER_ID
                ),
                {
                    method: "GET",
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `Memory request failed (${response.status})`
            );
        }


        const data =
            await response.json();


        const items =
            Array.isArray(data)
                ? data
                : (
                    data.memories ||
                    data.items ||
                    []
                );


        renderMemory(
            items
        );

    } catch (error) {

        console.error(
            "Memory error:",
            error
        );


        if (memoryList) {

            memoryList.innerHTML =
                `
                <div class="memory-empty">
                    Memory could not be loaded.
                </div>
                `;
        }
    }
}


function renderMemory(
    items
) {

    if (!memoryList) {
        return;
    }


    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        memoryList.innerHTML =
            `
            <div class="memory-empty">
                No saved memories yet.
            </div>
            `;

        return;
    }


    memoryList.innerHTML =
        items
            .map(
                function (item) {

                    const memory =
                        typeof item === "string"
                            ? item
                            : (
                                item.memory ||
                                item.content ||
                                ""
                            );


                    return `
                        <div class="memory-item">
                            ${escapeHTML(memory)}
                        </div>
                    `;

                }
            )
            .join("");
}


function closeMemory() {

    if (memoryModal) {

        memoryModal.hidden =
            true;
    }
}


/* ======================================================
   ONLINE STATUS
====================================================== */

function updateOnlineStatus() {

    if (!navigator.onLine) {

        showToast(
            "You are offline"
        );
    }
}


/* ======================================================
   TOAST
====================================================== */

let toastTimer =
    null;


function showToast(
    message
) {

    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.hidden =
        false;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            function () {

                toast.hidden =
                    true;

            },
            2400
        );
}


/* ======================================================
   SCROLL
====================================================== */

function scrollToBottom(
    smooth
) {

    if (!messages) {
        return;
    }


    requestAnimationFrame(
        function () {

            messages.scrollTo({
                top:
                    messages.scrollHeight,

                behavior:
                    smooth
                        ? "smooth"
                        : "auto"
            });

        }
    );
}


/* ======================================================
   GLOBAL API
====================================================== */

window.AtharvAI = {

    showToast,

    newChat,

    getHistory:
        function () {
            return history.slice();
        },

    getUserId:
        function () {
            return USER_ID;
        },

    isLive:
        function () {
            return liveMode;
        },

    clearHistory:
        function () {

            history = [];

            saveHistory();

            renderHistory();

        }

};


/* ======================================================
   START
====================================================== */

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
