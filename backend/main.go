// backend/main.go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
)

var (
	ctx = context.Background()
	rdb *redis.Client
	db  *sql.DB
)

func initRedis() {
	rdb = redis.NewClient(&redis.Options{Addr: "redis:6379"})
}

func initDB() {
	var err error
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	if host == "" { host = "localhost" }
	if port == "" { port = "5432" }
	if user == "" { user = "postgres" }
	if password == "" { password = "postgres" }
	if dbname == "" { dbname = "messages" }

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", host, port, user, password, dbname)
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		from_user VARCHAR(10),
		to_user VARCHAR(10),
		content TEXT,
		timestamp TIMESTAMP
	);`)
	if err != nil {
		log.Fatal(err)
	}
}

func processQueue() {
	for {
		msgStr, err := rdb.LPop(ctx, "incoming").Result()
		if err == redis.Nil {
			time.Sleep(time.Second)
			continue
		} else if err != nil {
			log.Println(err)
			continue
		}

		parts := strings.SplitN(msgStr, "|", 3)
		if len(parts) != 3 {
			continue
		}
		from, to, content := parts[0], parts[1], parts[2]

		// Persist to DB
		_, err = db.Exec(`INSERT INTO messages (from_user,to_user,content,timestamp) VALUES ($1,$2,$3,$4)`, from, to, content, time.Now())
		if err != nil {
			log.Println(err)
			continue
		}

		rdb.RPush(ctx, "messages:"+to, msgStr)
	}
}

func messagesHandler(w http.ResponseWriter, r *http.Request) {
	user := r.URL.Query().Get("user")
	peer := r.URL.Query().Get("peer")
	log.Printf("/messages requested: user=%s peer=%s", user, peer)
	if user == "" {
		http.Error(w, "user param required", http.StatusBadRequest)
		return
	}
	// Fetch all messages where (from_user=user AND to_user=peer) OR (from_user=peer AND to_user=user)
	var rows *sql.Rows
	var err error
	if peer != "" {
		rows, err = db.Query(`SELECT from_user, to_user, content, timestamp FROM messages WHERE (from_user=$1 AND to_user=$2) OR (from_user=$2 AND to_user=$1) ORDER BY timestamp ASC`, user, peer)
	} else {
		rows, err = db.Query(`SELECT from_user, to_user, content, timestamp FROM messages WHERE from_user=$1 OR to_user=$1 ORDER BY timestamp ASC`, user)
	}
	if err != nil {
		log.Printf("DB error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type Message struct {
		From      string    `json:"from"`
		To        string    `json:"to"`
		Content   string    `json:"content"`
		Timestamp time.Time `json:"timestamp"`
	}
	var messages []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.From, &m.To, &m.Content, &m.Timestamp); err != nil {
			log.Printf("Scan error: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		messages = append(messages, m)
	}
	log.Printf("Returning %d messages", len(messages))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func main() {
	initRedis()
	initDB()
	go processQueue()

	http.HandleFunc("/messages", messagesHandler)
	log.Println("Backend API running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

