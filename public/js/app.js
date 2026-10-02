"use strict";

/*
=========================================================
 ATHARV AI
 FRONTEND CONTROLLER
 Version 19.2.0
 --------------------------------------------------------
 FIXED:
 - Send button
 - Enter to send
 - Form submit
 - Attachment button
 - Voice button
 - Add button
 - Menu button
 - Menu close
 - Menu overlay
 - New Chat
 - Clear Chat
 - Live Search
 - History
 - Memory
 - Mobile composer
 - API errors
 - Browser cache/version mismatch
 - Initialization safety
=========================================================
*/

(function () {

    console.log("ATHARV AI 19.2.0: app.js loading");


    /* ==================================================
       CONFIG
    ================================================== */

    var API_BASE = window.location.origin;

    var CHAT_ENDPOINT =
        API_BASE + "/api/chat";

    var RESEARCH_ENDPOINT =
        API_BASE + "/api/chat/research";

    var MEMORY_ENDPOINT =
        API_BASE + "/api/memory";


    var STORAGE = {

        userId: "atharv_user_id_v19",

        sessionId: "atharv_session_id_v19",

        history: "atharv_chat_history_v19",

        liveMode: "atharv_live_mode_v19"

    };


    var MAX_MESSAGE_LENGTH = 12000;

    var sending = false;

    var recognition = null;

    var selectedFiles = [];


    /* ==================================================
       SAFE DOM
    ================================================== */

    function $(id) {

        return document.getElementById(id);

    }


    /* ==================================================
       STORAGE
    ================================================== */

    function safeGet(key, fallback) {

        try {

            var value = localStorage.getItem(key);

            return value === null
                ? fallback
                : value;

        } catch (error) {

            console.warn(
                "ATHARV AI: localStorage read failed",
                error
            );

            return fallback;

        }

    }


    function safeSet(key, value) {

        try {

            localStorage.setItem(
                key,
                value
            );

            return true;

        } catch (error) {

            console.warn(
                "ATHARV AI: localStorage write failed",
                error
            );

            return false;

        }

    }


    function getUserId() {

        var id = safeGet(
            STORAGE.userId,
            ""
        );

        if (!id) {

            id =
                "user_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            safeSet(
                STORAGE.userId,
                id
            );

        }

        return id;

    }


    function getSessionId() {

        var id = safeGet(
            STORAGE.sessionId,
            ""
        );

        if (!id) {

            id =
                "session_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            safeSet(
                STORAGE.sessionId,
                id
            );

        }

        return id;

    }


    function getHistory() {

        var raw = safeGet(
            STORAGE.history,
            "[]"
        );

        try {

            var data = JSON.parse(raw);

            return Array.isArray(data)
                ? data
                : [];

        } catch (error) {

            return [];

        }

    }


    function saveHistory(history) {

        safeSet(
            STORAGE.history,
            JSON.stringify(
                history.slice(-100)
            )
        );

    }


    function addHistory(role, content) {

        var history = getHistory();

        history.push({

            role: role,

            content: String(content),

            timestamp: Date.now()

        });

        saveHistory(history);

    }


    /* ==================================================
       TEXT HELPERS
    ================================================== */

    function escapeHTML(text) {

        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function formatAnswer(text) {

        var value = String(
            text === undefined ||
            text === null
                ? ""
                : text
        );

        value = escapeHTML(value);

        value = value.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

        value = value.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );

        value = value.replace(
            /\n/g,
            "<br>"
        );

        return value;

    }


    /* ==================================================
       CHAT UI
    ================================================== */

    function removeWelcome() {

        var welcome =
            $("welcomeScreen");

        if (welcome) {

            welcome.remove();

        }

    }


    function scrollToBottom() {

        var chat =
            $("chatMessages");

        if (!chat) return;

        requestAnimationFrame(function () {

            chat.scrollTop =
                chat.scrollHeight;

        });

    }


    function createMessageElement(
        role,
        content
    ) {

        var wrapper =
            document.createElement("div");

        wrapper.className =
            "message " +
            (
                role === "user"
                    ? "user-message"
                    : "assistant-message"
            );


        var bubble =
            document.createElement("div");

        bubble.className =
            "message-content";


        if (role === "user") {

            bubble.textContent =
                String(content);

        } else {

            bubble.innerHTML =
                formatAnswer(content);

        }


        wrapper.appendChild(
            bubble
        );


        return wrapper;

    }


    function addMessage(
        role,
        content,
        save
    ) {

        var chat =
            $("chatMessages");

        if (!chat) {

            console.error(
                "ATHARV AI: chatMessages not found"
            );

            return null;

        }


        removeWelcome();


        var element =
            createMessageElement(
                role,
                content
            );


        chat.appendChild(
            element
        );


        if (save !== false) {

            addHistory(
                role,
                content
            );

        }


        scrollToBottom();


        return element;

    }


    function showLoading() {

        var chat =
            $("chatMessages");

        if (!chat) return;


        removeLoading();


        var wrapper =
            document.createElement("div");

        wrapper.id =
            "atharvLoading";

        wrapper.className =
            "message assistant-message";


        var bubble =
            document.createElement("div");

        bubble.className =
            "message-content";


        bubble.textContent =
            "Atharv is thinking…";


        wrapper.appendChild(
            bubble
        );


        chat.appendChild(
            wrapper
        );


        scrollToBottom();

    }


    function removeLoading() {

        var loading =
            $("atharvLoading");

        if (loading) {

            loading.remove();

        }

    }


    /* ==================================================
       SEND STATE
    ================================================== */

    function setSendingState(active) {

        sending = active;

        var button =
            $("sendButton");

        if (!button) return;


        button.disabled = false;

        button.setAttribute(
            "aria-busy",
            active
                ? "true"
                : "false"
        );

    }


    /* ==================================================
       API
    ================================================== */

    async function fetchJSON(
        url,
        options,
        timeout
    ) {

        timeout =
            timeout || 120000;


        var controller =
            new AbortController();

        var timer =
            setTimeout(
                function () {

                    controller.abort();

                },
                timeout
            );


        try {

            var finalOptions =
                Object.assign(
                    {},
                    options || {},
                    {
                        signal:
                            controller.signal
                    }
                );


            console.log(
                "ATHARV AI: POST",
                url
            );


            var response =
                await fetch(
                    url,
                    finalOptions
                );


            console.log(
                "ATHARV AI: RESPONSE",
                response.status,
                url
            );


            var text =
                await response.text();


            var data = null;


            try {

                data =
                    text
                        ? JSON.parse(text)
                        : {};

            } catch (error) {

                data = {

                    raw: text

                };

            }


            if (!response.ok) {

                var serverMessage =
                    data &&
                    (
                        data.error ||
                        data.message
                    );


                throw new Error(
                    serverMessage ||
                    (
                        "Server error " +
                        response.status
                    )
                );

            }


            return data;

        } finally {

            clearTimeout(timer);

        }

    }


    function buildHistoryForAPI() {

        return getHistory()
            .slice(-20)
            .map(function (item) {

                return {

                    role:
                        item.role,

                    content:
                        item.content

                };

            });

    }


    function extractAnswer(data) {

        if (!data) {

            return "";

        }


        if (
            typeof data === "string"
        ) {

            return data;

        }


        var candidates = [

            data.answer,

            data.reply,

            data.response,

            data.content,

            data.text,

            data.message

        ];


        for (
            var i = 0;
            i < candidates.length;
            i++
        ) {

            if (
                typeof candidates[i] ===
                "string" &&
                candidates[i].trim()
            ) {

                return candidates[i];

            }

        }


        if (
            data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            typeof data.choices[0].message.content ===
                "string"
        ) {

            return data
                .choices[0]
                .message
                .content;

        }


        if (
            data.data &&
            typeof data.data.answer ===
                "string"
        ) {

            return data.data.answer;

        }


        return "";

    }


    async function sendNormalChat(
        message
    ) {

        var payload = {

            message: message,

            userId: getUserId(),

            sessionId: getSessionId(),

            history:
                buildHistoryForAPI()

        };


        console.log(
            "ATHARV AI: sending normal chat"
        );


        return fetchJSON(
            CHAT_ENDPOINT,
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

    }


    async function sendResearch(
        message
    ) {

        var payload = {

            message: message,

            userId: getUserId(),

            sessionId: getSessionId(),

            history:
                buildHistoryForAPI()

        };


        console.log(
            "ATHARV AI: sending live research"
        );


        return fetchJSON(
            RESEARCH_ENDPOINT,
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

    }


    /* ==================================================
       MAIN SEND
    ================================================== */

    async function sendMessage(
        forcedMessage
    ) {

        if (sending) {

            return;

        }


        var input =
            $("messageInput");

        if (!input) {

            console.error(
                "ATHARV AI: messageInput not found"
            );

            return;

        }


        var message =
            forcedMessage !== undefined
                ? String(forcedMessage).trim()
                : String(input.value).trim();


        if (!message) {

            return;

        }


        if (
            message.length >
            MAX_MESSAGE_LENGTH
        ) {

            addMessage(
                "assistant",
                "Message bahut lamba hai. Please message ko thoda chhota karein.",
                false
            );

            return;

        }


        input.value = "";

        input.style.height =
            "auto";


        addMessage(
            "user",
            message,
            true
        );


        setSendingState(true);

        showLoading();


        try {

            var live =
                safeGet(
                    STORAGE.liveMode,
                    "false"
                ) === "true";


            var data =
                live
                    ? await sendResearch(message)
                    : await sendNormalChat(message);


            console.log(
                "ATHARV AI: backend data received",
                data
            );


            var answer =
                extractAnswer(data);


            if (!answer) {

                answer =
                    "Mujhe server se valid response nahi mila.";

            }


            removeLoading();


            addMessage(
                "assistant",
                answer,
                true
            );


        } catch (error) {

            console.error(
                "ATHARV AI: CHAT ERROR",
                error
            );


            removeLoading();


            var errorMessage;


            if (
                error &&
                error.name ===
                    "AbortError"
            ) {

                errorMessage =
                    "Request timeout ho gaya. Please dobara try karein.";

            } else {

                errorMessage =
                    "Message send nahi ho saka. " +
                    (
                        error &&
                        error.message
                            ? error.message
                            : "Please try again."
                    );

            }


            addMessage(
                "assistant",
                errorMessage,
                false
            );

        } finally {

            setSendingState(false);

            input.focus();

        }

    }


    /* ==================================================
       SEND BUTTON
    ================================================== */

    function setupSend() {

        var button =
            $("sendButton");

        var input =
            $("messageInput");

        var form =
            $("composer");


        if (!button) {

            console.error(
                "ATHARV AI: sendButton missing"
            );

        } else {

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    console.log(
                        "ATHARV AI: SEND BUTTON CLICK"
                    );

                    sendMessage();

                },
                false
            );

        }


        if (!input) {

            console.error(
                "ATHARV AI: messageInput missing"
            );

        } else {

            input.addEventListener(
                "keydown",
                function (event) {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey
                    ) {

                        event.preventDefault();

                        sendMessage();

                    }

                },
                false
            );


            input.addEventListener(
                "input",
                function () {

                    this.style.height =
                        "auto";

                    this.style.height =
                        Math.min(
                            this.scrollHeight,
                            150
                        ) + "px";

                },
                false
            );

        }


        if (form) {

            form.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    console.log(
                        "ATHARV AI: FORM SUBMIT"
                    );

                    sendMessage();

                },
                false
            );

        }


        console.log(
            "ATHARV AI: send handlers ready"
        );

    }


    /* ==================================================
       MENU
    ================================================== */

    function openMenu() {

        var menu =
            $("atharvMenu");

        var overlay =
            $("menuOverlay");

        var button =
            $("menuButton");


        if (menu) {

            menu.classList.add(
                "open"
            );

            menu.classList.add(
                "active"
            );

        }


        if (overlay) {

            overlay.classList.add(
                "open"
            );

            overlay.classList.add(
                "active"
            );

            overlay.setAttribute(
                "aria-hidden",
                "false"
            );

        }


        if (button) {

            button.setAttribute(
                "aria-expanded",
                "true"
            );

        }

    }


    function closeMenu() {

        var menu =
            $("atharvMenu");

        var overlay =
            $("menuOverlay");

        var button =
            $("menuButton");


        if (menu) {

            menu.classList.remove(
                "open"
            );

            menu.classList.remove(
                "active"
            );

        }


        if (overlay) {

            overlay.classList.remove(
                "open"
            );

            overlay.classList.remove(
                "active"
            );

            overlay.setAttribute(
                "aria-hidden",
                "true"
            );

        }


        if (button) {

            button.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    function setupMenu() {

        var menuButton =
            $("menuButton");

        var menuClose =
            $("menuClose");

        var overlay =
            $("menuOverlay");


        if (menuButton) {

            menuButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    openMenu();

                },
                false
            );

        }


        if (menuClose) {

            menuClose.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeMenu();

                },
                false
            );

        }


        if (overlay) {

            overlay.addEventListener(
                "click",
                function () {

                    closeMenu();

                },
                false
            );

        }


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape"
                ) {

                    closeMenu();

                }

            },
            false
        );


        console.log(
            "ATHARV AI: menu ready"
        );

    }


    /* ==================================================
       NEW CHAT
    ================================================== */

    function newChat() {

        safeSet(
            STORAGE.history,
            "[]"
        );


        safeSet(
            STORAGE.sessionId,
            ""
        );


        var chat =
            $("chatMessages");


        if (chat) {

            chat.innerHTML = "";


            var welcome =
                document.createElement(
                    "section"
                );


            welcome.id =
                "welcomeScreen";

            welcome.className =
                "welcome";


            welcome.innerHTML =
                '<div class="welcome-inner">' +
                '<div class="welcome-logo">A</div>' +
                '<h1>How can I help you?</h1>' +
                '<p>Your AI. Every Language. Every Question.</p>' +
                "</div>";


            chat.appendChild(
                welcome
            );

        }


        closeMenu();


        var input =
            $("messageInput");

        if (input) {

            input.value = "";

            input.focus();

        }

    }


    function setupNewChat() {

        var button =
            $("newChatButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                newChat();

            },
            false
        );

    }


    /* ==================================================
       CLEAR CHAT
    ================================================== */

    function clearChat() {

        safeSet(
            STORAGE.history,
            "[]"
        );


        var chat =
            $("chatMessages");

        if (chat) {

            chat.innerHTML = "";


            var welcome =
                document.createElement(
                    "section"
                );


            welcome.id =
                "welcomeScreen";

            welcome.className =
                "welcome";


            welcome.innerHTML =
                '<div class="welcome-inner">' +
                '<div class="welcome-logo">A</div>' +
                '<h1>How can I help you?</h1>' +
                '<p>Your AI. Every Language. Every Question.</p>' +
                "</div>";


            chat.appendChild(
                welcome
            );

        }


        closeMenu();

    }


    function setupClearChat() {

        var button =
            $("clearChatButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                clearChat();

            },
            false
        );

    }


    /* ==================================================
       LOAD HISTORY
    ================================================== */

    function loadHistoryToUI() {

        var history =
            getHistory();

        if (!history.length) {

            return;

        }


        var chat =
            $("chatMessages");

        if (!chat) return;


        removeWelcome();


        history
            .slice(-100)
            .forEach(function (item) {

                if (
                    item &&
                    (
                        item.role === "user" ||
                        item.role === "assistant"
                    ) &&
                    typeof item.content ===
                        "string"
                ) {

                    addMessage(
                        item.role,
                        item.content,
                        false
                    );

                }

            });


        scrollToBottom();

    }


    function setupHistory() {

        var button =
            $("historyButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                loadHistoryToUI();

                closeMenu();

            },
            false
        );

    }


    /* ==================================================
       LIVE SEARCH
    ================================================== */

    function setupLiveSearch() {

        var button =
            $("liveSearchButton");

        if (!button) return;


        var enabled =
            safeGet(
                STORAGE.liveMode,
                "false"
            ) === "true";


        button.setAttribute(
            "aria-pressed",
            enabled
                ? "true"
                : "false"
        );


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();


                enabled =
                    !(
                        safeGet(
                            STORAGE.liveMode,
                            "false"
                        ) === "true"
                    );


                safeSet(
                    STORAGE.liveMode,
                    enabled
                        ? "true"
                        : "false"
                );


                button.setAttribute(
                    "aria-pressed",
                    enabled
                        ? "true"
                        : "false"
                );


                closeMenu();


                console.log(
                    "ATHARV AI: Live Search",
                    enabled
                );

            },
            false
        );

    }


    /* ==================================================
       ATTACHMENTS
    ================================================== */

    function setupAttachments() {

        var button =
            $("attachmentButton");

        var input =
            $("fileInput");


        if (!button) {

            console.warn(
                "ATHARV AI: attachmentButton missing"
            );

            return;

        }


        if (!input) {

            console.warn(
                "ATHARV AI: fileInput missing"
            );

            return;

        }


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                console.log(
                    "ATHARV AI: ATTACHMENT CLICK"
                );

                input.click();

            },
            false
        );


        input.addEventListener(
            "change",
            function () {

                selectedFiles =
                    Array.prototype.slice.call(
                        input.files || []
                    );


                if (
                    selectedFiles.length
                ) {

                    var names =
                        selectedFiles
                            .map(function (file) {

                                return file.name;

                            })
                            .join(", ");


                    var messageInput =
                        $("messageInput");


                    if (messageInput) {

                        messageInput.value =
                            messageInput.value
                                ? messageInput.value +
                                  "\n\nAttached: " +
                                  names
                                : "Attached: " +
                                  names;


                        messageInput.focus();

                    }

                }

            },
            false
        );

    }


    /* ==================================================
       ADD BUTTON
    ================================================== */

    function setupAddButton() {

        var button =
            $("addButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                console.log(
                    "ATHARV AI: ADD CLICK"
                );


                var attachment =
                    $("attachmentButton");


                if (attachment) {

                    attachment.click();

                }

            },
            false
        );

    }


    /* ==================================================
       VOICE
    ================================================== */

    function setupVoice() {

        var button =
            $("voiceButton");


        if (!button) return;


        var SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;


        if (!SpeechRecognition) {

            button.addEventListener(
                "click",
                function () {

                    alert(
                        "Voice input is not supported in this browser."
                    );

                },
                false
            );


            return;

        }


        recognition =
            new SpeechRecognition();


        recognition.continuous =
            false;

        recognition.interimResults =
            false;

        recognition.lang =
            "en-IN";


        recognition.onstart =
            function () {

                button.setAttribute(
                    "aria-pressed",
                    "true"
                );

                console.log(
                    "ATHARV AI: voice started"
                );

            };


        recognition.onend =
            function () {

                button.setAttribute(
                    "aria-pressed",
                    "false"
                );

            };


        recognition.onerror =
            function (event) {

                console.warn(
                    "ATHARV AI: voice error",
                    event
                );

                button.setAttribute(
                    "aria-pressed",
                    "false"
                );

            };


        recognition.onresult =
            function (event) {

                var transcript =
                    "";


                for (
                    var i = 0;
                    i <
                    event.results.length;
                    i++
                ) {

                    transcript +=
                        event.results[i][0]
                            .transcript;

                }


                var input =
                    $("messageInput");


                if (input) {

                    input.value =
                        (
                            input.value
                                ? input.value + " "
                                : ""
                        ) +
                        transcript.trim();


                    input.focus();


                    input.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles: true
                            }
                        )
                    );

                }

            };


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();


                try {

                    if (
                        button.getAttribute(
                            "aria-pressed"
                        ) === "true"
                    ) {

                        recognition.stop();

                    } else {

                        recognition.start();

                    }

                } catch (error) {

                    console.warn(
                        "ATHARV AI: voice start failed",
                        error
                    );

                }

            },
            false
        );

    }


    /* ==================================================
       MEMORY
    ================================================== */

    async function showMemory() {

        closeMenu();


        try {

            var response =
                await fetch(
                    MEMORY_ENDPOINT +
                    "?userId=" +
                    encodeURIComponent(
                        getUserId()
                    ),
                    {
                        method: "GET",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );


            var data =
                await response.json();


            console.log(
                "ATHARV AI: memory",
                data
            );


            var memories =
                data.memories ||
                data.data ||
                [];


            if (
                Array.isArray(memories) &&
                memories.length
            ) {

                var text =
                    memories
                        .map(function (item) {

                            if (
                                typeof item ===
                                    "string"
                            ) {

                                return item;

                            }

                            return (
                                item.name ||
                                item.key ||
                                item.content ||
                                JSON.stringify(item)
                            );

                        })
                        .join("\n");


                alert(
                    "Atharv AI Memory:\n\n" +
                    text
                );

            } else {

                alert(
                    "Atharv AI Memory abhi empty hai."
                );

            }

        } catch (error) {

            console.warn(
                "ATHARV AI: memory error",
                error
            );


            alert(
                "Memory load nahi ho saki."
            );

        }

    }


    function setupMemory() {

        var button =
            $("memoryButton");

        if (!button) return;


        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                showMemory();

            },
            false
        );

    }


    /* ==================================================
       DEBUG
    ================================================== */

    function debugDOM() {

        var ids = [

            "menuButton",
            "menuClose",
            "menuOverlay",
            "atharvMenu",
            "newChatButton",
            "liveSearchButton",
            "memoryButton",
            "historyButton",
            "clearChatButton",
            "composer",
            "addButton",
            "attachmentButton",
            "messageInput",
            "voiceButton",
            "sendButton",
            "fileInput",
            "chatMessages"

        ];


        ids.forEach(
            function (id) {

                if (!$(
                    id
                )) {

                    console.warn(
                        "ATHARV AI: missing element #" +
                        id
                    );

                }

            }
        );

    }


    /* ==================================================
       GLOBAL ERROR HANDLING
    ================================================== */

    window.addEventListener(
        "error",
        function (event) {

            console.error(
                "ATHARV AI GLOBAL ERROR:",
                event.error ||
                event.message
            );

        }
    );


    window.addEventListener(
        "unhandledrejection",
        function (event) {

            console.error(
                "ATHARV AI PROMISE ERROR:",
                event.reason
            );

        }
    );


    /* ==================================================
       INIT
    ================================================== */

    function init() {

        console.log(
            "ATHARV AI: initializing 19.2.0"
        );


        debugDOM();


        setupSend();

        setupMenu();

        setupNewChat();

        setupClearChat();

        setupHistory();

        setupLiveSearch();

        setupAttachments();

        setupAddButton();

        setupVoice();

        setupMemory();

        loadHistoryToUI();


        var input =
            $("messageInput");


        if (input) {

            setTimeout(
                function () {

                    input.focus();

                },
                150
            );

        }


        console.log(
            "ATHARV AI: 19.2.0 READY"
        );

    }


    /* ==================================================
       BOOT
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
