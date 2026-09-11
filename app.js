const chatBox = document.getElementById("chatBox");

const messageInput = document.getElementById("message");


function addMessage(text, type) {

  const message = document.createElement("div");

  message.className = "message " + type;

  message.innerHTML = text;

  chatBox.appendChild(message);

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}


function sendMessage() {

  const message = messageInput.value.trim();

  if (!message) {
    return;
  }

  addMessage(message, "user");

  messageInput.value = "";

  setTimeout(function () {

    addMessage(
      "Demo response 🤖<br><br>" +
      "Atharv AI engine ko next step mein connect karenge.",
      "ai"
    );

  }, 600);
}


function quickAsk(text) {

  messageInput.value = text;

  sendMessage();

}


messageInput.addEventListener("keydown", function(event) {

  if (event.key === "Enter" && !event.shiftKey) {

    event.preventDefault();

    sendMessage();

  }

});
