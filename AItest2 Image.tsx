import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export type Part = { text: string };
export type ChatMsg = { role: 'user' | 'model'; parts: Part[]; imageUrl?: string }; // 新增 imageUrl 屬性

type Props = {
  /** Default Gemini model id (you can type any valid one) */
  defaultModel?: string; // e.g. 'gemini-2.5-flash-image'
  /** Optional starter message */
  starter?: string;
};

async function fetchImage(prompt: string): Promise<string> {
  console.log(`Simulating image generation for: ${prompt}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const isBasketball = /籃球|basketball/i.test(prompt);
  if (isBasketball) {
    return 'https://picsum.photos/seed/basketballsmiley/300/300'; 
  }
  
  return 'https://picsum.photos/seed/defaultai/300/300';
}


export default function AItest({
  defaultModel = 'gemini-2.5-flash-image', 
  starter = '幫我列出一個日本淺草以及東京迪士尼的兩天一夜行程',
}: Props) {
  const [model, setModel] = useState<string>(defaultModel);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false); 
  
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key'); 
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    setHistory([{ role: 'model', parts: [{ text: '你好👋 我是 Gemini 小幫手，有什麼想聊的？' }] }]);
    if (starter) setInput(starter);
  }, [starter]);

  // auto-scroll to bottom
  useEffect(() => {
    const el = listRef.current; if (!el) return; el.scrollTop = el.scrollHeight;
  }, [history, loading, isGeneratingImage]);

  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  /** 處理文字訊息的傳送 */
  async function sendMessage(message?: string) {
    const content = (message ?? input).trim();
    if (!content || loading || isGeneratingImage) return;
    if (!ai) { setError('請先輸入有效的 Gemini API Key'); return; }

    setError('');
    setLoading(true);

    const newHistory: ChatMsg[] = [...history, { role: 'user', parts: [{ text: content }] }];
    setHistory(newHistory);
    setInput('');

    try {
      // Use the official SDK directly in the browser
      const resp = await ai.models.generateContent({
        model,
        contents: newHistory, // send the chat history to keep context
      });

      const reply = resp.text || '[No content]';
      setHistory(h => [...h, { role: 'model', parts: [{ text: reply }] }]);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  /** 處理圖片生成請求 */
  async function generateBasketballImage() {
    const prompt = '一張有笑臉的籃球的照片';
    if (!apiKey || loading || isGeneratingImage) return;
    
    const userMsg: ChatMsg = { role: 'user', parts: [{ text: `請生成圖片: ${prompt}` }] };
    setHistory(h => [...h, userMsg]);
    
    setError('');
    setIsGeneratingImage(true);

    try {
      const imageUrl = await fetchImage(prompt);
      
      const modelMsg: ChatMsg = { 
        role: 'model', 
        parts: [{ text: `好的，這是您請求的「${prompt}」圖片。` }],
        imageUrl: imageUrl, 
      };
      setHistory(h => [...h, modelMsg]);
      
    } catch (err: any) {
      setError(`圖片生成失敗: ${err?.message || String(err)}`);
    } finally {
      setIsGeneratingImage(false);
    }
  }


  function renderMarkdownLike(text: string) {
    const lines = text.split(/\n/);
    return (
      <>
        {lines.map((ln, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ln}</div>
        ))}
      </>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>Gemini Chat 聊天小幫手 🤖</div>

        {/* Controls (Model and API Key) */}
        <div style={styles.controls}>
          <div style={styles.controlGroup}>
            <label style={styles.label}>
              <span style={styles.labelTitle}>模型 (Model)</span>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="例如 gemini-2.5-flash-image"
                style={styles.input}
              />
            </label>
            <div style={styles.controlInfo}>
                使用 `gemini-2.5-flash-image` 支援多模態。
            </div>
          </div>
          <div style={styles.controlGroup}>
            <label style={styles.label}>
              <span style={styles.labelTitle}>Gemini API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  const v = e.target.value; setApiKey(v);
                  if (rememberKey) localStorage.setItem('gemini_api_key', v);
                }}
                placeholder="貼上你的 API Key"
                style={styles.input}
              />
            </label>
            <label style={styles.keyRememberLabel}>
              <input type="checkbox" checked={rememberKey} onChange={(e)=>{
                setRememberKey(e.target.checked);
                if (!e.target.checked) localStorage.removeItem('gemini_api_key');
                else if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
              }} />
              <span>記住在本機（localStorage）</span>
            </label>
          </div>
        </div>
        
        {/* Messages */}
        <div ref={listRef} style={styles.messages}>
          {history.map((m, idx) => (
            <div
              key={idx}
              style={{
                ...styles.msgContainer,
                ...(m.role === 'user' ? styles.userContainer : styles.assistantContainer)
              }}
            >
              <div style={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                <div style={styles.msgBody}>
                  {renderMarkdownLike(m.parts.map(p => p.text).join('\n'))}
                  
                  {/* 顯示生成的圖片 */}
                  {m.imageUrl && (
                    <div style={{ marginTop: 10 }}>
                      <img 
                        src={m.imageUrl} 
                        alt="Generated image" 
                        style={styles.generatedImage}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(loading || isGeneratingImage) && (
            <div style={{ ...styles.msgContainer, ...styles.assistantContainer }}>
              <div style={styles.assistantMsg}>
                <div style={styles.msgBody}>{isGeneratingImage ? '圖片生成中…' : '思考中…'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={styles.error}>⚠ {error}</div>
        )}

        {/* Composer */}
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          style={styles.composer}
        >
          <input
            placeholder="輸入訊息，按 Enter 送出"
            value={input}
            onChange={e => setInput(e.target.value)}
            style={styles.textInput}
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim() || !apiKey || isGeneratingImage} 
            style={styles.sendBtn}
          >
            {loading ? '傳送中' : '傳送'}
          </button>
        </form>

        {/* Quick examples + Image Generation Button */}
        <div style={styles.suggestionList}>
          {['日本淺草附近有哪些推薦的住宿？', '日本淺草必吃美食', '日本東京迪士尼必玩項目'].map((q) => (
            <button key={q} type="button" style={styles.suggestion} onClick={() => sendMessage(q)} disabled={loading || isGeneratingImage}>{q}</button>
          ))}
          {/* 新增圖片生成按鈕 */}
          <button 
            type="button" 
            onClick={generateBasketballImage} 
            disabled={loading || !apiKey || isGeneratingImage}
            style={{ ...styles.suggestion, ...styles.imageGenButton }}
          >
            {isGeneratingImage ? '生成中...' : '生成笑臉籃球圖片 🖼️'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { 
    display: 'flex', 
    justifyContent: 'center', 
    padding: 16, 
    background: '#f0f2f5', 
    minHeight: '100vh' 
  },
  card: {
    width: 'min(768px, 100%)', 
    height: '80vh', 
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderRadius: 20, 
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)', 
    overflow: 'hidden',
  },
  header: {
    padding: '12px 20px',
    fontWeight: 600,
    fontSize: 16,
    color: '#333',
    background: '#f9fafb',
    textAlign: 'center',
    borderBottom: '1px solid #eee',
  },
  controls: {
    display: 'flex',
    gap: 16,
    padding: 16,
    borderBottom: '1px dashed #eee', 
    fontSize: 12,
  },
  controlGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  label: { display: 'grid', gap: 4 },
  labelTitle: { fontWeight: 500, opacity: 0.8 },
  controlInfo: { fontSize: 11, opacity: 0.6, marginTop: 4 },
  input: { padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, width: '100%' },
  keyRememberLabel: { display:'flex', alignItems:'center', gap:6, marginTop:4, fontSize:11, opacity: 0.7 },
  
  messages: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flexGrow: 1, 
    overflowY: 'auto',
    backgroundColor: '#fff',
  },
  msgContainer: {
    display: 'flex',
    maxWidth: '85%', 
  },
  userContainer: {
    justifyContent: 'flex-end', 
    marginLeft: 'auto',
  },
  assistantContainer: {
    justifyContent: 'flex-start', 
    marginRight: 'auto',
  },
  userMsg: {
    borderRadius: '16px 16px 0 16px', 
    padding: '10px 14px',
    background: '#007aff', 
    color: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  assistantMsg: {
    borderRadius: '16px 16px 16px 0', 
    padding: '10px 14px',
    background: '#e5e7eb', 
    color: '#333',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  },
  msgBody: { fontSize: 14, lineHeight: 1.5 },
  generatedImage: { maxWidth: '100%', height: 'auto', borderRadius: 8, border: '1px solid #ccc' }, // 新增圖片樣式
  error: { color: '#b91c1c', padding: '8px 16px', borderTop: '1px solid #fecaca', background: '#fef2f2' },
  
  composer: { 
    padding: 16, 
    display: 'grid', 
    gridTemplateColumns: '1fr auto', 
    gap: 10, 
    borderTop: '1px solid #eee',
    background: '#fff',
  },
  textInput: { 
    padding: '12px 16px', 
    borderRadius: 24, 
    border: '1px solid #ddd', 
    fontSize: 14,
    flexGrow: 1,
  },
  sendBtn: { 
    padding: '0 20px', 
    borderRadius: 24, 
    border: 'none', 
    background: '#007aff', 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 1,
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center', 
    justifyContent: 'center',
    height: 'auto',
  },
  suggestionList: { 
    display: 'flex', 
    gap: 8, 
    flexWrap: 'wrap', 
    padding: '0 16px 16px',
    borderTop: '1px solid #eee', 
    background: '#fff',
  },
  suggestion: { 
    padding: '6px 12px', 
    borderRadius: 20, 
    border: '1px solid #ccc', 
    background: '#f9fafb', 
    cursor: 'pointer', 
    fontSize: 12,
    color: '#4b5563',
    transition: 'background 0.2s',
  },
  imageGenButton: {
    background: '#00cc66', 
    color: '#fff',
    border: '1px solid #00994d',
  },
};