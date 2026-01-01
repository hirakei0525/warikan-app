import React, { useState, useRef } from 'react';

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

export default function App() {
  const [sessionCode, setSessionCode] = useState(() => generateCode());
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
  const fileRef = useRef(null);

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
    const paymentData = { 
      id: editingId || Date.now().toString(), 
      payerId: form.payerId, 
      desc: form.desc || '支払い', 
      amount: Number(form.amount), 
      receipt: form.receipt,
      receiptName: form.receiptName, 
      excluded: [...form.excluded] 
    };
    if (editingId) {
      setPayments(prev => prev.map(p => p.id === editingId ? paymentData : p));
    } else {
      setPayments(prev => [...prev, paymentData]);
    }
    resetForm();
  };

  const resetForm = () => {
    setForm({ payerId:'', desc:'', amount:'', inputMode:'free', receipt:null, receiptName:'', excluded:[] });
    setShowForm(false);
    setEditingId(null);
    if(fileRef.current) fileRef.current.value = '';
  };

  const editPayment = (p) => {
    setForm({ payerId: p.payerId, desc: p.desc, amount: String(p.amount), inputMode:'free', receipt: p.receipt, receiptName: p.receiptName || '', excluded: [...p.excluded] });
    setEditingId(p.id);
    setShowForm(true);
  };

  const toggleExcluded = (id) => {
    setForm(f => ({ ...f, excluded: f.excluded.includes(id) ? f.excluded.filter(x=>x!==id) : [...f.excluded, id] }));
  };

  const resetAll = () => {
    if (window.confirm('すべてのデータをリセットしますか？')) {
      setParticipants([]); setPayments([]); setFixedAmounts({}); setZeroPayment({});
      setShowResults(false); setShowForm(false); setNewName(''); setSessionCode(generateCode());
    }
  };

  const calcEqualShares = () => {
    const shares = {};
    participants.forEach(p => shares[p.id] = 0);
    payments.forEach(payment => {
      const eligible = participants.filter(p => !payment.excluded.includes(p.id));
      if (eligible.length > 0) {
        const share = payment.amount / eligible.length;
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
      participants.forEach(p => {
        if (zeroPayment[p.id]) shouldPay[p.id] = 0;
        else if (fixedAmounts[p.id]) shouldPay[p.id] = fixedAmounts[p.id];
        else shouldPay[p.id] = Math.round(equalShares[p.id]);
      });
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
      if (creditors[ci].amt === 0) ci++;
      if (debtors[di].amt === 0) di++;
    }
    return { totalAmount, equalShares, paid, shouldPay, settlements };
  };

  const results = calculate();
  const equalShares = calcEqualShares();

  const copyUrl = () => { 
    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?code=${sessionCode}`); 
    setCopied(true); setTimeout(() => setCopied(false), 2000); 
  };

  const generatePDF = () => {
    if (!results) { alert('精算結果がありません'); return; }
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('ポップアップがブロックされました。許可してください。'); return; }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>精算レポート - ${sessionCode}</title>
    <style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}
    h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}
    h2{color:#059669;margin-top:30px}table{width:100%;border-collapse:collapse;margin:10px 0}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}
    .settlement{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0;font-size:18px}
    .receipt{max-width:300px;margin:10px 0;border:1px solid #ddd;border-radius:4px}
    .amount{font-weight:bold;color:#4f46e5}
    @media print{button{display:none}}</style></head><body>
    <h1>💰 割り勘精算レポート</h1>
    <p><strong>精算コード:</strong> ${sessionCode}</p>
    <p><strong>作成日:</strong> ${new Date().toLocaleString('ja-JP')}</p>
    <h2>📋 基本情報</h2>
    <table><tr><th>合計金額</th><td class="amount">${results.totalAmount.toLocaleString()}円</td></tr>
    <tr><th>参加者</th><td>${participants.map(p=>p.name).join(', ')}</td></tr>
    <tr><th>割り勘方法</th><td>${splitMethod === 'equal' ? '均等割り' : '傾斜割り勘'}</td></tr></table>
    <h2>💳 支払い明細</h2><table><tr><th>内容</th><th>支払者</th><th>金額</th><th>除外者</th></tr>
    ${payments.map(p => `<tr><td>${p.desc}</td><td>${participants.find(x=>x.id===p.payerId)?.name}</td>
    <td class="amount">${p.amount.toLocaleString()}円</td>
    <td>${p.excluded.length > 0 ? p.excluded.map(id=>participants.find(x=>x.id===id)?.name).join(', ') : '-'}</td></tr>`).join('')}</table>
    <h2>🧮 計算過程</h2><table><tr><th>参加者</th><th>支払額</th><th>均等負担額</th><th>最終負担額</th><th>差額</th></tr>
    ${participants.map(p => `<tr><td>${p.name}</td><td>${(results.paid[p.id]||0).toLocaleString()}円</td>
    <td>${Math.round(equalShares[p.id]||0).toLocaleString()}円</td>
    <td class="amount">${(results.shouldPay[p.id]||0).toLocaleString()}円</td>
    <td>${(results.paid[p.id] - results.shouldPay[p.id]).toLocaleString()}円</td></tr>`).join('')}</table>
    <h2>💸 精算アクション</h2>
    ${results.settlements.length === 0 ? '<p>精算の必要はありません</p>' : 
    results.settlements.map(s => `<div class="settlement"><strong>${s.from}</strong> → <strong>${s.to}</strong>: <span class="amount">${s.amount.toLocaleString()}円</span></div>`).join('')}
    <h2>📎 レシート画像</h2>
    ${payments.filter(p=>p.receipt).map(p => `<div><p><strong>${p.desc}</strong> (${p.amount.toLocaleString()}円)</p>
    ${p.receipt && p.receipt.startsWith('data:image') ? `<img src="${p.receipt}" class="receipt">` : `<p>📄 ${p.receiptName || 'ファイル'}</p>`}</div>`).join('') || '<p>レシート画像はありません</p>'}
    <div style="margin-top:40px;text-align:center;">
      <button onclick="window.print()" style="padding:15px 40px;font-size:18px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ 印刷 / PDF保存</button>
    </div>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-3">💰 割り勘精算アプリ</h1>
          
          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <span className="text-xs text-gray-500">精算コード</span>
            <p className="text-xl font-mono font-bold text-indigo-600">{sessionCode}</p>
            <button onClick={copyUrl} className="mt-2 w-full bg-indigo-500 text-white py-2 rounded-lg text-sm">{copied ? '✓ コピー済み' : '📋 共有URLコピー'}</button>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">👥 参加者 ({participants.length}人)</h2>
            <div className="flex gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addParticipant()} placeholder="名前" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addParticipant} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm shrink-0">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <span key={p.id} className="bg-blue-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">{p.name}
                  <button onClick={() => { setParticipants(prev => prev.filter(x => x.id !== p.id)); setPayments(prev => prev.filter(x => x.payerId !== p.id)); }} className="text-red-500 ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">💳 支払い ({payments.length}件)</h2>
              {!showForm && <button onClick={() => setShowForm(true)} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+ 追加</button>}
            </div>
            
            {showForm && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                <div><label className="text-xs text-gray-600">支払者</label>
                  <select value={form.payerId} onChange={e => setForm({...form, payerId: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">選択</option>{participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div><label className="text-xs text-gray-600">内容</label>
                  <input value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="例: 夕食代" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-600">金額</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setForm({...form, inputMode:'free'})} className={`flex-1 py-1 rounded text-sm ${form.inputMode === 'free' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>自由入力</button>
                    <button type="button" onClick={() => setForm({...form, inputMode:'select'})} className={`flex-1 py-1 rounded text-sm ${form.inputMode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>500円単位</button>
                  </div>
                  {form.inputMode === 'free' ? <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="金額" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  : <select value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">選択</option>{amountOptions.map(a => <option key={a} value={a}>{a.toLocaleString()}円</option>)}
                    </select>}
                </div>
                <div><label className="text-xs text-gray-600">除外する人</label>
                  <div className="flex flex-wrap gap-1">{participants.map(p => (
                    <button key={p.id} type="button" onClick={() => toggleExcluded(p.id)} className={`px-2 py-1 rounded text-xs ${form.excluded.includes(p.id) ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>{p.name}{form.excluded.includes(p.id) && ' ✓'}</button>
                  ))}</div></div>
                <div><label className="text-xs text-gray-600">📎 レシート画像</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="w-full text-sm border rounded-lg p-2" />
                  {form.receiptName && <p className="text-xs text-green-600 mt-1">✓ {form.receiptName}</p>}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={savePayment} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm">{editingId ? '更新' : '登録'}</button>
                  <button type="button" onClick={resetForm} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button>
                </div>
              </div>
            )}
            
            {payments.map(p => (
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.desc}</p>
                    <p className="text-xs text-gray-500">{participants.find(x => x.id === p.payerId)?.name}が支払い</p>
                    <p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>
                    {p.excluded.length > 0 && <p className="text-xs text-red-500">除外: {p.excluded.map(id => participants.find(x=>x.id===id)?.name).join(', ')}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => editPayment(p)} className="text-blue-500 text-xs">✏️編集</button>
                    {p.receipt && <button onClick={() => setViewReceipt(p)} className="text-green-600 text-xs">🧾詳細</button>}
                    <button onClick={() => setPayments(prev => prev.filter(x => x.id !== p.id))} className="text-red-500 text-xs">🗑削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">⚖️ 割り勘方法</h2>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setSplitMethod('equal')} className={`flex-1 py-2 rounded-lg text-sm ${splitMethod === 'equal' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>均等割り</button>
              <button onClick={() => setSplitMethod('fixed')} className={`flex-1 py-2 rounded-lg text-sm ${splitMethod === 'fixed' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>傾斜割り勘</button>
            </div>
            {splitMethod === 'fixed' && participants.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-2">※均等割りの場合の負担額（参考）</p>
                <div className="space-y-2">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="w-20 text-sm font-medium truncate">{p.name}</div>
                      <span className="text-xs text-gray-400 w-16">({Math.round(equalShares[p.id]||0).toLocaleString()}円)</span>
                      <label className="flex items-center gap-1 shrink-0"><input type="checkbox" checked={zeroPayment[p.id]||false} onChange={e => setZeroPayment({...zeroPayment,[p.id]:e.target.checked})} className="w-4 h-4" />
