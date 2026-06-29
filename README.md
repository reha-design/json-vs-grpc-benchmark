# JSON vs gRPC 성능 비교 프로젝트

Bun + Elysia.js 환경에서 JSON REST API와 gRPC의 성능 차이를 비교하는 프로젝트입니다.  
HTTP QUERY 메서드(RFC 10008)를 포함하며, 모든 통신은 **HTTP/2 + TLS** 위에서 동작합니다.

## 기술 스택

- **런타임**: Bun
- **HTTP 프레임워크**: Elysia.js
- **gRPC**: @grpc/grpc-js + @grpc/proto-loader
- **TLS**: mkcert (로컬 자체 서명 인증서)

## 프로젝트 구조

```
├── certs/              # TLS 인증서 (mkcert 생성)
├── proto/
│   └── user.proto      # gRPC 서비스 정의
├── src/
│   ├── data/
│   │   └── mock-data.ts   # 공통 목 데이터 (User 100명)
│   ├── json-server.ts     # Elysia.js HTTP/2 JSON 서버
│   ├── grpc-server.ts     # gRPC HTTP/2 서버
│   └── grpc-client.ts     # gRPC 클라이언트 유틸
├── bench/
│   └── benchmark.ts       # 벤치마크 스크립트
└── README.md
```

## 사전 준비

```bash
# mkcert 설치 (최초 1회)
winget install FiloSottile.mkcert
mkcert -install
```

## 빠른 시작

```bash
# 1. 의존성 설치
bun install

# 2. TLS 인증서 생성 (최초 1회)
bun run cert

# 3. JSON 서버 시작 (터미널 1)
bun run start:json

# 4. gRPC 서버 시작 (터미널 2)
bun run start:grpc

# 5. 벤치마크 실행 (터미널 3 — 양쪽 서버 실행 후)
bun run bench
```

## 테스트 케이스

| # | 시나리오 | JSON (Elysia) | gRPC |
|---|---------|--------------|------|
| 1 | 단일 조회 | `GET /api/user/:id` | `GetUser` |
| 2 | 전체 목록 | `GET /api/users` | `GetUsers` |
| 3 | 검색 (POST) | `POST /api/users/search` | `SearchUsers` |
| 4 | 검색 (QUERY) | `QUERY /api/users/query` ✨ | `SearchUsers` |

## HTTP QUERY 메서드 (RFC 10008)

2026년 6월 표준화된 새 HTTP 메서드로, **GET처럼 안전하고 멱등적이면서 body를 포함**할 수 있습니다.

```bash
# QUERY 메서드 사용 예시
curl -X QUERY https://localhost:3000/api/users/query \
  -H "Content-Type: application/json" \
  -d '{"name": "김", "min_age": 25}' \
  -k
```

## 비교 포인트

| 항목 | JSON (REST) | gRPC (Protobuf) |
|------|------------|-----------------|
| 직렬화 | 텍스트 (JSON) | 바이너리 (Protobuf) |
| 페이로드 크기 | 상대적으로 큼 | ~30-70% 절감 |
| 전송 프로토콜 | HTTP/2 (TLS) | HTTP/2 (TLS) |
| 타입 안전성 | 런타임 검증 | 컴파일 타임 보장 |
| 브라우저 지원 | ✅ | ❌ (gRPC-Web 필요) |
| 디버깅 | 쉬움 (사람이 읽기 가능) | 어려움 (바이너리) |
