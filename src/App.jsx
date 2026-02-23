import { useState, useRef, useEffect, useCallback } from 'react';

const JSONBIN_KEY = '$2a$10$7d90hiCCptuoBNJLlUFKluO72mrhvXh5Wd0vgf.KkZV9M0z7ZM6AC';
const API_URL = 'https://api.jsonbin.io/v3/b';
const generateCode = () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
const getParam = (key) => new URLSearchParams(window.location.search).get(key);
const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

// JSONBin API（検索機能強化）
const api = {
  async findBinByCode(code) {
    try {
      const res = await fetch('https://api.jsonbin.io/v3/c/uncategorized/bins', {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });
      if (!res.ok) return null;
      const bins = await res.json();
      const found = bins.find?.(b => b.snippetMeta?.name === code);
      return found?.id || null;
    } catch { return null; }
  },
  
  async save(code, data) {
    try {
      let binId = localStorage.getItem(`bin_${code}`);
      
      // binIdがない場合は検索
      if (!binId) {
        binId = await this.findBinByCode(code);
        if (binId) localStorage.setItem(`bin_${code}`, binId);
      }
      
      const payload = { code, ...data, updatedAt: Date.now() };
      
      if (binId) {
        await fetch(`${API_URL}/${binId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
          body: JSON.stringify(payload)
        });
      } else {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY, 'X-Bin-Name': code },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.metadata?.id) localStorage.setItem(`bin_${code}`, json.metadata.id);
      }
      return true;
    } catch (e) { console.error('Save error:', e); return false; }
  },
  
  async load(code) {
    try {
      let binId = localStorage.getItem(`bin_${code}`);
      
      // ローカルにbinIdがない場合は検索
      if (!binId) {
        binId = await this.findBinByCode(code);
        if (binId) localStorage.setItem(`bin_${code}`, binId);
      }
      
      if (!binId) return null;
      
      const res = await fetch(`${API_URL}/${binId}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.record;
    } catch (e) { console.error('Load error:', e); return null; }
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
  const [collector, setCollector] = useState(''); // 幹事（集約者）
  const [editingSettlement, setEditingSettlement] = useState(null);
  const [customSettlements, setCustomSettlements] = useState([]);
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
        setCollector(data.collector || '');
        setCustomSettlements(data.customSettlements || []);
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
    const data = { 
      participants, 
      payments: payments.map(p => ({...p, receipt: null})), 
      method, fixed, zero, collector, customSettlements 
    };
    await api.save(code, data);
    setSaving(false);
    setLastSync(Date.now());
  }, [code, participants, payments, method, fixed, zero, collector, customSettlements]);

  useEffect(() => {
    if (!init.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveData, 1000);
  }, [participants, payments, method, fixed, zero, collector, customSettlements, saveData]);

  const refresh = async () => {
    setLoading(true);
    const data = await api.load(code);
    if (data) {
      setParticipants(data.participants || []);
      setPayments(data.payments || []);
      setMethod(data.method || 'equal');
      setFixed(data.fixed || {});
      setZero(data.zero || {});
      setCollector(data.collector || '');
      setCustomSettlements(data.customSettlements || []);
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
      setParticipants([]); setPayments([]); setFixed({}); setZero({}); 
      setShowRes(false); setCollector(''); setCustomSettlements([]);
      setCode(newCode); 
      window.history.replaceState({}, '', `?code=${newCode}`);
    }
  };

  const eqShare = () => {
    const s = {}; participants.forEach(p => s[p.id] = 0);
    payments.forEach(py => {
      const el = participants.filter(p => !(py.excl||[]).includes(p.id));
      if (el.length) el.forEach(p => s[p.id] += py.amount / el.length);
    });
    return s;
  };

  const calc = () => {
    if (participants.length < 2 || !payments.length) return null;
    const eq = eqShare();
    const total = payments.reduce((a,b) => a + b.amount, 0);
    const paid = {}; 
    participants.forEach(p => paid[p.id] = 0); 
    payments.forEach(p => paid[p.payer] += p.amount);
    
    const should = {};
    if (method === 'equal') {
      participants.forEach(p => should[p.id] = Math.round(eq[p.id]));
    } else {
      let fixedTotal = 0;
      const unfixedIds = [];
      participants.forEach(p => {
        if (zero[p.id]) should[p.id] = 0;
        else if (fixed[p.id] > 0) { should[p.id] = fixed[p.id]; fixedTotal += fixed[p.id]; }
        else unfixedIds.push(p.id);
      });
      const remaining = total - fixedTotal;
      if (unfixedIds.length > 0 && remaining > 0) {
        const perPerson = Math.round(remaining / unfixedIds.length);
        unfixedIds.forEach((id, idx) => {
          if (idx === unfixedIds.length - 1) {
            should[id] = remaining - perPerson * (unfixedIds.length - 1);
          } else {
            should[id] = perPerson;
          }
        });
      } else unfixedIds.forEach(id => should[id] = 0);
    }
    
    const bal = {}; 
    participants.forEach(p => bal[p.id] = paid[p.id] - should[p.id]);
    
    return { total, eq, paid, should, bal };
  };

  // 送金計算（幹事集約モード対応）
  const calcSettlements = (res) => {
    if (!res) return [];
    
    // カスタム送金がある場合はそれを使用
    if (customSettlements.length > 0) return customSettlements;
    
    const bal = {...res.bal};
    
    // 幹事モード：全員→幹事に集約
    if (collector && bal[collector] !== undefined) {
      const settlements = [];
      participants.forEach(p => {
        if (p.id !== collector && bal[p.id] < 0) {
          settlements.push({
            id: `${p.id}-${collector}`,
            from: p.name,
            fromId: p.id,
            to: participants.find(x => x.id === collector)?.name || '',
            toId: collector,
            amount: Math.abs(bal[p.id])
          });
        }
      });
      
      // 他の立替者→幹事の精算
      participants.forEach(p => {
        if (p.id !== collector && bal[p.id] > 0) {
          settlements.push({
            id: `${collector}-${p.id}`,
            from: participants.find(x => x.id === collector)?.name || '',
            fromId: collector,
            to: p.name,
            toId: p.id,
            amount: bal[p.id]
          });
        }
      });
      
      return settlements;
    }
    
    // 通常モード
    const cr = participants.filter(p => bal[p.id] > 0).map(p => ({...p, a: bal[p.id]})).sort((a,b) => b.a - a.a);
    const dr = participants.filter(p => bal[p.id] < 0).map(p => ({...p, a: -bal[p.id]})).sort((a,b) => b.a - a.a);
    const set = []; 
    let ci=0, di=0;
    while (ci < cr.length && di < dr.length) {
      const a = Math.min(cr[ci].a, dr[di].a);
      if (a > 0) set.push({ 
        id: `${dr[di].id}-${cr[ci].id}`,
        from: dr[di].name, fromId: dr[di].id,
        to: cr[ci].name, toId: cr[ci].id,
        amount: a 
      });
      cr[ci].a -= a; dr[di].a -= a;
      if (!cr[ci].a) ci++; if (!dr[di].a) di++;
    }
    return set;
  };

  const res = calc();
  const eq = eqShare();
  const settlements = calcSettlements(res);
  
  const copy = () => { 
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?code=${code}`); 
    setCopied(true); setTimeout(() => setCopied(false), 2000); 
  };

  // 送金編集
  const updateSettlement = (idx, field, value) => {
    const newSet = customSettlements.length > 0 ? [...customSettlements] : [...settlements];
    if (field === 'from') {
      const p = participants.find(x => x.name === value);
      newSet[idx] = { ...newSet[idx], from: value, fromId: p?.id || '' };
    } else if (field === 'to') {
      const p = participants.find(x => x.name === value);
      newSet[idx] = { ...newSet[idx], to: value, toId: p?.id || '' };
    } else {
      newSet[idx] = { ...newSet[idx], [field]: value };
    }
    setCustomSettlements(newSet);
  };

  const resetSettlements = () => {
    setCustomSettlements([]);
    setCollector('');
  };

  const pdf = () => {
    if (!res) return;
    const finalSettlements = customSettlements.length > 0 ? customSettlements : settlements;
    const w = window.open('','_blank');
    w.document.write(`<html><head><meta charset="utf-8"><title>精算レポート</title>
    <style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}
    h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}h2{color:#059669;margin-top:25px}
    table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:10px}th{background:#f3f4f6}
    .excluded{color:#ef4444;font-size:12px}.settlement{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0}
    .amount{font-weight:bold;color:#4f46e5}@media print{button{display:none}}</style></head>
    <body><h1>💰 精算レポート</h1><p>精算コード: ${code}</p><p>作成日時: ${new Date().toLocaleString('ja-JP')}</p>
    ${collector ? `<p>💼 幹事（集約者）: ${participants.find(p=>p.id===collector)?.name}</p>` : ''}
    <h2>📋 基本情報</h2><table><tr><th>合計金額</th><td class="amount">${res.total.toLocaleString()}円</td></tr>
    <tr><th>参加者</th><td>${participants.map(p=>p.name).join(', ')}（${participants.length}名）</td></tr></table>
    <h2>💳 支払い明細</h2><table><tr><th>内容</th><th>支払者</th><th>金額</th><th>除外者</th></tr>
    ${payments.map(p=>`<tr><td>${p.desc}</td><td>${participants.find(x=>x.id===p.payer)?.name||''}</td>
    <td class="amount">${p.amount.toLocaleString()}円</td>
    <td class="excluded">${(p.excl||[]).length>0?(p.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).filter(Boolean).join(', '):'－'}</td></tr>`).join('')}</table>
    <h2>🧮 計算結果</h2><table><tr><th>名前</th><th>支払済</th><th>負担額</th><th>差額</th></tr>
    ${participants.map(p=>`<tr><td>${p.name}</td><td>${(res.paid[p.id]||0).toLocaleString()}円</td>
    <td class="amount">${(res.should[p.id]||0).toLocaleString()}円</td>
    <td>${((res.paid[p.id]||0)-(res.should[p.id]||0)).toLocaleString()}円</td></tr>`).join('')}</table>
    <h2>💸 送金アクション</h2>
    ${finalSettlements.length?finalSettlements.map(s=>`<div class="settlement"><strong>${s.from}</strong> → <strong>${s.to}</strong>: <span class="amount">${s.amount.toLocaleString()}円</span></div>`).join(''):'<p>精算不要</p>'}
    <button onclick="print()" style="margin-top:20px;padding:12px 40px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer">🖨️印刷/PDF</button></body></html>`);
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
              <button onClick={refresh} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">🔄</button>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">👥 参加者 ({participants.length}人)</h2>
            <div className="flex gap-2 mb-2">
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addP()} placeholder="名前" className="flex-1 border rounded-lg px-3 py-2 text-sm"/>
              <button onClick={addP} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">{participants.map(p=>(
              <span key={p.id} className="bg-blue-100 px-3 py-1 rounded-full text-sm">{p.name}<button onClick={()=>{setParticipants(participants.filter(x=>x.id!==p.id));setPayments(payments.filter(x=>x.payer!==p.id));}} className="text-red-500 ml-1">×</button></span>
            ))}</div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">💳 支払い ({payments.length}件)</h2>
              {!showForm&&<button onClick={()=>setShowForm(true)} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+追加</button>}
            </div>
            {showForm&&(
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                <div><label className="text-xs text-gray-600">支払者</label>
                  <select value={form.payer} onChange={e=>setForm({...form,payer:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">選択</option>{participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-600">内容</label>
                  <input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="夕食代" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
                <div><label className="text-xs text-gray-600">金額</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={()=>setForm({...form,mode:'free'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='free'?'bg-blue-500 text-white':'bg-gray-200'}`}>自由入力</button>
                    <button type="button" onClick={()=>setForm({...form,mode:'select'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='select'?'bg-blue-500 text-white':'bg-gray-200'}`}>500円単位</button>
                  </div>
                  {form.mode==='free'?<input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="金額" className="w-full border rounded-lg px-3 py-2 text-sm"/>:
                  <select value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">選択</option>{amountOptions.map(a=><option key={a} value={a}>{a.toLocaleString()}円</option>)}</select>}
                </div>
                <div><label className="text-xs text-gray-600">🚫 除外する人</label>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="flex flex-wrap gap-2">{participants.map(p=>{
                      const isEx = form.excl.includes(p.id);
                      return <button key={p.id} type="button" onClick={()=>setForm({...form,excl:isEx?form.excl.filter(x=>x!==p.id):[...form.excl,p.id]})} 
                        className={`px-3 py-1 rounded-full text-sm border-2 ${isEx?'bg-red-500 text-white border-red-500':'bg-white border-gray-300'}`}>
                        {isEx?'🚫 ':''}{p.name}{isEx?'（除外）':''}
                      </button>;
                    })}</div>
                    {form.excl.length>0&&<p className="text-xs text-red-600 mt-2">⚠️ {form.excl.length}名を除外</p>}
                  </div></div>
                <div><label className="text-xs text-gray-600">📎 レシート</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setForm({...form,receipt:ev.target.result,receiptName:f.name});r.readAsDataURL(f);}}} className="w-full text-sm border rounded-lg p-2"/></div>
                <div className="flex gap-2">
                  <button onClick={savePay} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm">{editId?'更新':'登録'}</button>
                  <button onClick={()=>{setShowForm(false);setEditId(null);setForm({payer:'',desc:'',amount:'',mode:'free',receipt:null,receiptName:'',excl:[]});}} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button>
                </div>
              </div>
            )}
            {payments.map(p=>(
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2 flex justify-between">
                <div><p className="font-medium text-sm">{p.desc}</p><p className="text-xs text-gray-500">{participants.find(x=>x.id===p.payer)?.name}</p>
                  <p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>
                  {(p.excl||[]).length>0&&<p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded mt-1">🚫除外:{(p.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).join(',')}</p>}
                </div>
                <div className="flex flex-col gap-1"><button onClick={()=>edit(p)} className="text-blue-500 text-xs">✏️</button>{p.receipt&&<button onClick={()=>setViewRec(p)} className="text-green-600 text-xs">🧾</button>}<button onClick={()=>setPayments(payments.filter(x=>x.id!==p.id))} className="text-red-500 text-xs">🗑</button></div>
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
                <p className="text-xs text-gray-500">💡 金額入力者は固定、未入力者で残額均等分配</p>
                {participants.map(p=>(
                  <div key={p.id} className="flex items-center gap-2 bg-white p-2 rounded">
                    <span className="w-16 text-sm">{p.name}</span>
                    <span className="text-xs text-gray-400 w-16">({Math.round(eq[p.id]||0)}円)</span>
                    <label className="flex items-center"><input type="checkbox" checked={zero[p.id]||false} onChange={e=>setZero({...zero,[p.id]:e.target.checked})} className="mr-1"/>0円</label>
                    <input type="number" value={fixed[p.id]||''} onChange={e=>setFixed({...fixed,[p.id]:+e.target.value})} disabled={zero[p.id]} placeholder="金額" className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-200"/>円
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button onClick={()=>setShowRes(true)} disabled={!res} className="w-full bg-indigo-500 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300">🧮 精算結果</button>
            <button onClick={reset} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold">🔄 リセット</button>
          </div>

          {showRes&&res&&(
            <div id="result-section" className="bg-green-50 rounded-xl p-4 mt-4">
              <h2 className="text-lg font-bold text-green-700 mb-3">📊 精算結果</h2>
              
              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between"><span>合計:</span><span className="font-bold text-lg">{res.total.toLocaleString()}円</span></div>
              </div>
              
              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">👤 各人の収支</h3>
                {participants.map(p=>(
                  <div key={p.id} className="text-sm border-b pb-2 mb-2 last:border-0">
                    <div className="flex justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${res.bal[p.id]>0?'bg-green-100 text-green-700':res.bal[p.id]<0?'bg-red-100 text-red-700':'bg-gray-100'}`}>
                        {res.bal[p.id]>0?`+${res.bal[p.id].toLocaleString()}円（受取）`:res.bal[p.id]<0?`${res.bal[p.id].toLocaleString()}円（支払）`:'±0円'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>支払済:{(res.paid[p.id]||0).toLocaleString()}円</span>
                      <span>負担:{(res.should[p.id]||0).toLocaleString()}円</span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 幹事設定 */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">💼 送金集約設定</h3>
                <p className="text-xs text-gray-500 mb-2">幹事を指定すると、全員→幹事に送金を集約できます</p>
                <select value={collector} onChange={e=>{setCollector(e.target.value);setCustomSettlements([]);}} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">指定なし（通常モード）</option>
                  {participants.filter(p=>res.bal[p.id]>0).map(p=>(
                    <option key={p.id} value={p.id}>👑 {p.name}（立替: {res.bal[p.id].toLocaleString()}円）</option>
                  ))}
                </select>
              </div>
              
              {/* 送金アクション */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">💸 送金アクション</h3>
                  {customSettlements.length>0&&<button onClick={resetSettlements} className="text-xs text-blue-500">リセット</button>}
                </div>
                {settlements.length?settlements.map((s,i)=>(
                  <div key={s.id||i} className="bg-green-100 rounded-lg p-3 mb-2">
                    {editingSettlement===i?(
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select value={s.from} onChange={e=>updateSettlement(i,'from',e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm">
                            {participants.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                          <span>→</span>
                          <select value={s.to} onChange={e=>updateSettlement(i,'to',e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm">
                            {participants.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" value={s.amount} onChange={e=>updateSettlement(i,'amount',+e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm"/>
                          <span>円</span>
                          <button onClick={()=>setEditingSettlement(null)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">確定</button>
                        </div>
                      </div>
                    ):(
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{s.from} → {s.to}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-green-700">{s.amount.toLocaleString()}円</span>
                          <button onClick={()=>{if(customSettlements.length===0)setCustomSettlements([...settlements]);setEditingSettlement(i);}} className="text-xs text-blue-500">✏️</button>
                        </div>
                      </div>
                    )}
                  </div>
                )):<p className="text-gray-500 text-sm">精算不要 🎉</p>}
              </div>
              
              <div className="space-y-2">
                <button onClick={pdf} className="w-full bg-purple-500 text-white py-2 rounded-lg text-sm">📄 PDF出力</button>
                <div className="flex gap-2">
                  <button onClick={()=>{import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js').then(m=>m.default(document.getElementById('app-container'),{scale:2,backgroundColor:'#eff6ff'}).then(c=>c.toBlob(b=>navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(()=>alert('コピーしました！')))))}} className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm">📸全体</button>
                  <button onClick={()=>{import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js').then(m=>m.default(document.getElementById('result-section'),{scale:2,backgroundColor:'#f0fdf4'}).then(c=>c.toBlob(b=>navigator.clipboard.write([new ClipboardItem({'image/png':b})]).then(()=>alert('コピーしました！')))))}} className="flex-1 bg-teal-500 text-white py-2 rounded-lg text-sm">📸結果のみ</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {viewRec&&(<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={()=>setViewRec(null)}><div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={e=>e.stopPropagation()}><h3 className="font-bold mb-2">🧾{viewRec.desc}</h3><p className="text-indigo-600 font-bold mb-2">{viewRec.amount.toLocaleString()}円</p>{(viewRec.excl||[]).length>0&&<p className="text-red-500 text-sm mb-2">🚫除外:{(viewRec.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).join(',')}</p>}{viewRec.receipt?.startsWith('data:image')&&<img src={viewRec.receipt} className="w-full rounded"/>}<button onClick={()=>setViewRec(null)} className="w-full mt-4 bg-gray-300 py-2 rounded-lg">閉じる</button></div></div>)}
    </div>
  );
}
