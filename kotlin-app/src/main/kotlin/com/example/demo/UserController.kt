package com.example.demo

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
class UserController {

    @GetMapping("/health")
    fun health(): Map<String, String> {
        return mapOf(
            "status" to "ok",
            "protocol" to "HTTP/2 (TLS)",
            "framework" to "Spring Boot"
        )
    }

    @GetMapping("/api/user/{id}")
    fun getUser(@PathVariable id: Int): ResponseEntity<Any> {
        val user = MockData.users.find { it.id == id }
        return if (user != null) {
            ResponseEntity.ok(user)
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
        }
    }

    @GetMapping("/api/users")
    fun getUsers(): Map<String, Any> {
        return mapOf(
            "users" to MockData.users,
            "count" to MockData.users.size
        )
    }

    @PostMapping("/api/users/search")
    fun searchUsersPost(@RequestBody criteria: SearchCriteria): Map<String, Any> {
        val results = MockData.filterUsers(criteria)
        return mapOf(
            "users" to results,
            "count" to results.size
        )
    }

    // ─── HTTP QUERY 메서드 구현 (필터링 분기) ───
    @RequestMapping("/api/users/query")
    fun searchUsersQuery(
        request: HttpServletRequest,
        @RequestBody(required = false) criteria: SearchCriteria?
    ): ResponseEntity<Any> {
        if (request.method != "QUERY") {
            return ResponseEntity
                .status(HttpStatus.METHOD_NOT_ALLOWED)
                .header("Allow", "QUERY")
                .body(mapOf("error" to "Method ${request.method} not allowed. Use QUERY method."))
        }

        val actualCriteria = criteria ?: SearchCriteria()
        val results = MockData.filterUsers(actualCriteria)
        return ResponseEntity.ok(
            mapOf(
                "users" to results,
                "count" to results.size
            )
        )
    }
}
