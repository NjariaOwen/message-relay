# python-ui/app.py

from flask import Flask, request, render_template_string, redirect
import redis
import requests

app = Flask(__name__)
r = redis.Redis(host="redis", port=6379, db=0)

# Backend API URL (use 'backend' as hostname in Docker, 'localhost' if running locally)
BACKEND_API = "http://backend:8080/messages"

HTML = """
<!doctype html>
<html lang='en'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <title>User A Chat</title>
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
        <h1>Chat as User A</h1>
        <form method="POST">
            <input type="text" name="to" value="B" placeholder="To" required>
            <input type="text" name="content" placeholder="Type a message" required>
            <input type="submit" value="Send">
        </form>
        <div class="chat">
        {% for msg in messages %}
            <div class="msg {% if msg.from == 'A' %}from-me{% else %}from-them{% endif %}">
                <div>{{ msg.content }}</div>
                <div class="meta">{{ msg.from }} → {{ msg.to }} | {{ msg.timestamp }}</div>
            </div>
        {% endfor %}
        </div>
    </div>
</body>
</html>
"""


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        to = request.form["to"]
        content = request.form["content"]
        # Push message to Redis incoming queue
        r.rpush("incoming", f"A|{to}|{content}")
        return redirect("/")

    # Fetch conversation from backend
    messages = []
    try:
        resp = requests.get(BACKEND_API, params={"user": "A", "peer": "B"}, timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                messages = data
    except Exception:
        pass
    return render_template_string(HTML, messages=messages)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
