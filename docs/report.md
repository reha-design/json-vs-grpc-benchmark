# 다중 프레임워크 HTTP/2 & gRPC 성능 비교 보고서 (Java 25 최종)

## 1. 개요
* **목적**: Bun(Elysia.js), Go(Native/Gin), Python(FastAPI), Kotlin(Spring Boot - Java 25 가상 스레드 활성화) 환경에서 HTTP/2 (TLS) 기반 JSON API(GET/POST/QUERY)와 gRPC(Protobuf)의 성능 격차 정량적 분석.
* **통제 변수**: 
  - 동일 로컬 호스트(loopback) 환경 (네트워크 대역폭 병목 최소화)
  - 동일한 TLS 인증서 사양 공유 (HTTP/2 강제)
  - 동일 난수 시드(seed=42) 기반 100명 가상 사용자 데이터 서빙

---

## 2. 프레임워크별 분석 및 성능 지표

### 2.1 Bun (Elysia.js)
* **런타임**: JavaScriptCore (Bun)
* **특징**: Bun의 C++ 네이티브 `Bun.serve` 엔진 활용. V8/JSC의 고속 JSON 직렬화에 의존.
* **성능 평가**: 
  - 단일 조회 GET에서 **15,860 RPS**로 전체 1위.
  - 대량 데이터 조회 시 JSON 파싱 능력이 우수하나, gRPC(@grpc/grpc-js) 모듈이 Pure JS 구현체인 한계로 gRPC 호출 시 CPU 직렬화 연산 오버헤드 발생.
* **장단점**: 로컬 JSON 처리는 가장 빠르나 JS gRPC 라이브러리 효율이 상대적으로 떨어짐.

### 2.2 Go (Native & Gin)
* **런타임**: Go Compiled Native Binary
* **특징**: 컴파일러 수준에서 기계어로 직렬화 수행. Gin의 가벼운 Radix tree 라우터 적용.
* **성능 평가**:
  - Go Native/Gin JSON 속도 차이 거의 없음 (RPS 편차 < 3%).
  - gRPC의 성능이 **4,356 RPS** (단일), **2,335 RPS** (대량)로 타 플랫폼 대비 압도적으로 우수.
* **장단점**: 기계어 빌드 특성상 JSON, gRPC 모두 최상위권의 안정적인 성능 유지.

### 2.3 Python (FastAPI)
* **런타임**: CPython 3.14 + uvicorn[standard]
* **특징**: ASGI 규격 기반 비동기(AsyncIO) 처리.
* **성능 평가**:
  - 프레임워크 추상화 레이어로 인해 단일 조회 GET 성능 하락 (`0.71ms`).
  - 대량 데이터(27KB) 조회 시 JSON GET(`2.93ms`) 대비 gRPC(`0.91ms`)가 **3.2배 이상 빠름**.
* **장단점**: 대량의 I/O 및 데이터 전송 구조에서 gRPC 도입 효과가 4대 플랫폼 중 가장 높음.

### 2.4 Kotlin (Spring Boot - Java 25)
* **런타임**: Eclipse Temurin OpenJDK 25 (JVM) + Embedded Tomcat
* **특징**: IOC/DI 컨테이너 기반 및 **`spring.threads.virtual.enabled: true`** 가상 스레드 최적화 적용.
* **성능 평가**:
  - Java 17 대비 단일 gRPC 조회 성능이 **1.25ms -> 0.75ms(1,334 RPS)** 로 **40% 이상 속도 수직 상승**.
  - **검색 (QUERY) 시나리오**에서는 Java 21(`0.56ms`) 대비 더욱 향상된 **`0.49ms` (2,037 RPS)** 기록. JVM 25 엔진의 내부 락/모니터 핀홀 병목 최적화 효과 확인.
* **장단점**: 가상 스레드 도입 시 JVM 프레임워크 오버헤드가 극적으로 완화됨. 최신 Java 25+ 및 가상 스레드 도입 혜택이 최고임.

---

## 3. 종합 평정 및 아키텍처 가이드

1. **소규모/단순 I/O 환경**:
   - Bun/Elysia 또는 Go Native JSON API 구축이 로컬 응답 속도 면에서 최선.
2. **무거운 서버 (Python, Kotlin JVM) 및 MSA 환경**:
   - 내부 마이크로서비스 간 통신에 **gRPC 필수 도입 권장**. 직렬화 연산 단축만으로 1.8~3.2배의 응답 속도 향상 획득 가능.
3. **가상 스레드 및 Java 25 적용 필수**:
   - JVM 백엔드 개발 시, 처리 스레드가 차단(Block)되는 I/O 병목을 완화하기 위해 반드시 Java 25 및 `virtual threads` 설정을 적용하여 대기 지연(Latency)을 단축해야 함.
