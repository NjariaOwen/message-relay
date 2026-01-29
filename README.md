# 📝 Mini Message Relay

**Mini Message Relay** is a polyglot, bi-directional messaging system. It demonstrates how different services (Python, Node.js, and Go) can communicate asynchronously using **Redis** as a message broker and **PostgreSQL** for persistent storage.

---

## 🏗️ Architecture

```
		   +----------------+         +----------------+
		   |  Python UI     |         |   Node UI      |
		   | (Flask, port 5000)       | (Express, 5001)|
		   +--------+-------+         +-------+--------+
					|                         |
					|   (push/pull)           |
					|                         |
				+---v-------------------------v---+
				|            Redis                |
				|         (Message Broker)        |
				+---+-------------------------+---+
					|                         |
					|   (poll, push, persist) |
					|                         |
				+---v-------------------------v---+
				|           Go Backend            |
				|         (Message Proc.)         |
				+---+-------------------------+---+
					|
					|   (store/retrieve)
					v
		   +----------------------+
		   |     PostgreSQL       |
		   |   (Message Store)    |
		   +----------------------+
```

The system uses a hub-and-spoke model where the UIs interact only with Redis, and the Go backend handles the heavy lifting.



### Components:
* **Python UI (Flask):** Interface for User A.
* **Node UI (Express):** Interface for User B.
* **Go Backend:** Processes messages from Redis and persists them to PostgreSQL.
* **Redis:** Acts as the shared message queue.
* **PostgreSQL:** Stores the permanent history of all exchanges.

### Message Flow:
1. **UI (Python/Node)** sends a message $\rightarrow$ Pushed to **Redis**.
2. **Go Backend** polls **Redis** $\rightarrow$ Saves to **Postgres** $\rightarrow$ Pushes back to **Redis** for the recipient.
3. **Recipient UI** polls the backend API for new messages $\rightarrow$ Updates chat in real-time.

---

## 🛠️ Tech Stack

| Service | Technology | Docker Image |
| :--- | :--- | :--- |
| **User A Interface** | Python 3.11 (Flask) | `python:3.11-slim` |
| **User B Interface** | Node.js 20 (Express) | `node:20-slim` |
| **Message Processor** | Go 1.21 | `golang:1.21-alpine` |
| **Queue/Broker** | Redis 7 | `redis:7-alpine` |
| **Database** | PostgreSQL 16 | `postgres:16-alpine` |

---

## ⚙️ Setup Instructions

### Environment Variables
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and fill in your actual database credentials (do not commit `.env` to git).

### Docker Setup (Recommended)
1. Ensure Docker and Docker Compose are installed.
2. Run the following command to build and start all services:
   ```bash
   docker-compose up -d --build
   ```
3. Access the UIs:
   - User A (Python): http://localhost:5000
   - User B (Node.js): http://localhost:5001
   - Backend API: http://localhost:8080
4. To stop: `docker-compose down`
5. To view logs: `docker-compose logs -f [service-name]` (e.g., `nodejs`)

### Manual Setup (Alternative)
If you prefer not to use Docker, follow these steps:

#### 1. PostgreSQL Configuration
Run the following commands in your Postgres terminal to set up the environment:

```sql
CREATE DATABASE messages;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE messages TO postgres;
```

#### 2. Infrastructure
Start the Redis server:

```bash
redis-server
```

#### 3. Start Go Backend

```bash
cd backend
go get github.com/go-redis/redis/v8
go get github.com/lib/pq
go run main.go
```

#### 4. Start Python UI (User A)

```bash
cd python-ui
pip install Flask redis requests
python app.py
# Running on http://localhost:5000
```

#### 5. Start Node UI (User B)

```bash
cd node-ui
npm install express ioredis body-parser node-fetch
node index.js
# Running on http://localhost:5001
```

---

## 🧪 Testing the Flow

1. **Send:** Open the Python UI (http://localhost:5000) and send a message to User B.
2. **Receive:** The Node UI (http://localhost:5001) will update automatically (no refresh needed).
3. **Reply:** Send a reply from the Node UI back to User A.
4. **Verify DB:** Check the database logs or connect to Postgres in the container:
   ```bash
   docker-compose exec database psql -U postuser -d postgres -c "SELECT * FROM messages;"
   ```

---

## 📝 License

MIT