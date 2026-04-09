const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3001;

// Gmail config
const GMAIL_USER = 'dermoestetikaifarmacija@gmail.com';
const GMAIL_PASS = 'ecim uiaa qqpl rmgx';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

app.use(express.json());
app.use(express.static('.'));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Data
app.get('/api/data', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  res.json(data);
});

app.post('/api/data', (req, res) => {
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  let list = data.participants || [];
  if (req.query.eventId && req.query.eventId !== 'all') {
    list = list.filter(p => p.eventId == req.query.eventId);
  }
  list.sort((a, b) => (b.score || 0) - (a.score || 0));
  res.json(list.slice(0, 50));
});

// Check-in
app.post('/api/checkin', (req, res) => {
  const { qrCode, eventId } = req.body;
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  const p = data.participants.find(x => x.qrCode === qrCode && x.eventId == eventId);
  
  if (!p) return res.status(404).json({ success: false, error: 'Not found' });
  if (p.checkedIn) return res.json({ success: false, alreadyCheckedIn: true, participant: p });
  
  p.checkedIn = true;
  p.checkedInAt = new Date().toISOString();
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
  res.json({ success: true, participant: p });
});

// QR Generator
async function generateQR(text) {
  return await QRCode.toDataURL(text, { width: 300, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
}

// Email sender
async function sendEmail(participant) {
  const qrData = await generateQR(participant.qrCode);
  const qrBase64 = qrData.split(',')[1];
  const events = { 1: 'Banja Luka', 2: 'Sarajevo', 3: 'Mostar' };
  
  const mail = {
    from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
    to: participant.email,
    subject: 'Vaš QR kod za D&F Summer Essentials 2026',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:10px;">
        <div style="background:rgba(255,255,255,0.1);padding:30px;text-align:center;">
          <h1>D&F Summer Essentials 2026</h1>
          <p>Pozdrav <strong>${participant.name}</strong>,</p>
          <p>Vaša prijava je potvrđena!</p>
        </div>
        <div style="background:white;color:#333;padding:30px;margin:20px 0;text-align:center;border-radius:8px;">
          <h2 style="color:#667eea;">${events[participant.eventId] || 'Summer Essentials'}</h2>
          <p><strong>QR kod:</strong> ${participant.qrCode}</p>
          <img src="cid:qrcode" style="max-width:300px;width:100%;" />
          <p>Unesite ručno: <strong>${participant.qrCode}</strong></p>
        </div>
      </div>
    `,
    attachments: [{ filename: `QR-${participant.qrCode}.png`, content: qrBase64, encoding: 'base64', cid: 'qrcode' }]
  };
  
  return await transporter.sendMail(mail);
}

// API: Send single email
app.post('/api/send-qr-email', async (req, res) => {
  try {
    const { participantId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const p = data.participants.find(x => x.id === participantId);
    
    if (!p) return res.status(404).json({ success: false, error: 'Participant not found' });
    if (!p.email) return res.status(400).json({ success: false, error: 'No email address' });
    
    const result = await sendEmail(p);
    p.emailSent = true;
    p.emailSentAt = new Date().toISOString();
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Bulk send
app.post('/api/send-bulk-qr-emails', async (req, res) => {
  try {
    const { participantIds } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const results = { sent: 0, failed: 0, errors: [] };
    
    for (const id of participantIds) {
      try {
        const p = data.participants.find(x => x.id === id);
        if (!p || !p.email || p.emailSent) continue;
        
        await sendEmail(p);
        p.emailSent = true;
        p.emailSentAt = new Date().toISOString();
        results.sent++;
        
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        results.failed++;
        results.errors.push({ id, error: e.message });
      }
    }
    
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Test email
app.post('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail({
      name: 'Test User',
      email: req.body.email,
      qrCode: 'SE12345678',
      eventId: 1,
      city: 'Banja Luka'
    });
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Generate QR
app.get('/api/generate-qr', async (req, res) => {
  try {
    const qr = await generateQR(req.query.text);
    res.json({ qrCode: qr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Default route
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));

// Init
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync('./data/summer-essentials-data.json')) {
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify({
    events: [
      { id: 1, name: 'Banja Luka - 15.05.2026', date: '2026-05-15', time: '16:30', location: 'Vila Slatina' },
      { id: 2, name: 'Sarajevo - 22.05.2026', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran"' },
      { id: 3, name: 'Mostar - 29.05.2026', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna' }
    ],
    participants: [],
    sponsors: [], questions: [], settings: { eventStarted: false, quizEnabled: true }
  }, null, 2));
}

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
