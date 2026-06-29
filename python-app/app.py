import asyncio
import os
import random
from concurrent import futures
import grpc
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
import uvicorn

import user_pb2
import user_pb2_grpc

# ─── 공통 목 데이터 생성 (시드 고정으로 모든 언어와 동등한 무작위성 제공) ───
random.seed(42)

first_names = [
    "김민수", "이서연", "박지훈", "최수아", "정우진",
    "강하은", "조현우", "윤예린", "임도윤", "한서준",
    "오지은", "신유나", "서민재", "권나윤", "황준서",
    "송하린", "전도현", "문지아", "양시우", "배수빈",
]
departments = ["개발", "디자인", "기획", "인사", "마케팅", "영업", "재무", "운영"]
roles = ["사원", "주임", "대리", "과장", "차장", "부장", "팀장", "이사"]
cities = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "성남"]
skill_pool = [
    "TypeScript", "JavaScript", "Python", "Go", "Rust",
    "React", "Vue", "Angular", "Svelte", "Next.js",
    "Node.js", "Bun", "Deno", "Docker", "Kubernetes",
    "PostgreSQL", "MongoDB", "Redis", "GraphQL", "gRPC",
]

def generate_skills():
    count = random.randint(2, 6)
    return random.sample(skill_pool, count)

def generate_users():
    users_list = []
    for i in range(1, 101):
        name = random.choice(first_names)
        dept = random.choice(departments)
        age = random.randint(23, 42)
        year = random.randint(2015, 2024)
        month = f"{random.randint(1, 12):02d}"
        day = f"{random.randint(1, 28):02d}"
        
        users_list.append({
            "id": i,
            "name": name,
            "email": f"user{i}@example.com",
            "age": age,
            "address": f"{random.choice(cities)}시 {random.choice(['강남구', '해운대구', '중구', '서구', '동구'])} {random.randint(1, 999)}번지",
            "phone": f"010-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}",
            "department": dept,
            "role": random.choice(roles),
            "salary": round(3000.0 + random.random() * 7000.0, 4),
            "is_active": random.random() > 0.15,
            "joined_date": f"{year}-{month}-{day}",
            "skills": generate_skills()
        })
    return users_list

USERS = generate_users()

def filter_users(criteria):
    results = []
    for u in USERS:
        if criteria.get("name") and criteria["name"] not in u["name"]:
            continue
        if criteria.get("min_age") and u["age"] < criteria["min_age"]:
            continue
        if criteria.get("max_age") and u["age"] > criteria["max_age"]:
            continue
        if criteria.get("department") and u["department"] != criteria["department"]:
            continue
        results.append(u)
    return results

# ─── FastAPI 설정 (HTTP/2 + TLS) ───
app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok", "protocol": "HTTP/2 (TLS)", "framework": "FastAPI"}

@app.get("/api/user/{user_id}")
async def get_user(user_id: int):
    user = next((u for u in USERS if u["id"] == user_id), None)
    if not user:
        return JSONResponse(content={"error": "User not found"}, status_code=404)
    return user

@app.get("/api/users")
async def get_users():
    return {"users": USERS, "count": len(USERS)}

@app.post("/api/users/search")
async def search_users_post(request: Request):
    criteria = await request.json()
    results = filter_users(criteria)
    return {"users": results, "count": len(results)}

# HTTP QUERY 메서드 처리
@app.api_route("/api/users/query", methods=["QUERY"])
async def search_users_query(request: Request):
    try:
        criteria = await request.json()
    except Exception:
        criteria = {}
    results = filter_users(criteria)
    return JSONResponse(content={"users": results, "count": len(results)})

# ─── gRPC 서비스 구현 ───
class UserService(user_pb2_grpc.UserServiceServicer):
    def GetUser(self, request, context):
        user = next((u for u in USERS if u["id"] == request.id), None)
        if not user:
            context.abort(grpc.StatusCode.NOT_FOUND, f"User {request.id} not found")
        
        return user_pb2.User(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            age=user["age"],
            address=user["address"],
            phone=user["phone"],
            department=user["department"],
            role=user["role"],
            salary=user["salary"],
            is_active=user["is_active"],
            joined_date=user["joined_date"],
            skills=user["skills"]
        )

    def GetUsers(self, request, context):
        pb_users = []
        for u in USERS:
            pb_users.append(user_pb2.User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                age=u["age"],
                address=u["address"],
                phone=u["phone"],
                department=u["department"],
                role=u["role"],
                salary=u["salary"],
                is_active=u["is_active"],
                joined_date=u["joined_date"],
                skills=u["skills"]
            ))
        return user_pb2.UserList(users=pb_users)

    def SearchUsers(self, request, context):
        criteria = {}
        if request.name:
            criteria["name"] = request.name
        if request.min_age:
            criteria["min_age"] = request.min_age
        if request.max_age:
            criteria["max_age"] = request.max_age
        if request.department:
            criteria["department"] = request.department

        results = filter_users(criteria)
        pb_users = []
        for u in results:
            pb_users.append(user_pb2.User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                age=u["age"],
                address=u["address"],
                phone=u["phone"],
                department=u["department"],
                role=u["role"],
                salary=u["salary"],
                is_active=u["is_active"],
                joined_date=u["joined_date"],
                skills=u["skills"]
            ))
        return user_pb2.UserList(users=pb_users)

def serve_grpc():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    user_pb2_grpc.add_UserServiceServicer_to_server(UserService(), server)
    
    # SSL/TLS 자격 증명 로드
    certs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../certs"))
    with open(os.path.join(certs_dir, "localhost-key.pem"), "rb") as f:
        private_key = f.read()
    with open(os.path.join(certs_dir, "localhost.pem"), "rb") as f:
        certificate_chain = f.read()
    with open(os.path.join(certs_dir, "rootCA.pem"), "rb") as f:
        root_certificates = f.read()

    server_creds = grpc.ssl_server_credentials(
        [(private_key, certificate_chain)],
        root_certificates=root_certificates,
        require_client_auth=False
    )
    
    server.add_secure_port("0.0.0.0:50053", server_creds)
    server.start()
    print("[Python gRPC Server Started on port 50053]")
    return server

# ─── 서버 메인 진입점 ───
async def main():
    # gRPC 백그라운드 스레드 시작
    grpc_server = serve_grpc()
    
    # FastAPI HTTP/2 TLS 서버 구동
    certs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../certs"))
    ssl_keyfile = os.path.join(certs_dir, "localhost-key.pem")
    ssl_certfile = os.path.join(certs_dir, "localhost.pem")
    
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=3002,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        http="h11" # 기본값인 h11에서 h2로 업그레이드됨 (cryptography 및 h2 모듈 존재 시 자동으로 http/2 활성화)
    )
    server = uvicorn.Server(config)
    
    print("[Python FastAPI Server Started on port 3002]")
    
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())
