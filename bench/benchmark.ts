// ============================================================
// 종합 다중 언어 벤치마크 스크립트 (HTTP/2 + TLS)
// Bun, Go (Native/Gin), Python (FastAPI), Kotlin (Spring Boot)
// ============================================================

import { GrpcBenchmarkClient } from "../src/grpc-client";

// ─── 설정 ───
const ITERATIONS = 200; // 시나리오당 반복 횟수
const WARMUP = 20;      // 웜업 횟수

// 자체 서명 인증서 검증 무시
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ─── 테스트 대상 매트릭스 ───
interface PlatformConfig {
  name: string;
  framework: string;
  jsonBase: string;
  grpcPort: number;
}

const platforms: PlatformConfig[] = [
  { name: "Bun", framework: "Elysia.js", jsonBase: "https://localhost:3000", grpcPort: 50051 },
  { name: "Go", framework: "Go Native", jsonBase: "https://localhost:3001", grpcPort: 50052 },
  { name: "Go", framework: "Go Gin", jsonBase: "https://localhost:3004", grpcPort: 50052 },
  { name: "Python", framework: "FastAPI", jsonBase: "https://localhost:3002", grpcPort: 50053 },
  { name: "Kotlin", framework: "Spring Boot", jsonBase: "https://localhost:3003", grpcPort: 50054 },
  { name: "Node.js", framework: "Express", jsonBase: "https://localhost:3005", grpcPort: 50055 },
  { name: "Node.js", framework: "Fastify", jsonBase: "https://localhost:3006", grpcPort: 50055 },
];

interface BenchResult {
  platform: string;
  framework: string;
  scenario: string;
  protocol: string;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  payloadBytes: number;
  rps: number;
}

// ─── 통계 계산 유틸 ───
function calcStats(times: number[]): { avg: number; median: number; p95: number; p99: number; min: number; max: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const len = sorted.length;

  return {
    avg: Math.round((sum / len) * 100) / 100,
    median: sorted[Math.floor(len / 2)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    min: sorted[0],
    max: sorted[len - 1],
  };
}

function byteSize(obj: any): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

// ─── JSON 벤치마크 엔진 ───
async function benchJson(
  platform: string,
  framework: string,
  scenario: string,
  url: string,
  options?: RequestInit
): Promise<BenchResult | null> {
  const times: number[] = [];
  let payloadBytes = 0;
  const method = options?.method || "GET";

  try {
    // 웜업
    for (let i = 0; i < WARMUP; i++) {
      await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
    }

    // 측정
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const end = performance.now();

      times.push(Math.round((end - start) * 100) / 100);
      if (i === 0) payloadBytes = byteSize(data);
    }

    const stats = calcStats(times);
    const totalTime = times.reduce((a, b) => a + b, 0);

    return {
      platform,
      framework,
      scenario,
      protocol: `HTTP/2 ${method}`,
      ...stats,
      payloadBytes,
      rps: Math.round((ITERATIONS / (totalTime / 1000)) * 100) / 100,
    };
  } catch (err: any) {
    console.warn(`⚠️ [${platform}/${framework}] JSON ${scenario} 테스트 오류 (서버 꺼짐?): ${err.message}`);
    return null;
  }
}

// ─── gRPC 벤치마크 엔진 ───
async function benchGrpc(
  platform: string,
  framework: string,
  scenario: string,
  grpcClient: GrpcBenchmarkClient,
  fn: (client: GrpcBenchmarkClient) => Promise<any>
): Promise<BenchResult | null> {
  const times: number[] = [];
  let payloadBytes = 0;

  try {
    // 웜업
    for (let i = 0; i < WARMUP; i++) {
      await fn(grpcClient);
    }

    // 측정
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      const data = await fn(grpcClient);
      const end = performance.now();

      times.push(Math.round((end - start) * 100) / 100);
      if (i === 0) payloadBytes = byteSize(data);
    }

    const stats = calcStats(times);
    const totalTime = times.reduce((a, b) => a + b, 0);

    return {
      platform,
      framework,
      scenario,
      protocol: "gRPC",
      ...stats,
      payloadBytes,
      rps: Math.round((ITERATIONS / (totalTime / 1000)) * 100) / 100,
    };
  } catch (err: any) {
    console.warn(`⚠️ [${platform}/${framework}] gRPC ${scenario} 테스트 오류 (서버 꺼짐?): ${err.message}`);
    return null;
  }
}

