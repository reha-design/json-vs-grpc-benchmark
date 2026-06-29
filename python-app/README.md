# Python FastAPI JSON & gRPC 벤치마크 앱

이 모듈은 `FastAPI` 기반으로 구성된 테스트 서버입니다. HTTP/2 TLS 통신과 gRPC 통신을 모두 지원합니다.

## 기술 스택
- **Python**: CPython 3.14 (가정)
- **Framework**: FastAPI (uvicorn[standard])
- **gRPC**: grpcio

## 실행 방법
```bash
# 가상환경 및 의존성 설치
uv sync

# 서버 실행 (uvicorn)
uv run app.py
```

## 벤치마크 요약 (단독 구동 환경)
자원 경합이 없는 단독 구동(Single Execution) 환경에서의 최고 성능치입니다.
- **단일 조회 (JSON GET)**: 약 1,594 RPS
- **단일 조회 (gRPC)**: 약 2,784 RPS
- **전체 목록 (JSON GET)**: 약 414 RPS
- **전체 목록 (gRPC)**: 약 1,094 RPS

*참고: 프레임워크 오버헤드가 다소 있으나, 대량 데이터(전체 목록) 전송 시 gRPC의 직렬화 이점이 발휘되어 JSON GET 대비 2.6배 이상 빠른 성능을 보여줍니다.*
