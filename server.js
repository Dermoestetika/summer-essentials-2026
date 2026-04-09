const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3001;

// Gmail config
const GMAIL_USER = process.env.GMAIL_USER || 'dermoestetikaifarmacija@gmail.com';
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD || 'ecim uiaa qqpl rmgx';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

app.use(express.json());
app.use(express.static('.'));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get all data
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data not found' });
  }
});

// Save data
app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    let participants = data.participants || [];
    if (req.query.eventId && req.query.eventId !== 'all') {
      participants = participants.filter(p => p.eventId == req.query.eventId);
    }
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    res.json(participants.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Check-in
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
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Generate QR
async function generateQR(text) {
  return await QRCode.toDataURL(text, { width: 300, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
}

// Send email function
async function sendEmail(participant) {
  const qrDataUrl = await generateQR(participant.qrCode);
  const qrBase64 = qrDataUrl.split(',')[1];
  
  const events = { 1: 'Banja Luka', 2: 'Sarajevo', 3: 'Mostar' };
  const eventName = events[participant.eventId] || 'Summer Essentials';
  
  const mailOptions = {
    from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
    to: participant.email,
    subject: 'Vaš QR kod za D&F Summer Essentials 2026',
    html: `
      <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
        <div style="background: rgba(255,255,255,0.1); padding: 30px; text-align: center;">
          <h1>D&F Summer Essentials 2026</h1>
          <p>Pozdrav <strong>${participant.name}</strong>,</p>
          <p>Vaša prijava je potvrđena!</p>
        </div>
        <div style="background: white; color: #333; padding: 30px; margin: 20px 0; text-align: center;">
          <h2 style="color: #667eea;">Detalji</h2>
          <p><strong>Događaj:</strong> ${eventName} - 15.05.2026</p>
          <p><strong>Grad:</strong> ${participant.city}</p>
          <p><strong>QR kod:</strong> ${participant.qrCode}</p>
          <img src="cid:qrcode" style="max-width: 300px; width: 100%;" />
          <p>Skenirajte na ulazu ili unesite ručno: <strong>${participant.qrCode}</strong></p>
        </div>
      </div>
    `,
    attachments: [{ filename: `QR-${participant.qrCode}.png`, content: qrBase64, encoding: 'base64', cid: 'qrcode' }]
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
    if (!participant.email) return res.status(400).json({ success: false, error: 'No email' });
    
    const result = await sendEmail(participant);
    
    participant.emailSent = true;
    participant.emailSentAt = new Date().toISOString();
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
        p.emailSentAt = new Date().toISOString();
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
      name: 'Test Korisnik',
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
  try {
    const qr = await generateQR(req.query.text);
    res.json({ qrCode: qr });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Home
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'app.html')));

// Init data
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync('./data/summer-essentials-data.json')) {
  fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify({
    events: [
      { id: 1, name: 'Banja Luka - 15.05.2026', date: '2026-05-15', time: '16:30', location: 'Vila Slatina' },
      { id: 2, name: 'Sarajevo - 22.05.2026', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran"' },
      { id: 3, name: 'Mostar - 29.05.2026', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna' }
    ],
    participants: [
      { id: 1, name: 'Mladen Test', email: 'mladen@test.com', qrCode: 'SE12345678', eventId: 1, city: 'Banja Luka', checkedIn: true, score: 5 },
      { id: 2, name: 'Ana Farmaceut', email: 'ana@anapharm.ba', qrCode: 'SE87654321', eventId: 1, city: 'Sarajevo', checkedIn: true, score: 35 },
      { id: 3, name: 'Marko Ljekarnik', email: 'marko@farmacija.ba', qrCode: 'SE11112222', eventId: 1, city: 'Mostar', checkedIn: true, score: 28 },
      { id: 4, name: 'Ivana Doktor', email: 'ivana@doktor.ba', qrCode: 'SE99998888', eventId: 1, city: 'Banja Luka', checkedIn: true, score: 40 },
      { id: 5, name: 'Petra Medic', email: 'petra@medic.ba', qrCode: 'SE55556666', eventId: 2, city: 'Sarajevo', checkedIn: true, score: 42 }
    ],
    sponsors: [], questions: [], settings: { eventStarted: false, quizEnabled: true }
  }, null, 2));
}

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
