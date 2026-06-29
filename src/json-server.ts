// ============================================================
// Elysia.js JSON REST API 서버 (HTTP/2 + TLS)
// GET, POST, QUERY 메서드 지원
// ============================================================

import { Elysia } from "elysia";
import { users, getUserById, searchUsers } from "./data/mock-data";
import type { SearchCriteria } from "./data/mock-data";

const app = new Elysia()
  // ─── 단일 사용자 조회 ───
  .get("/api/user/:id", ({ params }) => {
    const user = getUserById(Number(params.id));
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return user;
  })

  // ─── 전체 사용자 목록 ───
  .get("/api/users", () => {
    return { users, count: users.length };
  })

  // ─── 검색 (POST — 기존 방식) ───
  .post("/api/users/search", ({ body }) => {
    const criteria = body as SearchCriteria;
    const results = searchUsers(criteria);
    return { users: results, count: results.length };
  })

  // ─── 검색 (HTTP QUERY — RFC 10008) ───
  // Elysia.js에 .query()가 없으므로 .all() + method 체크로 구현
  .all("/api/users/query", async ({ request }) => {
    if (request.method !== "QUERY") {
      return new Response(
        JSON.stringify({ error: `Method ${request.method} not allowed. Use QUERY method.` }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "QUERY",
          },
        }
      );
    }

    try {
      const criteria: SearchCriteria = await request.json();
      const results = searchUsers(criteria);
      return new Response(JSON.stringify({ users: results, count: results.length }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  })

  // ─── 헬스 체크 ───
  .get("/health", () => ({ status: "ok", protocol: "HTTP/2 (TLS)" }))

  // ─── 서버 시작 (HTTP/2 + TLS) ───
  .listen({
    port: 3000,
    tls: {
      key: Bun.file("./certs/localhost-key.pem"),
      cert: Bun.file("./certs/localhost.pem"),
    },
  });

console.log("┌─────────────────────────────────────────────┐");
console.log("│  🚀 JSON REST API Server (HTTP/2 + TLS)     │");
console.log("│  📡 https://localhost:3000                   │");
console.log("│                                             │");
console.log("│  Endpoints:                                 │");
console.log("│   GET    /api/user/:id     단일 조회         │");
console.log("│   GET    /api/users        전체 목록         │");
console.log("│   POST   /api/users/search 검색 (기존)       │");
console.log("│   QUERY  /api/users/query  검색 (RFC 10008)  │");
console.log("│   GET    /health           헬스 체크         │");
console.log("└─────────────────────────────────────────────┘");
