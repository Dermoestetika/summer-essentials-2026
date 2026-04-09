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

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all data
app.get('/api/data', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  res.json(data);
});

// Save data
app.post('/api/data', (req, res) => {
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  let participants = data.participants || [];
  if (req.query.eventId && req.query.eventId !== 'all') {
    participants = participants.filter(p => p.eventId == req.query.eventId);
  }
  participants.sort((a, b) => (b.score || 0) - (a.score || 0));
  res.json(participants.slice(0, 50));
});

// Check-in
app.post('/api/checkin', (req, res) => {
  const { qrCode, eventId } = req.body;
  const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
  const participant = data.participants.find(p => p.qrCode === qrCode && p.eventId == eventId);
  
  if (!participant) return res.status(404).json({ success: false, error: 'Not found' });
  if (participant.checkedIn) return res.json({ success: false, alreadyCheckedIn: true, participant });
  
  participant.checkedIn = true;
  participant.checkedInAt = new Date().toISOString();
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
  res.json({ success: true, participant });
});

// Generate QR
async function generateQR(text) {
  return await QRCode.toDataURL(text, { width: 300, margin: 2 });
}

// Send email function
async function sendEmail(participant) {
  const qrDataUrl = await generateQR(participant.qrCode);
  const qrBase64 = qrDataUrl.split(',')[1];
  
  const mailOptions = {
    from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
    to: participant.email,
    subject: 'Vaš QR kod za D&F Summer Essentials 2026',
    html: `
      <div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px;background:#667eea;color:white;">
        <h1>D&F Summer Essentials 2026</h1>
        <p>Pozdrav <strong>${participant.name}</strong>!</p>
        <p>Vaša prijava je potvrđena.</p>
        <div style="background:white;color:#333;padding:20px;margin:20px 0;text-align:center;">
          <h2>Vaš QR kod:</h2>
          <img src="cid:qrcode" style="max-width:300px;" />
          <p>Kod: <strong>${participant.qrCode}</strong></p>
        </div>
      </div>
    `,
    attachments: [{ filename: 'QR.png', content: qrBase64, encoding: 'base64', cid: 'qrcode' }]
  };
  
  return await transporter.sendMail(mailOptions);
}

// Send QR email
app.post('/api/send-qr-email', async (req, res) => {
  try {
    const { participantId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const participant = data.participants.find(p => p.id === participantId);
    
    if (!participant) return res.status(404).json({ success: false, error: 'Not found' });
    
    const result = await sendEmail(participant);
    
    participant.emailSent = true;
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk send
app.post('/api/send-bulk-qr-emails', async (req, res) => {
  try {
    const { participantIds } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const results = { sent: 0, failed: 0 };
    
    for (const id of participantIds) {
      try {
        const p = data.participants.find(x => x.id === id);
        if (!p || !p.email || p.emailSent) continue;
        await sendEmail(p);
        p.emailSent = true;
        results.sent++;
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        results.failed++;
      }
    }
    
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test email
app.post('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail({
      name: 'Test',
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

// Generate QR endpoint
app.get('/api/generate-qr', async (req, res) => {
  const qr = await generateQR(req.query.text);
  res.json({ qrCode: qr });
});

app.listen(PORT, () => console.log(`Server on port ${PORT}`));
