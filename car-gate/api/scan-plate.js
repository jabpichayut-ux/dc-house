const GOOGLE_API_KEY = 'AIzaSyD8AvaVO0uYS_pDNBmQx5DYLaB0j8dIZo0';
const SECRET = 'dc-house-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, image } = req.body;
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Strip base64 header if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 5 }]
          }]
        })
      }
    );

    const data = await response.json();
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || '';

    if (!fullText) {
      return res.json({ success: false, plate: '', message: 'อ่านไม่ได้ · กรุณากรอกเอง' });
    }

    // Clean up the text — remove newlines, extra spaces
    const cleaned = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    return res.json({ success: true, plate: cleaned });

  } catch (err) {
    return res.status(500).json({ error: 'Scan failed', message: err.message });
  }
}
