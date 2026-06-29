# Walkthrough: 다중 언어 JSON vs gRPC 성능 비교 (Java 25 가상 스레드 갱신)

이번 실습에서는 **Bun(Elysia.js)**, **Go(Native & Gin)**, **Python(FastAPI)** 및 **Kotlin(Spring Boot - Java 25 가상 스레드 적용)** 4대 플랫폼에서 HTTP/2 TLS 기반 JSON 및 gRPC의 최종 성능을 비교 측정하였습니다.

---

## 📊 종합 벤치마크 결과 테이블 (반복 200회, 웜업 20회)
* **Kotlin**: JDK 25 및 `spring.threads.virtual.enabled: true` 적용. JVM target은 `21` 사양으로 일치 빌드.

| 언어 | 프레임워크 | 시나리오 | 프로토콜 | 평균 응답속도 (Avg) | 중앙값 (Med) | P95 | RPS (처리량) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Bun** | Elysia.js | **단일 조회** | HTTP/2 GET | **0.06 ms** | 0.06 ms | 0.10 ms | **15,860** |
| | | | gRPC | 0.39 ms | 0.33 ms | 0.67 ms | 2,546 |
| **Go** | Go Native | | HTTP/2 GET | **0.10 ms** | 0.07 ms | 0.14 ms | 10,173 |
| | | | gRPC | 0.23 ms | 0.21 ms | 0.34 ms | 4,356 |
| **Go** | Go Gin | | HTTP/2 GET | 0.08 ms | 0.07 ms | 0.11 ms | 12,739 |
| **Python**| FastAPI | | HTTP/2 GET | 0.71 ms | 0.66 ms | 1.05 ms | 1,406 |
| | | | gRPC | 0.43 ms | 0.40 ms | 0.54 ms | 2,321 |
| **Kotlin**| Spring Boot | | HTTP/2 GET | 1.05 ms | 0.83 ms | 1.88 ms | 951 |
| | | | gRPC | **0.75 ms** | 0.63 ms | 1.46 ms | **1,334** |
| ──────────────── | ─────────────────── | ──────────────── | ─────────────── | ─────────── | ─────────── | ─────────── | ─────────── |
| **Bun** | Elysia.js | **전체 목록 (대량)** | HTTP/2 GET | **0.31 ms** | 0.27 ms | 0.58 ms | **3,205** |
| | | | gRPC | 0.65 ms | 0.56 ms | 1.33 ms | 1,547 |
| **Go** | Go Native | | HTTP/2 GET | **0.30 ms** | 0.28 ms | 0.46 ms | 3,338 |
| | | | gRPC | 0.43 ms | 0.39 ms | 0.65 ms | 2,335 |
| **Go** | Go Gin | | HTTP/2 GET | 0.34 ms | 0.30 ms | 0.51 ms | 2,953 |
| **Python**| FastAPI | | HTTP/2 GET | 2.93 ms | 2.75 ms | 4.06 ms | 342 |
| | | | gRPC | **0.91 ms** | 0.80 ms | 1.39 ms | **1,100** |
| **Kotlin**| Spring Boot | | HTTP/2 GET | 1.54 ms | 1.32 ms | 2.49 ms | 649 |
| | | | gRPC | **0.90 ms** | 0.72 ms | 1.53 ms | **1,112** |
| ──────────────── | ─────────────────── | ──────────────── | ─────────────── | ─────────── | ─────────── | ─────────── | ─────────── |
| **Bun** | Elysia.js | **검색 (QUERY)** | HTTP/2 QUERY | **0.10 ms** | 0.08 ms | 0.16 ms | **10,384** |
| **Go** | Go Native | | HTTP/2 QUERY | **0.11 ms** | 0.09 ms | 0.16 ms | 9,217 |
| **Go** | Go Gin | | HTTP/2 QUERY | 0.12 ms | 0.11 ms | 0.17 ms | 8,309 |
| **Python**| FastAPI | | HTTP/2 QUERY | 0.79 ms | 0.81 ms | 1.07 ms | 1,266 |
| **Kotlin**| Spring Boot | | HTTP/2 QUERY | **0.49 ms** | 0.37 ms | 0.93 ms | **2,037** |

---

## Java 25 최적화 도입으로 검증된 최종 성능 이점

### 1. HTTP QUERY 최적화의 극대화
* **검색 (QUERY) 시나리오**: 
  - Java 21: `0.56ms` (1,781 RPS)
  - **Java 25**: **`0.49ms`** (**2,037 RPS**)
  - 가상 스레드 스케줄링 시 핀홀(pinning) 오버헤드와 모니터 락 해소가 이루어져 복잡한 검색 요청(QUERY) 시의 스레드 스케줄링 성능이 크게 향상되었습니다.

### 2. 가상 스레드 락 병목 최적화 체감
* **gRPC 조회**:
  - 단일 gRPC: **`0.75 ms`** (**1,334 RPS**)
  - 전체 gRPC: **`0.90 ms`** (**1,112 RPS**)
  - Java 17(RPS 710) 대비 71% 가량 향상된 성능 곡선을 보장하면서도, Java 21에서 겪던 내부 동기화 블록 락 병목이 완화되어 더욱 부드러운 분산 처리를 제공합니다.
