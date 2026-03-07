// PunkPick shared likes — Vercel serverless function
// GET  /api/likes        → { likes: { "42": 5, ... } }
// POST /api/likes        → body: { id: 42 }  → increments + returns updated

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'maxmurrray';
const REPO  = 'Punksierge';
const PATH  = 'data/likes.json';

async function readLikes() {
  const res = await fetch(
    `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/${PATH}?t=${Date.now()}`
  );
  return await res.json();
}

async function getFileInfo() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );
  const d = await res.json();
  const content = JSON.parse(Buffer.from(d.content, 'base64').toString());
  return { sha: d.sha, content };
}

async function writeLikes(content, sha) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'punkpick: update likes',
        content: Buffer.from(JSON.stringify(content)).toString('base64'),
        sha,
      }),
    }
  );
  return res.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = await readLikes();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (!GITHUB_TOKEN) return res.status(503).json({ error: 'GITHUB_TOKEN not set' });
      const { id } = req.body || {};
      if (id === undefined) return res.status(400).json({ error: 'id required' });

      const { sha, content } = await getFileInfo();
      content.likes[String(id)] = (content.likes[String(id)] || 0) + 1;
      await writeLikes(content, sha);
      return res.status(200).json(content);
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
};
