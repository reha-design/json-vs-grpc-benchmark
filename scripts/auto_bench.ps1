# 모든 벤치마크를 순차적으로, 한 번에 한 서버만 기동하여 측정하는 스크립트

Write-Host "Cleaning up existing processes..."
Get-Process bun, node, server, java, python -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

$resultsFile = "bench_results_single.log"
Clear-Content $resultsFile -ErrorAction SilentlyContinue

function RunBench {
    param($title, $startCmd, $dir)
    Write-Host "========================================="
    Write-Host " Benchmarking: $title"
    Write-Host "========================================="
    
    Add-Content $resultsFile "========================================="
    Add-Content $resultsFile " Benchmarking: $title"
    Add-Content $resultsFile "========================================="

    # 서버 기동
    Write-Host "Starting server: $startCmd in $dir"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d $dir && $startCmd" -PassThru -WindowStyle Hidden
    
    Write-Host "Waiting for server to warm up (10s)..."
    Start-Sleep -Seconds 10
    
    Write-Host "Running benchmark..."
    # 벤치마크 실행, 결과를 파일에 추가
    bun run bench/benchmark.ts >> $resultsFile 2>&1
    
    # 서버 킬
    Write-Host "Stopping server..."
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    
    # 확실한 정리를 위해 프로세스 이름 기반으로 킬
    Get-Process bun, node, server, java, python -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 3
}

$baseDir = "d:\develop\SIDE_PROJECT"

# 순차적 실행
RunBench -title "Bun JSON" -startCmd "bun run src/json-server.ts" -dir $baseDir
RunBench -title "Bun gRPC" -startCmd "bun run src/grpc-server.ts" -dir $baseDir
RunBench -title "Node.js Servers" -startCmd "bun run src/node-servers.ts" -dir $baseDir
RunBench -title "Go Server" -startCmd "go-app\server.exe" -dir $baseDir
RunBench -title "Python FastAPI" -startCmd "uv run app.py" -dir "$baseDir\python-app"
RunBench -title "Spring Boot Kotlin" -startCmd "gradlew.bat bootRun" -dir "$baseDir\kotlin-app"

Write-Host "All benchmarks completed. Check bench_results_single.log"
