# Walkthrough: 다중 언어 JSON vs gRPC 성능 비교 (Node.js 추가 및 Java 25 / Spring Boot 3.4.0 갱신)

본 실습에서는 **Bun(Elysia.js)**, **Go(Native & Gin)**, **Python(FastAPI)**, **Node.js(Express & Fastify)** 및 **Kotlin(Spring Boot)** 5대 플랫폼에서 HTTP/2 TLS 기반 JSON 및 gRPC의 최종 성능을 비교 측정하였습니다.

---

## 📊 종합 벤치마크 결과 테이블 (반복 200회, 웜업 20회)
* **Kotlin**: JDK 25 및 Spring Boot 3.4.0 가상 스레드 기본화 적용. JVM target은 `21` 사양 빌드.
* **Node.js**: Node 20+ 환경에서 Express, Fastify, 및 gRPC 서버 가동.

| 언어 | 프레임워크 | 시나리오 | 프로토콜 | 평균 응답속도 (Avg) | 중앙값 (Med) | P95 | RPS (처리량) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Bun** | Elysia.js | **단일 조회** | HTTP/2 GET | **0.09 ms** | 0.07 ms | 0.19 ms | **10,599** |
| | | | gRPC | 0.40 ms | 0.33 ms | 0.68 ms | 2,522 |
| **Go** | Go Native | | HTTP/2 GET | **0.09 ms** | 0.07 ms | 0.19 ms | **10,599** |
| | | | gRPC | 0.26 ms | 0.22 ms | 0.43 ms | 3,838 |
| **Go** | Go Gin | | HTTP/2 GET | 0.12 ms | 0.08 ms | 0.18 ms | 8,425 |
| **Node.js**| Fastify | | HTTP/2 GET | **0.26 ms** | 0.23 ms | 0.33 ms | **3,899** |
| **Node.js**| Express | | HTTP/2 GET | 0.25 ms | 0.22 ms | 0.38 ms | 3,963 |
| | | | gRPC | 0.57 ms | 0.54 ms | 0.83 ms | 1,753 |
| **Python**| FastAPI | | HTTP/2 GET | 0.58 ms | 0.52 ms | 0.96 ms | 1,722 |
| | | | gRPC | 0.36 ms | 0.33 ms | 0.56 ms | 2,778 |
| **Kotlin**| Spring Boot | | HTTP/2 GET | 1.00 ms | 0.79 ms | 1.87 ms | 996 |
| | | | gRPC | 1.00 ms | 0.84 ms | 2.32 ms | 996 |
| ──────────────── | ─────────────────── | ──────────────── | ─────────────── | ─────────── | ─────────── | ─────────── | ─────────── |
| **Bun** | Elysia.js | **전체 목록 (대량)** | HTTP/2 GET | **0.32 ms** | 0.28 ms | 0.64 ms | **3,096** |
| | | | gRPC | 0.66 ms | 0.56 ms | 1.19 ms | 1,509 |
| **Go** | Go Native | | HTTP/2 GET | **0.33 ms** | 0.28 ms | 0.55 ms | **3,015** |
| | | | gRPC | 0.51 ms | 0.38 ms | 1.03 ms | 1,955 |
| **Go** | Go Gin | | HTTP/2 GET | 0.35 ms | 0.30 ms | 0.65 ms | 2,863 |
| **Node.js**| Fastify | | HTTP/2 GET | **0.65 ms** | 0.63 ms | 0.88 ms | **1,545** |
| **Node.js**| Express | | HTTP/2 GET | 0.68 ms | 0.63 ms | 1.00 ms | 1,476 |
| | | | gRPC | 1.00 ms | 0.97 ms | 1.58 ms | 997 |
| **Kotlin**| Spring Boot | | HTTP/2 GET | 1.62 ms | 1.41 ms | 2.66 ms | 618 |
| | | | gRPC | 1.12 ms | 0.89 ms | 2.06 ms | 892 |
| **Python**| FastAPI | | HTTP/2 GET | 2.59 ms | 2.40 ms | 3.73 ms | 386 |
| | | | gRPC | 0.85 ms | 0.76 ms | 1.28 ms | 1,178 |
| ──────────────── | ─────────────────── | ──────────────── | ─────────────── | ─────────── | ─────────── | ─────────── | ─────────── |
| **Bun** | Elysia.js | **검색 (QUERY)** | HTTP/2 QUERY | **0.12 ms** | 0.09 ms | 0.23 ms | **8,669** |
| **Go** | Go Native | | HTTP/2 QUERY | **0.11 ms** | 0.10 ms | 0.20 ms | **8,925** |
| **Go** | Go Gin | | HTTP/2 QUERY | 0.11 ms | 0.08 ms | 0.20 ms | 9,407 |
| **Node.js**| Fastify | | HTTP/2 QUERY | **0.28 ms** | 0.26 ms | 0.36 ms | **3,573** |
| **Node.js**| Express | | HTTP/2 QUERY | 0.30 ms | 0.30 ms | 0.41 ms | 3,349 |
| **Kotlin**| Spring Boot | | HTTP/2 QUERY | 0.54 ms | 0.39 ms | 0.91 ms | 1,862 |
| **Python**| FastAPI | | HTTP/2 QUERY | 0.60 ms | 0.56 ms | 1.04 ms | 1,659 |

---

## 실행 아키텍처 구조

```mermaid
graph TD
    Client["벤치마크 클라이언트 (benchmark.ts)"]
    
    Client -->|"JSON :3000 / gRPC :50051"| Bun["Bun / Elysia.js"]
    Client -->|"JSON :3001 / gRPC :50052"| GoNat["Go (Native)"]
    Client -->|"JSON :3004 / gRPC :50052"| GoGin["Go (Gin)"]
    Client -->|"JSON :3002 / gRPC :50053"| Py["Python (FastAPI)"]
    Client -->|"JSON :3003 / gRPC :50054"| Kot["Kotlin (Spring Boot 3.4.0)"]
    Client -->|"JSON :3005 / gRPC :50055"| Express["Node.js (Express)"]
    Client -->|"JSON :3006 / gRPC :50055"| Fastify["Node.js (Fastify)"]

    style Client fill:#f9f,stroke:#333,stroke-width:2px
    style Bun fill:#fcf,stroke:#333
    style GoNat fill:#cff,stroke:#333
    style GoGin fill:#cff,stroke:#333
    style Py fill:#ffc,stroke:#333
    style Kot fill:#dfd,stroke:#333
    style Express fill:#fdd,stroke:#333
    style Fastify fill:#fdd,stroke:#333
```

---

## 🛠️ 플랫폼별 빌드 트러블슈팅 가이드

### 1. Fastify QUERY 메소드 404 에러 대응
* **문제**: Fastify는 표준 라우터 정의 시 비표준 HTTP/2 `QUERY` 메소드 등록을 차단하거나 404 Not Found를 반환함.
* **해결**: `preValidation` 생명주기 훅(Hook)을 사용하여 비표준 `QUERY` 요청을 라우터 매핑 전에 인터셉트하고, 데이터 버퍼링(`getRawBody`)을 통해 JSON 파싱 후 응답을 직접 Hijacking 처리함.

### 2. Kotlin JVM Target 일치화
* **문제**: JDK 25 하에서 Kotlin 컴파일러 타겟과 Java 컴파일러 버전에 격차가 발생하여 `:compileKotlin` 빌드 크래시 발생.
* **해결**: `build.gradle.kts` 내에 `jvmTarget.set(JvmTarget.JVM_21)` 및 `options.release.set(21)` 설정을 수동 정렬하여 호환성 보장.
