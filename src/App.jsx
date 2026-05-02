import { useState, useRef, useEffect, useCallback } from 'react';

const generateCode = () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('').sort(() => Math.random() - 0.5).slice(0, 8).join('');
const getParam = (key) => new URLSearchParams(window.location.search).get(key);
const amountOptions = [500,1000,1500,2000,2500,3000,3500,4000,4500,5000,5500,6000,6500,7000,7500,8000,8500,9000,9500,10000];

const api = {
  async save(code, data) {
    try {
      const r = await fetch(`/api/bins/${encodeURIComponent(code)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return r.ok;
    } catch (e) { console.error('Save error:', e); return false; }
  },

  async load(code) {
    try {
      const r = await fetch(`/api/bins/${encodeURIComponent(code)}`);
      if (r.status === 404) return null;
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { console.error('Load error:', e); return null; }
  },

  async saveReport(reportCode, data) {
    try {
      const r = await fetch(`/api/reports/${encodeURIComponent(reportCode)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return r.ok;
    } catch (e) { console.error('SaveReport error:', e); return false; }
  },

  async loadReport(reportCode) {
    try {
      const r = await fetch(`/api/reports/${encodeURIComponent(reportCode)}`);
      if (r.status === 404) return null;
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { console.error('LoadReport error:', e); return null; }
  }
};

// パスワードのハッシュ化（簡易）
const hashPassword = async (pw) => {
  if (!pw) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ============================
// レポートビューコンポーネント
// ============================
function ReportView({ reportCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pwRequired, setPwRequired] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const load = async () => {
      const record = await api.loadReport(reportCode);
      if (!record) { setLoading(false); return; }
      setData(record);
      if (record.passwordHash) {
        setPwRequired(true);
      } else {
        setUnlocked(true);
      }
      setLoading(false);
    };
    load();
  }, [reportCode]);

  const handleUnlock = async () => {
    const hash = await hashPassword(pwInput);
    if (hash === data.passwordHash) {
      setUnlocked(true);
      setPwError('');
    } else {
      setPwError('パスワードが違います');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <p className="text-lg">読み込み中...</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl p-6 text-center shadow-lg">
        <p className="text-2xl mb-2">🔍</p>
        <p className="font-bold">レポートが見つかりません</p>
        <p className="text-sm text-gray-500 mt-1">URLが正しいか確認してください</p>
      </div>
    </div>
  );

  if (pwRequired && !unlocked) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-xl p-6 shadow-lg max-w-xs w-full">
        <h2 className="text-lg font-bold text-center mb-4">🔒 パスワードが必要です</h2>
        <input
          type="password"
          value={pwInput}
          onChange={e => setPwInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="パスワードを入力"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
        />
        {pwError && <p className="text-red-500 text-xs mb-2">{pwError}</p>}
        <button onClick={handleUnlock} className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold">
          確認
        </button>
      </div>
    </div>
  );

  const { participants, payments, res, settlements, collector, method, createdAt } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-1">📊 精算レポート</h1>
          <p className="text-xs text-center text-gray-400 mb-3">
            作成日時: {new Date(createdAt).toLocaleString('ja-JP')}
          </p>

          <div className="bg-white rounded-lg p-3 mb-3 border">
            <div className="flex justify-between">
              <span>合計:</span>
              <span className="font-bold text-lg">{res.total.toLocaleString()}円</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>参加者:</span>
              <span>{participants.map(p => p.name).join(', ')}（{participants.length}名）</span>
            </div>
            {collector && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>💼 幹事:</span>
                <span>{participants.find(p => p.id === collector)?.name}</span>
              </div>
            )}
          </div>

          <h3 className="font-semibold text-sm mb-2">💳 支払い明細</h3>
          <div className="mb-3">
            {payments.map(p => (
              <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex justify-between">
                  <span className="font-medium text-sm">{p.desc}</span>
                  <span className="font-bold text-indigo-600">{p.amount.toLocaleString()}円</span>
                </div>
                <p className="text-xs text-gray-500">支払者: {participants.find(x => x.id === p.payer)?.name}</p>
                {(p.excl || []).length > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    🚫 除外: {(p.excl || []).map(id => participants.find(x => x.id === id)?.name).filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-sm mb-2">👤 各人の収支</h3>
          <div className="bg-white rounded-lg border p-3 mb-3">
            {participants.map(p => (
              <div key={p.id} className="text-sm border-b pb-2 mb-2 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${res.bal[p.id] > 0 ? 'bg-green-100 text-green-700' : res.bal[p.id] < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                    {res.bal[p.id] > 0 ? `+${res.bal[p.id].toLocaleString()}円（受取）` : res.bal[p.id] < 0 ? `${res.bal[p.id].toLocaleString()}円（支払）` : '±0円'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>支払済: {(res.paid[p.id] || 0).toLocaleString()}円</span>
                  <span>負担: {(res.should[p.id] || 0).toLocaleString()}円</span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-sm mb-2">💸 送金アクション</h3>
          <div className="bg-green-50 rounded-lg p-3">
            {settlements.length ? settlements.map((s, i) => (
              <div key={s.id || i} className="bg-green-100 rounded-lg p-3 mb-2 flex justify-between items-center">
                <span className="font-medium">{s.from} → {s.to}</span>
                <span className="text-xl font-bold text-green-700">{s.amount.toLocaleString()}円</span>
              </div>
            )) : <p className="text-gray-500 text-sm">精算不要 🎉</p>}
          </div>

          <button
            onClick={() => window.print()}
            className="w-full mt-4 bg-purple-500 text-white py-2 rounded-lg text-sm"
          >
            🖨️ 印刷 / PDF保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================
// レポートURL共有モーダル
// ============================
function ShareReportModal({ onClose, onShare }) {
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (pw && pw !== pwConfirm) { setError('パスワードが一致しません'); return; }
    if (pw && pw.length < 4) { setError('パスワードは4文字以上にしてください'); return; }
    setError('');
    setLoading(true);
    const url = await onShare(pw || '');
    setShareUrl(url);
    setLoading(false);
    setDone(true);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        {!done ? (
          <>
            <h2 className="text-lg font-bold mb-3 text-center">📤 精算レポートをURL共有</h2>
            <p className="text-xs text-gray-500 mb-4">
              現在の精算結果をURLで共有できます。パスワードは任意です。
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600">🔒 パスワード（任意）</label>
                <input
                  type="password"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  placeholder="設定しない場合は空白"
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              {pw && (
                <div>
                  <label className="text-xs text-gray-600">🔒 パスワード確認</label>
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    placeholder="もう一度入力"
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              )}
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700">
                ⚠️ レシート画像は共有レポートに含まれません
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleShare} disabled={loading} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold disabled:bg-gray-300">
                {loading ? '生成中...' : pw ? '🔒 パスワード付きで共有' : '🔓 URLを生成'}
              </button>
              <button onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded-lg text-sm">
                キャンセル
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-2 text-center text-green-600">✅ URLを生成しました</h2>
            {pw && <p className="text-xs text-center text-gray-500 mb-3">🔒 パスワード保護付き</p>}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 break-all text-xs text-gray-700 border">
              {shareUrl}
            </div>
            <button onClick={copyUrl} className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold mb-2">
              {copied ? '✓ コピー済' : '📋 URLをコピー'}
            </button>
            <button onClick={onClose} className="w-full bg-gray-200 py-2 rounded-lg text-sm">
              閉じる
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================
// メインアプリ
// ============================
export default function App() {
  // URLパラメータにreportがある場合はレポートビューを表示
  const reportParam = getParam('report');
  if (reportParam) return <ReportView reportCode={reportParam} />;

  const [code, setCode] = useState(() => getParam('code') || generateCode());
  const [participants, setParticipants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ payer: '', desc: '', amount: '', mode: 'free', receipt: null, receiptName: '', excl: [] });
  const [method, setMethod] = useState('equal');
  const [fixed, setFixed] = useState({});
  const [zero, setZero] = useState({});
  const [showRes, setShowRes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewRec, setViewRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [collector, setCollector] = useState('');
  const [editingSettlement, setEditingSettlement] = useState(null);
  const [customSettlements, setCustomSettlements] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [notFound, setNotFound] = useState(false);
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
        init.current = true;
      } else if (urlCode) {
        setNotFound(true);
      } else {
        init.current = true;
      }
      if (!urlCode) window.history.replaceState({}, '', `?code=${c}`);
      setLoading(false);
    };
    load();
  }, []);

  const startNewSession = () => {
    setNotFound(false);
    init.current = true;
  };

  const startWithFreshCode = () => {
    const newCode = generateCode();
    setCode(newCode);
    window.history.replaceState({}, '', `?code=${newCode}`);
    setNotFound(false);
    init.current = true;
  };

  const saveData = useCallback(async () => {
    if (!init.current) return;
    setSaving(true);
    const data = {
      participants,
      payments: payments.map(p => ({ ...p, receipt: null })),
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
    const d = {
      id: editId || Date.now().toString(),
      payer: form.payer, desc: form.desc || '支払い',
      amount: +form.amount,
      receipt: form.receipt, receiptName: form.receiptName,
      excl: [...form.excl]
    };
    setPayments(editId ? payments.map(p => p.id === editId ? d : p) : [...payments, d]);
    setForm({ payer: '', desc: '', amount: '', mode: 'free', receipt: null, receiptName: '', excl: [] });
    setShowForm(false);
    setEditId(null);
  };

  const edit = (p) => {
    setForm({ payer: p.payer, desc: p.desc, amount: '' + p.amount, mode: 'free', receipt: p.receipt, receiptName: p.receiptName || '', excl: [...(p.excl || [])] });
    setEditId(p.id);
    setShowForm(true);
  };

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
      const el = participants.filter(p => !(py.excl || []).includes(p.id));
      if (el.length) el.forEach(p => s[p.id] += py.amount / el.length);
    });
    return s;
  };

  const calc = () => {
    if (participants.length < 2 || !payments.length) return null;
    const eq = eqShare();
    const total = payments.reduce((a, b) => a + b.amount, 0);
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
        if (zero[p.id]) { should[p.id] = 0; }
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
      } else {
        unfixedIds.forEach(id => should[id] = 0);
      }
    }

    const bal = {};
    participants.forEach(p => bal[p.id] = paid[p.id] - should[p.id]);

    return { total, eq, paid, should, bal };
  };

  // 傾斜割り勘の未入力者への均等分配額を計算
  const calcUnfixedAmount = () => {
    if (method !== 'fixed' || participants.length === 0 || payments.length === 0) return null;
    const total = payments.reduce((a, b) => a + b.amount, 0);
    let fixedTotal = 0;
    const unfixedIds = [];
    participants.forEach(p => {
      if (zero[p.id]) { /* 0円 */ }
      else if (fixed[p.id] > 0) { fixedTotal += fixed[p.id]; }
      else unfixedIds.push(p.id);
    });
    if (unfixedIds.length === 0) return null;
    const remaining = total - fixedTotal;
    if (remaining <= 0) return null;
    return Math.round(remaining / unfixedIds.length);
  };

  const calcSettlements = (res) => {
    if (!res) return [];
    if (customSettlements.length > 0) return customSettlements;

    const bal = { ...res.bal };

    if (collector && bal[collector] !== undefined) {
      const settlements = [];
      participants.forEach(p => {
        if (p.id !== collector && bal[p.id] < 0) {
          settlements.push({
            id: `${p.id}-${collector}`,
            from: p.name, fromId: p.id,
            to: participants.find(x => x.id === collector)?.name || '',
            toId: collector,
            amount: Math.abs(bal[p.id])
          });
        }
      });
      participants.forEach(p => {
        if (p.id !== collector && bal[p.id] > 0) {
          settlements.push({
            id: `${collector}-${p.id}`,
            from: participants.find(x => x.id === collector)?.name || '',
            fromId: collector,
            to: p.name, toId: p.id,
            amount: bal[p.id]
          });
        }
      });
      return settlements;
    }

    const cr = participants.filter(p => bal[p.id] > 0).map(p => ({ ...p, a: bal[p.id] })).sort((a, b) => b.a - a.a);
    const dr = participants.filter(p => bal[p.id] < 0).map(p => ({ ...p, a: -bal[p.id] })).sort((a, b) => b.a - a.a);
    const set = [];
    let ci = 0, di = 0;
    while (ci < cr.length && di < dr.length) {
      const a = Math.min(cr[ci].a, dr[di].a);
      if (a > 0) set.push({
        id: `${dr[di].id}-${cr[ci].id}`,
        from: dr[di].name, fromId: dr[di].id,
        to: cr[ci].name, toId: cr[ci].id,
        amount: a
      });
      cr[ci].a -= a; dr[di].a -= a;
      if (!cr[ci].a) ci++;
      if (!dr[di].a) di++;
    }
    return set;
  };

  const res = calc();
  const eq = eqShare();
  const unfixedAmount = calcUnfixedAmount();
  const settlements = calcSettlements(res);

  const copy = () => {
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?code=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    const w = window.open('', '_blank');
    w.document.write(`<html><head><meta charset="utf-8"><title>精算レポート</title>
    <style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}
    h1{color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:10px}h2{color:#059669;margin-top:25px}
    table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:10px}th{background:#f3f4f6}
    .excluded{color:#ef4444;font-size:12px}.settlement{background:#d1fae5;padding:15px;border-radius:8px;margin:10px 0}
    .amount{font-weight:bold;color:#4f46e5}@media print{button{display:none}}</style></head>
    <body><h1>💰 精算レポート</h1><p>精算コード: ${code}</p><p>作成日時: ${new Date().toLocaleString('ja-JP')}</p>
    ${collector ? `<p>💼 幹事（集約者）: ${participants.find(p => p.id === collector)?.name}</p>` : ''}
    <h2>📋 基本情報</h2><table><tr><th>合計金額</th><td class="amount">${res.total.toLocaleString()}円</td></tr>
    <tr><th>参加者</th><td>${participants.map(p => p.name).join(', ')}（${participants.length}名）</td></tr></table>
    <h2>💳 支払い明細</h2><table><tr><th>内容</th><th>支払者</th><th>金額</th><th>除外者</th></tr>
    ${payments.map(p => `<tr><td>${p.desc}</td><td>${participants.find(x => x.id === p.payer)?.name || ''}</td>
    <td class="amount">${p.amount.toLocaleString()}円</td>
    <td class="excluded">${(p.excl || []).length > 0 ? (p.excl || []).map(id => participants.find(x => x.id === id)?.name).filter(Boolean).join(', ') : '－'}</td></tr>`).join('')}</table>
    <h2>🧮 計算結果</h2><table><tr><th>名前</th><th>支払済</th><th>負担額</th><th>差額</th></tr>
    ${participants.map(p => `<tr><td>${p.name}</td><td>${(res.paid[p.id] || 0).toLocaleString()}円</td>
    <td class="amount">${(res.should[p.id] || 0).toLocaleString()}円</td>
    <td>${((res.paid[p.id] || 0) - (res.should[p.id] || 0)).toLocaleString()}円</td></tr>`).join('')}</table>
    <h2>💸 送金アクション</h2>
    ${finalSettlements.length ? finalSettlements.map(s => `<div class="settlement"><strong>${s.from}</strong> → <strong>${s.to}</strong>: <span class="amount">${s.amount.toLocaleString()}円</span></div>`).join('') : '<p>精算不要</p>'}
    <button onclick="print()" style="margin-top:20px;padding:12px 40px;background:#4f46e5;color:white;border:none;border-radius:8px;cursor:pointer">🖨️印刷/PDF</button></body></html>`);
    w.document.close();
  };

  // レポートURLを生成してKVに保存
  const handleShareReport = async (pw) => {
    if (!res) return '';
    const finalSettlements = customSettlements.length > 0 ? customSettlements : settlements;
    const reportCode = generateCode();
    const passwordHash = pw ? await hashPassword(pw) : '';
    const reportData = {
      participants,
      payments: payments.map(p => ({ ...p, receipt: null })),
      res,
      settlements: finalSettlements,
      collector,
      method,
      passwordHash
    };
    await api.saveReport(reportCode, reportData);
    const url = `${location.origin}${location.pathname}?report=${reportCode}`;
    return url;
  };

  // 画像キャプチャユーティリティ
  const captureElement = async (elementId, bgColor) => {
    try {
      const m = await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js');
      const el = document.getElementById(elementId);
      if (!el) return alert('要素が見つかりません');
      const canvas = await m.default(el, { scale: 2, backgroundColor: bgColor });
      const blob = await new Promise(r => canvas.toBlob(r));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      alert('クリップボードにコピーしました！');
    } catch (e) {
      alert('キャプチャに失敗しました: ' + e.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <p className="text-lg mb-2">読み込み中...</p>
        <p className="text-sm text-gray-500">精算コード: {code}</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white rounded-xl p-6 shadow-lg max-w-sm w-full">
        <h2 className="text-lg font-bold text-center mb-2">🔍 セッションが見つかりません</h2>
        <p className="text-xs text-center text-gray-500 mb-4">
          コード <span className="font-mono font-bold">{code}</span> のデータはサーバに存在しません。<br />
          URLが正しいか、共有元の方に確認してください。
        </p>
        <div className="space-y-2">
          <button onClick={startNewSession} className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold">
            このコードで新しい精算を始める
          </button>
          <button onClick={startWithFreshCode} className="w-full bg-gray-200 py-2 rounded-lg text-sm">
            新しいコードを発行する
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div id="app-container" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h1 className="text-xl font-bold text-center text-indigo-600 mb-3">💰 割り勘精算アプリ</h1>

          <div className="bg-indigo-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-gray-500">精算コード</span>
                <p className="text-xl font-mono font-bold text-indigo-600">{code}</p>
              </div>
              <div className="text-right">
                {saving && <span className="text-xs text-orange-500">保存中...</span>}
                {!saving && lastSync && <span className="text-xs text-green-600">✓ 同期済</span>}
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={copy} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm">
                {copied ? '✓コピー済' : '📋 URL共有'}
              </button>
              <button onClick={refresh} className="bg-gray-200 px-3 py-2 rounded-lg text-sm">🔄</button>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">👥 参加者 ({participants.length}人)</h2>
            <div className="flex gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addP()} placeholder="名前" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addP} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">追加</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <span key={p.id} className="bg-blue-100 px-3 py-1 rounded-full text-sm">
                  {p.name}
                  <button onClick={() => { setParticipants(participants.filter(x => x.id !== p.id)); setPayments(payments.filter(x => x.payer !== p.id)); }} className="text-red-500 ml-1">×</button>
                </span>
              ))}
            </div>
          </div>

          {/* ── 支払い一覧（キャプチャ対象エリア） ── */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold">💳 支払い ({payments.length}件)</h2>
              {!showForm && <button onClick={() => setShowForm(true)} className="bg-blue-500 text-white px-3 py-1 rounded-lg text-sm">+追加</button>}
            </div>

            {showForm && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-600">支払者</label>
                  <select value={form.payer} onChange={e => setForm({ ...form, payer: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">選択</option>
                    {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600">内容</label>
                  <input value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="夕食代" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">金額</label>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setForm({ ...form, mode: 'free' })} className={`flex-1 py-1 rounded text-sm ${form.mode === 'free' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>自由入力</button>
                    <button type="button" onClick={() => setForm({ ...form, mode: 'select' })} className={`flex-1 py-1 rounded text-sm ${form.mode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>500円単位</button>
                  </div>
                  {form.mode === 'free'
                    ? <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="金額" className="w-full border rounded-lg px-3 py-2 text-sm" />
                    : <select value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">選択</option>
                        {amountOptions.map(a => <option key={a} value={a}>{a.toLocaleString()}円</option>)}
                      </select>
                  }
                </div>
                <div>
                  <label className="text-xs text-gray-600">🚫 除外する人</label>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <div className="flex flex-wrap gap-2">
                      {participants.map(p => {
                        const isEx = form.excl.includes(p.id);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => setForm({ ...form, excl: isEx ? form.excl.filter(x => x !== p.id) : [...form.excl, p.id] })}
                            className={`px-3 py-1 rounded-full text-sm border-2 ${isEx ? 'bg-red-500 text-white border-red-500' : 'bg-white border-gray-300'}`}>
                            {isEx ? '🚫 ' : ''}{p.name}{isEx ? '（除外）' : ''}
                          </button>
                        );
                      })}
                    </div>
                    {form.excl.length > 0 && <p className="text-xs text-red-600 mt-2">⚠️ {form.excl.length}名を除外</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">📎 レシート</label>
                  <input ref={fileRef} type="file" accept="image/*,.pdf"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => setForm({ ...form, receipt: ev.target.result, receiptName: f.name }); r.readAsDataURL(f); } }}
                    className="w-full text-sm border rounded-lg p-2" />
                </div>
                <div className="flex gap-2">
                  <button onClick={savePay} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm">{editId ? '更新' : '登録'}</button>
                  <button onClick={() => { setShowForm(false); setEditId(null); setForm({ payer: '', desc: '', amount: '', mode: 'free', receipt: null, receiptName: '', excl: [] }); }} className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">キャンセル</button>
                </div>
              </div>
            )}

            {/* ── 支払いリスト本体（キャプチャ対象） ── */}
            <div id="payments-list">
              {payments.length > 0 && (
                <div className="bg-white rounded-lg border p-3 mb-2">
                  <p className="text-xs font-semibold text-gray-400 mb-2">💳 支払い一覧</p>
                  {payments.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded-lg p-3 mb-2 flex justify-between">
                      <div>
                        <p className="font-medium text-sm">{p.desc}</p>
                        <p className="text-xs text-gray-500">{participants.find(x => x.id === p.payer)?.name}</p>
                        <p className="text-sm font-bold text-indigo-600">{p.amount.toLocaleString()}円</p>
                        {(p.excl || []).length > 0 && (
                          <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded mt-1">
                            🚫除外:{(p.excl || []).map(id => participants.find(x => x.id === id)?.name).join(',')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => edit(p)} className="text-blue-500 text-xs">✏️</button>
                        {p.receipt && <button onClick={() => setViewRec(p)} className="text-green-600 text-xs">🧾</button>}
                        <button onClick={() => setPayments(payments.filter(x => x.id !== p.id))} className="text-red-500 text-xs">🗑</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center bg-indigo-50 rounded-lg px-3 py-2 mt-1">
                    <span className="text-sm font-semibold text-gray-600">合計</span>
                    <span className="text-base font-bold text-indigo-600">{payments.reduce((a, b) => a + b.amount, 0).toLocaleString()}円</span>
                  </div>
                </div>
              )}
              {payments.length === 0 && !showForm && (
                <p className="text-sm text-gray-400 text-center py-3">支払いがまだありません</p>
              )}
            </div>

            {/* 支払い金額キャプチャボタン */}
            {payments.length > 0 && (
              <button
                onClick={() => captureElement('payments-list', '#ffffff')}
                className="w-full mt-1 bg-orange-400 text-white py-2 rounded-lg text-sm"
              >
                📸 支払い金額のみ画像コピー
              </button>
            )}
          </div>

          <div className="mb-4">
            <h2 className="font-semibold mb-2">⚖️ 割り勘方法</h2>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setMethod('equal')} className={`flex-1 py-2 rounded-lg text-sm ${method === 'equal' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>均等割り</button>
              <button onClick={() => setMethod('fixed')} className={`flex-1 py-2 rounded-lg text-sm ${method === 'fixed' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>傾斜割り勘</button>
            </div>
            {method === 'fixed' && participants.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-3 space-y-2">
                {/* 未入力者への均等分配額を明示 */}
                {unfixedAmount !== null && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
                    <span className="text-blue-700 font-semibold">📊 未入力者の均等分配額: </span>
                    <span className="text-blue-900 font-bold">{unfixedAmount.toLocaleString()}円</span>
                    <span className="text-blue-500 text-xs ml-1">/ 人</span>
                  </div>
                )}
                <p className="text-xs text-gray-500">💡 金額入力者は固定、未入力者で残額均等分配</p>
                {participants.map(p => {
                  const isUnfixed = !zero[p.id] && !(fixed[p.id] > 0);
                  return (
                    <div key={p.id} className="flex items-center gap-2 bg-white p-2 rounded">
                      <span className="w-16 text-sm">{p.name}</span>
                      <span className="text-xs text-gray-400 w-20">
                        {isUnfixed && unfixedAmount !== null
                          ? <span className="text-blue-600 font-semibold">→{unfixedAmount.toLocaleString()}円</span>
                          : `(${Math.round(eq[p.id] || 0)}円)`
                        }
                      </span>
                      <label className="flex items-center">
                        <input type="checkbox" checked={zero[p.id] || false} onChange={e => setZero({ ...zero, [p.id]: e.target.checked })} className="mr-1" />0円
                      </label>
                      <input type="number" value={fixed[p.id] || ''} onChange={e => setFixed({ ...fixed, [p.id]: +e.target.value })} disabled={zero[p.id]} placeholder="金額" className="flex-1 border rounded px-2 py-1 text-sm disabled:bg-gray-200" />円
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button onClick={() => setShowRes(true)} disabled={!res} className="w-full bg-indigo-500 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300">🧮 精算結果</button>
            <button onClick={reset} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold">🔄 リセット</button>
          </div>

          {showRes && res && (
            <div id="result-section" className="bg-green-50 rounded-xl p-4 mt-4">
              <h2 className="text-lg font-bold text-green-700 mb-3">📊 精算結果</h2>

              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between">
                  <span>合計:</span>
                  <span className="font-bold text-lg">{res.total.toLocaleString()}円</span>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">👤 各人の収支</h3>
                {participants.map(p => (
                  <div key={p.id} className="text-sm border-b pb-2 mb-2 last:border-0">
                    <div className="flex justify-between">
                      <span className="font-medium">{p.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${res.bal[p.id] > 0 ? 'bg-green-100 text-green-700' : res.bal[p.id] < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                        {res.bal[p.id] > 0 ? `+${res.bal[p.id].toLocaleString()}円（受取）` : res.bal[p.id] < 0 ? `${res.bal[p.id].toLocaleString()}円（支払）` : '±0円'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>支払済:{(res.paid[p.id] || 0).toLocaleString()}円</span>
                      <span>負担:{(res.should[p.id] || 0).toLocaleString()}円</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 幹事設定 */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <h3 className="font-semibold text-sm mb-2">💼 送金集約設定</h3>
                <p className="text-xs text-gray-500 mb-2">幹事を指定すると、全員→幹事に送金を集約できます</p>
                <select value={collector} onChange={e => { setCollector(e.target.value); setCustomSettlements([]); }} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">指定なし（通常モード）</option>
                  {participants.filter(p => res.bal[p.id] > 0).map(p => (
                    <option key={p.id} value={p.id}>👑 {p.name}（立替: {res.bal[p.id].toLocaleString()}円）</option>
                  ))}
                </select>
              </div>

              {/* 送金アクション */}
              <div className="bg-white rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">💸 送金アクション</h3>
                  {customSettlements.length > 0 && <button onClick={resetSettlements} className="text-xs text-blue-500">リセット</button>}
                </div>
                {settlements.length ? settlements.map((s, i) => (
                  <div key={s.id || i} className="bg-green-100 rounded-lg p-3 mb-2">
                    {editingSettlement === i ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select value={s.from} onChange={e => updateSettlement(i, 'from', e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm">
                            {participants.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                          <span>→</span>
                          <select value={s.to} onChange={e => updateSettlement(i, 'to', e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm">
                            {participants.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" value={s.amount} onChange={e => updateSettlement(i, 'amount', +e.target.value)} className="flex-1 border rounded px-2 py-1 text-sm" />
                          <span>円</span>
                          <button onClick={() => setEditingSettlement(null)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">確定</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{s.from} → {s.to}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-green-700">{s.amount.toLocaleString()}円</span>
                          <button onClick={() => { if (customSettlements.length === 0) setCustomSettlements([...settlements]); setEditingSettlement(i); }} className="text-xs text-blue-500">✏️</button>
                        </div>
                      </div>
                    )}
                  </div>
                )) : <p className="text-gray-500 text-sm">精算不要 🎉</p>}
              </div>

              <div className="space-y-2">
                <button onClick={pdf} className="w-full bg-purple-500 text-white py-2 rounded-lg text-sm">📄 PDF出力</button>
                <button onClick={() => setShowShareModal(true)} className="w-full bg-teal-600 text-white py-2 rounded-lg text-sm font-semibold">
                  🔗 精算レポートをURL共有
                </button>
                <div className="flex gap-2">
                  <button onClick={() => captureElement('app-container', '#eff6ff')} className="flex-1 bg-gray-600 text-white py-2 rounded-lg text-sm">📸全体</button>
                  <button onClick={() => captureElement('result-section', '#f0fdf4')} className="flex-1 bg-teal-500 text-white py-2 rounded-lg text-sm">📸結果のみ</button>
                  <button onClick={() => captureElement('payments-list', '#ffffff')} className="flex-1 bg-orange-400 text-white py-2 rounded-lg text-sm">📸支払のみ</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* レポート共有モーダル */}
      {showShareModal && res && (
        <ShareReportModal
          onClose={() => setShowShareModal(false)}
          onShare={handleShareReport}
        />
      )}

      {/* レシートビューモーダル */}
      {viewRec && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewRec(null)}>
          <div className="bg-white rounded-xl p-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-2">🧾{viewRec.desc}</h3>
            <p className="text-indigo-600 font-bold mb-2">{viewRec.amount.toLocaleString()}円</p>
            {(viewRec.excl || []).length > 0 && (
              <p className="text-red-500 text-sm mb-2">🚫除外:{(viewRec.excl || []).map(id => participants.find(x => x.id === id)?.name).join(',')}</p>
            )}
            {viewRec.receipt?.startsWith('data:image') && <img src={viewRec.receipt} className="w-full rounded" />}
            <button onClick={() => setViewRec(null)} className="w-full mt-4 bg-gray-300 py-2 rounded-lg">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
