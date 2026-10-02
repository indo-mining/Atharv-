"use strict";

(() => {

    document.addEventListener("DOMContentLoaded", () => {

        const chat = window.AtharvChat;

        if (!chat) {
            alert("Atharv Chat load nahi hua.");
            return;
        }

        chat.init();

        const form =
            document.getElementById("composer");

        const input =
            document.getElementById("messageInput");

        const sendButton =
            document.getElementById("sendButton");

        const voiceButton =
            document.getElementById("voiceButton");


        /* =========================================
           SEND
        ========================================= */

        async function sendMessage() {

            if (!input) return;

            const message =
                input.value.trim();

            if (!message) return;

            if (sendButton) {
                sendButton.disabled = true;
            }

            try {

                const success =
                    await chat.send(message);

                if (success) {
                    input.value = "";
                    input.style.height = "auto";

                    try {
                        localStorage.removeItem(
                            "atharv_draft_v22"
                        );
                    } catch {}
                }

            } catch (error) {

                chat.showToast(
                    error?.message ||
                    "Message send nahi hua."
                );

            } finally {

                if (sendButton) {
                    sendButton.disabled = false;
                }

                input.focus();
            }
        }


        /* =========================================
           FORM
        ========================================= */

        if (form) {

            form.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    sendMessage();
                }
            );

        }


        /* =========================================
           ENTER
        ========================================= */

        if (input) {

            input.addEventListener(
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


            input.addEventListener(
                "input",
                () => {

                    input.style.height = "auto";

                    input.style.height =
                        Math.min(
                            input.scrollHeight,
                            160
                        ) + "px";

                    try {
                        localStorage.setItem(
                            "atharv_draft_v22",
                            input.value
                        );
                    } catch {}
                }
            );

        }


        /* =========================================
           VOICE
        ========================================= */

        if (
            voiceButton &&
            (
                "webkitSpeechRecognition" in window ||
                "SpeechRecognition" in window
            )
        ) {

            const SpeechRecognition =
                window.SpeechRecognition ||
                window.webkitSpeechRecognition;

            const recognition =
                new SpeechRecognition();

            recognition.lang =
                navigator.language || "en-IN";

            recognition.continuous = false;

            recognition.interimResults = false;


            voiceButton.addEventListener(
                "click",
                () => {

                    try {
                        recognition.start();
                    } catch {}
                }
            );


            recognition.onresult =
                event => {

                    const text =
                        event.results?.[0]?.[0]?.transcript ||
                        "";

                    if (input && text) {

                        input.value =
                            text;

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
        }


        /* =========================================
           READY
        ========================================= */

        console.log(
            "[Atharv AI] App ready"
        );

    });

})();
