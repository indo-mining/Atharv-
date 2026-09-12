const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("message");
const sendButton = document.querySelector(".send");

// Atharv backend URL
// Same website par backend ho to "/" rakhein.
// Agar backend alag server par hai to yahan uska URL डालें.
const API_BASE = "";

let isThinking = false;

// ========================================
// ADD MESSAGE
// ========================================

function addMessage(text, type) {

const message = document.createElement("div");

message.className = "message " + type;

// Safe text rendering
message.textContent = text;

chatBox.appendChild(message);

message.scrollIntoView({
behavior: "smooth",
block: "end"
});

return message;
}

// ========================================
// TYPING / THINKING MESSAGE
// ========================================

function showThinking() {

const message = document.createElement("div");

message.className = "message ai";
message.id = "thinkingMessage";

message.textContent = "Atharv soch raha hai... 🤔";

chatBox.appendChild(message);

message.scrollIntoView({
behavior: "smooth",
block: "end"
});
}

function removeThinking() {

const thinking = document.getElementById("thinkingMessage");

if (thinking) {
thinking.remove();
}
}

// ========================================
// SEND MESSAGE
// ========================================

async function sendMessage() {

const message = messageInput.value.trim();

if (!message || isThinking) {
return;
}

// User message
addMessage(message, "user");

messageInput.value = "";

isThinking = true;

sendButton.disabled = true;
sendButton.style.opacity = "0.5";

showThinking();

try {

const response = await fetch(API_BASE + "/api/chat", {

  method: "POST",

  headers: {
    "Content-Type": "application/json"
  },

  body: JSON.stringify({
    message: message
  })

});


const data = await response.json();

removeThinking();


if (!response.ok) {

  throw new Error(
    data.error || "Atharv server error"
  );

}


const reply =
  data.reply ||
  data.message ||
  "Atharv ko response nahi mila.";


addMessage(reply, "ai");

} catch (error) {

removeThinking();

console.error("ATHARV ERROR:", error);

addMessage(
  "Sorry 🙏 Atharv server se connection nahi ho pa raha. Thodi der baad dobara try karein.",
  "ai"
);

}

isThinking = false;

sendButton.disabled = false;
sendButton.style.opacity = "1";

messageInput.focus();
}

// ========================================
// QUICK QUESTIONS
// ========================================

function quickAsk(text) {

if (isThinking) {
return;
}

messageInput.value = text;

sendMessage();
}

// ========================================
// ENTER TO SEND
// ========================================

messageInput.addEventListener("keydown", function(event) {

if (event.key === "Enter" && !event.shiftKey) {

event.preventDefault();

sendMessage();

}

});

// ========================================
// AUTO RESIZE TEXTAREA
// ========================================

messageInput.addEventListener("input", function() {

this.style.height = "auto";

this.style.height =
Math.min(this.scrollHeight, 120) + "px";

});

// ========================================
// PROFILE BUTTON
// ========================================

const profileButton = document.querySelector(".profile");

if (profileButton) {

profileButton.addEventListener("click", function() {

addMessage(
  "👤 Profile section Atharv ke next update mein activate hoga.",
  "ai"
);

});

}

// ========================================
// BOTTOM NAV
// ========================================

const navButtons =
document.querySelectorAll(".bottom-nav button");

navButtons.forEach(function(button) {

button.addEventListener("click", function() {

navButtons.forEach(function(btn) {
  btn.classList.remove("active");
});

button.classList.add("active");

});

});

// ========================================
// WELCOME
// ========================================

console.log("ATHARV AI loaded successfully 🤖");
console.log("Waiting for /api/chat backend...");
