export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const token = await getAccessToken(serviceAccount);

    const { penaltyValues, rewardValues } = req.body;

    const results = {};

    // 벌점 저장
    if (penaltyValues && penaltyValues.length > 0) {
      results.penalty = await appendToSheet(SPREADSHEET_ID, "벌점기록", penaltyValues, token);
    }

    // 상점 저장
    if (rewardValues && rewardValues.length > 0) {
      results.reward = await appendToSheet(SPREADSHEET_ID, "상점기록", rewardValues, token);
    }

    return res.status(200).json({ success: true, results });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// =============================================
// 시트에 데이터 추가
// =============================================
async function appendToSheet(spreadsheetId, sheetName, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`[${sheetName}] ${err.error?.message || "API 오류"}`);
  }

  const result = await response.json();
  return result.updates?.updatedRange;
}

// =============================================
// Service Account → OAuth2 Access Token 발급
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

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature  = await crypto.subtle.sign(
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
  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || "액세스 토큰 발급 실패");
  }

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
