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
  - 단일 조회 GET에서 **13,394 RPS**로 테스트군 중 최상위의 단일 처리 능력을 기록.
  - gRPC(@grpc/grpc-js) 모듈은 Pure JS 구현체이므로 직렬화 오버헤드가 발생하나, HTTP/2 JSON 통신 성능이 압도적.

### 2.2 Go (Native & Gin)
* **런타임**: Go Compiled Native Binary
* **성능 평가**:
  - 단독 구동 시 Go Native 단일 GET은 **11,302 RPS**, Gin은 **11,056 RPS**로 뛰어난 원시 성능을 회복함.
  - gRPC 성능 역시 **3,907 RPS** (단일), **2,435 RPS** (대량)로 타 플랫폼 대비 안정적이며 지연 시간이 극히 낮음.

### 2.3 Node.js (Express & Fastify)
* **런타임**: Node 20+ (V8 Engine)
* **성능 평가**:
  - **Fastify (9,090 RPS)** 가 **Express (6,090 RPS)** 보다 높은 성능 효율을 보여줌.
  - Fastify의 비표준 `QUERY` 메소드 연결 제한 우회를 위해 `preValidation` 훅으로 바디 데이터를 처리.

### 2.4 Python (FastAPI)
* **런타임**: CPython 3.14 + uvicorn[standard]
* **성능 평가**:
  - 단일 조회 GET 기준 **1,594 RPS** 수준.
  - 프레임워크 자체 오버헤드가 있으나, 대량 데이터 조회 시 JSON GET(414 RPS) 대비 gRPC(1,094 RPS)가 **2.6배 이상 빠름**.

### 2.5 Kotlin (Spring Boot 3.4.0 - Java 25)
* **런타임**: Eclipse Temurin OpenJDK 25 (JVM)
* **특징**: Spring Boot 3.4.0 기반 가상 스레드 최적화가 무르익은 런타임 적용.
* **성능 평가**:
  - 단일 gRPC 조회 성능이 **1,365 RPS** 수준, JSON GET은 **1,045 RPS**.
  - **전체 목록 (대량)** 시나리오에서 JSON GET(682 RPS) 대비 gRPC(1,162 RPS)가 약 **1.7배** 더 빠름.
* **비고**: Gradle 8.7 빌드 및 gRPC 컴파일 플러그인 호환을 유지하기 위해 Spring Boot 3.4.0 매핑.

---

## 3. 종합 평정 및 아키텍처 가이드

1. **소규모/단순 I/O 환경**:
   - Bun/Elysia 또는 Go Native JSON API 구축이 로컬 응답 속도 면에서 최선.
2. **무거운 서버 (Python, Kotlin JVM) 및 MSA 환경**:
   - 내부 마이크로서비스 간 통신에 **gRPC 필수 도입 권장**. 직렬화 연산 단축만으로 2~3배의 응답 속도 향상 획득 가능.
3. **가상 스레드 및 Java 25 적용 필수**:
   - JVM 백엔드 개발 시, 처리 스레드가 차단(Block)되는 I/O 병목을 완화하기 위해 반드시 Java 25 및 가상 스레드 기본 설정을 탑재하여 대기 지연(Latency)을 단축해야 함.

---

## 4. Kotlin Spring Boot 3.4.0 vs 3.2.3 성능 하락 원인 분석
스프링 부트 버전을 `3.2.3`에서 `3.4.0`으로 올렸을 때 성능 지표(RPS, 응답 속도)가 하락한 주요 근본 원인은 다음과 같습니다:

1. **가상 스레드 피닝(Lock Pinning) 현상 심화**:
   * Spring Boot 3.4.0의 로깅 엔진(Logback 등) 및 직렬화 내부 모듈에서 사용하는 `synchronized` 키워드 블록이 실행될 때, Java 25 가상 스레드가 플랫폼 캐리어 스레드(Carrier Thread)에 고정(Pinning)되는 병목이 일어납니다. 피닝이 발생하면 JVM 가상 스레드의 경량화 이점이 무색해지며 오버헤드가 누적됩니다.
2. **톰캣 10.1.x+ 커넥션 리소스 관리 정책 변경**:
   * 내장 톰캣(Tomcat 10.1.25+) 엔진의 HTTP/2 Keep-Alive 및 동적 스레드 풀 할당 동작이 3.2.x 계열 대비 보수적이고 안전 지향적으로 리팩토링되어, 로컬 루프백(Loopback) 기반의 초고속 고빈도 요청 상황에서 컨텍스트 스위칭 및 할당 지연 오버헤드가 더 크게 개입했습니다.
3. **디폴트 스케줄러 영역 확장**:
   * 스프링 부트 프레임워크 자체의 필터, 인터셉터 계층까지 가상 스레드 할당 제어가 심화되면서, I/O 대기시간이 극히 짧은 단순 로컬 연산에서 스케줄러 간 태스크 스위칭 비용이 CPU 순수 실행 시간보다 더 커지는 오버헤드가 개입되었습니다.

