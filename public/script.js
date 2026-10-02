"use strict";

console.log("=================================");
console.log("ATHARV: SCRIPT.JS LOADED");
console.log("=================================");

document.addEventListener("DOMContentLoaded", function () {

    console.log("ATHARV: DOM LOADED");

    const button = document.getElementById("sendButton");
    const input = document.getElementById("messageInput");

    console.log("ATHARV: sendButton =", button);
    console.log("ATHARV: messageInput =", input);

    if (!button) {
        console.error("ATHARV ERROR: sendButton NOT FOUND");
        return;
    }

    if (!input) {
        console.error("ATHARV ERROR: messageInput NOT FOUND");
        return;
    }

    button.disabled = false;

    button.addEventListener("click", function (event) {

        event.preventDefault();

        console.log("=================================");
        console.log("ATHARV: SEND BUTTON CLICKED");
        console.log("=================================");

        const message = input.value.trim();

        console.log(
            "ATHARV MESSAGE:",
            message
        );

        if (!message) {

            alert("Pehle message type karo.");

            input.focus();

            return;
        }

        alert(
            "SEND BUTTON WORKING!\n\nMessage:\n" +
            message
        );

    });

    console.log(
        "ATHARV: SEND BUTTON LISTENER ATTACHED"
    );

});
