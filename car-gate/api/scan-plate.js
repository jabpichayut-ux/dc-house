export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, image } = req.body;
  if (key !== 'dc-house-2026') return res.status(401).json({ error: 'Unauthorized' });
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image.replace(/^data:image\/\w+;base64,/, '')
              }
            },
            {
              type: 'text',
              text: 'This is a photo of a Thai vehicle license plate. Read the plate number and province exactly as shown. Reply with ONLY the plate number and province in this format: "กก 1234 กรุงเทพมหานคร". If you cannot read the plate clearly, reply with only the word "unclear".'
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() || 'unclear';

    if (text === 'unclear') {
      return res.json({ success: false, plate: '', message: 'ไม่สามารถอ่านป้ายทะเบียนได้ กรุณากรอกเอง' });
    }

    return res.json({ success: true, plate: text });

  } catch (err) {
    return res.status(500).json({ error: 'Scan failed', message: err.message });
  }
}