// ─── 벤치마크 오케스트레이션 ───
async function main() {
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║    📊 다중 언어 JSON vs gRPC 성능 벤치마크 (HTTP/2)       ║");
  console.log("╠═══════════════════════════════════════════════════════════╣");
  console.log(`║  반복 횟수: ${ITERATIONS}회  |  웜업: ${WARMUP}회                      ║`);
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("\n⏳ 순차적 테스트 시작...\n");

  const results: BenchResult[] = [];
  const searchBody = JSON.stringify({ name: "김", min_age: 25, max_age: 35 });
  const searchBodyKotlin = JSON.stringify({ name: "김", minAge: 25, maxAge: 35 });

  for (const p of platforms) {
    console.log(`------------------------------------------------------------`);
    console.log(`🚀 [테스트 중] ${p.name} - ${p.framework} ...`);
    console.log(`------------------------------------------------------------`);

    // 1. 단일 조회 (GET)
    const jsonGet1 = await benchJson(p.name, p.framework, "단일 조회", `${p.jsonBase}/api/user/1`);
    if (jsonGet1) results.push(jsonGet1);

    // 2. 전체 목록 (GET)
    const jsonGetList = await benchJson(p.name, p.framework, "전체 목록", `${p.jsonBase}/api/users`);
    if (jsonGetList) results.push(jsonGetList);

    // 3. 검색 (POST)
    // Kotlin은 CamelCase 바인딩 사양에 맞춰 body 파싱 편차가 있을 수 있으므로 분기
    const postBody = p.name === "Kotlin" ? searchBodyKotlin : searchBody;
    const jsonPost = await benchJson(p.name, p.framework, "검색 (POST)", `${p.jsonBase}/api/users/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: postBody,
    });
    if (jsonPost) results.push(jsonPost);

    // 4. 검색 (QUERY - RFC 10008)
    const jsonQuery = await benchJson(p.name, p.framework, "검색 (QUERY)", `${p.jsonBase}/api/users/query`, {
      method: "QUERY",
      headers: { "Content-Type": "application/json" },
      body: postBody,
    });
    if (jsonQuery) results.push(jsonQuery);

    // 5. gRPC 시나리오들 (동일 포트 gRPC 중복 호출 제거용 체크)
    // Go의 경우 Native/Gin 두 플랫폼이 gRPC 포트(50052)를 공유하므로 한 번만 진행합니다.
    const alreadyTestedGrpc = results.some(
      (r) => r.platform === p.name && r.protocol === "gRPC" && r.framework !== p.framework
    );

    if (!alreadyTestedGrpc) {
      const grpcClient = new GrpcBenchmarkClient(p.grpcPort);
      
      // gRPC 단일 조회
      const gGetUser = await benchGrpc(p.name, p.framework, "단일 조회", grpcClient, (c) => c.getUser(1));
      if (gGetUser) results.push(gGetUser);

      // gRPC 전체 목록
      const gGetUsers = await benchGrpc(p.name, p.framework, "전체 목록", grpcClient, (c) => c.getUsers());
      if (gGetUsers) results.push(gGetUsers);

      // gRPC 검색
      const gSearch = await benchGrpc(p.name, p.framework, "검색 (gRPC)", grpcClient, (c) =>
        c.searchUsersRpc({ name: "김", min_age: 25, max_age: 35 })
      );
      if (gSearch) results.push(gSearch);

      grpcClient.close();
    }
  }

  // ─── 결과 출력 ───
  console.log("\n");
  console.log("╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                                         📊 종합 벤치마크 결과 리포트                                          ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝");
  console.log("");

  const header = [
    "언어".padEnd(8),
    "프레임워크".padEnd(14),
    "시나리오".padEnd(16),
    "프로토콜".padEnd(14),
    "Avg(ms)".padStart(8),
    "Med(ms)".padStart(8),
    "P95(ms)".padStart(8),
    "P99(ms)".padStart(8),
    "Min(ms)".padStart(8),
    "Max(ms)".padStart(8),
    "Payload".padStart(9),
    "RPS".padStart(8),
  ].join(" │ ");

  const separator = "─".repeat(header.length);

  console.log(separator);
  console.log(header);
  console.log(separator);

  // 시나리오 순서로 정렬하여 보기 편하게 만듦
  const scenarioOrder = ["단일 조회", "전체 목록", "검색 (POST)", "검색 (QUERY)", "검색 (gRPC)"];
  results.sort((a, b) => {
    const scDiff = scenarioOrder.indexOf(a.scenario) - scenarioOrder.indexOf(b.scenario);
    if (scDiff !== 0) return scDiff;
    return a.platform.localeCompare(b.platform);
  });

  for (const r of results) {
    const row = [
      r.platform.padEnd(8),
      r.framework.padEnd(14),
      r.scenario.padEnd(16),
      r.protocol.padEnd(14),
      r.avg.toFixed(2).padStart(8),
      r.median.toFixed(2).padStart(8),
      r.p95.toFixed(2).padStart(8),
      r.p99.toFixed(2).padStart(8),
      r.min.toFixed(2).padStart(8),
      r.max.toFixed(2).padStart(8),
      formatBytes(r.payloadBytes).padStart(9),
      r.rps.toFixed(0).padStart(8),
    ].join(" │ ");
    console.log(row);
  }

  console.log(separator);
  console.log("\n✅ 모든 벤치마크 완료!\n");

  // ADDED: Dump results to JSON file
  const fs = require("fs");
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync("bench_results_dump.json", "utf-8")); } catch(e){}
  const merged = existing.concat(results);
  fs.writeFileSync("bench_results_dump.json", JSON.stringify(merged, null, 2));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main().catch((err) => {
  console.error("❌ 벤치마크 대실패:", err);
});
