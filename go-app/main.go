package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"

	pb "go-benchmark/user"
)

// ─── 공통 데이터 정의 ───
type User struct {
	ID          int32    `json:"id"`
	Name        string   `json:"name"`
	Email       string   `json:"email"`
	Age         int32    `json:"age"`
	Address     string   `json:"address"`
	Phone       string   `json:"phone"`
	Department  string   `json:"department"`
	Role        string   `json:"role"`
	Salary      float64  `json:"salary"`
	IsActive    bool     `json:"is_active"`
	JoinedDate  string   `json:"joined_date"`
	Skills      []string `json:"skills"`
}

type SearchCriteria struct {
	Name       string `json:"name"`
	MinAge     int32  `json:"min_age"`
	MaxAge     int32  `json:"max_age"`
	Department string `json:"department"`
}

var (
	users     []User
	usersOnce sync.Once
)

var firstNames = []string{
	"김민수", "이서연", "박지훈", "최수아", "정우진",
	"강하은", "조현우", "윤예린", "임도윤", "한서준",
	"오지은", "신유나", "서민재", "권나윤", "황준서",
	"송하린", "전도현", "문지아", "양시우", "배수빈",
}
var departments = []string{"개발", "디자인", "기획", "인사", "마케팅", "영업", "재무", "운영"}
var roles = []string{"사원", "주임", "대리", "과장", "차장", "부장", "팀장", "이사"}
var cities = []string{"서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "수원", "성남"}
var skillPool = []string{
	"TypeScript", "JavaScript", "Python", "Go", "Rust",
	"React", "Vue", "Angular", "Svelte", "Next.js",
	"Node.js", "Bun", "Deno", "Docker", "Kubernetes",
	"PostgreSQL", "MongoDB", "Redis", "GraphQL", "gRPC",
}

// ─── 목 데이터 생성 (시드 고정) ───
func initUsers() {
	usersOnce.Do(func() {
		r := rand.New(rand.NewSource(42))
		users = make([]User, 100)
		for i := 0; i < 100; i++ {
			id := int32(i + 1)
			name := firstNames[r.Intn(len(firstNames))]
			dept := departments[r.Intn(len(departments))]
			age := int32(23 + r.Intn(20))
			year := 2015 + r.Intn(10)
			month := fmt.Sprintf("%02d", 1+r.Intn(12))
			day := fmt.Sprintf("%02d", 1+r.Intn(28))

			// 스킬 무작위 2~6개 추출
			skillsCount := 2 + r.Intn(5)
			shuffledSkills := make([]string, len(skillPool))
			copy(shuffledSkills, skillPool)
			r.Shuffle(len(shuffledSkills), func(i, j int) {
				shuffledSkills[i], shuffledSkills[j] = shuffledSkills[j], shuffledSkills[i]
			})

			users[i] = User{
				ID:         id,
				Name:       name,
				Email:      fmt.Sprintf("user%d@example.com", id),
				Age:        age,
				Address:    fmt.Sprintf("%s시 %s %d번지", cities[r.Intn(len(cities))], []string{"강남구", "해운대구", "중구", "서구", "동구"}[r.Intn(5)], 1+r.Intn(999)),
				Phone:      fmt.Sprintf("010-%04d-%04d", r.Intn(10000), r.Intn(10000)),
				Department: dept,
				Role:       roles[r.Intn(len(roles))],
				Salary:     mathRound(3000.0+r.Float64()*7000.0, 4),
				IsActive:   r.Float64() > 0.15,
				JoinedDate: fmt.Sprintf("%d-%s-%s", year, month, day),
				Skills:     shuffledSkills[:skillsCount],
			}
		}
	})
}

func mathRound(val float64, precision int) float64 {
	p := 1.0
	for i := 0; i < precision; i++ {
		p *= 10
	}
	return float64(int(val*p+0.5)) / p
}

func filterUsers(criteria SearchCriteria) []User {
	var results []User
	for _, u := range users {
		if criteria.Name != "" && !strings.Contains(u.Name, criteria.Name) {
			continue
		}
		if criteria.MinAge > 0 && u.Age < criteria.MinAge {
			continue
		}
		if criteria.MaxAge > 0 && u.Age > criteria.MaxAge {
			continue
		}
		if criteria.Department != "" && u.Department != criteria.Department {
			continue
		}
		results = append(results, u)
	}
	return results
}

// ─── gRPC 서비스 구현 ───
type gRpcServer struct {
	pb.UnimplementedUserServiceServer
}

func (s *gRpcServer) GetUser(ctx context.Context, req *pb.UserIdRequest) (*pb.User, error) {
	for _, u := range users {
		if u.ID == req.Id {
			return &pb.User{
				Id:         u.ID,
				Name:       u.Name,
				Email:      u.Email,
				Age:        u.Age,
				Address:    u.Address,
				Phone:      u.Phone,
				Department: u.Department,
				Role:       u.Role,
				Salary:     u.Salary,
				IsActive:   u.IsActive,
				JoinedDate: u.JoinedDate,
				Skills:     u.Skills,
			}, nil
		}
	}
	return nil, status.Errorf(codes.NotFound, "user with id %d not found", req.Id)
}

func (s *gRpcServer) GetUsers(ctx context.Context, req *pb.Empty) (*pb.UserList, error) {
	pbUsers := make([]*pb.User, len(users))
	for i, u := range users {
		pbUsers[i] = &pb.User{
			Id:         u.ID,
			Name:       u.Name,
			Email:      u.Email,
			Age:        u.Age,
			Address:    u.Address,
			Phone:      u.Phone,
			Department: u.Department,
			Role:       u.Role,
			Salary:     u.Salary,
			IsActive:   u.IsActive,
			JoinedDate: u.JoinedDate,
			Skills:     u.Skills,
		}
	}
	return &pb.UserList{Users: pbUsers}, nil
}

func (s *gRpcServer) SearchUsers(ctx context.Context, req *pb.SearchRequest) (*pb.UserList, error) {
	criteria := SearchCriteria{
		Name:       req.Name,
		MinAge:     req.MinAge,
		MaxAge:     req.MaxAge,
		Department: req.Department,
	}
	results := filterUsers(criteria)
	pbUsers := make([]*pb.User, len(results))
	for i, u := range results {
		pbUsers[i] = &pb.User{
			Id:         u.ID,
			Name:       u.Name,
			Email:      u.Email,
			Age:        u.Age,
			Address:    u.Address,
			Phone:      u.Phone,
			Department: u.Department,
			Role:       u.Role,
			Salary:     u.Salary,
			IsActive:   u.IsActive,
			JoinedDate: u.JoinedDate,
			Skills:     u.Skills,
		}
	}
	return &pb.UserList{Users: pbUsers}, nil
}

// ─── Go Native JSON Server Handler ───
func nativeGetUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
		"count": len(users),
	})
}

