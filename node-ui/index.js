// node-ui/index.js

const express = require("express");
const bodyParser = require("body-parser");
const Redis = require("ioredis");
// Prefer the built-in global fetch (Node 18+). If not available, dynamically import node-fetch.
let fetchFn;
if (typeof fetch === "function") {
    fetchFn = fetch;
} else {
    fetchFn = (...args) => import('node-fetch').then(m => m.default(...args));
}

const app = express();
const redis = new Redis({ host: "redis", port: 6379 });

const BACKEND_API = "http://backend:8080/messages";

app.use(bodyParser.urlencoded({ extended: true }));

const HTML = (messages) => `
<!doctype html>
<html lang='en'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>User B Chat</title>
    <style>
        body {
            background: #ece5dd;
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #222;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            background: #fff;
            margin-top: 40px;
            padding: 2rem 2.5rem 2.5rem 2.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            min-width: 340px;
            max-width: 400px;
        }
        h1 {
            color: #075e54;
            margin-bottom: 1rem;
            text-align: center;
        }
        form {
            display: flex;
            flex-direction: row;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            justify-content: center;
        }
        input[type="text"] {
            padding: 0.5rem;
            font-size: 1rem;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            outline: none;
            transition: border 0.2s;
        }
        input[name="content"] {
            width: 180px;
        }
        input[type="text"]:focus {
            border: 1.5px solid #25d366;
        }
        input[type="submit"] {
            background: #25d366;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 0.6rem 1.2rem;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        input[type="submit"]:hover {
            background: #128c7e;
        }
        .chat {
            background: #ece5dd;
            border-radius: 8px;
            padding: 1rem;
            min-height: 300px;
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .msg {
            max-width: 70%;
            padding: 0.7rem 1rem;
            border-radius: 16px;
            font-size: 1.05rem;
            word-break: break-word;
            display: inline-block;
        }
        .from-me {
            align-self: flex-end;
            background: #dcf8c6;
        }
        .from-them {
            align-self: flex-start;
            background: #fff;
            border: 1px solid #e0e0e0;
        }
        .meta {
            font-size: 0.8em;
            color: #888;
            margin-top: 2px;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Chat as User B</h1>
        <form method="POST">
            <input type="text" name="to" value="A" placeholder="To" required>
            <input type="text" name="content" placeholder="Type a message" required>
            <input type="submit" value="Send">
        </form>
        <div class="chat">
        ${messages.map(msg => `
            <div class="msg ${msg.from === 'B' ? 'from-me' : 'from-them'}">
                <div>${msg.content}</div>
                <div class="meta">${msg.from} → ${msg.to} | ${msg.timestamp}</div>
            </div>
        `).join("")}
        </div>
    </div>
</body>
</html>
`;


app.get("/", async (req, res) => {
    let messages = [];
    try {
        const resp = await fetchFn(BACKEND_API + "?user=B&peer=A");
        const raw = await resp.text();
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            data = null;
        }
        // Map backend fields to expected UI fields
        if (Array.isArray(data)) {
            messages = data.map(msg => ({
                from: msg.from || msg.from_user,
                to: msg.to || msg.to_user,
                content: msg.content,
                timestamp: msg.timestamp
            }));
        } else {
            messages = [];
        }
    } catch (e) {
        messages = [];
    }
    console.log("Fetched messages from backend:", messages);
    res.send(HTML(messages));
});

app.post("/", async (req, res) => {
    const { to, content } = req.body;
    await redis.rpush("incoming", `B|${to}|${content}`);
    res.redirect("/");
});

app.listen(5001, () => console.log("User B UI running on port 5001"));

