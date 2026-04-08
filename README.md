# 눕지마요 🔔

> 식사 사진을 찍으면 AI가 소화 시간을 분석해주는 타이머 앱

## 기술 스택

- React 18 + Vite
- Tailwind CSS
- Groq API (llama-3.2-11b-vision-preview)
- PWA 지원

---

## 로컬 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 파일에 VITE_GROQ_API_KEY 입력

# 개발 서버 시작
npm run dev
```

---

## Vercel 배포

### 1. GitHub에 푸시

```bash
git init
git add .
git commit -m "init: 눕지마요 초기 커밋"
git remote add origin https://github.com/유저명/noopjimayo.git
git push -u origin main
```

### 2. Vercel 환경변수 설정

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**

| 변수명 | 값 |
|--------|-----|
| `VITE_GROQ_API_KEY` | Groq 콘솔에서 발급한 API 키 |

> ⚠️ `.env.local` 파일은 절대 GitHub에 올리지 마세요. `.gitignore`에 포함되어 있습니다.

### 3. Groq API 키 발급

[https://console.groq.com](https://console.groq.com) → API Keys → Create API Key

---

## 폴더 구조

```
noopjimayo/
├── public/
│   ├── favicon.svg
│   └── manifest.json      # PWA 설정
├── src/
│   ├── App.jsx            # 메인 컴포넌트
│   ├── main.jsx           # 엔트리포인트
│   └── index.css          # 글로벌 스타일
├── .env.example           # 환경변수 예시
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```
