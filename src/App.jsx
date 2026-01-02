import { useState, useRef, useEffect } from 'react';

const generateCode = () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
const getParam = (key) => new URLSearchParams(window.location.search).get(key);
const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

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
  const fileRef = useRef(null);
  const init = useRef(false);

  // URL からデータ読み込み
  useEffect(() => {
    const d = getParam('d');
    if (d) {
      try {
        const json = JSON.parse(decodeURIComponent(atob(d)));
        setParticipants(json.p || []);
        setPayments((json.y || []).map(x => ({...x, receipt: null})));
        setMethod(json.m || 'equal');
        setFixed(json.f || {});
        setZero(json.z || {});
      } catch {}
    }
    if (!getParam('code')) window.history.replaceState({}, '', `?code=${code}`);
    setLoading(false);
    init.current = true;
  }, []);

  // データをURLに反映
  const getShareUrl = () => {
    const d = btoa(encodeURIComponent(JSON.stringify({
      p: participants,
      y: payments.map(x => ({...x, receipt: null})),
      m: method, f: fixed, z: zero
    })));
    return `${location.origin}${location.pathname}?code=${code}&d=${d}`;
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

  const reset = () => { if (confirm('リセット？')) { setParticipants([]); setPayments([]); setFixed({}); setZero({}); setShowRes(false); setCode(generateCode()); window.history.replaceState({}, '', `?code=${generateCode()}`); }};

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
    const eq = eqShare(), total = payments.reduce((a,b) => a + b.amount, 0);
    const paid = {}; participants.forEach(p => paid[p.id] = 0); payments.forEach(p => paid[p.payer] += p.amount);
    const should = {};
    if (method === 'equal') { participants.forEach(p => should[p.id] = Math.round(eq[p.id])); }
    else {
      let ft = 0; const uf = [];
      participants.forEach(p => {
        if (zero[p.id]) should[p.id] = 0;
        else if (fixed[p.id] > 0) { should[p.id] = fixed[p.id]; ft += fixed[p.id]; }
        else uf.push(p.id);
      });
      const rem = total - ft;
      if (uf.length && rem > 0) {
        let ueq = 0; uf.forEach(id => ueq += eq[id]||0);
        uf.forEach(id => should[id] = ueq > 0 ? Math.round(rem * (eq[id]||0) / ueq) : Math.round(rem / uf.length));
      } else uf.forEach(id => should[id] = 0);
    }
    const bal = {}; participants.forEach(p => bal[p.id] = paid[p.id] - should[p.id]);
    const cr = participants.filter(p => bal[p.id] > 0).map(p => ({...p, a: bal[p.id]})).sort((a,b) => b.a - a.a);
    const dr = participants.filter(p => bal[p.id] < 0).map(p => ({...p, a: -bal[p.id]})).sort((a,b) => b.a - a.a);
    const set = []; let ci=0, di=0;
    while (ci < cr.length && di < dr.length) {
      const a = Math.min(cr[ci].a, dr[di].a);
      if (a > 0) set.push({ from: dr[di].name, to: cr[ci].name, amount: a });
      cr[ci].a -= a; dr[di].a -= a;
      if (!cr[ci].a) ci++; if (!dr[di].a) di++;
    }
    return { total, eq, paid, should, set };
  };

  const res = calc(), eq = eqShare();
  const copy = () => { navigator.clipboard.writeText(getShareUrl()); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const pdf = () => {
    if (!res) return;
    const w = window.open('','_blank');
    w.document.write(`<html><head><meta charset="utf-8"><title>精算</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}.s{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0}</style></head><body><h1>💰精算レポート</h1><p>コード:${code} / ${new Date().toLocaleString('ja-JP')}</p><h2>支払い</h2><table><tr><th>内容</th><th>支払者</th><th>金額</th></tr>${payments.map(p=>`<tr><td>${p.desc}</td><td>${participants.find(x=>x.id===p.payer)?.name}</td><td>${p.amount.toLocaleString()}円</td></tr>`).join('')}</table><h2>結果</h2><table><tr><th>名前</th><th>支払</th><th>負担</th></tr>${participants.map(p=>`<tr><td>${p.name}</td><td>${(res.paid[p.id]||0).toLocaleString()}円</td><td>${(res.should[p.id]||0).toLocaleString()}円</td></tr>`).join('')}</table><h2>送金</h2>${res.set.map(s=>`<div class="s">${s.from}→${s.to}: ${s.amount.toLocaleString()}円</div>`).join('')||'精算不要'}<br><button onclick="print()">🖨️印刷</button></body></html>`);
    w.document.close();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>読み込み中...</p></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-3">💰 割り勘精算アプリ</h1>
          
          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <span className="text-xs text-gray-500">精算コード</span>
            <p className="text-xl font-mono font-bold text-indigo-600">{code}</p>
            <button onClick={copy} className="mt-2 w-full bg-indigo-500 text-white py-2 rounded-lg text-sm">{copied ? '✓コピー済み' : '📋 共有URLコピー'}</button>
            <p className="text-xs text-gray-400 mt-1 text-center">※データ入力後にコピーしてください</p>
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
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                <select value={form.payer} onChange={e=>setForm({...form,payer:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">支払者</option>{participants.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})} placeholder="内容" className="w-full border rounded-lg px-3 py-2 text-sm"/>
                <div className="flex gap-2 mb-1">
                  <button type="button" onClick={()=>setForm({...form,mode:'free'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='free'?'bg-blue-500 text-white':'bg-gray-200'}`}>自由入力</button>
                  <button type="button" onClick={()=>setForm({...form,mode:'select'})} className={`flex-1 py-1 rounded text-sm ${form.mode==='select'?'bg-blue-500 text-white':'bg-gray-200'}`}>500円単位</button>
                </div>
                {form.mode==='free'?<input type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="金額" className="w-full border rounded-lg px-3 py-2 text-sm"/>:<select value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">金額選択</option>{amountOptions.map(a=><option key={a} value={a}>{a.toLocaleString()}円</option>)}</select>}
                <div className="flex flex-wrap gap-1">{participants.map(p=>(<button key={p.id} type="button" onClick={()=>setForm({...form,excl:form.excl.includes(p.id)?form.excl.filter(x=>x!==p.id):[...form.excl,p.id]})} className={`px-2 py-1 rounded text-xs ${form.excl.includes(p.id)?'bg-red-500 text-white':'bg-gray-200'}`}>{p.name}{form.excl.includes(p.id)&&'✓'}</button>))}</div>
                <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files?.[0];if(f){const r=new FileReader();r.onload=ev=>setForm({...form,receipt:ev.target.result,receiptName:f.name});r.readAsDataURL(f);}}} className="w-full text-sm"/>
                <div className="flex gap-2"><button onClick={savePay} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm">{editId?'更新':'登録'}</button><button onClick={()=>{setShowForm(false);setEditId(null);setForm({payer:'',desc:'',amount:'',mode:'free',receipt:null,receiptName:'',excl:[]});}} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button></div>
              </div>
            )}
            {payments.map(p=>(
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2 flex justify-between">
                <div><p className="font-medium text-sm">{p.desc}</p><p className="text-xs text-gray-500">{participants.find(x=>x.id===p.payer)?.name}</p><p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>{(p.excl||[]).length>0&&<p className="text-xs text-red-500">除外:{(p.excl||[]).map(id=>participants.find(x=>x.id===id)?.name).join(',')}</p>}</div>
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
                <p className="text-xs text-gray-400">※参考均等額 / 未入力者で残額分配</p>
                {participants.map(p=>(
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-16 text-sm">{p.name}</span>
                    <span className="text-xs text-gray-400 w-16">({Math.round(eq[p.id]||0)}円)</span>
                    <label className="flex items-center"><input type="checkbox" checked={zero[p.id]||false} onChange={e=>setZero({...zero,[p.id]:e.target.checked})} className="mr-1"/><span className="text-xs">0円</span></label>
                    <input type="number" value={fixed[p.id]||''} onChange={e=>setFixed({...fixed,[p.id]:+e.target.value})} disabled={zero[p.id]} placeholder="金額" className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-200"/>
                    <span className="text-xs">円</span>
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
            <div className="bg-green-50 rounded-lg p-4 mt-4">
              <h2 className="text-lg font-bold text-green-700 mb-2">📊 精算結果</h2>
              <div className="bg-white rounded-lg p-3 mb-3"><div className="flex justify-between text-sm"><span>合計:</span><span className="font-bold">{res.total.toLocaleString()}円</span></div></div>
              <div className="bg-white rounded-lg p-3 mb-3">{participants.map(p=>(<div key={p.id} className="text-sm border-b pb-1 mb-1"><span className="font-medium">{p.name}</span><div className="flex justify-between text-xs text-gray-500"><span>支払:{(res.paid[p.id]||0).toLocaleString()}円</span><span>均等:{Math.round(eq[p.id]||0).toLocaleString()}円</span><span className="font-bold text-indigo-600">負担:{(res.should[p.id]||0).toLocaleString()}円</span></div></div>))}</div>
              <div className="bg-white rounded-lg p-3 mb-3">{res.set.length?res.set.map((s,i)=>(<div key={i} className="bg-green-100 rounded-lg p-3 mb-2 flex justify-between"><span>{s.from}→{s.to}</span><span className="font-bold text-green-700">{s.amount.toLocaleString()}円</span></div>)):<p className="text-gray-500">精算不要</p>}</div>
              <button onClick={pdf} className="w-full bg-purple-500 text-white py-2 rounded-lg text-sm">📄 PDF出力</button>
            </div>
          )}
        </div>
      </div>
      {viewRec&&(<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={()=>setViewRec(null)}><div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={e=>e.stopPropagation()}><h3 className="font-bold mb-2">🧾{viewRec.desc}</h3><p className="text-indigo-600 font-bold mb-2">{viewRec.amount.toLocaleString()}円</p>{viewRec.receipt?.startsWith('data:image')&&<img src={viewRec.receipt} className="w-full rounded"/>}<button onClick={()=>setViewRec(null)} className="w-full mt-4 bg-gray-300 py-2 rounded-lg">閉じる</button></div></div>)}
    </div>
  );
}
