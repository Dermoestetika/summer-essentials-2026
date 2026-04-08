const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 3001;

const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'ecim uiaa qqpl rmgx';
const GMAIL_USER = process.env.GMAIL_USER || 'dermoestetikaifarmacija@gmail.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
});

app.use(express.json());
app.use(express.static('.'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function generateQRCodeBase64(text) {
  return await QRCode.toDataURL(text, { width: 300, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
}

async function sendQREmail(participant) {
  const qrCodeDataUrl = await generateQRCodeBase64(participant.qrCode);
  const qrCodeBase64 = qrCodeDataUrl.split(',')[1];
  
  const eventNames = { 1: 'Banja Luka - 15.05.2026', 2: 'Sarajevo - 22.05.2026', 3: 'Mostar - 29.05.2026' };
  const eventName = eventNames[participant.eventId] || 'Summer Essentials 2026';
  
  const mailOptions = {
    from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
    to: participant.email,
    subject: 'Vaš QR kod za D&F Summer Essentials 2026',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
      <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px; text-align: center;">
        <h1 style="margin: 0 0 20px 0;">D&F Summer Essentials 2026</h1>
        <p style="font-size: 18px;">Pozdrav <strong>${participant.name}</strong>,</p>
        <p>Vaša prijava je potvrđena!</p>
      </div>
      <div style="background: white; color: #333; padding: 30px; margin: 20px 0; border-radius: 10px; text-align: center;">
        <h2 style="color: #667eea;">Detalji</h2>
        <p><strong>Događaj:</strong> ${eventName}</p>
        <p><strong>Grad:</strong> ${participant.city}</p>
        <p><strong>QR kod:</strong> ${participant.qrCode}</p>
        <img src="cid:qrcode" style="max-width: 300px; width: 100%; border-radius: 10px;" />
      </div>
    </div>`,
    attachments: [{ filename: `QR-${participant.qrCode}.png`, content: qrCodeBase64, encoding: 'base64', cid: 'qrcode' }]
  };
  
  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

// API Routes
app.get('/api/data', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'))); }
  catch (err) { res.status(500).json({ error: 'Data not found' }); }
});

app.post('/api/data', (req, res) => {
  try { fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(req.body, null, 2)); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: 'Failed to save' }); }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    let participants = data.participants || [];
    if (req.query.eventId && req.query.eventId !== 'all') participants = participants.filter(p => p.eventId == req.query.eventId);
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json(participants.slice(0, 50));
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/checkin', (req, res) => {
  try {
    const { qrCode, eventId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const participant = data.participants.find(p => p.qrCode === qrCode && p.eventId == eventId);
    if (!participant) return res.status(404).json({ success: false, error: 'Not found' });
    if (participant.checkedIn) return res.json({ success: false, alreadyCheckedIn: true, participant });
    participant.checkedIn = true;
    participant.checkedInAt = new Date().toISOString();
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, participant });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/send-qr-email', async (req, res) => {
  try {
    const { participantId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const participant = data.participants.find(p => p.id === participantId);
    if (!participant) return res.status(404).json({ success: false, error: 'Not found' });
    if (!participant.email) return res.status(400).json({ success: false, error: 'No email' });
    const result = await sendQREmail(participant);
    participant.emailSent = true;
    participant.emailSentAt = new Date().toISOString();
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, messageId: result.messageId });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/send-bulk-qr-emails', async (req, res) => {
  try {
    const { participantIds } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const results = { sent: 0, failed: 0, errors: [] };
    for (const participantId of participantIds) {
      try {
        const participant = data.participants.find(p => p.id === participantId);
        if (!participant || !participant.email) { results.failed++; continue; }
        await sendQREmail(participant);
        participant.emailSent = true;
        participant.emailSentAt = new Date().toISOString();
        results.sent++;
        await new Promise(r => setTimeout(r, 500));
      } catch (err) { results.failed++; results.errors.push({ id: participantId, error: err.message }); }
    }
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, results });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/test-email', async (req, res) => {
  try {
    const result = await sendQREmail({ name: 'Test', email: req.body.email, qrCode: 'SE12345678', eventId: 1, city: 'Test' });
    res.json({ success: true, messageId: result.messageId });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/generate-qr', async (req, res) => {
  try {
    const qrDataUrl = await generateQRCodeBase64(req.query.text);
    res.json({ qrCode: qrDataUrl });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));

if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync('./data/summer-essentials-data.json')) {
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify({
    events: [
      { id: 1, name: 'Banja Luka - 15.05.2026', date: '2026-05-15', time: '16:30', location: 'Vila Slatina' },
      { id: 2, name: 'Sarajevo - 22.05.2026', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran" hotela Bosnia' },
      { id: 3, name: 'Mostar - 29.05.2026', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna' }
    ],
    participants: [], sponsors: [], questions: [], settings: { eventStarted: false, quizEnabled: false }
  }, null, 2));
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email: ${GMAIL_USER}`);
});
