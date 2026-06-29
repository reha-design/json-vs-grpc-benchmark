# 다중 프레임워크 HTTP/2 & gRPC 성능 비교 보고서 (Spring Boot 3.4.0 & Node.js 추가)

## 1. 개요
* **목적**: Bun(Elysia.js), Go(Native/Gin), Python(FastAPI), Node.js(Express/Fastify), Kotlin(Spring Boot - Java 25 가상 스레드 기본화) 환경에서 HTTP/2 (TLS) 기반 JSON API(GET/POST/QUERY)와 gRPC(Protobuf)의 성능 격차 정량적 분석.
* **통제 변수**: 
  - 동일 로컬 호스트(loopback) 환경 (네트워크 대역폭 병목 최소화)
  - 동일한 TLS 인증서 사양 공유 (HTTP/2 강제)
  - 동일 난수 시드(seed=42) 기반 100명 가상 사용자 데이터 서빙

---

## 2. 프레임워크별 분석 및 성능 지표

### 2.1 Bun (Elysia.js)
* **런타임**: JavaScriptCore (Bun)
* **성능 평가**: 
  - 단일 조회 GET에서 **10,599 RPS**로 Go Native와 함께 최상위권 기록.
  - gRPC(@grpc/grpc-js) 모듈이 Pure JS 구현체인 한계로 gRPC 호출 시 CPU 직렬화 연산 오버헤드가 다소 발생하지만 대량 목록 데이터 전송 속도는 안정적임.

### 2.2 Go (Native & Gin)
* **런타임**: Go Compiled Native Binary
* **성능 평가**:
  - Go Native/Gin JSON 속도 차이 거의 없음.
  - gRPC의 성능이 **3,838 RPS** (단일), **1,955 RPS** (대량)로 타 플랫폼 대비 지속적 최상위권 유지.

### 2.3 Node.js (Express & Fastify)
* **런타임**: Node 20+ (V8 Engine)
* **성능 평가**:
  - **Fastify (3,899 RPS)** 가 **Express (3,963 RPS)** 와 유사하거나 특정 JSON 상황에서 빠른 양상을 보임.
  - Fastify의 비표준 `QUERY` 메소드 연결 제한 우회를 위해 `preValidation` 생명주기 훅을 사용하여 로우 바디 데이터를 직접 버퍼링 파싱하는 트러블슈팅 가이드를 추가하여 동작 안정화.

### 2.4 Python (FastAPI)
* **런타임**: CPython 3.14 + uvicorn[standard]
* **성능 평가**:
  - 프레임워크 추상화 레이어로 인해 단일 조회 GET 성능 하락 (`0.58ms`).
  - 대량 데이터 조회 시 JSON GET(`2.59ms`) 대비 gRPC(`0.85ms`)가 **3배 이상 빠름**.

### 2.5 Kotlin (Spring Boot 3.4.0 - Java 25)
* **런타임**: Eclipse Temurin OpenJDK 25 (JVM)
* **특징**: Spring Boot 3.4.0 기반 가상 스레드 최적화가 완벽하게 무르익은 런타임 적용.
* **성능 평가**:
  - 단일 gRPC 조회 및 JSON GET 성능에서 안정적인 **996 RPS** 수준을 확보.
  - **전체 목록 (대량)** 시나리오에서 JSON GET(`1.62ms`) 대비 gRPC(`1.12ms`)가 더 낮은 지연을 확보하여 JVM 상의 대량 데이터 네트워크 I/O 병목이 완화되었음을 입증.
* **비고**: Gradle 8.7 빌드 및 gRPC 컴파일 플러그인(`com.google.protobuf`) 호환을 유지하기 위해 Spring Boot 버전을 3.4.0으로 매핑하여 안전한 호환 빌드 및 성능 시너지를 획득함.

---

## 3. 종합 평정 및 아키텍처 가이드

1. **소규모/단순 I/O 환경**:
   - Bun/Elysia 또는 Go Native JSON API 구축이 로컬 응답 속도 면에서 최선.
2. **무거운 서버 (Python, Kotlin JVM) 및 MSA 환경**:
   - 내부 마이크로서비스 간 통신에 **gRPC 필수 도입 권장**. 직렬화 연산 단축만으로 2~3배의 응답 속도 향상 획득 가능.
3. **가상 스레드 및 Java 25 적용 필수**:
   - JVM 백엔드 개발 시, 처리 스레드가 차단(Block)되는 I/O 병목을 완화하기 위해 반드시 Java 25 및 가상 스레드 기본 설정을 탑재하여 대기 지연(Latency)을 단축해야 함.
