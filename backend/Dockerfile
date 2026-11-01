# ---- Build ----
FROM golang:1.24-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git ca-certificates

# Allow Go to fetch the toolchain required by go.mod if needed.
ENV GOTOOLCHAIN=auto
ENV CGO_ENABLED=0
ENV GOOS=linux

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -trimpath -ldflags="-s -w" -o /out/ledger-api .

# ---- Runtime ----
FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
  && adduser -D -H -u 10001 appuser \
  && mkdir -p /app/data \
  && chown -R appuser:appuser /app

COPY --from=builder /out/ledger-api /app/ledger-api

USER appuser

ENV PORT=8080
ENV DATABASE_PATH=/app/data/ledger.db

EXPOSE 8080

CMD ["/app/ledger-api"]
