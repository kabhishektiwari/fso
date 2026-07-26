import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.post('/api/paicat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { model = 'gemini-2.5-flash', contents, systemInstruction, generationConfig } = req.body;
    
    let targetModel = model;
    if (targetModel === 'gemini-3.5-flash') targetModel = 'gemini-2.5-flash';
    if (targetModel === 'gemini-3.1-flash-lite') targetModel = 'gemini-2.5-flash';

    let url;
    let headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
    } else {
      url = `https://paicatgemapi.abhishekjogiya123.workers.dev/v1beta/models/${targetModel}:generateContent`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents, systemInstruction, generationConfig })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Server error' } });
  }
});

app.use(express.static(__dirname));

app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
