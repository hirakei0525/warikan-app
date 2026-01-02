import { useState, useRef, useEffect } from 'react';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const getCodeFromURL = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
};

const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

export default function App() {
  const [sessionCode, setSessionCode] = useState(() => getCodeFromURL() || generateCode());
  const [participants, setParticipants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ payerId:'', desc:'', amount:'', inputMode:'free', receipt:null, receiptName:'', excluded:[] });
  const [splitMethod, setSplitMethod] = useState('equal');
  const [fixedAmounts, setFixedAmounts] = useState({});
  const [zeroPayment, setZeroPayment] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const fileRef = useRef(null);
  const isInitialized = useRef(false);

  // LocalStorageにデータを保存
  const saveToStorage = (code, data) => {
    try {
      localStorage.setItem(`warikan_${code}`, JSON.stringify(data));
      setSaveStatus('保存済み');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      console.error('保存エラー:', e);
    }
  };

  // LocalStorageからデータを読み込み
  const loadFromStorage = (code) => {
    try {
      const data = localStorage.getItem(`warikan_${code}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('読み込みエラー:', e);
      return null;
    }
  };

  // 初回読み込み
  useEffect(() => {
    const code = getCodeFromURL() || sessionCode;
    const savedData = loadFromStorage(code);
    
    if (savedData) {
      setParticipants(savedData.participants || []);
      setPayments(savedData.payments || []);
      setSplitMethod(savedData.splitMethod || 'equal');
      setFixedAmounts(savedData.fixedAmounts || {});
      setZeroPayment(savedData.zeroPayment || {});
    }
    
    // URLにコードがなければ追加
    if (!getCodeFromURL()) {
      window.history.replaceState({}, '', `${window.location.pathname}?code=${code}`);
    }
    
    setSessionCode(code);
    setIsLoading(false);
    isInitialized.current = true;
  }, []);

  // データ変更時に自動保存
  useEffect(() => {
    if (!isInitialized.current) return;
    
    const data = {
      participants,
      payments: payments.map(p => ({...p, receipt: p.receipt ? '[画像データ]' : null})), // 画像は除外して保存
      splitMethod,
      fixedAmounts,
      zeroPayment,
      updatedAt: new Date().toISOString()
    };
    
    saveToStorage(sessionCode, data);
  }, [participants, payments, splitMethod, fixedAmounts, zeroPayment, sessionCode]);

  const addParticipant = () => {
    const name = newName.trim();
    if (name && !participants.some(p => p.name === name)) {
      setParticipants(prev => [...prev, { id: Date.now().toString(), name }]);
      setNewName('');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setForm(f => ({...f, receipt: ev.target.result, receiptName: file.name}));
      reader.readAsDataURL(file);
    }
  };

  const savePayment = () => {
    if (!form.payerId || !form.amount) return alert('支払者と金額を入力してください');
    const data = { id: editingId || Date.now().toString(), payerId: form.payerId, desc: form.desc || '支払い', amount: Number(form.amount), receipt: form.receipt, receiptName: form.receiptName, excluded: [...form.excluded] };
    if (editingId) setPayments(prev => prev.map(p => p.id === editingId ? data : p));
    else setPayments(prev => [...prev, data]);
    resetForm();
  };

  const resetForm = () => {
    setForm({ payerId:'', desc:'', amount:'', inputMode:'free', receipt:null, receiptName:'', excluded:[] });
    setShowForm(false); setEditingId(null);
    if(fileRef.current) fileRef.current.value = '';
  };

  const editPayment = (p) => {
    setForm({ payerId: p.payerId, desc: p.desc, amount: String(p.amount), inputMode:'free', receipt: p.receipt, receiptName: p.receiptName || '', excluded: [...(p.excluded || [])] });
    setEditingId(p.id); setShowForm(true);
  };

  const toggleExcluded = (id) => setForm(f => ({ ...f, excluded: f.excluded.includes(id) ? f.excluded.filter(x=>x!==id) : [...f.excluded, id] }));

  const resetAll = () => {
    if (window.confirm('すべてリセットしますか？新しい精算コードが発行されます。')) {
      const newCode = generateCode();
      localStorage.removeItem(`warikan_${sessionCode}`);
      setParticipants([]); setPayments([]); setFixedAmounts({}); setZeroPayment({});
      setShowResults(false); setShowForm(false); setNewName(''); 
      setSessionCode(newCode);
      window.history.replaceState({}, '', `${window.location.pathname}?code=${newCode}`);
    }
  };

  const calcEqualShares = () => {
    const shares = {}; 
    participants.forEach(p => shares[p.id] = 0);
    payments.forEach(pay => {
      const eligible = participants.filter(p => !(pay.excluded || []).includes(p.id));
      if (eligible.length > 0) { 
        const share = pay.amount / eligible.length; 
        eligible.forEach(p => shares[p.id] += share); 
      }
    });
    return shares;
  };

  const calculate = () => {
    if (participants.length < 2 || payments.length === 0) return null;
    const equalShares = calcEqualShares();
    const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
    const paid = {}; 
    participants.forEach(p => paid[p.id] = 0); 
    payments.forEach(p => paid[p.payerId] += p.amount);
    const shouldPay = {};
    
    if (splitMethod === 'equal') {
      participants.forEach(p => shouldPay[p.id] = Math.round(equalShares[p.id]));
    } else {
      let fixedTotal = 0;
      const unfixedIds = [];
      participants.forEach(p => {
        if (zeroPayment[p.id]) {
          shouldPay[p.id] = 0;
        } else if (fixedAmounts[p.id] && fixedAmounts[p.id] > 0) {
          shouldPay[p.id] = fixedAmounts[p.id];
          fixedTotal += fixedAmounts[p.id];
        } else {
          unfixedIds.push(p.id);
        }
      });
      const remaining = totalAmount - fixedTotal;
      if (unfixedIds.length > 0 && remaining > 0) {
        let unfixedEqualTotal = 0;
        unfixedIds.forEach(id => { unfixedEqualTotal += equalShares[id] || 0; });
        if (unfixedEqualTotal > 0) {
          unfixedIds.forEach(id => {
            const ratio = (equalShares[id] || 0) / unfixedEqualTotal;
            shouldPay[id] = Math.round(remaining * ratio);
          });
        } else {
          const perPerson = Math.round(remaining / unfixedIds.length);
          unfixedIds.forEach(id => { shouldPay[id] = perPerson; });
        }
      } else if (unfixedIds.length > 0) {
        unfixedIds.forEach(id => { shouldPay[id] = 0; });
      }
    }
    
    const balance = {}; 
    participants.forEach(p => balance[p.id] = paid[p.id] - shouldPay[p.id]);
    const creditors = participants.filter(p => balance[p.id] > 0).map(p => ({...p, amt: balance[p.id]})).sort((a,b) => b.amt - a.amt);
    const debtors = participants.filter(p => balance[p.id] < 0).map(p => ({...p, amt: -balance[p.id]})).sort((a,b) => b.amt - a.amt);
    const settlements = []; 
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amt = Math.min(creditors[ci].amt, debtors[di].amt);
      if (amt > 0) settlements.push({ from: debtors[di].name, to: creditors[ci].name, amount: amt });
      creditors[ci].amt -= amt; debtors[di].amt -= amt;
      if (creditors[ci].amt === 0) ci++; if (debtors[di].amt === 0) di++;
    }
    return { totalAmount, equalShares, paid, shouldPay, settlements };
  };

  const results = calculate();
  const equalShares = calcEqualShares();
  
  const copyUrl = () => { 
    const url = `${window.location.origin}${window.location.pathname}?code=${sessionCode}`;
    navigator.clipboard.writeText(url); 
    setCopied(true); 
    setTimeout(() => setCopied(false), 2000); 
  };

  const generatePDF = () => {
    if (!results) return alert('精算結果がありません');
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return alert('ポップアップを許可してください');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>精算レポート - ${sessionCode}</title><style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#4f46e5}h2{color:#059669;margin-top:30px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}.settlement{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0}.receipt{max-width:300px}@media print{button{display:none}}</style></head><body><h1>💰 精算レポート</h1><p>精算コード: ${sessionCode}</p><p>作成日: ${new Date().toLocaleString('ja-JP')}</p><h2>基本情報</h2><table><tr><th>合計</th><td>${results.totalAmount.toLocaleString()}円</td></tr><tr><th>参加者</th><td>${participants.map(p=>p.name).join(', ')}</td></tr></table><h2>支払い明細</h2><table><tr><th>内容</th><th>支払者</th><th>金額</th><th>除外</th></tr>${payments.map(p=>`<tr><td>${p.desc}</td><td>${participants.find(x=>x.id===p.payerId)?.name||''}</td><td>${p.amount.toLocaleString()}円</td><td>${(p.excluded||[]).map(id=>participants.find(x=>x.id===id)?.name).join(', ')||'-'}</td></tr>`).join('')}</table><h2>計算結果</h2><table><tr><th>名前</th><th>支払</th><th>均等</th><th>負担</th></tr>${participants.map(p=>`<tr><td>${p.name}</td><td>${(results.paid[p.id]||0).toLocaleString()}円</td><td>${Math.round(equalShares[p.id]||0).toLocaleString()}円</td><td>${(results.shouldPay[p.id]||0).toLocaleString()}円</td></tr>`).join('')}</table><h2>送金</h2>${results.settlements.length===0?'<p>精算不要</p>':results.settlements.map(s=>`<div class="settlement">${s.from} → ${s.to}: ${s.amount.toLocaleString()}円</div>`).join('')}<br><button onclick="window.print()" style="padding:10px 30px;font-size:16px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ 印刷/PDF保存</button></body></html>`);
    w.document.close();
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><p className="text-lg">読み込み中...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-3">💰 割り勘精算アプリ</h1>
          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-gray-500">精算コード</span>
                <p className="text-xl font-mono font-bold text-indigo-600">{sessionCode}</p>
              </div>
              {saveStatus && <span className="text-xs text-green-600">✓ {saveStatus}</span>}
            </div>
            <button onClick={copyUrl} className="mt-2 w-full bg-indigo-500 text-white py-2 rounded-lg text-sm">{copied ? '✓ コピー済み' : '📋 共有URLコピー'}</button>
            <p className="text-xs text-gray-400 mt-1 text-center">※同じURLを開くとデータが共有されます</p>
          </div>
          <div className="mb-4">
            <h2 className="font-semibold mb-2">👥 参加者 ({participants.length}人)</h2>
            <div className="flex gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addParticipant()} placeholder="名前" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addParticipant} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">{participants.map(p => (
              <span key={p.id} className="bg-blue-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">{p.name}<button onClick={() => { setParticipants(prev => prev.filter(x => x.id !== p.id)); setPayments(prev => prev.filter(x => x.payerId !== p.id)); }} className="text-red-500 ml-1">×</button></span>
            ))}</div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">💳 支払い ({payments.length}件)</h2>
              {!showForm && <button onClick={() => setShowForm(true)} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+ 追加</button>}
            </div>
            {showForm && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                <div><label className="text-xs text-gray-600">支払者</label><select value={form.payerId} onChange={e => setForm({...form, payerId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">選択</option>{participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="text-xs text-gray-600">内容</label><input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="例: 夕食代" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-600">金額</label>
                  <div className="flex gap-2 mb-2"><button type="button" onClick={() => setForm({...form, inputMode:'free'})} className={`flex-1 py-1 rounded text-sm ${form.inputMode === 'free' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>自由入力</button><button type="button" onClick={() => setForm({...form, inputMode:'select'})} className={`flex-1 py-1 rounded text-sm ${form.inputMode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>500円単位</button></div>
                  {form.inputMode === 'free' ? <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="金額" className="w-full border rounded-lg px-3 py-2 text-sm" /> : <select value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">選択</option>{amountOptions.map(a => <option key={a} value={a}>{a.toLocaleString()}円</option>)}</select>}
                </div>
                <div><label className="text-xs text-gray-600">除外する人</label><div className="flex flex-wrap gap-1">{participants.map(p => (<button key={p.id} type="button" onClick={() => toggleExcluded(p.id)} className={`px-2 py-1 rounded text-xs ${form.excluded.includes(p.id) ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>{p.name}{form.excluded.includes(p.id) && ' ✓'}</button>))}</div></div>
                <div><label className="text-xs text-gray-600">📎 レシート</label><input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="w-full text-sm border rounded-lg p-2" />{form.receiptName && <p className="text-xs text-green-600 mt-1">✓ {form.receiptName}</p>}</div>
                <div className="flex gap-2"><button type="button" onClick={savePayment} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm">{editingId ? '更新' : '登録'}</button><button type="button" onClick={resetForm} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button></div>
              </div>
            )}
            {payments.map(p => (
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2 flex justify-between">
                <div><p className="font-medium text-sm">{p.desc}</p><p className="text-xs text-gray-500">{participants.find(x => x.id === p.payerId)?.name}が支払い</p><p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>{(p.excluded||[]).length > 0 && <p className="text-xs text-red-500">除外: {(p.excluded||[]).map(id => participants.find(x=>x.id===id)?.name).join(', ')}</p>}</div>
                <div className="flex flex-col gap-1"><button onClick={() => editPayment(p)} className="text-blue-500 text-xs">✏️編集</button>{p.receipt && <button onClick={() => setViewReceipt(p)} className="text-green-600 text-xs">🧾詳細</button>}<button onClick={() => setPayments(prev => prev.filter(x => x.id !== p.id))} className="text-red-500 text-xs">🗑削除</button></div>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <h2 className="font-semibold mb-2">⚖️ 割り勘方法</h2>
            <div className="flex gap-2 mb-2"><button onClick={() => setSplitMethod('equal')} className={`flex-1 py-2 rounded-lg text-sm ${splitMethod === 'equal' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>均等割り</button><button onClick={() => setSplitMethod('fixed')} className={`flex-1 py-2 rounded-lg text-sm ${splitMethod === 'fixed' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>傾斜割り勘</button></div>
            {splitMethod === 'fixed' && participants.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3"><p className="text-xs text-gray-400 mb-2">※均等割りの場合（参考）/ 未入力者で残額を分配</p><div className="space-y-2">{participants.map(p => (
                <div key={p.id} className="flex items-center gap-2"><div className="w-20 text-sm font-medium">{p.name}</div><span className="text-xs text-gray-400 w-20">({Math.round(equalShares[p.id]||0).toLocaleString()}円)</span><label className="flex items-center gap-1"><input type="checkbox" checked={zeroPayment[p.id]||false} onChange={e => setZeroPayment({...zeroPayment,[p.id]:e.target.checked})} className="w-4 h-4" /><span className="text-xs">0円</span></label><input type="number" value={fixedAmounts[p.id]||''} onChange={e => setFixedAmounts({...fixedAmounts,[p.id]:Number(e.target.value)})} disabled={zeroPayment[p.id]} placeholder="金額" className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-200" /><span className="text-xs">円</span></div>
              ))}</div></div>
            )}
          </div>
          <div className="space-y-2">
            <button onClick={() => setShowResults(true)} disabled={!results} className="w-full bg-indigo-500 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300">🧮 精算結果を表示</button>
            <button onClick={resetAll} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold">🔄 すべてリセット</button>
          </div>
          {showResults && results && (
            <div className="bg-green-50 rounded-lg p-4 mt-4">
              <h2 className="text-lg font-bold text-green-700 mb-2">📊 精算結果</h2>
              <p className="text-xs text-gray-500 mb-3">精算コード: {sessionCode}</p>
              <div className="bg-white rounded-lg p-3 mb-3 text-sm"><div className="flex justify-between"><span>合計金額:</span><span className="font-bold">{results.totalAmount.toLocaleString()}円</span></div></div>
              <div className="bg-white rounded-lg p-3 mb-3"><h3 className="font-semibold text-sm mb-2">👤 各人の収支</h3>{participants.map(p => (<div key={p.id} className="text-sm border-b pb-1 mb-1"><div className="font-medium">{p.name}</div><div className="flex justify-between text-xs text-gray-600"><span>支払: {(results.paid[p.id]||0).toLocaleString()}円</span><span>均等: {Math.round(equalShares[p.id]||0).toLocaleString()}円</span><span className="font-bold text-indigo-600">負担: {(results.shouldPay[p.id]||0).toLocaleString()}円</span></div></div>))}</div>
              <div className="bg-white rounded-lg p-3 mb-3"><h3 className="font-semibold text-sm mb-2">💸 送金アクション</h3>{results.settlements.length === 0 ? <p className="text-gray-500 text-sm">精算不要</p> : results.settlements.map((s,i) => (<div key={i} className="bg-green-100 rounded-lg p-3 mb-2 flex justify-between items-center"><span className="font-medium">{s.from} → {s.to}</span><span className="text-xl font-bold text-green-700">{s.amount.toLocaleString()}円</span></div>))}</div>
              <button onClick={generatePDF} className="w-full bg-purple-500 text-white py-2 rounded-lg text-sm">📄 PDFレポート出力</button>
            </div>
          )}
        </div>
      </div>
      {viewReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setViewReceipt(null)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2">🧾 {viewReceipt.desc}</h3>
            <p className="text-sm text-gray-600">支払者: {participants.find(x=>x.id===viewReceipt.payerId)?.name}</p>
            <p className="text-lg font-bold text-indigo-600 mb-3">{viewReceipt.amount.toLocaleString()}円</p>
            {viewReceipt.receipt?.startsWith('data:image') ? <img src={viewReceipt.receipt} alt="レシート" className="w-full rounded-lg" /> : <p className="text-sm">📄 {viewReceipt.receiptName}</p>}
            <button onClick={() => setViewReceipt(null)} className="w-full mt-4 bg-gray-300 py-2 rounded-lg">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
