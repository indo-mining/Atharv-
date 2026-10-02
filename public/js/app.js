"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND CONTROLLER
 Version 22.0.1
 --------------------------------------------------------
 - Composer
 - Send button
 - Enter to send
 - Menu
 - Voice
 - Attachments
 - Draft
 - Quick prompts
 - PWA install
 - Memory
 - History
 - Live Search
=========================================================
*/

(() => {

    const VERSION = "22.0.1";

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            /* ==========================================
               CHAT CONTROLLER
            ========================================== */

            const chat = window.AtharvChat;

            if (!chat) {
                console.error(
                    "AtharvChat is not available."
                );
                return;
            }

            try {
                chat.init();
            } catch (error) {
                console.error(
                    "AtharvChat init failed:",
                    error
                );
            }


            /* ==========================================
               DOM
            ========================================== */

            const messageInput =
                document.getElementById("messageInput");

            const composer =
                document.getElementById("composer");

            const sendButton =
                document.getElementById("sendButton");

            const menuButton =
                document.getElementById("menuButton");

            const menuClose =
                document.getElementById("menuClose");

            const atharvMenu =
                document.getElementById("atharvMenu");

            const menuOverlay =
                document.getElementById("menuOverlay");

            const plusButton =
                document.getElementById("plusButton");

            const liveSearchToggle =
                document.getElementById("liveSearchToggle");

            const liveState =
                document.getElementById("liveState");

            const liveSwitch =
                document.getElementById("liveSwitch");

            const fileInput =
                document.getElementById("fileInput");

            const attachmentPreview =
                document.getElementById("attachmentPreview");

            const voiceButton =
                document.getElementById("voiceButton");

            const newChatButton =
                document.getElementById("newChatButton");

            const menuNewChat =
                document.getElementById("menuNewChat");

            const clearButton =
                document.getElementById("clearButton");

            const memoryButton =
                document.getElementById("memoryButton");

            const historyButton =
                document.getElementById("historyButton");

            const installButton =
                document.getElementById("installButton");


            /* ==========================================
               SEND STATE
            ========================================== */

            let sending = false;


            /* ==========================================
               DRAFT
            ========================================== */

            const DRAFT_KEY =
                "atharv_draft_v22";


            try {

                const draft =
                    localStorage.getItem(DRAFT_KEY);

                if (
                    draft &&
                    messageInput
                ) {

                    messageInput.value =
                        draft;

                    resizeTextarea();
                }

            } catch (error) {

                console.warn(
                    "Draft restore failed:",
                    error
                );
            }


            function saveDraft() {

                if (!messageInput) {
                    return;
                }

                try {

                    localStorage.setItem(
                        DRAFT_KEY,
                        messageInput.value
                    );

                } catch (error) {

                    console.warn(
                        "Draft save failed:",
                        error
                    );
                }
            }


            function clearDraft() {

                try {

                    localStorage.removeItem(
                        DRAFT_KEY
                    );

                } catch (error) {

                    console.warn(
                        "Draft clear failed:",
                        error
                    );
                }
            }


            /* ==========================================
               TEXTAREA RESIZE
            ========================================== */

            function resizeTextarea() {

                if (!messageInput) {
                    return;
                }

                messageInput.style.height =
                    "auto";

                const height =
                    Math.min(
                        Math.max(
                            messageInput.scrollHeight,
                            24
                        ),
                        140
                    );

                messageInput.style.height =
                    `${height}px`;
            }


            /* ==========================================
               TEXTAREA INPUT
            ========================================== */

            messageInput?.addEventListener(
                "input",
                () => {

                    resizeTextarea();

                    saveDraft();
                }
            );


            /* ==========================================
               SEND MESSAGE
            ========================================== */

            async function submitMessage() {

                if (sending) {
                    return;
                }

                if (!messageInput) {
                    return;
                }

                const value =
                    messageInput.value.trim();


                if (!value) {

                    messageInput.focus();

                    return;
                }


                sending = true;


                if (sendButton) {
                    sendButton.disabled = true;
                    sendButton.setAttribute(
                        "aria-disabled",
                        "true"
                    );
                }


                /*
                 * IMPORTANT:
                 *
                 * Message ko API successful hone se
                 * pehle textarea se remove nahi karna.
                 */

                try {

                    const success =
                        await chat.send(value);


                    if (success) {

                        /*
                         * Sirf successful request ke baad
                         * input clear hoga.
                         */

                        messageInput.value = "";

                        resizeTextarea();

                        clearDraft();

                    } else {

                        /*
                         * Request fail hone par message
                         * textbox mein bana rahega.
                         */

                        messageInput.value =
                            value;

                        resizeTextarea();

                        saveDraft();

                    }

                } catch (error) {

                    console.error(
                        "SEND ERROR:",
                        error
                    );


                    /*
                     * Failed request par message
                     * kabhi lose nahi hoga.
                     */

                    messageInput.value =
                        value;

                    resizeTextarea();

                    saveDraft();


                    if (
                        typeof chat.showToast ===
                        "function"
                    ) {

                        chat.showToast(
                            error?.message ||
                            "Message send nahi hua."
                        );
                    }

                } finally {

                    sending = false;


                    if (sendButton) {

                        sendButton.disabled =
                            false;

                        sendButton.removeAttribute(
                            "aria-disabled"
                        );
                    }


                    /*
                     * Mobile keyboard ko open rakho.
                     */

                    messageInput.focus();
                }
            }


            /* ==========================================
               SEND BUTTON
            ========================================== */

            if (sendButton) {

                sendButton.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        submitMessage();
                    }
                );
            }


            /* ==========================================
               ENTER TO SEND
               Shift + Enter = New Line
            ========================================== */

            messageInput?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.isComposing
                    ) {

                        event.preventDefault();

                        submitMessage();
                    }
                }
            );


            /* ==========================================
               COMPOSER SUBMIT
            ========================================== */

            composer?.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    submitMessage();
                }
            );


            /* ==========================================
               MENU
            ========================================== */

            function openMenu() {

                atharvMenu?.classList.add(
                    "open"
                );

                menuOverlay?.classList.add(
                    "show"
                );

                atharvMenu?.setAttribute(
                    "aria-hidden",
                    "false"
                );
            }


            function closeMenu() {

                atharvMenu?.classList.remove(
                    "open"
                );

                menuOverlay?.classList.remove(
                    "show"
                );

                atharvMenu?.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }


            menuButton?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    openMenu();
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


            /* ==========================================
               NEW CHAT
            ========================================== */

            function newChat() {

                try {
                    chat.clearChat();
                } catch (error) {
                    console.error(
                        "New chat failed:",
                        error
                    );
                }

                clearDraft();

                if (messageInput) {
                    messageInput.value = "";
                    resizeTextarea();
                }

                closeMenu();

                messageInput?.focus();
            }


            newChatButton?.addEventListener(
                "click",
                newChat
            );


            menuNewChat?.addEventListener(
                "click",
                newChat
            );


            /* ==========================================
               CLEAR CHAT
            ========================================== */

            clearButton?.addEventListener(
                "click",
                () => {

                    try {
                        chat.clearChat();
                    } catch (error) {
                        console.error(
                            "Clear chat failed:",
                            error
                        );
                    }

                    clearDraft();

                    if (messageInput) {
                        messageInput.value = "";
                        resizeTextarea();
                    }

                    closeMenu();
                }
            );


            /* ==========================================
               LIVE SEARCH
            ========================================== */

            function updateLiveUI() {

                let enabled = false;

                try {
                    enabled =
                        Boolean(
                            chat.getLive()
                        );
                } catch (error) {
                    console.warn(
                        "Live state read failed:",
                        error
                    );
                }


                if (liveState) {

                    liveState.textContent =
                        enabled
                            ? "On"
                            : "Off";
                }


                liveSwitch?.classList.toggle(
                    "active",
                    enabled
                );
            }


            updateLiveUI();


            liveSearchToggle?.addEventListener(
                "click",
                () => {

                    try {

                        const next =
                            !chat.getLive();

                        chat.setLive(
                            next
                        );

                        updateLiveUI();

                        chat.showToast(
                            next
                                ? "Live Search on"
                                : "Live Search off"
                        );

                    } catch (error) {

                        console.error(
                            "Live Search error:",
                            error
                        );

                        chat.showToast(
                            "Live Search could not be changed."
                        );
                    }
                }
            );


            /* ==========================================
               PLUS BUTTON
            ========================================== */

            plusButton?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    openMenu();
                }
            );


            /* ==========================================
               FILE ATTACHMENTS
            ========================================== */

            fileInput?.addEventListener(
                "change",
                () => {

                    if (
                        !fileInput.files ||
                        !fileInput.files.length
                    ) {
                        return;
                    }


                    if (
                        attachmentPreview
                    ) {

                        attachmentPreview.innerHTML =
                            "";


                        Array.from(
                            fileInput.files
                        ).forEach(
                            file => {

                                const item =
                                    document.createElement(
                                        "div"
                                    );


                                item.className =
                                    "attachment-item";


                                item.textContent =
                                    `📎 ${file.name}`;


                                attachmentPreview.appendChild(
                                    item
                                );
                            }
                        );


                        attachmentPreview.classList.add(
                            "show"
                        );
                    }


                    chat.showToast(
                        `${fileInput.files.length} file(s) attached`
                    );
                }
            );


            /* ==========================================
               VOICE INPUT
            ========================================== */

            let recognition = null;


            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;


            if (
                SpeechRecognition &&
                voiceButton
            ) {

                try {

                    recognition =
                        new SpeechRecognition();


                    recognition.lang =
                        navigator.language ||
                        "en-IN";


                    recognition.continuous =
                        false;


                    recognition.interimResults =
                        false;


                    recognition.onstart =
                        () => {

                            voiceButton.classList.add(
                                "recording"
                            );

                            chat.showToast(
                                "Listening..."
                            );
                        };


                    recognition.onend =
                        () => {

                            voiceButton.classList.remove(
                                "recording"
                            );
                        };


                    recognition.onerror =
                        error => {

                            console.warn(
                                "Voice error:",
                                error
                            );

                            voiceButton.classList.remove(
                                "recording"
                            );

                            chat.showToast(
                                "Voice input failed."
                            );
                        };


                    recognition.onresult =
                        event => {

                            const transcript =
                                Array.from(
                                    event.results
                                )
                                    .map(
                                        result =>
                                            result[0]
                                                .transcript
                                    )
                                    .join(" ");


                            if (
                                messageInput &&
                                transcript
                            ) {

                                messageInput.value =
                                    (
                                        messageInput.value
                                            ? messageInput.value + " "
                                            : ""
                                    ) +
                                    transcript;


                                resizeTextarea();

                                saveDraft();

                                messageInput.focus();
                            }
                        };


                    voiceButton.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            try {

                                recognition.start();

                            } catch (error) {

                                /*
                                 * Recognition already running.
                                 */

                                console.warn(
                                    "Voice start:",
                                    error
                                );
                            }
                        }
                    );

                } catch (error) {

                    console.error(
                        "SpeechRecognition setup failed:",
                        error
                    );
                }

            } else {

                voiceButton?.addEventListener(
                    "click",
                    () => {

                        chat.showToast(
                            "Voice input is not supported in this browser."
                        );
                    }
                );
            }


            /* ==========================================
               QUICK PROMPTS
            ========================================== */

            document
                .querySelectorAll(".quick-card")
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () => {

                                const prompt =
                                    button.dataset.prompt ||
                                    "";


                                if (
                                    messageInput &&
                                    prompt
                                ) {

                                    messageInput.value =
                                        prompt;


                                    resizeTextarea();

                                    saveDraft();

                                    messageInput.focus();
                                }
                            }
                        );
                    }
                );


            /* ==========================================
               HISTORY
            ========================================== */

            historyButton?.addEventListener(
                "click",
                () => {

                    try {

                        const history =
                            chat.getHistory();


                        if (!history.length) {

                            chat.showToast(
                                "No chat history yet."
                            );

                            return;
                        }


                        chat.showToast(
                            `${history.length} messages saved on this device.`
                        );


                        closeMenu();

                    } catch (error) {

                        console.error(
                            "History error:",
                            error
                        );

                        chat.showToast(
                            "Unable to load chat history."
                        );
                    }
                }
            );


            /* ==========================================
               MEMORY
            ========================================== */

            memoryButton?.addEventListener(
                "click",
                async () => {

                    closeMenu();


                    try {

                        const userId =
                            chat.getUserId();


                        const response =
                            await fetch(
                                `/api/memory?userId=${encodeURIComponent(
                                    userId
                                )}`,
                                {
                                    method: "GET",
                                    headers: {
                                        Accept:
                                            "application/json"
                                    }
                                }
                            );


                        let data = null;


                        try {

                            data =
                                await response.json();

                        } catch {

                            data = null;
                        }


                        if (
                            !response.ok ||
                            !data?.ok
                        ) {

                            throw new Error(
                                data?.error ||
                                `Memory request failed (${response.status})`
                            );
                        }


                        const memories =
                            Array.isArray(
                                data.memories
                            )
                                ? data.memories
                                : [];


                        if (!memories.length) {

                            chat.showToast(
                                "No saved memories."
                            );

                            return;
                        }


                        const text =
                            memories
                                .map(
                                    item =>
                                        `${item.memory_key}: ${item.memory_value}`
                                )
                                .join(
                                    " • "
                                );


                        chat.showToast(
                            text
                        );

                    } catch (error) {

                        console.error(
                            "Memory error:",
                            error
                        );

                        chat.showToast(
                            error?.message ||
                            "Memory could not be loaded."
                        );
                    }
                }
            );


            /* ==========================================
               PWA INSTALL
            ========================================== */

            let deferredPrompt =
                null;


            window.addEventListener(
                "beforeinstallprompt",
                event => {

                    event.preventDefault();

                    deferredPrompt =
                        event;


                    installButton?.classList.remove(
                        "hidden"
                    );
                }
            );


            installButton?.addEventListener(
                "click",
                async () => {

                    if (!deferredPrompt) {

                        chat.showToast(
                            "Use your browser menu and choose Add to Home screen."
                        );

                        return;
                    }


                    try {

                        deferredPrompt.prompt();

                        await deferredPrompt.userChoice;

                    } catch (error) {

                        console.warn(
                            "PWA install failed:",
                            error
                        );

                    } finally {

                        deferredPrompt =
                            null;


                        installButton?.classList.add(
                            "hidden"
                        );
                    }
                }
            );


            /* ==========================================
               SERVICE WORKER
            ========================================== */

            if (
                "serviceWorker" in navigator
            ) {

                window.addEventListener(
                    "load",
                    () => {

                        navigator.serviceWorker
                            .register(
                                `/sw.js?v=${VERSION}`
                            )
                            .then(
                                registration => {

                                    console.log(
                                        "Atharv AI service worker registered:",
                                        registration.scope
                                    );
                                }
                            )
                            .catch(
                                error => {

                                    console.warn(
                                        "Service worker registration failed:",
                                        error
                                    );
                                }
                            );
                    }
                );
            }


            /* ==========================================
               ESCAPE KEY
            ========================================== */

            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Escape"
                    ) {

                        closeMenu();
                    }
                }
            );


            /* ==========================================
               MOBILE KEYBOARD / VISIBILITY
            ========================================== */

            window.addEventListener(
                "resize",
                () => {

                    resizeTextarea();
                }
            );


            /* ==========================================
               STARTUP
            ========================================== */

            resizeTextarea();

            messageInput?.focus();


            console.log(
                `Atharv AI frontend ${VERSION} loaded successfully.`
            );

        }
    );

})();
