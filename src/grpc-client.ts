// ============================================================
// gRPC 클라이언트 유틸 (TLS) - 다중 포트 지원 리팩토링
// 벤치마크에서 사용할 Promise 기반 래퍼 클래스
// ============================================================

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as fs from "fs";

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

// ─── TLS 크레덴셜 로드 ───
const certsDir = path.resolve(__dirname, "../certs");
const rootCert = fs.readFileSync(path.join(certsDir, "rootCA.pem"));
const channelCredentials = grpc.credentials.createSsl(rootCert);

// ─── 다중 서버 포트 대응을 위한 클라이언트 래퍼 클래스 ───
export class GrpcBenchmarkClient {
  private client: any;

  constructor(port: number) {
    this.client = new protoDescriptor.user.UserService(
      `localhost:${port}`,
      channelCredentials
    );
  }

  getUser(id: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetUser({ id }, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  getUsers(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetUsers({}, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  searchUsersRpc(criteria: {
    name?: string;
    min_age?: number;
    max_age?: number;
    department?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.SearchUsers(criteria, (err: any, response: any) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  close(): void {
    this.client.close();
  }
}
