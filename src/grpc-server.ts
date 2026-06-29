// ============================================================
// gRPC 서버 (HTTP/2 + TLS)
// @grpc/grpc-js + @grpc/proto-loader
// ============================================================

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as fs from "fs";
import { users, getUserById, searchUsers } from "./data/mock-data";

// ─── Proto 로드 ───
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

// ─── RPC 핸들러 ───

function getUser(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) {
  const id = call.request.id;
  const user = getUserById(id);

  if (!user) {
    callback({
      code: grpc.status.NOT_FOUND,
      details: `User with id ${id} not found`,
    });
    return;
  }

  callback(null, user);
}

function getUsers(
  _call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) {
  callback(null, { users });
}

function searchUsersHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) {
  const criteria = {
    name: call.request.name || undefined,
    min_age: call.request.min_age || undefined,
    max_age: call.request.max_age || undefined,
    department: call.request.department || undefined,
  };

  const results = searchUsers(criteria);
  callback(null, { users: results });
}

// ─── 서버 시작 (TLS) ───

const server = new grpc.Server();

server.addService(userService.UserService.service, {
  GetUser: getUser,
  GetUsers: getUsers,
  SearchUsers: searchUsersHandler,
});

// TLS 인증서 로드
const certsDir = path.resolve(__dirname, "../certs");
const rootCert = fs.readFileSync(path.join(certsDir, "rootCA.pem"));
const serverKey = fs.readFileSync(path.join(certsDir, "localhost-key.pem"));
const serverCert = fs.readFileSync(path.join(certsDir, "localhost.pem"));

const serverCredentials = grpc.ServerCredentials.createSsl(
  rootCert,
  [{ private_key: serverKey, cert_chain: serverCert }],
  false // checkClientCertificate
);

server.bindAsync("0.0.0.0:50051", serverCredentials, (err, port) => {
  if (err) {
    console.error("❌ gRPC 서버 시작 실패:", err);
    process.exit(1);
  }

  console.log("┌─────────────────────────────────────────────┐");
  console.log("│  🚀 gRPC Server (HTTP/2 + TLS)              │");
  console.log(`│  📡 grpcs://localhost:${port}                 │`);
  console.log("│                                             │");
  console.log("│  Services:                                  │");
  console.log("│   GetUser       단일 사용자 조회              │");
  console.log("│   GetUsers      전체 사용자 목록              │");
  console.log("│   SearchUsers   조건 검색                    │");
  console.log("└─────────────────────────────────────────────┘");
});
