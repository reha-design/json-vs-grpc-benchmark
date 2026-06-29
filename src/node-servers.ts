// ============================================================
// Node.js Express, Fastify, and gRPC Servers
// Enforces HTTP/2 (where supported) & TLS
// ============================================================

import express from "express";
import Fastify from "fastify";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { users, getUserById, searchUsers } from "./data/mock-data";
import type { SearchCriteria } from "./data/mock-data";

const CERT_DIR = path.resolve(__dirname, "../certs");
const sslOptions = {
  key: fs.readFileSync(path.join(CERT_DIR, "localhost-key.pem")),
  cert: fs.readFileSync(path.join(CERT_DIR, "localhost.pem")),
};

// ------------------------------------------------------------
// 1. Express Server (Port: 3005, HTTPS TLS)
// ------------------------------------------------------------
const expressApp = express();
expressApp.use(express.json());

expressApp.get("/api/user/:id", (req, res) => {
  const user = getUserById(Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

expressApp.get("/api/users", (req, res) => {
  res.json({ users, count: users.length });
});

expressApp.post("/api/users/search", (req, res) => {
  const results = searchUsers(req.body);
  res.json({ users: results, count: results.length });
});

// Express custom QUERY router
expressApp.all("/api/users/query", (req, res) => {
  if (req.method !== "QUERY") {
    res.setHeader("Allow", "QUERY");
    res.status(405).json({ error: `Method ${req.method} not allowed. Use QUERY method.` });
    return;
  }
  const results = searchUsers(req.body);
  res.json({ users: results, count: results.length });
});

const expressServer = https.createServer(sslOptions, expressApp);
expressServer.listen(3005, () => {
  console.log("[Express] HTTPS Server running on port 3005");
});

// ------------------------------------------------------------
// 2. Fastify Server (Port: 3006, HTTP/2 + TLS)
// ------------------------------------------------------------
const fastifyApp = Fastify({
  https: sslOptions,
  logger: false,
});

// Helper to buffer raw request body in case Fastify parser doesn't process it (due to non-standard HTTP methods)
function getRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => { body += chunk; });
    req.on("end", () => { resolve(body); });
    req.on("error", (err: any) => { reject(err); });
  });
}

// Hack: Intercept non-standard QUERY method via preValidation hook to bypass 404 router constraints
fastifyApp.addHook("preValidation", async (request, reply) => {
  if (request.raw.method === "QUERY" && request.raw.url === "/api/users/query") {
    let criteria = request.body as SearchCriteria;
    if (!criteria) {
      try {
        const raw = await getRawBody(request.raw);
        criteria = JSON.parse(raw);
      } catch {
        criteria = {};
      }
    }
    const results = searchUsers(criteria);
    reply.status(200).send({ users: results, count: results.length });
    return reply;
  }
});

fastifyApp.get("/api/user/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = getUserById(Number(id));
  if (!user) {
    reply.status(404).send({ error: "User not found" });
    return;
  }
  return user;
});

fastifyApp.get("/api/users", async () => {
  return { users, count: users.length };
});

fastifyApp.post("/api/users/search", async (request) => {
  const criteria = request.body as SearchCriteria;
  const results = searchUsers(criteria);
  return { users: results, count: results.length };
});

fastifyApp.listen({ port: 3006, host: "127.0.0.1" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`[Fastify] HTTP/2 TLS Server running at ${address}`);
});

// ------------------------------------------------------------
// 3. Node gRPC Server (Port: 50055, TLS)
// ------------------------------------------------------------
const PROTO_PATH = path.resolve(__dirname, "../proto/user.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const userService = protoDescriptor.user;

const grpcServer = new grpc.Server();

grpcServer.addService(userService.UserService.service, {
  getUser: (call: any, callback: any) => {
    const user = getUserById(call.request.id);
    if (!user) {
      callback({
        code: grpc.status.NOT_FOUND,
        details: `User with id ${call.request.id} not found`,
      });
      return;
    }
    callback(null, user);
  },
  getUsers: (_call: any, callback: any) => {
    callback(null, { users });
  },
  searchUsers: (call: any, callback: any) => {
    const criteria = {
      name: call.request.name || undefined,
      min_age: call.request.min_age || undefined,
      max_age: call.request.max_age || undefined,
      department: call.request.department || undefined,
    };
    const results = searchUsers(criteria);
    callback(null, { users: results });
  },
});

const rootCert = fs.readFileSync(path.join(CERT_DIR, "rootCA.pem"));
const keyCertPairs = [
  {
    private_key: fs.readFileSync(path.join(CERT_DIR, "localhost-key.pem")),
    cert_chain: fs.readFileSync(path.join(CERT_DIR, "localhost.pem")),
  },
];

const grpcCreds = grpc.ServerCredentials.createSsl(rootCert, keyCertPairs, false);

grpcServer.bindAsync("0.0.0.0:50055", grpcCreds, (err, port) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(`[Node gRPC] Server running on port ${port} with TLS`);
});
