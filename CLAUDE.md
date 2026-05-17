# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 작업 규칙

**코드 수정, 파일 생성/삭제, 명령어 실행 등 모든 작업은 반드시 사용자에게 먼저 확인을 받고 진행한다.** 읽기/검색은 자유롭게 하되, 변경이 수반되는 작업은 무조건 사전 승인 필요.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview built output

Environment: copy `.env.example` to `.env.local` and set `VITE_GROQ_API_KEY` (Groq console). Without it the app falls back to a `localStorage` key (`TEMP_GROQ_KEY`) prompted at analysis time. Deployed on Vercel; env var must be configured there as `VITE_GROQ_API_KEY`.

No test/lint setup exists.

## Architecture

Single-page React 18 + Vite + Tailwind PWA. Effectively the entire app lives in [src/App.jsx](src/App.jsx) — one component, ~700 lines, driven by a `step` state machine: `HOME → UPLOAD → ANALYZING → RESULT → FINISHED`.

Key cross-cutting concerns to keep in mind when editing:

- **Timer persistence via `localStorage`**: the source of truth for the running timer is `noopjimayo_endtime` (absolute end timestamp). The `setInterval` re-reads it every tick so the timer survives reloads and background tabs. Don't replace this with an in-memory countdown.
- **Two-stage analyze flow**: `startAnalysis` calls the Groq vision API (`meta-llama/llama-4-scout-17b-16e-instruct` via `api.groq.com/openai/v1/chat/completions`), stores the response in `pendingResult`, and a `useEffect` reveals `stimulatingFactors` one-by-one before calling `applyResultAndMove`. Final timer = `max(AI baseTimeMinutes, baseline) + (#factors × 10min)` where baseline is 60min (general) or 150min (질환 모드 — 위염/역류성 식도염).
- **iOS audio**: alarm uses Web Audio API oscillators (`playAlarm`), not the HTMLAudio element. The `AudioContext` must be unlocked by a user gesture — this happens on the HOME "앱 시작하기" button (silent oscillator + `resume()`). Don't move audio init out of that handler or iOS will go silent.
- **Notification permission** is also requested on the HOME start button (user gesture required by browsers).
- **Image handling**: non-JPEG/PNG/WebP/GIF uploads (e.g. HEIC) are converted to JPEG via a canvas before being base64-encoded for the Groq request.
- **Hidden admin modal**: 10 taps on the running timer opens a password modal. `1234` = force-finish, `0000` = reset to 60s, `1111` = reset to 10s (test). These are intentional, not dead code.

## Groq prompt

The system prompt in `startAnalysis` is tuned for Korean food recognition and has strict rules for `stimulatingFactors` (only spicy/caffeine/alcohol/chocolate/mint/fried/carbonated/high-fat processed). If you change the prompt, keep the JSON-only output contract and the strict factor list — the UI relies on both.
