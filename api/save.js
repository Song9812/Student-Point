export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SHEET_NAME = "벌점기록";

  if (!SPREADSHEET_ID || !API_KEY) {
    return res.status(500).json({ error: "서버 환경변수가 설정되지 않았습니다." });
  }

  try {
    const { values } = req.body;

    if (!values || !Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: "저장할 데이터가 없습니다." });
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Google Sheets API 오류");
    }

    const result = await response.json();
    return res.status(200).json({ success: true, updatedRange: result.updates?.updatedRange });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
