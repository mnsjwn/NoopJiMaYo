import React, { useState, useEffect, useRef } from 'react';
import { 
  BellRing, 
  ChevronRight, 
  Upload, 
  Home, 
  AlertTriangle, 
  X, 
  ShieldCheck
} from 'lucide-react';

const ANALYZING_STEPS = [
  "사진을 인식하고 있습니다...",
  "음식 종류를 파악하고 있습니다...",
  "자극 요소를 분석하고 있습니다...",
  "소화 시간을 계산하고 있습니다...",
];

const App = () => {
  const [step, setStep] = useState('HOME');
  const [hasCondition, setHasCondition] = useState(false); 
  const [image, setImage] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  
  const [analysisResult, setAnalysisResult] = useState({
    mealName: "",
    detectedItems: [],
    stimulatingFactors: [],
    calculatedTime: 0,
    reason: ""
  });

  // 분석중 화면용 상태
  const [analyzingStepIndex, setAnalyzingStepIndex] = useState(0);
  const [revealedFactors, setRevealedFactors] = useState([]);
  const [pendingResult, setPendingResult] = useState(null);

  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const analyzingTimerRef = useRef(null);

  const getApiKey = () => {
    try {
      const viteEnv = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
      const env = (typeof process !== 'undefined' && process.env) || {};
      const envKey = viteEnv.VITE_GROQ_API_KEY || env.VITE_GROQ_API_KEY;
      if (envKey) return envKey;
    } catch (e) {}
    return localStorage.getItem('TEMP_GROQ_KEY') || "";
  };

  const GROQ_API_KEY = getApiKey();

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Jua&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    const savedEndTime = localStorage.getItem('noopjimayo_endtime');
    if (savedEndTime) {
      const remaining = Math.floor((parseInt(savedEndTime) - Date.now()) / 1000);
      if (remaining > 0) {
        setTimeLeft(remaining);
        setIsActive(true);
        setStep('RESULT');
      }
    }
  }, []);

  // 분석중 화면 — 단계 메시지 순환 + 결과 오면 자극 요소 하나씩 공개
  useEffect(() => {
    if (step !== 'ANALYZING') {
      clearInterval(analyzingTimerRef.current);
      return;
    }

    setAnalyzingStepIndex(0);
    setRevealedFactors([]);

    let stepIdx = 0;
    analyzingTimerRef.current = setInterval(() => {
      stepIdx = (stepIdx + 1) % ANALYZING_STEPS.length;
      setAnalyzingStepIndex(stepIdx);
    }, 1800);

    return () => clearInterval(analyzingTimerRef.current);
  }, [step]);

  // API 결과 도착 후 자극 요소 하나씩 공개 → 다 공개되면 RESULT로 이동
  useEffect(() => {
    if (!pendingResult) return;

    const factors = pendingResult.stimulatingFactors || [];
    if (factors.length === 0) {
      // 자극 요소 없으면 잠깐 대기 후 바로 이동
      const t = setTimeout(() => {
        applyResultAndMove(pendingResult);
        setPendingResult(null);
      }, 1200);
      return () => clearTimeout(t);
    }

    // 자극 요소 하나씩 800ms 간격으로 공개
    let i = 0;
    const reveal = setInterval(() => {
      i++;
      setRevealedFactors(factors.slice(0, i));
      if (i >= factors.length) {
        clearInterval(reveal);
        // 마지막 요소 공개 후 1.5초 더 보여주고 이동
        setTimeout(() => {
          applyResultAndMove(pendingResult);
          setPendingResult(null);
        }, 1500);
      }
    }, 800);

    return () => clearInterval(reveal);
  }, [pendingResult]);

  const applyResultAndMove = (aiData) => {
    let baseMinutes = hasCondition ? 150 : 60;
    let aiMinutes = aiData.baseTimeMinutes || baseMinutes;
    
    // 자극 요소 개수마다 10분 추가 (AI가 늘리는 느낌)
    const factorCount = (aiData.stimulatingFactors || []).length;
    const bonusMinutes = factorCount * 10;
    
    let finalMinutes = Math.max(aiMinutes, baseMinutes) + bonusMinutes;
    let finalSeconds = finalMinutes * 60;

    setAnalysisResult({ ...aiData, calculatedTime: finalSeconds, bonusMinutes });
    setTimeLeft(finalSeconds);
    clearInterval(analyzingTimerRef.current);
    setStep('RESULT');
    startTimer(finalSeconds);
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        const savedEndTime = localStorage.getItem('noopjimayo_endtime');
        if (savedEndTime) {
          const remaining = Math.floor((parseInt(savedEndTime) - Date.now()) / 1000);
          if (remaining <= 0) {
            finishTimer();
          } else {
            setTimeLeft(remaining);
          }
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  const startTimer = (seconds) => {
    const endTime = Date.now() + seconds * 1000;
    localStorage.setItem('noopjimayo_endtime', endTime.toString());
    setIsActive(true);
  };

  const finishTimer = () => {
    setIsActive(false);
    setTimeLeft(0);
    clearInterval(timerRef.current);
    localStorage.removeItem('noopjimayo_endtime');
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play failed:", e));
    }
    sendNotification();
    setStep('FINISHED');
  };

  const sendNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("눕지마요 알림", {
        body: "소화 시간이 끝났습니다! 이제 누워도 됩니다. 😊"
      });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const needsConversion = !supportedTypes.includes(file.type);

    const convertToJpeg = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = src;
      });
    };

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalDataUrl = reader.result;
      setImage(originalDataUrl);
      if (needsConversion) {
        const jpegDataUrl = await convertToJpeg(originalDataUrl);
        setBase64Image({ data: jpegDataUrl.split(',')[1], mimeType: 'image/jpeg' });
      } else {
        setBase64Image({ data: originalDataUrl.split(',')[1], mimeType: file.type });
      }
    };
    reader.readAsDataURL(file);
  };

  const startAnalysis = async () => {
    if (!base64Image) return;

    if (!GROQ_API_KEY) {
      const manualKey = prompt("API 키가 설정되지 않았습니다. 여기에 입력하세요:");
      if (manualKey) {
        localStorage.setItem('TEMP_GROQ_KEY', manualKey);
        window.location.reload();
      }
      return;
    }

    setStep('ANALYZING');

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `이 식사 사진을 분석해줘. 반드시 아래 형식의 JSON만 반환해. 다른 말은 절대 하지 마. 마크다운 코드블록도 쓰지 마.
{
  "mealName": "음식 이름",
  "detectedItems": ["재료1", "재료2"],
  "stimulatingFactors": ["자극 요소1", "자극 요소2"],
  "baseTimeMinutes": 90,
  "reason": "이유 설명"
}

[자극 요소 판단 기준 - 매우 엄격하게 적용]
stimulatingFactors는 아래 항목에 해당하는 것만 포함해. 일반 재료(쌀, 채소, 고기 등)는 절대 포함하지 마.
- 고춧가루, 청양고추, 매운 소스 등 매운 성분
- 커피, 에너지 드링크 등 카페인 음료
- 술, 맥주, 와인 등 알코올
- 초콜릿, 민트
- 튀김류 (기름에 튀긴 음식)
- 탄산음료
- 지방 함량이 매우 높은 가공식품 (소시지, 베이컨 등)
위 항목에 해당하지 않으면 stimulatingFactors는 반드시 빈 배열 []로 반환해.
reason은 stimulatingFactors 내용과 반드시 일치해야 해. 자극 요소가 없으면 reason에도 없다고 써.
위염/역류성 식도염 환자라면 baseTimeMinutes는 최소 150, 일반인은 최소 60.`
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${base64Image.mimeType};base64,${base64Image.data}` }
                }
              ]
            }
          ],
          max_completion_tokens: 1024,
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errBody = await response.json();
        console.error("Groq API Error:", errBody);
        throw new Error(errBody?.error?.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const raw = result.choices[0].message.content;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON 파싱 실패: " + raw);
      const aiData = JSON.parse(jsonMatch[0]);

      // 바로 이동하지 않고 pendingResult에 저장 → useEffect가 자극 요소 공개 후 이동
      setPendingResult(aiData);

    } catch (error) {
      console.error("분석 오류:", error);
      const fallbackSeconds = hasCondition ? 9000 : 3600;
      setAnalysisResult({
        mealName: "식사 분석 완료",
        stimulatingFactors: [],
        calculatedTime: fallbackSeconds,
        bonusMinutes: 0,
        reason: `오류: ${error.message} — 안전한 소화를 위해 기본 대기 시간을 설정합니다.`
      });
      setTimeLeft(fallbackSeconds);
      setStep('RESULT');
      startTimer(fallbackSeconds);
    }
  };

  const handleTimerClick = () => {
    if (!isActive) return;
    const newCount = adminClickCount + 1;
    if (newCount >= 10) {
      setShowAdminModal(true);
      setAdminClickCount(0);
    } else {
      setAdminClickCount(newCount);
    }
  };

  const checkAdminPassword = () => {
    if (adminPassword === '1234') {
      setShowAdminModal(false);
      setAdminPassword('');
      finishTimer();
    } else {
      setAdminPassword('');
    }
  };

  const formatTime = (seconds) => {
    if (seconds <= 0) return "00 : 00 : 00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
  };

  const resetAll = () => {
    setStep('HOME');
    setIsActive(false);
    setImage(null);
    setBase64Image(null);
    setPendingResult(null);
    setRevealedFactors([]);
    localStorage.removeItem('noopjimayo_endtime');
    if (timerRef.current) clearInterval(timerRef.current);
    if (analyzingTimerRef.current) clearInterval(analyzingTimerRef.current);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-[#2D3436] font-['Jua'] flex justify-center antialiased">
      <div className="w-full max-w-md min-h-screen bg-white shadow-[0_0_80px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden relative">
        
        {step !== 'HOME' && (
          <div className="bg-blue-600 p-6 flex items-center justify-between shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <BellRing size={24} className="text-white" />
              </div>
              <h1 className="text-white text-2xl tracking-tight">눕지마요</h1>
            </div>
            <button onClick={resetAll} className="bg-white/20 p-2 rounded-xl text-white hover:bg-white/30 transition-colors">
              <Home size={20} />
            </button>
          </div>
        )}

        {step === 'HOME' && (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-64 h-64 mb-10 relative">
                <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-30"></div>
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="bg-blue-600 p-12 rounded-[3rem] shadow-2xl">
                    <BellRing size={100} className="text-white" strokeWidth={2.5} />
                  </div>
                </div>
              </div>
              <h1 className="text-6xl text-slate-900 mb-4 tracking-tighter">눕지마요</h1>
              <p className="text-slate-400 text-xl font-bold italic">"소화 안심 타이머"</p>
            </div>
            <button 
              onClick={() => setStep('UPLOAD')}
              className="w-full bg-blue-600 text-white text-2xl py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95"
            >
              앱 시작하기 <ChevronRight size={28} strokeWidth={3} />
            </button>
          </div>
        )}

        {step === 'UPLOAD' && (
          <div className="flex-1 p-8 flex flex-col bg-white">
            <h2 className="text-3xl text-slate-900 tracking-tight mb-8 font-black">상태 설정 및 사진 업로드</h2>
            
            <div className="flex gap-2 mb-8">
              <button 
                onClick={() => setHasCondition(false)}
                className={`flex-1 py-4 rounded-2xl text-lg transition-all border-2 ${!hasCondition ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-white border-slate-100 text-slate-400'}`}
              >
                일반 모드
              </button>
              <button 
                onClick={() => setHasCondition(true)}
                className={`flex-1 py-4 rounded-2xl text-lg transition-all border-2 ${hasCondition ? 'bg-red-50 border-red-500 text-red-500' : 'bg-white border-slate-100 text-slate-400'}`}
              >
                위염 및 역류성 식도염
              </button>
            </div>

            <label className="flex-1 border-[4px] border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all relative overflow-hidden mb-8 group">
              {image ? (
                <img src={image} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={36} className="text-slate-400" strokeWidth={2.5} />
                  </div>
                  <p className="text-slate-400 text-xl font-bold">식사 사진 올리기</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            <button 
              disabled={!image}
              onClick={startAnalysis}
              className={`w-full py-6 rounded-[2rem] text-2xl transition-all shadow-xl ${image ? 'bg-blue-600 text-white shadow-blue-100 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
            >
              분석 및 타이머 시작
            </button>
          </div>
        )}

        {step === 'ANALYZING' && (
          <div className="flex-1 flex flex-col p-8 bg-white">
            {/* 상단 스피너 + 단계 메시지 */}
            <div className="flex flex-col items-center pt-10 pb-8">
              <div className="w-36 h-36 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <BellRing size={60} className="text-blue-500" />
              </div>
              <div className="w-10 h-10 border-[5px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-5"></div>
              <h2 className="text-2xl text-slate-900 font-black tracking-wide text-center transition-all duration-500">
                {ANALYZING_STEPS[analyzingStepIndex]}
              </h2>
            </div>

            {/* 자극 요소 등장 영역 */}
            <div className="flex-1 bg-slate-50 rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-amber-500" />
                <p className="text-slate-500 text-base font-bold">발견된 자극 요소</p>
              </div>

              {revealedFactors.length === 0 ? (
                <p className="text-slate-300 text-base">분석 중...</p>
              ) : (
                <ul className="space-y-3">
                  {revealedFactors.map((factor, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 animate-[fadeIn_0.4s_ease]"
                      style={{ animationFillMode: 'both' }}
                    >
                      <span className="w-3 h-3 rounded-full bg-red-500 shrink-0 shadow-sm shadow-red-300"></span>
                      <span className="text-slate-700 text-lg font-bold">{factor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-white">
            <div className="px-8 pt-8 pb-4">
              <h2 className="text-3xl text-slate-900 font-black tracking-tight">소화 안심 타이머</h2>
            </div>
            <div className="px-8 flex-1">
              <div className="bg-slate-50 rounded-[2.5rem] p-8 mb-6 shadow-sm">
                <div className="flex justify-between items-start mb-5">
                  <h3 className="text-2xl text-slate-900 font-black leading-tight">{analysisResult.mealName || "분석 완료"}</h3>
                  <span className={`px-4 py-1 rounded-full text-sm font-bold shrink-0 ml-2 ${hasCondition ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {hasCondition ? '질환 모드' : '일반 모드'}
                  </span>
                </div>

                {/* 자극 요소 빨간점 리스트 */}
                {analysisResult.stimulatingFactors?.length > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={16} className="text-amber-500" />
                      <p className="text-slate-500 text-sm font-bold">자극 요소</p>
                    </div>
                    <ul className="space-y-2">
                      {analysisResult.stimulatingFactors.map((factor, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-red-500 shrink-0 shadow-sm shadow-red-300"></span>
                          <span className="text-slate-700 text-base font-bold">{factor}</span>
                        </li>
                      ))}
                    </ul>
                    {analysisResult.bonusMinutes > 0 && (
                      <div className="mt-4 px-4 py-2 bg-red-50 rounded-2xl border border-red-100">
                        <p className="text-red-500 text-sm font-bold">
                          ⚠️ 자극 요소로 인해 소화 시간 +{analysisResult.bonusMinutes}분 추가됐어요
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-3 h-3 rounded-full bg-green-400 shrink-0"></span>
                    <p className="text-slate-500 text-base font-bold">자극 요소 없음</p>
                  </div>
                )}

                <div className="p-4 bg-white rounded-2xl border border-slate-100 text-slate-500 text-sm leading-relaxed">
                  {analysisResult.reason}
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center py-4">
                <div 
                  onClick={handleTimerClick}
                  className="text-6xl text-slate-900 mb-8 tracking-tighter font-black cursor-pointer active:scale-95 transition-transform"
                >
                  {formatTime(timeLeft)}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 mb-8 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / (analysisResult.calculatedTime || 3600)) * 100}%` }}
                  ></div>
                </div>
                <button 
                  onClick={isActive ? null : () => startTimer(timeLeft)}
                  className={`w-full text-white text-2xl py-6 rounded-[2rem] shadow-xl flex items-center justify-center gap-4 transition-all ${isActive ? 'bg-slate-200 text-slate-400 cursor-default' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-100'}`}
                >
                  {isActive ? "소화 중..." : "타이머 시작"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'FINISHED' && (
          <div className="flex-1 flex flex-col p-10 bg-white text-center">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-56 h-56 bg-green-50 rounded-full flex items-center justify-center mb-10 shadow-inner">
                <BellRing size={100} className="text-green-500" />
              </div>
              <h2 className="text-5xl text-slate-900 mb-6 font-black tracking-tight">이제 누워도 안심!</h2>
              <p className="text-slate-500 text-2xl font-bold leading-relaxed">
                충분한 소화 시간이 지났습니다.<br/>편안하게 휴식을 취하세요. 😊
              </p>
            </div>
            <button 
              onClick={resetAll}
              className="w-full bg-blue-600 text-white py-6 rounded-[2rem] text-2xl shadow-2xl hover:bg-blue-700 active:scale-95 transition-all mt-auto shadow-blue-100"
            >
              처음으로 돌아가기
            </button>
          </div>
        )}

        {showAdminModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 font-['Jua']">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <span className="font-black text-slate-900 flex items-center gap-2"><ShieldCheck size={20} /> 관리자 종료</span>
                <button onClick={() => setShowAdminModal(false)}><X size={24} /></button>
              </div>
              <input 
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 mb-6 text-center text-2xl tracking-widest focus:border-blue-500 outline-none font-black"
              />
              <button onClick={checkAdminPassword} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg active:scale-95">종료 승인</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
