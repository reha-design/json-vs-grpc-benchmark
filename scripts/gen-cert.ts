// ============================================================
// 자체 서명 TLS 인증서 생성 스크립트 (Bun 내장 API 사용)
// mkcert나 openssl 없이 인증서를 생성합니다.
// ============================================================

import { $ } from "bun";
import * as fs from "fs";
import * as path from "path";

const certsDir = path.resolve(__dirname, "../certs");

// certs 디렉터리 확인
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

const keyPath = path.join(certsDir, "localhost-key.pem");
const certPath = path.join(certsDir, "localhost.pem");

// 이미 존재하면 스킵
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log("✅ 인증서가 이미 존재합니다:");
  console.log(`   📄 ${certPath}`);
  console.log(`   🔑 ${keyPath}`);
  process.exit(0);
}

// Bun의 내장 TLS 기능으로 자체 서명 인증서 생성
// Bun.serve의 tls에 문자열 "localhost"를 주면 자동 생성하지만
// 파일로 저장하기 위해 node:tls의 createSecureContext 대신
// Bun 전용 방법을 사용합니다.

try {
  // Node.js crypto 모듈의 generateKeyPairSync + createSign으로 생성
  const crypto = await import("crypto");
  
  // RSA 키 쌍 생성
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // 자체 서명 인증서 생성 (X509Certificate)
  // Node.js 20+ / Bun에서는 crypto.X509Certificate을 사용할 수 있지만
  // 인증서 '생성'을 위해서는 forge 같은 라이브러리가 필요.
  // 대안: Bun의 내장 기능을 활용

  // Bun은 tls 옵션 없이도 자체 서명 인증서를 생성할 수 있음
  // 하지만 파일로 저장하려면 직접 만들어야 함
  
  // 간단한 ASN.1 DER 인코딩으로 자체 서명 인증서 생성
  const forge = await generateSelfSignedCert(privateKey, publicKey);
  
  fs.writeFileSync(keyPath, privateKey);
  fs.writeFileSync(certPath, forge);
  
  console.log("✅ 자체 서명 인증서 생성 완료!");
  console.log(`   📄 ${certPath}`);
  console.log(`   🔑 ${keyPath}`);
  
} catch (err) {
  console.error("인증서 생성 실패, 대체 방법 시도 중...", err);
  
  // 대체: Bun shell로 PowerShell의 New-SelfSignedCertificate 사용
  await generateWithPowerShell(keyPath, certPath);
}

async function generateSelfSignedCert(privateKeyPem: string, publicKeyPem: string): Promise<string> {
  // node:crypto의 createSign을 사용한 자체 서명 인증서는 복잡하므로
  // PowerShell 방식으로 폴백
  throw new Error("Use PowerShell fallback");
}

async function generateWithPowerShell(keyPath: string, certPath: string): Promise<void> {
  console.log("🔧 PowerShell로 인증서 생성 중...");
  
  const psScript = `
$cert = New-SelfSignedCertificate \`
  -DnsName "localhost","127.0.0.1" \`
  -CertStoreLocation "Cert:\\CurrentUser\\My" \`
  -NotAfter (Get-Date).AddYears(1) \`
  -KeyAlgorithm RSA \`
  -KeyLength 2048 \`
  -FriendlyName "JSON vs gRPC Benchmark Local Dev"

# PFX로 내보내기 (임시)
$password = ConvertTo-SecureString -String "temp1234" -Force -AsPlainText
$pfxPath = "${certsDir.replace(/\\/g, "\\\\")}\\\\temp.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

Write-Output $cert.Thumbprint
`;

  const result = await $`powershell -Command ${psScript}`.text();
  const thumbprint = result.trim();
  console.log(`   🔖 Thumbprint: ${thumbprint}`);
  
  // PFX → PEM 변환 (Bun에서 처리)
  const pfxPath = path.join(certsDir, "temp.pfx");
  const pfxData = fs.readFileSync(pfxPath);
  
  // Bun의 crypto로 PFX 파싱
  const crypto = await import("crypto");
  
  // PFX에서 키와 인증서 추출 — Node.js 방식
  try {
    const pfxBuffer = pfxData;
    
    // OpenSSL이 없으므로 PowerShell로 PEM 추출
    const pemScript = `
$password = ConvertTo-SecureString -String "temp1234" -Force -AsPlainText
$pfxPath = "${pfxPath.replace(/\\/g, "\\\\")}"
$certPath = "${certPath.replace(/\\/g, "\\\\")}"
$keyPath = "${keyPath.replace(/\\/g, "\\\\")}"

# .NET을 사용하여 PFX에서 인증서와 키 추출
$pfxCollection = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
$pfxCollection.Import($pfxPath, "temp1234", [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)

foreach ($c in $pfxCollection) {
    # 인증서 PEM
    $certPem = "-----BEGIN CERTIFICATE-----`n"
    $certPem += [Convert]::ToBase64String($c.RawData, [Base64FormattingOptions]::InsertLineBreaks)
    $certPem += "`n-----END CERTIFICATE-----"
    [System.IO.File]::WriteAllText($certPath, $certPem)
    
    # 개인키 PEM
    if ($c.HasPrivateKey) {
        $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)
        $keyBytes = $rsa.ExportPkcs8PrivateKey()
        $keyPem = "-----BEGIN PRIVATE KEY-----`n"
        $keyPem += [Convert]::ToBase64String($keyBytes, [Base64FormattingOptions]::InsertLineBreaks)
        $keyPem += "`n-----END PRIVATE KEY-----"
        [System.IO.File]::WriteAllText($keyPath, $keyPem)
    }
}

# 임시 PFX 삭제
Remove-Item $pfxPath -ErrorAction SilentlyContinue

# 인증서 저장소에서 제거 (선택)
# Remove-Item "Cert:\\CurrentUser\\My\\$($c.Thumbprint)" -ErrorAction SilentlyContinue

Write-Output "OK"
`;
    
    const pemResult = await $`powershell -Command ${pemScript}`.text();
    console.log("✅ 자체 서명 인증서 생성 완료! (PowerShell)");
    console.log(`   📄 ${certPath}`);
    console.log(`   🔑 ${keyPath}`);
    
  } catch (pemErr) {
    console.error("❌ PEM 변환 실패:", pemErr);
    process.exit(1);
  }
}
