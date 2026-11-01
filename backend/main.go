package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

const (
	defaultAddr     = ":8080"
	defaultDBPath   = "ledger.db"
	tokenTTL        = 24 * time.Hour
	bcryptCost      = 12
	defaultJSONData = `{"accounts":{"bank":0,"ewallet":0,"cash":0},"transactions":[],"loans":[],"debts":[]}`
)

type contextKey string

const userIDKey contextKey = "userID"

type server struct {
	db        *sql.DB
	jwtSecret []byte
	corsOrigins map[string]struct{}
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
	UserID    int64  `json:"user_id"`
	Email     string `json:"email"`
}

type errorResponse struct {
	Error string `json:"error"`
}

type claims struct {
	UserID int64  `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func main() {
	addr := envOr("PORT", defaultAddr)
	if !strings.HasPrefix(addr, ":") && !strings.Contains(addr, ":") {
		addr = ":" + addr
	}

	dbPath := envOr("DATABASE_PATH", defaultDBPath)
	jwtSecret := envOr("JWT_SECRET", "dev-ledger-secret-change-me")
	corsCSV := envOr(
		"CORS_ORIGINS",
		"http://localhost:3000,http://127.0.0.1:3000,https://ledger.app",
	)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	// SQLite handles one writer at a time; keep a single open connection.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	s := &server{
		db:          db,
		jwtSecret:   []byte(jwtSecret),
		corsOrigins: parseOrigins(corsCSV),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/register", s.handleRegister)
	mux.HandleFunc("POST /api/login", s.handleLogin)
	mux.HandleFunc("GET /api/data", s.auth(s.handleGetData))
	mux.HandleFunc("POST /api/data/sync", s.auth(s.handleSyncData))
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	handler := s.cors(logging(mux))

	log.Printf("ledger API listening on %s (db=%s)", addr, dbPath)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func migrate(db *sql.DB) error {
	schema := `
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_data (
	user_id INTEGER PRIMARY KEY,
	data TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

PRAGMA foreign_keys = ON;
`
	_, err := db.Exec(schema)
	return err
}

func (s *server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	password := req.Password

	if !isValidEmail(email) {
		writeError(w, http.StatusBadRequest, "a valid email is required")
		return
	}
	if len(password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		log.Printf("bcrypt hash error: %v", err)
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	tx, err := s.db.Begin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO users (email, password_hash) VALUES (?, ?)`,
		email,
		string(hash),
	)
	if err != nil {
		if isUniqueViolation(err) {
			writeError(w, http.StatusConflict, "email already registered")
			return
		}
		log.Printf("insert user: %v", err)
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	userID, err := res.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	if _, err := tx.Exec(
		`INSERT INTO user_data (user_id, data) VALUES (?, ?)`,
		userID,
		defaultJSONData,
	); err != nil {
		log.Printf("insert user_data: %v", err)
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "could not create account")
		return
	}

	token, expiresAt, err := s.issueToken(userID, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "account created but token failed")
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{
		Token:     token,
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
		UserID:    userID,
		Email:     email,
	})
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	var (
		userID int64
		hash   string
	)
	err := s.db.QueryRow(
		`SELECT id, password_hash FROM users WHERE email = ?`,
		email,
	).Scan(&userID, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		log.Printf("login query: %v", err)
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, expiresAt, err := s.issueToken(userID, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not issue token")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		Token:     token,
		ExpiresAt: expiresAt.UTC().Format(time.RFC3339),
		UserID:    userID,
		Email:     email,
	})
}

func (s *server) handleGetData(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var raw string
	err := s.db.QueryRow(
		`SELECT data FROM user_data WHERE user_id = ?`,
		userID,
	).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "user data not found")
		return
	}
	if err != nil {
		log.Printf("get data: %v", err)
		writeError(w, http.StatusInternalServerError, "could not load data")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(raw))
}

func (s *server) handleSyncData(w http.ResponseWriter, r *http.Request) {
	userID, ok := userIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20))
	decoder.UseNumber()

	var payload json.RawMessage
	if err := decoder.Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if !json.Valid(payload) || len(payload) == 0 {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	// Ensure top-level object shape before persisting.
	var shape map[string]json.RawMessage
	if err := json.Unmarshal(payload, &shape); err != nil {
		writeError(w, http.StatusBadRequest, "payload must be a JSON object")
		return
	}
	for _, key := range []string{"accounts", "transactions", "loans", "debts"} {
		if _, exists := shape[key]; !exists {
			writeError(w, http.StatusBadRequest, "payload missing required key: "+key)
			return
		}
	}

	res, err := s.db.Exec(
		`UPDATE user_data SET data = ? WHERE user_id = ?`,
		string(payload),
		userID,
	)
	if err != nil {
		log.Printf("sync data: %v", err)
		writeError(w, http.StatusInternalServerError, "could not sync data")
		return
	}

	affected, err := res.RowsAffected()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not sync data")
		return
	}
	if affected == 0 {
		writeError(w, http.StatusNotFound, "user data not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "synced"})
}

func (s *server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			writeError(w, http.StatusUnauthorized, "missing authorization header")
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			writeError(w, http.StatusUnauthorized, "invalid authorization header")
			return
		}

		parsed, err := jwt.ParseWithClaims(parts[1], &claims{}, func(token *jwt.Token) (any, error) {
			if token.Method != jwt.SigningMethodHS256 {
				return nil, errors.New("unexpected signing method")
			}
			return s.jwtSecret, nil
		})
		if err != nil || !parsed.Valid {
			writeError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		c, ok := parsed.Claims.(*claims)
		if !ok || c.UserID == 0 {
			writeError(w, http.StatusUnauthorized, "invalid token claims")
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, c.UserID)
		next(w, r.WithContext(ctx))
	}
}

func (s *server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, allowed := s.corsOrigins[origin]; allowed || wildcardOrigin(s.corsOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *server) issueToken(userID int64, email string) (string, time.Time, error) {
	expiresAt := time.Now().Add(tokenTTL)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   email,
		},
	})

	signed, err := token.SignedString(s.jwtSecret)
	return signed, expiresAt, err
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rw.status, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorResponse{Error: message})
}

func userIDFromContext(ctx context.Context) (int64, bool) {
	id, ok := ctx.Value(userIDKey).(int64)
	return id, ok && id > 0
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func parseOrigins(csv string) map[string]struct{} {
	out := make(map[string]struct{})
	for _, part := range strings.Split(csv, ",") {
		origin := strings.TrimSpace(part)
		if origin != "" {
			out[origin] = struct{}{}
		}
	}
	return out
}

func wildcardOrigin(origins map[string]struct{}) bool {
	_, ok := origins["*"]
	return ok
}

func isValidEmail(email string) bool {
	if len(email) < 5 || len(email) > 254 {
		return false
	}
	at := strings.LastIndex(email, "@")
	if at < 1 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	return strings.Contains(domain, ".")
}

func isUniqueViolation(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "constraint")
}
