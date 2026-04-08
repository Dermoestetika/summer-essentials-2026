const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const app = express();
const PORT = process.env.PORT || 3001;

// Gmail App Password
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'ecim uiaa qqpl rmgx';
const GMAIL_USER = process.env.GMAIL_USER || 'dermoestetikaifarmacija@gmail.com';

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Generate QR Code as Base64
async function generateQRCodeBase64(text) {
  try {
    return await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR Code generation failed:', err);
    throw err;
  }
}

// Send QR Code Email
async function sendQREmail(participant) {
  try {
    const qrCodeDataUrl = await generateQRCodeBase64(participant.qrCode);
    const qrCodeBase64 = qrCodeDataUrl.split(',')[1];
    
    const eventNames = {
      1: 'Banja Luka - 15.05.2026',
      2: 'Sarajevo - 22.05.2026', 
      3: 'Mostar - 29.05.2026'
    };
    
    const eventName = eventNames[participant.eventId] || 'Summer Essentials 2026';
    
    const mailOptions = {
      from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
      to: participant.email,
      subject: 'Vaš QR kod za D&F Summer Essentials 2026',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px;">
          <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="margin: 0 0 20px 0; font-size: 28px;">D&F Summer Essentials 2026</h1>
            <p style="font-size: 18px; margin: 0 0 10px 0;">Pozdrav <strong>${participant.name}</strong>,</p>
            <p style="font-size: 16px;">Vaša prijava za događaj je potvrđena!</p>
          </div>
          
          <div style="background: white; color: #333; padding: 30px; margin: 20px 0; border-radius: 10px; text-align: center;">
            <h2 style="color: #667eea; margin: 0 0 20px 0;">Detalji događaja</h2>
            <p style="font-size: 16px; margin: 10px 0;"><strong>Događaj:</strong> ${eventName}</p>
            <p style="font-size: 16px; margin: 10px 0;"><strong>Grad:</strong> ${participant.city}</p>
            ${participant.pharmacy ? `<p style="font-size: 16px; margin: 10px 0;"><strong>Apoteka:</strong> ${participant.pharmacy}</p>` : ''}
            <p style="font-size: 16px; margin: 10px 0;"><strong>Vaš QR kod:</strong> ${participant.qrCode}</p>
          </div>
          
          <div style="background: white; color: #333; padding: 30px; margin: 20px 0; border-radius: 10px; text-align: center;">
            <h3 style="color: #667eea; margin: 0 0 20px 0;">Vaš QR kod za ulaz</h3>
            <p style="margin: 0 0 20px 0; color: #666;">Skenirajte ovaj kod na ulazu ili pokažite službenom osoblju:</p>
            <img src="cid:qrcode" alt="QR Code" style="max-width: 300px; width: 100%; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);" />
            <p style="margin-top: 20px; font-size: 14px; color: #666;">Alternativno, možete unijeti kod ručno: <strong>${participant.qrCode}</strong></p>
          </div>
          
          <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin-top: 20px;">
            <h4 style="margin: 0 0 15px 0;">Šta vas očekuje?</h4>
            <ul style="text-align: left; line-height: 1.8;">
              <li>Edukativni sadržaj o najnovijim trendovima u dermatologiji i farmaciji</li>
              <li>Interaktivni kvizovi na štandovima sponzora</li>
              <li>Nagrade za najbolje učesnike</li>
              <li>Networking sa kolegama iz struke</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.3);">
            <p style="margin: 0; font-size: 14px;">Ukoliko imate pitanja, kontaktirajte nas na <a href="mailto:${GMAIL_USER}" style="color: #ffd700;">${GMAIL_USER}</a></p>
            <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">© 2026 D&F Summer Essentials. Sva prava pridržana.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `QR-${participant.qrCode}.png`,
          content: qrCodeBase64,
          encoding: 'base64',
          cid: 'qrcode'
        }
      ]
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email sending failed:', err);
    throw err;
  }
}

// API Routes

// Get all data
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data not found' });
  }
});

// Save all data
app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    const { eventId } = req.query;
    
    let participants = data.participants || [];
    
    if (eventId && eventId !== 'all') {
      participants = participants.filter(p => p.eventId == eventId);
    }
    
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    res.json(participants.slice(0, 50));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Check-in endpoint
app.post('/api/checkin', (req, res) => {
  try {
    const { qrCode, eventId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    
    const participant = data.participants.find(p => 
      p.qrCode === qrCode && p.eventId == eventId
    );
    
    if (!participant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Participant not found' 
      });
    }
    
    if (participant.checkedIn) {
      return res.json({ 
        success: false, 
        alreadyCheckedIn: true,
        participant 
      });
    }
    
    participant.checkedIn = true;
    participant.checkedInAt = new Date().toISOString();
    
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(data, null, 2));
    
    res.json({ success: true, participant });
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// Send QR Code Email endpoint
app.post('/api/send-qr-email', async (req, res) => {
  try {
    const { participantId } = req.body;
    const data = JSON.parse(fs.readFileSync('./data/summer-essentials-data.json', 'utf8'));
    
    const participant = data.participants.find(p => p.id === participantId);
    
    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }
    
    if (!participant.email) {
      return res.status(400).json({ success: false, error: 'Participant has no email' });
    }
    
    const result = await sendQREmail(participant);
    
    // Mark email as sent
    participant.emailSent = true;
    participant.emailSentAt = new Date().toISO
