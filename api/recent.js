export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const token = await getAccessToken(serviceAccount);

    // 벌점기록 + 상점기록 병렬 조회
    const [penaltyRows, rewardRows] = await Promise.all([
      fetchSheet(SPREADSHEET_ID, "벌점기록", token),
      fetchSheet(SPREADSHEET_ID, "상점기록", token),
    ]);

    // 각각 타입 태그 추가 후 합치기
    const all = [
      ...penaltyRows.map(r => ({ ...r, type: "벌점" })),
      ...rewardRows.map(r =>  ({ ...r, type: "상점" })),
    ];

    // 날짜 기준 내림차순 정렬 후 상위 5개
    all.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    const recent = all.slice(0, 5);

    return res.status(200).json({ recent });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// =============================================
// 시트 데이터 읽기 (A:D 범위, 2행부터)
// =============================================
async function fetchSheet(spreadsheetId, sheetName, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:D`;

  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`[${sheetName}] ${err.error?.message || "읽기 오류"}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .filter(r => r[0]) // 날짜 없는 빈 행 제외
    .map(r => ({
      datetime:   r[0] || "",
      studentNum: r[1] || "",
      item:       r[2] || "",
      score:      r[3] || "",
    }));
}

// =============================================
// Service Account → OAuth2 Access Token
// =============================================
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = obj =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedJWT = `${encode(header)}.${encode(payload)}`;
  const privateKey  = await importPrivateKey(serviceAccount.private_key);
  const signature   = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(unsignedJWT)
  );

  const signedJWT = `${unsignedJWT}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJWT,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(tokenData.error_description || "토큰 발급 실패");
  return tokenData.access_token;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
