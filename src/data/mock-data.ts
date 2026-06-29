// ============================================================
// 공통 목 데이터 — JSON / gRPC 양쪽에서 동일 데이터 사용
// ============================================================

export interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
  department: string;
  role: string;
  salary: number;
  is_active: boolean;
  joined_date: string;
  skills: string[];
}

export interface SearchCriteria {
  name?: string;
  min_age?: number;
  max_age?: number;
  department?: string;
}

// --- 데이터 생성 헬퍼 ---

const firstNames = [
  "김민수", "이서연", "박지훈", "최수아", "정우진",
  "강하은", "조현우", "윤예린", "임도윤", "한서준",
  "오지은", "신유나", "서민재", "권나윤", "황준서",
  "송하린", "전도현", "문지아", "양시우", "배수빈",
];

const departments = ["개발", "디자인", "기획", "인사", "마케팅", "영업", "재무", "운영"];
const roles = ["사원", "주임", "대리", "과장", "차장", "부장", "팀장", "이사"];
const cities = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "성남"];

const skillPool = [
  "TypeScript", "JavaScript", "Python", "Go", "Rust",
  "React", "Vue", "Angular", "Svelte", "Next.js",
  "Node.js", "Bun", "Deno", "Docker", "Kubernetes",
  "PostgreSQL", "MongoDB", "Redis", "GraphQL", "gRPC",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSkills(): string[] {
  const count = 2 + Math.floor(Math.random() * 5); // 2~6개
  const shuffled = [...skillPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateUser(id: number): User {
  const name = randomPick(firstNames);
  const dept = randomPick(departments);
  const age = 23 + Math.floor(Math.random() * 20); // 23~42
  const year = 2015 + Math.floor(Math.random() * 10);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");

  return {
    id,
    name,
    email: `user${id}@example.com`,
    age,
    address: `${randomPick(cities)}시 ${randomPick(["강남구", "해운대구", "중구", "서구", "동구"])} ${Math.floor(Math.random() * 999) + 1}번지`,
    phone: `010-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    department: dept,
    role: randomPick(roles),
    salary: Math.round((3000 + Math.random() * 7000) * 10000) / 10000, // 3000~10000 만원
    is_active: Math.random() > 0.15,
    joined_date: `${year}-${month}-${day}`,
    skills: randomSkills(),
  };
}

// --- 100명 목 데이터 ---
export const users: User[] = Array.from({ length: 100 }, (_, i) => generateUser(i + 1));

// --- 검색 함수 ---
export function searchUsers(criteria: SearchCriteria): User[] {
  return users.filter((user) => {
    if (criteria.name && !user.name.includes(criteria.name)) return false;
    if (criteria.min_age && user.age < criteria.min_age) return false;
    if (criteria.max_age && user.age > criteria.max_age) return false;
    if (criteria.department && user.department !== criteria.department) return false;
    return true;
  });
}

// --- 단일 조회 ---
export function getUserById(id: number): User | undefined {
  return users.find((u) => u.id === id);
}
