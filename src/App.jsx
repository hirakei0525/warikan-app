import { useState, useRef, useEffect, useCallback } from 'react';

const JSONBIN_KEY = '$2a$10$7d90hiCCptuoBNJLlUFKluO72mrhvXh5Wd0vgf.KkZV9M0z7ZM6AC';
const API_URL = 'https://api.jsonbin.io/v3/b';
const generateCode = () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
const getParam = (key) => new URLSearchParams(window.location.search).get(key);
const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

const api = {
  async save(code, data) {
    const binId = localStorage.getItem(`bin_${code}`);
    try {
      if (binId) {
        await fetch(`${API_URL}/${binId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY }, body: JSON.stringify({ code, ...data, updatedAt: Date.now() }) });
      } else {
        const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Name': code }, body: JSON.stringify({ code, ...data, updatedAt: Date.now() }) });
        const json = await res.json();
        if (json.metadata?.id) localStorage.setItem(`bin_${code}`, json.metadata.id);
      }
      return true;
    } catch (e) { console.error('Save error:', e); return false; }
  },
  async load(code) {
    try {
      let binId = localStorage.getItem(`bin_${code}`);
      if (binId) {
        const res = await fetch(`${API_URL}/${binId}/latest`, { headers: { 'X-Master-Key': JSONBIN_KEY } });
        const json = await res.json();
        return json.record;
      }
      return null;
    } catch (e) { console.error('Load error:', e); return null; }
  }
};

// スクリーンショット機能
const captureElement = async (elementId, isFullPage = false) => {
  try {
    const { default: html2canvas } = await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js');
    const element = isFullPage ? document.body : document.getElementById(elementId);
    if (!element) return alert('要素が見つかりません');
    const canvas = await html2canvas(element, { backgroundColor: '#f0f9ff', scale: 2 });
    canvas.toBlob(blob => {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('クリップボードにコピーしました！');
    });
  } catch (e) {
    console.error(e);
    alert('スクリーンショットに失敗しました。もう一度お試しください。');
  }
};

export default function App() {
  const [code, setCode] = useState(() => getParam('code') || generateCode());
  const [participants, setParticipants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ payer:'', desc:'', amount:'', mode:'free', receipt:null, receiptName:'', excl:[] });
  const [method, setMethod] = useState('equal');
  const [fixed, setFixed] = useState({});
  const [zero, setZero] = useState({});
  const [showRes, setShowRes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewRec, setViewRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const fileRef = useRef(null);
  const init = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    const load = async () => {
      const urlCode = getParam('code');
      if (urlCode) setCode(urlCode);
      const c = urlCode || code;
      const data = await api.load(c);
      if (data) {
        setParticipants(data.participants || []);
        setPayments(data.payments || []);
        setMethod(data.method || 'equal');
        setFixed(data.fixed || {});
        setZero(data.zero || {});
        setLastSync(data.updatedAt);
      }
      if (!urlCode) window.history.replaceState({}, '', `?code=${c}`);
      setLoading(false);
      init.current = true;
    };
    load();
  }, []);

  const saveData = useCallback(async () => {
    if (!init.current) return;
    setSaving(true);
    const data = { participants, payments: payments.map(p => ({...p, receipt: null})), method, fixed, zero };
    await api.save(code, data);
    setSaving(false);
    setLastSync(Date.now());
  }, [code, participants, payments, method, fixed, zero]);

  useEffect(() => {
    if (!init.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveData, 1000);
  }, [participants, payments, method, fixed, zero, saveData]);

  const refresh = async () => {
    setLoading(true);
    const data = await api.load(code);
    if (data) {
      setParticipants(data.participants || []);
      setPayments(data.payments || []);
      setMethod(data.method || 'equal');
      setFixed(data.fixed || {});
      setZero(data.zero || {});
      setLastSync(data.updatedAt);
    }
    setLoading(false);
  };

  const addP = () => {
    const n = newName.trim();
    if (n && !participants.find(p => p.name === n)) {
      setParticipants([...participants, { id: Date.now().toString(), name: n }]);
      setNewName('');
    }
  };

  const savePay = () => {
    if (!form.payer || !form.amount) return alert('入力してください');
    const d = { id: editId || Date.now().toString(), payer: form.payer, desc: form.desc || '支払い', amount: +form.amount, receipt: form.receipt, receiptName: form.receiptName, excl: [...form.excl] };
    setPayments(editId ? payments.map(p => p.id === editId ? d : p) : [...payments, d]);
    setForm({ payer:'', desc:'', amount:'', mode:'free', receipt:null, receiptName:'', excl:[] });
    setShowForm(false); setEditId(null);
  };

  const edit = (p) => { setForm({ payer: p.payer, desc: p.desc, amount: ''+p.amount, mode:'free', receipt: p.receipt, receiptName: p.receiptName||'', excl: [...(p.excl||[])] }); setEditId(p.id); setShowForm(true); };

  const reset = () => { 
    if (confirm('リセット？')) { 
      const newCode = generateCode();
      setParticipants([]); setPayments([]); setFixed({}); setZero({}); setShowRes(false); 
      setCode(newCode); 
      window.history.replaceState({}, '', `?code=${newCode}`);
    }
  };

  // 均等割り計算（除外考慮）
  const eqShare = () => {
    const s = {}; participants.forEach(p => s[p.id] = 0);
    payments.forEach(py => {
      const el = participants.filter(p => !(py.excl||[]).includes(p.id));
      if (el.length) el.forEach(p => s[p.id] += py.amount / el.length);
    });
    return s;
  };

  // メイン計算ロジック
  const calc = () => {
    if (participants.length < 2 || !payments.length) return null;
    const eq = eqShare();
    const total = payments.reduce((a,b) => a + b.amount, 0);
    const paid = {}; 
    participants.forEach(p => paid[p.id] = 0); 
    payments.forEach(p => paid[p.payer] += p.amount);
    
    const should = {};
    
    if (method === 'equal') {
      // 均等割り
      participants.forEach(p => should[p.id] = Math.round(eq[p.id]));
    } else {
      // 傾斜割り勘：固定額の人を先に確定、残りを均等分配
      let fixedTotal = 0;
      const unfixedIds = [];
      
      participants.forEach(p => {
        if (zero[p.id]) {
          should[p.id] = 0;
        } else if (fixed[p.id] > 0) {
          should[p.id] = fixed[p.id];
          fixedTotal += fixed[p.id];
        } else {
          unfixedIds.push(p.id);
        }
      });
      
      // 残り金額を未固定者で均等分配
      const remaining = total - fixedTotal;
      if (unfixedIds.length > 0 && remaining > 0) {
        const perPerson = Math.round(remaining / unfixedIds.length);
        unfixedIds.forEach((id, idx) => {
          // 最後の人で端数調整
          if (idx === unfixedIds.length - 1) {
            const othersTotal = perPerson * (unfixedIds.length - 1);
            should[id] = remaining - othersTotal;
          } else {
            should[id] = perPerson;
          }
        });
      } else {
        unfixedIds.forEach(id => should[id] = 0);
      }
    }
    
    // 収支計算
    const bal = {}; 
    participants.forEach(p => bal[p.id] = paid[p.id] - should[p.id]);
    
    const cr = participants.filter(p => bal[p.id] > 0).map(p => ({...p, a: bal[p.id]})).sort((a,b) => b.a - a.a);
    const dr = participants.filter(p => bal[p.id] < 0).map(p => ({...p, a: -bal[p.id]})).sort((a,b) => b.a - a.a);
    
    const set = []; 
    let ci=0, di=0;
    while (ci < cr.length && di < dr.length) {
      const a = Math.min(cr[ci].a, dr[di].a);
      if (a > 0) set.push({ from: dr[di].name, to: cr[ci].name, amount: a });
      cr[ci].a -= a; dr[di].a -= a;
      if (!cr[ci].a) ci++; if (!dr[di].a) di++;
    }
    
    return { total, eq, paid, should, set };
  };

  const res = calc(), eq = eqShare();
  const copy = () => { 
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?code=${code}`); 
    setCopied(true); setTimeout(() => setCopied(false), 2000); 
  };

  const pdf = () => {
    if (!res) return;
    const w = window.open('','_blank');
    w.document.write(`<html><head><meta charset="utf-8"><title>精算レポート - ${code}</title>
    <style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}
    h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}
    h2{color:#059669;margin-top:25px}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border:1px solid #ddd;padding:10px;text-align:left}
    th{background:#f3f4f6}
    .excluded{color:#ef4444;font-size:12px}
    .settlement{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0;font-size:18px}
    .amount{font-weight:bold;color:#4f46e5}
    @media print{button{display:none}}</style></head>
    <body>
    <h1>💰 割り勘精算レポート</h1>
    <p><strong>精算コード:</strong> ${code}</p>
    <p><strong>作成日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
    
    <h2>📋 基本情報</h2>
    <table>
      <tr><th>合計金額</th><td class="amount">${res.total.toLocaleString()}円</td></tr>
      <tr><th>参加者</th><td>${participants.map(p=>p.name).join(', ')}（${participants.length}名）</td></tr>
      <tr><th>割り勘方法</th><td>${method==='equal'?'均等割り':'傾斜割り勘'}</td></tr>
    </table>
    
    <h2>💳 支払い明細</h2>
    <table>
      <tr><th>内容</th><th>支払者</th><th>金額</th><th>除外者</th></tr>
      ${payments.map(p=>`<tr>
        <td>${p.desc}</td>
        <td>${participants.find(x=>x.id===p.payer)?.name || ''}</td>
        <td class="amount">${p.amount.toLocaleString()}円</td>
        <td class="excluded">${(p.excl||[]).length > 0 ? (p.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).filter(Boolean).join(', ') : '－'}</td>
      </tr>`).join('')}
    </table>
    
    <h2>🧮 計算結果</h2>
    <table>
      <tr><th>名前</th><th>支払済み</th><th>均等負担額</th><th>最終負担額</th><th>差額</th></tr>
      ${participants.map(p=>`<tr>
        <td>${p.name}</td>
        <td>${(res.paid[p.id]||0).toLocaleString()}円</td>
        <td>${Math.round(eq[p.id]||0).toLocaleString()}円</td>
        <td class="amount">${(res.should[p.id]||0).toLocaleString()}円</td>
        <td>${((res.paid[p.id]||0) - (res.should[p.id]||0)).toLocaleString()}円</td>
      </tr>`).join('')}
    </table>
    
    <h2>💸 精算アクション</h2>
    ${res.set.length ? res.set.map(s=>`<div class="settlement"><strong>${s.from}</strong> → <strong>${s.to}</strong>: <span class="amount">${s.amount.toLocaleString()}円</span></div>`).join('') : '<p>精算の必要はありません</p>'}
    
    <div style="margin-top:40px;text-align:center">
      <button onclick="window.print()" style="padding:12px 40px;font-size:16px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ 印刷 / PDF保存</button>
    </div>
    </body></html>`);
    w.document.close();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><div className="text-center"><p className="text-lg mb-2">読み込み中...</p><p className="text-sm text-gray-500">精算コード: {code}</p></div></div>;

  return (
    <div id="app-container" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-3">💰 割り勘精算アプリ</h1>
          
          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-start">
              <div><span className="text-xs text-gray-500">精算コード</span><p className="text-xl font-mono font-bold text-indigo-600">{code}</p></div>
              <div className="text-right">
                {saving && <span className="text-xs text-orange-500">保存中...</span>}
                {!saving && lastSync && <span className="text-xs text-green-600">✓ 同期済</span>}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={copy} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm">{copied ? '✓コピー済' : '📋 URL共有'}</button>
              <button onClick={refresh} className="bg-gray-200 px-3 py-2 rounded-lg text-sm" title="最新データを取得">🔄</button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">データは自動保存・同期されます</p>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">👥 参加者 ({participants.length}人)</h2>
            <div className="flex gap-2 mb-2">
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addP()} placeholder="名前を入力" className="flex-1 border rounded-lg px-3 py-2 text-sm"/>
              <button onClick={addP} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">{participants.map(p=>(
              <span key={p.id} className="bg-blue-100 px-3 py-1 rounded-full text-sm">{p.name}<button onClick={()=>{setParticipants(participants.filter(x=>x.id!==p.id));setPayments(payments.filter(x=>x.payer!==p.id));}} className="text-red-500 ml-1">×</button></span>
            ))}</div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">💳 支払い ({payments.length}件)</h2>
              {!showForm&&<button onClick={()=>setShowForm(true)} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+ 追加</button>}
            </div>
            {showForm&&(
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">支払者</label>
                  <select value={form.payer} onChange={e=>setForm({...form,payer:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">選択してください</option>
                    {participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">内容</label>
                  <input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="例: 夕食代" className="w-full border rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">金額</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={()=>setForm({...form,mode:'free'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='free'?'bg-blue-500 text-white':'bg-gray-200'}`}>自由入力</button>
                    <button type="button" onClick={()=>setForm({...form,mode:'select'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='select'?'bg-blue-500 text-white':'bg-gray-200'}`}>500円単位</button>
                  </div>
                  {form.mode==='free'?
                    <input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="金額を入力" className="w-full border rounded-lg px-3 py-2 text-sm"/>:
                    <select value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">金額を選択</option>
                      {amountOptions.map(a=><option key={a} value={a}>{a.toLocaleString()}円</option>)}
                    </select>
                  }
                </div>
                
                {/* 除外設定UI改善 */}
                <div>
                  <label className="text-xs text-gray-600 block mb-1">🚫 この支払いから除外する人（タップで除外）</label>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p=>{
                        const isExcluded = form.excl.includes(p.id);
                        return (
                          <button key={p.id} type="button" 
                            onClick={()=>setForm({...form,excl:isExcluded?form.excl.filter(x=>x!==p.id):[...form.excl,p.id]})} 
                            className={`px-3 py-1 rounded-full text-sm border-2 transition-all ${
                              isExcluded 
                                ? 'bg-red-500 text-white border-red-500' 
                                : 'bg-white text-gray-700 border-gray-300 hover:border-red-300'
                            }`}>
                            {isExcluded ? '🚫 ' : ''}{p.name}{isExcluded ? '（除外中）' : ''}
                          </button>
                        );
                      })}
                    </div>
                    {form.excl.length > 0 && (
                      <p className="text-xs text-red-600 mt-2">⚠️ {form.excl.length}名を除外: この支払いの割り勘対象から外れます</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-gray-600 block mb-1">📎 レシート画像</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setForm({...form,receipt:ev.target.result,receiptName:f.name});r.readAsDataURL(f);}}} className="w-full text-sm border rounded-lg p-2"/>
                  {form.receiptName && <p className="text-xs text-green-600 mt-1">✓ {form.receiptName}</p>}
                </div>
                
                <div className="flex gap-2">
                  <button onClick={savePay} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium">{editId?'更新':'登録'}</button>
                  <button onClick={()=>{setShowForm(false);setEditId(null);setForm({payer:'',desc:'',amount:'',mode:'free',receipt:null,receiptName:'',excl:[]});}} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button>
                </div>
              </div>
            )}
            {payments.map(p=>(
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2 flex justify-between">
                <div>
                  <p className="font-medium text-sm">{p.desc}</p>
                  <p className="text-xs text-gray-500">{participants.find(x=>x.id===p.payer)?.name}が支払い</p>
                  <p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>
                  {(p.excl||[]).length>0 && (
                    <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded mt-1">
                      🚫 除外: {(p.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={()=>edit(p)} className="text-blue-500 text-xs">✏️編集</button>
                  {p.receipt&&<button onClick={()=>setViewRec(p)} className="text-green-600 text-xs">🧾詳細</button>}
                  <button onClick={()=>setPayments(payments.filter(x=>x.id!==p.id))} className="text-red-500 text-xs">🗑削除</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">⚖️ 割り勘方法</h2>
            <div className="flex gap-2 mb-2">
              <button onClick={()=>setMethod('equal')} className={`flex-1 py-2 rounded-lg text-sm ${method==='equal'?'bg-indigo-500 text-white':'bg-gray-200'}`}>均等割り</button>
              <button onClick={()=>setMethod('fixed')} className={`flex-1 py-2 rounded-lg text-sm ${method==='fixed'?'bg-indigo-500 text-white':'bg-gray-200'}`}>傾斜割り勘</button>
            </div>
            {method==='fixed'&&participants.length>0&&(
              <div className="bg-yellow-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-500 mb-2">💡 金額を入力した人は固定、未入力の人で残額を均等分配します</p>
                {participants.map(p=>{
                  const total = payments.reduce((a,b) => a + b.amount, 0);
                  const fixedTotal = Object.entries(fixed).filter(([id]) => id !== p.id && !zero[id]).reduce((a,[,v]) => a + (v||0), 0) + (zero[p.id] ? 0 : (fixed[p.id] || 0));
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-white p-2 rounded">
                      <span className="w-20 text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-gray-400 w-20">(均等:{Math.round(eq[p.id]||0).toLocaleString()}円)</span>
                      <label className="flex items-center shrink-0">
                        <input type="checkbox" checked={zero[p.id]||false} onChange={e=>setZero({...zero,[p.id]:e.target.checked})} className="mr-1 w-4 h-4"/>
                        <span className="text-xs">0円</span>
                      </label>
                      <input type="number" value={fixed[p.id]||''} onChange={e=>setFixed({...fixed,[p.id]:+e.target.value})} disabled={zero[p.id]} placeholder="金額" className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-200 min-w-0"/>
                      <span className="text-xs shrink-0">円</span>
                    </div>
                  );
                })}
                {(() => {
                  const total = payments.reduce((a,b) => a + b.amount, 0);
                  const fixedTotal = Object.entries(fixed).filter(([id]) => !zero[id]).reduce((a,[id,v]) => a + (v||0), 0);
                  const unfixedCount = participants.filter(p => !zero[p.id] && !fixed[p.id]).length;
                  const remaining = total - fixedTotal;
                  return (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <p>合計: <strong>{total.toLocaleString()}円</strong></p>
                      <p>固定済: <strong>{fixedTotal.toLocaleString()}円</strong></p>
                      <p>残り: <strong className="text-indigo-600">{remaining.toLocaleString()}円</strong> 
                        {unfixedCount > 0 && <span className="text-gray-500">（{unfixedCount}名で {Math.round(remaining/unfixedCount).toLocaleString()}円/人）</span>}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button onClick={()=>setShowRes(true)} disabled={!res} className="w-full bg-indigo-500 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300">🧮 精算結果を表示</button>
            <button onClick={reset} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold">🔄 リセット</button>
          </div>

          {showRes&&res&&(
            <div id="result-section" className="bg-green-50 rounded-xl p-4 mt-4">
              <h2 className="text-lg font-bold text-green-700 mb-3">📊 精算結果</h2>
              <p className="text-xs text-gray-500 mb-3">精算コード: {code}</p>
              
              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between text-sm">
                  <span>合計金額:</span>
                  <span className="font-bold text-lg">{res.total.toLocaleString()}円</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">👤 各人の収支</h3>
                {participants.map(p=>(
                  <div key={p.id} className="text-sm border-b pb-2 mb-2 last:border-0">
                    <div className="font-medium">{p.name}</div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>支払: {(res.paid[p.id]||0).toLocaleString()}円</span>
                      <span>均等: {Math.round(eq[p.id]||0).toLocaleString()}円</span>
                      <span className="font-bold text-indigo-600">負担: {(res.should[p.id]||0).toLocaleString()}円</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">💸 送金アクション</h3>
                {res.set.length ? res.set.map((s,i)=>(
                  <div key={i} className="bg-green-100 rounded-lg p-3 mb-2 flex justify-between items-center">
                    <span className="font-medium">{s.from} → {s.to}</span>
                    <span className="text-xl font-bold text-green-700">{s.amount.toLocaleString()}円</span>
                  </div>
                )) : <p className="text-gray-500 text-sm">精算の必要はありません 🎉</p>}
              </div>
              
              {/* 出力ボタン群 */}
              <div className="space-y-2">
                <button onClick={pdf} className="w-full bg-purple-500 text-white py-2 rounded-lg text-sm">📄 PDFレポート出力</button>
                <div className="flex gap-2">
                  <button onClick={()=>captureElement('app-container', true)} className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm">📸 全体をコピー</button>
                  <button onClick={()=>captureElement('result-section')} className="flex-1 bg-teal-500 text-white py-2 rounded-lg text-sm">📸 結果のみコピー</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {viewRec&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={()=>setViewRec(null)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">🧾 {viewRec.desc}</h3>
            <p className="text-sm text-gray-600">支払者: {participants.find(x=>x.id===viewRec.payer)?.name}</p>
            <p className="text-xl font-bold text-indigo-600 mb-3">{viewRec.amount.toLocaleString()}円</p>
            {(viewRec.excl||[]).length > 0 && (
              <p className="text-sm text-red-500 mb-3">🚫 除外: {(viewRec.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).filter(Boolean).join(', ')}</p>
            )}
            {viewRec.receipt?.startsWith('data:image') && <img src={viewRec.receipt} alt="レシート" className="w-full rounded-lg"/>}
            <button onClick={()=>setViewRec(null)} className="w-full mt-4 bg-gray-300 py-2 rounded-lg">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
