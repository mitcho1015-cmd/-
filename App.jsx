import { useState, useRef, useEffect } from "react";

const LEVELS = [
  { id: "beginner", label: "Beginner", emoji: "🌱", color: "#4ade80" },
  { id: "intermediate", label: "Intermediate", emoji: "🌿", color: "#22d3ee" },
  { id: "advanced", label: "Advanced", emoji: "🌳", color: "#a78bfa" },
];

const TOPICS = [
  { id: "daily", label: "Daily Life", emoji: "☀️" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "food", label: "Food & Dining", emoji: "🍜" },
  { id: "culture", label: "Culture", emoji: "🎭" },
  { id: "free", label: "Free Talk", emoji: "💬" },
];

function PulseRing({ color, active }) {
  return (
    <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${color}`, opacity: active ? 0.6 : 0, animation: active ? "pulse-ring 1.2s ease-out infinite" : "none" }} />
  );
}

const STEPS = [
  { emoji: "🎙️", title: "ボタンを押して話す", desc: "大きなマイクボタンを押している間、英語で話してください。離すと送信されます。" },
  { emoji: "🤖", title: "AIが英語で返事", desc: "AIが自動で声に出して返事します。🔊アイコンのときは話し終わるまで待って！" },
  { emoji: "🔁", title: "これを繰り返す", desc: "またボタンを押して話す。まるで電話みたいに会話できます！" },
  { emoji: "📊", title: "最後に採点", desc: "会話が終わったら「採点」ボタンで日本語フィードバックがもらえます。" },
];

function Tutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'Georgia', serif", color: "#e2e8f0" }}>
      <style>{`* { box-sizing: border-box; } @keyframes fadeup { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }`}</style>
      <div key={step} style={{ textAlign: "center", animation: "fadeup 0.3s ease", maxWidth: 340 }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>{s.emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f8fafc", marginBottom: 14 }}>{s.title}</div>
        <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.8 }}>{s.desc}</div>
      </div>

      {/* dots */}
      <div style={{ display: "flex", gap: 8, margin: "40px 0 32px" }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? "#4ade80" : "#1e293b", transition: "all 0.3s" }} />
        ))}
      </div>

      <button
        onClick={() => isLast ? onDone() : setStep(step + 1)}
        style={{ width: "100%", maxWidth: 300, padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #4ade80, #4ade8088)", color: "#0a0f1e", fontSize: 16, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
      >
        {isLast ? "さっそく始める →" : "次へ"}
      </button>
      {step > 0 && (
        <button onClick={() => setStep(step - 1)} style={{ marginTop: 12, background: "none", border: "none", color: "#475569", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>← 戻る</button>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("tutorial");
  const [level, setLevel] = useState("beginner");
  const [topic, setTopic] = useState("daily");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState("");
  const [lastAI, setLastAI] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const messagesRef = useRef([]);

  const selectedLevel = LEVELS.find((l) => l.id === level);
  const selectedTopic = TOPICS.find((t) => t.id === topic);
  const accent = selectedLevel?.color || "#4ade80";

  const systemPrompt = `You are a friendly English conversation tutor. The student's level is ${level} and the topic is ${selectedTopic?.label}.
Rules:
- Speak naturally in English at the ${level} level
- Keep replies SHORT: 1-3 sentences only. This is voice conversation.
- If the student makes a grammar mistake, gently correct it naturally within your reply
- Always ask one follow-up question to keep the conversation going
- Be warm and encouraging`;

  function speak(text, onEnd) {
    const synth = synthRef.current;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = level === "beginner" ? 0.85 : level === "intermediate" ? 0.95 : 1.05;
    utter.pitch = 1.05;
    // prefer a good English voice
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.lang === "en-US" && v.name.includes("Samantha"))
      || voices.find(v => v.lang === "en-US" && !v.name.includes("Google"))
      || voices.find(v => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;
    utter.onend = () => onEnd && onEnd();
    synth.speak(utter);
  }

  async function sendToAI(userText, currentMessages) {
    setStatus("thinking");
    const newMessages = [...currentMessages, { role: "user", content: userText }];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: systemPrompt,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const aiText = data.content?.find((b) => b.type === "text")?.text || "Sorry, could you repeat that?";
      const withAI = [...newMessages, { role: "assistant", content: aiText }];
      messagesRef.current = withAI;
      setMessages(withAI);
      setLastAI(aiText);
      setStatus("speaking");
      speak(aiText, () => setStatus("idle"));
    } catch {
      setStatus("idle");
      setError("接続エラー。もう一度お試しください。");
    }
  }

  function startListening() {
    if (status !== "idle") return;
    setError("");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("このブラウザは音声認識に対応していません。Chromeをお試しください。");
      return;
    }
    synthRef.current.cancel();
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = () => setStatus("listening");
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join("");
      setTranscript(t);
    };
    rec.onend = () => {
      const finalText = transcript || "";
      setTranscript("");
      if (finalText.trim()) {
        sendToAI(finalText.trim(), messagesRef.current);
      } else {
        setStatus("idle");
      }
    };
    rec.onerror = (e) => {
      setStatus("idle");
      if (e.error !== "no-speech") setError("マイクにアクセスできません。許可を確認してください。");
    };
    recognitionRef.current = rec;
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  async function startChat() {
    setScreen("chat");
    setMessages([]);
    messagesRef.current = [];
    setLastAI("");
    setStatus("thinking");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: "user", content: `Start the conversation about ${selectedTopic?.label}. Give a warm greeting and ask ONE simple opening question. Keep it to 2 sentences max.` }],
        }),
      });
      const data = await res.json();
      const aiText = data.content?.find((b) => b.type === "text")?.text || "Hi! Let's practice English. How are you today?";
      const initial = [{ role: "assistant", content: aiText }];
      messagesRef.current = initial;
      setMessages(initial);
      setLastAI(aiText);
      setStatus("speaking");
      speak(aiText, () => setStatus("idle"));
    } catch {
      setStatus("idle");
    }
  }

  async function getFeedback() {
    if (messagesRef.current.length < 2) return;
    setShowFeedback(true);
    setFeedbackMsg(null);
    synthRef.current.cancel();
    try {
      const conversation = messagesRef.current.map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`).join("\n");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `Analyze this English conversation by a ${level} level Japanese student. Give brief feedback in Japanese:
1. ✅ 良かった点
2. 📝 改善できる点（具体例付き）
3. 🎯 今日のスコア（10点満点）

Conversation:\n${conversation}\n\nKeep it short and encouraging.`,
          }],
        }),
      });
      const data = await res.json();
      setFeedbackMsg(data.content?.find((b) => b.type === "text")?.text || "");
    } catch {
      setFeedbackMsg("フィードバックを取得できませんでした。");
    }
  }

  const statusLabel = {
    idle: "タップして話す",
    listening: "聞いています...",
    thinking: "考えています...",
    speaking: "話しています...",
  }[status];

  const statusColor = {
    idle: "#475569",
    listening: accent,
    thinking: "#fbbf24",
    speaking: "#60a5fa",
  }[status];

  // ── TUTORIAL ──
  if (screen === "tutorial") {
    return <Tutorial onDone={() => setScreen("home")} />;
  }

  // ── HOME ──
  if (screen === "home") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <style>{`* { box-sizing: border-box; } button { cursor: pointer; } .ch:hover { transform: translateY(-2px); } .ch { transition: transform 0.15s; }`}</style>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🎙️</div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "#f8fafc" }}>英会話 AI Tutor</h1>
          <p style={{ color: "#94a3b8", margin: "8px 0 0", fontSize: 14 }}>声で話して、声で学ぶ</p>
        </div>

        <div style={{ width: "100%", maxWidth: 440, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>レベル</div>
          <div style={{ display: "flex", gap: 8 }}>
            {LEVELS.map((l) => (
              <button key={l.id} className="ch" onClick={() => setLevel(l.id)} style={{ flex: 1, padding: "12px 6px", borderRadius: 12, border: `2px solid ${level === l.id ? l.color : "#1e293b"}`, background: level === l.id ? `${l.color}18` : "#0f172a", color: level === l.id ? l.color : "#64748b", fontFamily: "inherit", fontSize: 12, fontWeight: 700, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 20 }}>{l.emoji}</span>{l.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 440, marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>トピック</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TOPICS.map((t) => (
              <button key={t.id} className="ch" onClick={() => setTopic(t.id)} style={{ padding: "11px 14px", borderRadius: 10, border: `2px solid ${topic === t.id ? accent : "#1e293b"}`, background: topic === t.id ? `${accent}18` : "#0f172a", color: topic === t.id ? accent : "#64748b", fontFamily: "inherit", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={startChat} style={{ width: "100%", maxWidth: 440, padding: 18, borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${accent}, ${accent}88)`, color: "#0a0f1e", fontSize: 16, fontWeight: 700, fontFamily: "inherit", boxShadow: `0 4px 24px ${accent}44` }}>
          会話を始める →
        </button>
        <button onClick={() => setScreen("tutorial")} style={{ marginTop: 8, background: "none", border: "none", color: "#334155", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>❓ 使い方を見る</button>
        <p style={{ marginTop: 6, fontSize: 11, color: "#1e293b" }}>{selectedLevel?.emoji} {selectedLevel?.label} · {selectedTopic?.emoji} {selectedTopic?.label}</p>
      </div>
    );
  }

  // ── CHAT ──
  return (
    <div style={{ height: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }
        @keyframes wave { 0%,100%{height:6px} 50%{height:22px} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
      `}</style>

      {/* Top bar */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => { synthRef.current.cancel(); setScreen("home"); }} style={{ background: "none", border: "1px solid #1e293b", color: "#94a3b8", padding: "6px 10px", borderRadius: 8, fontFamily: "inherit", fontSize: 12 }}>← 戻る</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{selectedTopic?.emoji} {selectedTopic?.label}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>{selectedLevel?.emoji} {selectedLevel?.label}</div>
        </div>
        <button onClick={getFeedback} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "7px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>📊 採点</button>
      </div>

      {/* Conversation log (subtitle style) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isUser ? `${accent}22` : "#111827", border: `1px solid ${isUser ? accent + "44" : "#1e293b"}`, fontSize: 13, lineHeight: 1.6, color: isUser ? accent : "#cbd5e1" }}>
                {m.content}
              </div>
            </div>
          );
        })}
        {transcript && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: "16px 16px 4px 16px", background: `${accent}11`, border: `1px dashed ${accent}66`, fontSize: 13, color: `${accent}99`, fontStyle: "italic" }}>
              {transcript}
            </div>
          </div>
        )}
      </div>

      {/* Status + mic area */}
      <div style={{ padding: "20px 16px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, borderTop: "1px solid #1e293b" }}>

        {/* Sound wave / status indicator */}
        <div style={{ height: 32, display: "flex", alignItems: "center", gap: 4 }}>
          {status === "listening" && [0,1,2,3,4].map(i => (
            <div key={i} style={{ width: 4, borderRadius: 2, background: accent, animation: `wave 0.8s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
          {status === "speaking" && [0,1,2,3,4].map(i => (
            <div key={i} style={{ width: 4, borderRadius: 2, background: "#60a5fa", animation: `wave 0.9s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
          {status === "thinking" && (
            <div style={{ width: 24, height: 24, border: "3px solid #1e293b", borderTop: `3px solid #fbbf24`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          )}
          {status === "idle" && <div style={{ height: 2, width: 48, background: "#1e293b", borderRadius: 1 }} />}
        </div>

        <div style={{ fontSize: 13, color: statusColor, fontWeight: 600, letterSpacing: 0.5 }}>{statusLabel}</div>

        {/* Big mic button */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <PulseRing color={accent} active={status === "listening"} />
          <button
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={stopListening}
            disabled={status === "thinking" || status === "speaking"}
            style={{
              width: 80, height: 80, borderRadius: "50%", border: "none",
              background: status === "listening" ? accent : status === "thinking" ? "#fbbf2422" : status === "speaking" ? "#60a5fa22" : "#111827",
              boxShadow: status === "listening" ? `0 0 32px ${accent}66` : "0 4px 20px #00000066",
              fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: status === "idle" ? "pointer" : "default",
              transition: "all 0.2s", border: `2px solid ${status === "listening" ? accent : "#1e293b"}`,
              userSelect: "none", WebkitUserSelect: "none",
            }}
          >
            {status === "speaking" ? "🔊" : status === "thinking" ? "💭" : "🎤"}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: "#334155", textAlign: "center" }}>
          {status === "idle" ? "ボタンを押している間に話してください" : ""}
        </p>

        {error && <div style={{ background: "#7f1d1d22", border: "1px solid #ef444444", color: "#fca5a5", padding: "8px 14px", borderRadius: 8, fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>

      {/* Feedback modal */}
      {showFeedback && (
        <div style={{ position: "absolute", inset: 0, background: "#000000cc", display: "flex", alignItems: "flex-end", zIndex: 10 }} onClick={() => setShowFeedback(false)}>
          <div style={{ width: "100%", background: "#111827", borderRadius: "20px 20px 0 0", padding: 24, maxHeight: "70vh", overflowY: "auto", border: "1px solid #1e293b" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: accent }}>📊 会話フィードバック</div>
              <button onClick={() => setShowFeedback(false)} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "6px 12px", borderRadius: 8, fontFamily: "inherit" }}>閉じる</button>
            </div>
            {feedbackMsg
              ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{feedbackMsg}</p>
              : <div style={{ textAlign: "center", padding: 30, color: "#475569" }}>
                  <div style={{ width: 24, height: 24, border: "3px solid #1e293b", borderTop: `3px solid ${accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                  分析中...
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}
