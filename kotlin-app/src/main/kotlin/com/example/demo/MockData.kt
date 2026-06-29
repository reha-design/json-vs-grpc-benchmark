package com.example.demo

import java.util.Random

data class User(
    val id: Int,
    val name: String,
    val email: String,
    val age: Int,
    val address: String,
    val phone: String,
    val department: String,
    val role: String,
    val salary: Double,
    val isActive: Boolean,
    val joinedDate: String,
    val skills: List<String>
)

data class SearchCriteria(
    val name: String? = null,
    val minAge: Int? = null,
    val maxAge: Int? = null,
    val department: String? = null
)

object MockData {
    val users = mutableListOf<User>()

    private val firstNames = listOf(
        "김민수", "이서연", "박지훈", "최수아", "정우진",
        "강하은", "조현우", "윤예린", "임도윤", "한서준",
        "오지은", "신유나", "서민재", "권나윤", "황준서",
        "송하린", "전도현", "문지아", "양시우", "배수빈"
    )
    private val departments = listOf("개발", "디자인", "기획", "인사", "마케팅", "영업", "재무", "운영")
    private val roles = listOf("사원", "주임", "대리", "과장", "차장", "부장", "팀장", "이사")
    private val cities = listOf("서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "성남")
    private val skillPool = listOf(
        "TypeScript", "JavaScript", "Python", "Go", "Rust",
        "React", "Vue", "Angular", "Svelte", "Next.js",
        "Node.js", "Bun", "Deno", "Docker", "Kubernetes",
        "PostgreSQL", "MongoDB", "Redis", "GraphQL", "gRPC"
    )

    init {
        val random = Random(42)
        val streetTypes = listOf("강남구", "해운대구", "중구", "서구", "동구")

        for (i in 1..100) {
            val name = firstNames[random.nextInt(firstNames.size)]
            val dept = departments[random.nextInt(departments.size)]
            val age = 23 + random.nextInt(20)
            val year = 2015 + random.nextInt(10)
            val month = String.format("%02d", 1 + random.nextInt(12))
            val day = String.format("%02d", 1 + random.nextInt(28))

            // 스킬 2~6개 랜덤 추출
            val skillsCount = 2 + random.nextInt(5)
            val shuffledSkills = skillPool.shuffled(random)
            val skills = shuffledSkills.take(skillsCount)

            users.add(
                User(
                    id = i,
                    name = name,
                    email = "user$i@example.com",
                    age = age,
                    address = "${cities[random.nextInt(cities.size)]}시 ${streetTypes[random.nextInt(streetTypes.size)]} ${1 + random.nextInt(999)}번지",
                    phone = "010-${String.format("%04d", random.nextInt(10000))}-${String.format("%04d", random.nextInt(10000))}",
                    department = dept,
                    role = roles[random.nextInt(roles.size)],
                    salary = Math.round((3000.0 + random.nextDouble() * 7000.0) * 10000.0) / 10000.0,
                    isActive = random.nextDouble() > 0.15,
                    joinedDate = "$year-$month-$day",
                    skills = skills
                )
            )
        }
    }

    fun filterUsers(criteria: SearchCriteria): List<User> {
        return users.filter { u ->
            if (criteria.name != null && !u.name.contains(criteria.name)) return@filter false
            if (criteria.minAge != null && u.age < criteria.minAge) return@filter false
            if (criteria.maxAge != null && u.age > criteria.maxAge) return@filter false
            if (criteria.department != null && u.department != criteria.department) return@filter false
            true
        }
    }
}