func nativeGetUser(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	idStr := strings.TrimPrefix(r.URL.Path, "/api/user/")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid user ID"})
		return
	}
	for _, u := range users {
		if u.ID == int32(id) {
			json.NewEncoder(w).Encode(u)
			return
		}
	}
	w.WriteHeader(http.StatusNotFound)
	json.NewEncoder(w).Encode(map[string]string{"error": "User not found"})
}

func nativeSearchUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var criteria SearchCriteria
	if err := json.NewDecoder(r.Body).Decode(&criteria); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid body"})
		return
	}
	results := filterUsers(criteria)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": results,
		"count": len(results),
	})
}

func nativeQueryUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != "QUERY" {
		w.Header().Set("Allow", "QUERY")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{"error": "Method Not Allowed. Use QUERY method."})
		return
	}
	var criteria SearchCriteria
	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&criteria)
	}
	results := filterUsers(criteria)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": results,
		"count": len(results),
	})
}

// ─── Main 구동부 ───
func main() {
	initUsers()

	certsDir, _ := filepath.Abs("certs")
	keyFile := filepath.Join(certsDir, "localhost-key.pem")
	certFile := filepath.Join(certsDir, "localhost.pem")
	rootCAFile := filepath.Join(certsDir, "rootCA.pem")

	// 1. gRPC Server 구동
	go func() {
		lis, err := net.Listen("tcp", ":50052")
		if err != nil {
			log.Fatalf("failed to listen: %v", err)
		}

		creds, err := credentials.NewServerTLSFromFile(certFile, keyFile)
		if err != nil {
			log.Fatalf("failed to load credentials: %v", err)
		}

		s := grpc.NewServer(grpc.Creds(creds))
		pb.RegisterUserServiceServer(s, &gRpcServer{})

		fmt.Println("┌─────────────────────────────────────────────┐")
		fmt.Println("│  🚀 Go gRPC Server (HTTP/2 + TLS)           │")
		fmt.Println("│  📡 grpcs://localhost:50052                 │")
		fmt.Println("└─────────────────────────────────────────────┘")
		if err := s.Serve(lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	// 2. Go Native JSON Server 구동
	go func() {
		mux := http.NewServeMux()
		mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "ok", "protocol": "HTTP/2 (TLS)", "framework": "Go Native"})
		})
		mux.HandleFunc("/api/users", nativeGetUsers)
		mux.HandleFunc("/api/user/", nativeGetUser)
		mux.HandleFunc("/api/users/search", nativeSearchUsers)
		mux.HandleFunc("/api/users/query", nativeQueryUsers)

		server := &http.Server{
			Addr:    ":3001",
			Handler: mux,
		}

		fmt.Println("┌─────────────────────────────────────────────┐")
		fmt.Println("│  🚀 Go Native HTTP/2 JSON Server (TLS)      │")
		fmt.Println("│  📡 https://localhost:3001                  │")
		fmt.Println("└─────────────────────────────────────────────┘")
		if err := server.ListenAndServeTLS(certFile, keyFile); err != nil {
			log.Fatalf("failed to run native server: %v", err)
		}
	}()

	// 3. Go Gin JSON Server 구동
	go func() {
		gin.SetMode(gin.ReleaseMode)
		r := gin.New()
		r.Use(gin.Recovery())

		r.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok", "protocol": "HTTP/2 (TLS)", "framework": "Go Gin"})
		})
		r.GET("/api/users", func(c *gin.Context) {
			c.JSON(200, gin.H{"users": users, "count": len(users)})
		})
		r.GET("/api/user/:id", func(c *gin.Context) {
			id, err := strconv.Atoi(c.Param("id"))
			if err != nil {
				c.JSON(400, gin.H{"error": "Invalid ID"})
				return
			}
			for _, u := range users {
				if u.ID == int32(id) {
					c.JSON(200, u)
					return
				}
			}
			c.JSON(404, gin.H{"error": "User not found"})
		})
		r.POST("/api/users/search", func(c *gin.Context) {
			var criteria SearchCriteria
			if err := c.ShouldBindJSON(&criteria); err != nil {
				c.JSON(400, gin.H{"error": "Invalid request body"})
				return
			}
			results := filterUsers(criteria)
			c.JSON(200, gin.H{"users": results, "count": len(results)})
		})

		// Gin에서 HTTP QUERY 메서드 커스텀 핸들러 설정
		r.Handle("QUERY", "/api/users/query", func(c *gin.Context) {
			var criteria SearchCriteria
			// QUERY 메서드는 body가 없거나 파싱 에러나도 정상 통과 처리 가능
			c.ShouldBindJSON(&criteria)
			results := filterUsers(criteria)
			c.JSON(200, gin.H{"users": results, "count": len(results)})
		})

		// Go의 표준 http.Server에 Gin Handler를 설정하여 TLS/HTTP2 구동
		server := &http.Server{
			Addr:    ":3004",
			Handler: r,
		}

		fmt.Println("┌─────────────────────────────────────────────┐")
		fmt.Println("│  🚀 Go Gin HTTP/2 JSON Server (TLS)         │")
		fmt.Println("│  📡 https://localhost:3004                  │")
		fmt.Println("└─────────────────────────────────────────────┘")
		if err := server.ListenAndServeTLS(certFile, keyFile); err != nil {
			log.Fatalf("failed to run gin server: %v", err)
		}
	}()

	// ─── 클라이언트가 신뢰할 수 있게 rootCA.pem 관련 세부 콘솔 로그 출력 (참고용) ───
	_ = rootCAFile

	// 프로세스 유지
	select {}
}
