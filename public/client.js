// client.js
import van from "https://cdn.jsdelivr.net/gh/vanjs-org/van/public/van-1.6.0.min.js";
const { div, ul, li, textarea, button, span, style } = van.tags;

const messages = van.state([]);
const inputText = van.state("");
const isLoading = van.state(false);

const addMessage = (role, content) => {
    messages.val = [...messages.val, { role, content }];
};

const getAIResponse = async (userMsg) => {
    isLoading.val = true;
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    addMessage("assistant", `I heard: "${userMsg}" — this is a simulated response!`);
    isLoading.val = false;
};

const sendMessage = () => {
    const text = inputText.val.trim();
    if (!text || isLoading.val) return;
    addMessage("user", text);
    const msg = text;
    inputText.val = "";
    getAIResponse(msg);
};

// Initial message
van.add(document.body, () => {
    if (messages.val.length === 0) {
    addMessage("assistant", "Hello! I'm your AI assistant. How can I help you today?");
    }
    return null;
});
// () => messages.val.map(msg =>{}); //not correct
// messages.val.map(msg =>{}); //  correct
const ChatApp = () => div({ class: "chat-container" },
    div({ class: "chat-header" },
    div("AI Assistant"),
    span(() => isLoading.val ? "Typing..." : "Online")
    ),

    div({ class: "chat-messages" },
    ul({ class: "messages-list" },
        // CORRECT PATTERN - NO SPREAD!
        messages.val.map(msg =>
        li({ class: `message ${msg.role}` },
            div({ class: "message-bubble" },
            div({ class: "message-role" }, msg.role === "user" ? "You" : "Assistant"),
            div({ class: "message-content" }, msg.content)
            )
        )
        ),

        () => isLoading.val ? li({ class: "message assistant typing" },
        div({ class: "message-bubble" },
            div({ class: "typing-indicator" },
            span(), span(), span()
            )
        )
        ) : null
    )
    ),

    div({ class: "chat-input-area" },
    textarea({
        value: inputText,
        placeholder: "Type your message...",
        oninput: e => inputText.val = e.target.value,
        onkeydown: e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())
    }),
    button({ onclick: sendMessage, disabled: () => !inputText.val.trim() || isLoading.val }, "Send")
    )
);

// Your full CSS from before goes here
let style_textContent = `
    body{margin:0;font-family:system-ui;height:100vh;background:#f5f5f5}
    .chat-container{max-width:800px;margin:0 auto;height:100vh;display:flex;flex-direction:column;background:white;box-shadow:0 0 20px rgba(0,0,0,.1)}
    .chat-header{padding:16px 24px;background:#2563eb;color:white;font-weight:600;display:flex;justify-content:space-between;align-items:center}
    .chat-messages{flex:1;overflow-y:auto;padding:20px;background:#f9fafb}
    .messages-list{list-style:none;padding:0;margin:0}
    .message{margin-bottom:20px;display:flex}
    .message.user{justify-content:flex-end}
    .message.assistant{justify-content:flex-start}
    .message-bubble{max-width:70%;padding:12px 16px;border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .message.user .message-bubble{background:#2563eb;color:white;border-bottom-right-radius:4px}
    .message.assistant .message-bubble{background:white;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px}
    .message-role{font-size:.75rem;opacity:.7;margin-bottom:4px;font-weight:600}
    .typing-indicator span{display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin:0 3px;animation:typing 1.4s infinite}
    .typing-indicator span:nth-child(2){animation-delay:.2s}
    .typing-indicator span:nth-child(3){animation-delay:.4s}
    @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
    .chat-input-area{padding:16px;background:white;border-top:1px solid #e5e7eb;display:flex;gap:12px;align-items:flex-end}
    textarea{flex:1;padding:12px 16px;border:1px solid #d1d5db;border-radius:12px;resize:none;font-family:inherit;font-size:1rem;max-height:120px}
    textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
    button{padding:12px 20px;background:#2563eb;color:white;border:none;border-radius:12px;cursor:pointer;font-weight:600}
    button:hover{background:#1d4ed8}
    button:disabled{background:#93c5fd;cursor:not-allowed}
`;

van.add(document.head, style(style_textContent));

van.add(document.body, ChatApp);