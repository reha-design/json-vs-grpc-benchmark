# Multi-Language HTTP/2 TLS and gRPC Benchmark

This project benchmarks **JSON REST API (GET/POST/QUERY)** and **gRPC (Protobuf)** performance over **HTTP/2 TLS** across 4 platforms:
* **Bun** (Elysia.js)
* **Go** (Native / Gin)
* **Python** (FastAPI with Uvicorn/h2)
* **Kotlin** (Spring Boot 3.2+ with JDK 25 Virtual Threads ⚡)

---

## 🛠️ Prerequisite
Ensure you have the following installed on your machine:
* [Bun](https://bun.sh/) (v1.x)
* [Go](https://go.dev/) (v1.24+ or v1.25+)
* [Python](https://www.python.org/) (v3.12+) & [uv](https://github.com/astral-sh/uv)
* [Java JDK 25](https://adoptium.net/temurin/releases/) (or JDK 21+)

---

## 🚀 Getting Started

### 1. Clone & Install dependencies
```bash
git clone https://github.com/reha-design/json-vs-grpc-benchmark.git
cd json-vs-grpc-benchmark

# Install Bun dependencies
bun install
```

### 2. Generate Local TLS Certificates
We enforce HTTP/2 which requires TLS. Generate certificates for `localhost` in `certs/` directory:
```bash
bun run cert
```
*Note: Ensure `certs/localhost.pem`, `certs/localhost-key.pem`, and `certs/rootCA.pem` are created.*

### 3. Setup Python Virtual Environment
```bash
cd python-app
uv sync
cd ..
```

### 4. Build Go Binary
```bash
cd go-app
go mod tidy
go build -o server.exe main.go
cd ..
```

---

## 🏃 Running the Servers

Open separate terminals or run them in background:

```bash
# 1. Bun Server (JSON: 3000, gRPC: 50051)
bun run start:json
bun run start:grpc

# 2. Go Server (JSON: 3001, Gin: 3004, gRPC: 50052)
bun run start:go

# 3. Python Server (JSON: 3002, gRPC: 50053)
bun run start:py

# 4. Kotlin Spring Boot Server (JSON: 3003, gRPC: 50054)
bun run start:kotlin
```

---

## 📊 Running the Benchmark

Run the benchmarking orchestration script to compare Avg latency, Median, P95/P99 response time, and RPS (Requests Per Second):

```bash
bun run bench
```
