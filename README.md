# 벌점 입력 앱 — Vercel 배포 가이드

## 프로젝트 구조

```
penalty-app/
├── public/
│   └── index.html        ← 프론트엔드
├── api/
│   └── save.js           ← Serverless Function (API Key 보호)
├── vercel.json
├── package.json
└── README.md
```

---

## 배포 순서

### 1. GitHub 저장소 생성 후 푸시

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_ID/penalty-app.git
git push -u origin main
```

### 2. Vercel 연결

1. [vercel.com](https://vercel.com) → **Add New Project**
2. GitHub 저장소 선택
3. **Environment Variables** 탭에서 아래 두 값 입력:

| 변수명 | 값 |
|--------|-----|
| `SPREADSHEET_ID` | `1xrS6VXDO0sxOWDkBsrHJFsVGvXm_44CrkHikzUg4qIQ` |
| `GOOGLE_API_KEY` | `AIzaSyD3Sy4xmbGcM1eTT-4BDB8UqTBUdR9P-HM` |

4. **Deploy** 클릭

---

## 주의사항

- Google Sheets API Key는 **쓰기 권한이 필요**합니다.
  - Google Cloud Console → API & Services → 사용자 인증 정보에서 키 확인
  - Sheets API가 활성화되어 있어야 합니다.
- 스프레드시트 공유 설정: 해당 API Key가 쓸 수 있도록 **편집자** 권한 필요  
  (또는 스프레드시트를 "링크가 있는 모든 사용자 — 편집자"로 설정)
- 시트 이름이 `벌점기록` 인지 확인하세요.
