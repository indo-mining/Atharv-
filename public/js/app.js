"use strict";

/*
=========================================================
 ATHARV AI - FRONTEND CONTROLLER
 Version 22.0.0
 --------------------------------------------------------
 - Composer
 - Send button
 - Menu
 - Voice
 - Attachments
 - Draft
 - Quick prompts
 - PWA install
 - Memory
 - History
=========================================================
*/

(() => {

    const VERSION = "22.0.0";

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            const chat =
                window.AtharvChat;


            if (!chat) {

                console.error(
                    "AtharvChat is not available."
                );

                return;
            }


            chat.init();


            /* ==========================================
               DOM
            ========================================== */

            const messageInput =
                document.getElementById(
                    "messageInput"
                );

            const composer =
                document.getElementById(
                    "composer"
                );

            const sendButton =
                document.getElementById(
                    "sendButton"
                );

            const menuButton =
                document.getElementById(
                    "menuButton"
                );

            const menuClose =
                document.getElementById(
                    "menuClose"
                );

            const atharvMenu =
                document.getElementById(
                    "atharvMenu"
                );

            const menuOverlay =
                document.getElementById(
                    "menuOverlay"
                );

            const plusButton =
                document.getElementById(
                    "plusButton"
                );

            const liveSearchToggle =
                document.getElementById(
                    "liveSearchToggle"
                );

            const liveState =
                document.getElementById(
                    "liveState"
                );

            const liveSwitch =
                document.getElementById(
                    "liveSwitch"
                );

            const fileInput =
                document.getElementById(
                    "fileInput"
                );

            const attachmentPreview =
                document.getElementById(
                    "attachmentPreview"
                );

            const voiceButton =
                document.getElementById(
                    "voiceButton"
                );

            const newChatButton =
                document.getElementById(
                    "newChatButton"
                );

            const menuNewChat =
                document.getElementById(
                    "menuNewChat"
                );

            const clearButton =
                document.getElementById(
                    "clearButton"
                );

            const memoryButton =
                document.getElementById(
                    "memoryButton"
                );

            const historyButton =
                document.getElementById(
                    "historyButton"
                );

            const installButton =
                document.getElementById(
                    "installButton"
                );


            /* ==========================================
               DRAFT
            ========================================== */

            const DRAFT_KEY =
                "atharv_draft_v22";


            try {

                const draft =
                    localStorage.getItem(
                        DRAFT_KEY
                    );

                if (
                    draft &&
                    messageInput
                ) {
                    messageInput.value =
                        draft;

                    resizeTextarea();
                }

            } catch {}


            function saveDraft() {

                if (!messageInput) {
                    return;
                }

                try {

                    localStorage.setItem(
                        DRAFT_KEY,
                        messageInput.value
                    );

                } catch {}
            }


            function clearDraft() {

                try {

                    localStorage.removeItem(
                        DRAFT_KEY
                    );

                } catch {}
            }


            /* ==========================================
               TEXTAREA
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


            messageInput?.addEventListener(
                "input",
                () => {

                    resizeTextarea();

                    saveDraft();
                }
            );


            /* ==========================================
               SEND
            ========================================== */

            async function submitMessage() {

    if (sending) {
        return;
    }

    if (!messageInput) {
        return;
    }

    const value = messageInput.value.trim();

    if (!value) {
        messageInput.focus();
        return;
    }

    sending = true;

    if (sendButton) {
        sendButton.disabled = true;
    }

    /*
     * IMPORTANT:
     * Message ko request successful hone se pehle
     * textarea se remove nahi karna.
     */
    try {

        const success = await chat.send(value);

        if (success) {

            messageInput.value = "";

            resizeTextarea();

            clearDraft();

        } else {

            /*
             * Request fail hone par message
             * textbox mein wapas rahega.
             */
            messageInput.value = value;

            resizeTextarea();

            saveDraft();
        }

    } catch (error) {

        console.error(
            "SEND ERROR:",
            error
        );

        messageInput.value = value;

        resizeTextarea();

        saveDraft();

        chat.showToast(
            error?.message ||
            "Message send nahi hua."
        );

    } finally {

        sending = false;

        if (sendButton) {
            sendButton.disabled = false;
        }

        messageInput.focus();
    }
}

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
                openMenu
            );


            menuClose?.addEventListener(
                "click",
                closeMenu
            );


            menuOverlay?.addEventListener(
                "click",
                closeMenu
            );


            /* ==========================================
               NEW CHAT
            ========================================== */

            function newChat() {

                chat.clearChat();

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

                    chat.clearChat();

                    closeMenu();
                }
            );


            /* ==========================================
               LIVE SEARCH
            ========================================== */

            function updateLiveUI() {

                const enabled =
                    chat.getLive();


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
                }
            );


            /* ==========================================
               PLUS
            ========================================== */

            plusButton?.addEventListener(
                "click",
                () => {

                    openMenu();
                }
            );


            /* ==========================================
               FILES
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
               VOICE
            ========================================== */

            let recognition = null;


            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;


            if (
                SpeechRecognition &&
                voiceButton
            ) {

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
                    () => {

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
                                        result[0].transcript
                                )
                                .join(" ");


                        if (
                            messageInput
                        ) {

                            messageInput.value =
                                (
                                    messageInput.value
                                    ? messageInput.value +
                                      " "
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
                    () => {

                        try {

                            recognition.start();

                        } catch {

                            // Already running.
                        }
                    }
                );

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
               QUICK CARDS
            ========================================== */

            document
                .querySelectorAll(
                    ".quick-card"
                )
                .forEach(
                    button => {

                        button.addEventListener(
                            "click",
                            () => {

                                const prompt =
                                    button.dataset.prompt ||
                                    "";

                                if (
                                    messageInput
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
                                    headers: {
                                        Accept:
                                            "application/json"
                                    }
                                }
                            );


                        const data =
                            await response.json();


                        if (
                            !response.ok ||
                            !data.ok
                        ) {

                            throw new Error(
                                data.error ||
                                "Unable to load memory."
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

                        chat.showToast(
                            error.message ||
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


                    deferredPrompt.prompt();

                    await deferredPrompt.userChoice;

                    deferredPrompt =
                        null;

                    installButton.classList.add(
                        "hidden"
                    );
                }
            );


            /* ==========================================
               SERVICE WORKER
            ========================================== */

            if (
                "serviceWorker" in
                navigator
            ) {

                window.addEventListener(
                    "load",
                    () => {

                        navigator.serviceWorker
                            .register(
                                `/sw.js?v=${VERSION}`
                            )
                            .catch(
                                error =>
                                    console.warn(
                                        "Service worker registration failed:",
                                        error
                                    )
                            );
                    }
                );
            }


            /* ==========================================
               ESCAPE
            ========================================== */

            document.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Escape"
                    ) {
                        closeMenu();
                    }
                }
            );


            /* ==========================================
               START
            ========================================== */

            resizeTextarea();

            messageInput?.focus();

        }
    );

})();
