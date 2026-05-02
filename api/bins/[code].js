import { kv } from '@vercel/kv';

const isValidCode = (c) => typeof c === 'string' && /^[A-Z0-9_]{4,64}$/.test(c);
const MAX_BYTES = 512 * 1024;

export default async function handler(req, res) {
  const { code } = req.query;
  if (!isValidCode(code)) return res.status(400).json({ error: 'invalid code' });
  const key = `bin:${code}`;

  try {
    if (req.method === 'GET') {
      const data = await kv.get(key);
      if (!data) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(data);
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid body' });
      const serialized = JSON.stringify(body);
      if (serialized.length > MAX_BYTES) return res.status(413).json({ error: 'payload too large' });

      const payload = { ...body, code, updatedAt: Date.now() };
      await kv.set(key, payload, { ex: 60 * 60 * 24 * 90 });
      return res.status(200).json({ ok: true, updatedAt: payload.updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('bins handler error:', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
