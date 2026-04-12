const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3001;

// Email configuration
const GMAIL_USER = process.env.GMAIL_USER || 'dermoestetikaifarmacija@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || 'ecim uiaa qqpl rmgx';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
    }
});

// Middleware
app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Create data directory if not exists
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}

// Initialize data file if not exists
const DATA_FILE = './data/summer-essentials-data.json';
if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
        events: [
            { id: 1, name: 'Banja Luka - 15.05.2026', date: '2026-05-15', time: '16:30', location: 'Vila Slatina' },
            { id: 2, name: 'Sarajevo - 22.05.2026', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran" hotela Bosnia' },
            { id: 3, name: 'Mostar - 29.05.2026', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna' }
        ],
        participants: [],
        sponsors: [
            { id: 1, name: 'Farmadent', logo: '', description: 'Farmaceutska kompanija' },
            { id: 2, name: 'Dekaonon', logo: '', description: 'Dermatološka kuća' },
            { id: 3, name: 'Anapharm', logo: '', description: 'Organizator' }
        ],
        questions: {
            '1': [], // Farmadent questions
            '2': [], // Dekaonon questions
            '3': []  // Anapharm questions
        },
        settings: {
            eventStarted: false,
            quizEnabled: false
        }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
}

// Helper function to load data
function loadData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('Error loading data:', err);
        return null;
    }
}

// Helper function to save data
function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving data:', err);
        return false;
    }
}

// ==================== API ROUTES ====================

// Get all data
app.get('/api/data', (req, res) => {
    const data = loadData();
    if (data) {
        res.json(data);
    } else {
        res.status(500).json({ error: 'Failed to load data' });
    }
});

// Save all data
app.post('/api/data', (req, res) => {
    if (saveData(req.body)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    const data = loadData();
    if (!data) {
        return res.status(500).json({ error: 'Failed to load data' });
    }
    
    const { eventId } = req.query;
    let participants = data.participants || [];
    
    if (eventId && eventId !== 'all') {
        participants = participants.filter(p => p.eventId == eventId);
    }
    
    // Sort by score (descending)
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    res.json(participants.slice(0, 50));
});

// Check-in endpoint
app.post('/api/checkin', (req, res) => {
    const { qrCode, eventId } = req.body;
    const data = loadData();
    
    if (!data) {
        return res.status(500).json({ error: 'Failed to load data' });
    }
    
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
    
    if (saveData(data)) {
        res.json({ success: true, participant });
    } else {
        res.status(500).json({ error: 'Failed to save check-in' });
    }
});

// ==================== EMAIL ENDPOINTS ====================

// Test email
app.post('/api/test-email', async (req, res) => {
    try {
        const { email } = req.body;
        
        const info = await transporter.sendMail({
            from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
            to: email,
            subject: 'Test Email - Summer Essentials 2026',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #C8A951 0%, #e8d78e 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #1a1a2e; margin: 0; font-size: 28px;">D&F Summer Essentials</h1>
                        <p style="color: #1a1a2e; margin: 10px 0 0 0;">Test Email</p>
                    </div>
                    <div style="padding: 30px; background: #fff;">
                        <p>Ovo je test email.</p>
                        <p>Ako ga vidite, email sistem radi ispravno!</p>
                    </div>
                </div>
            `
        });
        
        res.json({ success: true, messageId: info.messageId });
    } catch (err) {
        console.error('Test email error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Generate QR code
app.get('/api/generate-qr', async (req, res) => {
    try {
        const { text } = req.query;
        if (!text) {
            return res.status(400).json({ error: 'Text parameter required' });
        }
        
        const qrDataUrl = await QRCode.toDataURL(text, {
            width: 400,
            margin: 2,
            color: {
                dark: '#1a1a2e',
                light: '#ffffff'
            }
        });
        
        res.json({ qrCode: qrDataUrl });
    } catch (err) {
        console.error('QR generation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Send QR email to single participant
app.post('/api/send-qr-email', async (req, res) => {
    try {
        const { participantId } = req.body;
        const data = loadData();
        
        if (!data) {
            return res.status(500).json({ success: false, error: 'Failed to load data' });
        }
        
        const participant = data.participants.find(p => p.id == participantId);
        
        if (!participant) {
            return res.status(404).json({ success: false, error: 'Participant not found' });
        }
        
        // Generate QR code
        const qrText = participant.qrCode || `PART-${participant.id}`;
        const qrDataUrl = await QRCode.toDataURL(qrText, {
            width: 300,
            margin: 2,
            color: { dark: '#1a1a2e', light: '#ffffff' }
        });
        
        const event = data.events.find(e => e.id == participant.eventId);
        
        // Send email
        await transporter.sendMail({
            from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
            to: participant.email,
            subject: 'Vas QR kod za D&F Summer Essentials 2026',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #C8A951 0%, #e8d78e 100%); padding: 30px; text-align: center;">
                        <h1 style="color: #1a1a2e; margin: 0; font-size: 28px;">D&F Summer Essentials</h1>
                        <p style="color: #1a1a2e; margin: 10px 0 0 0;">Vasa prijava je potvrdjena!</p>
                    </div>
                    <div style="padding: 30px; background: #fff;">
                        <p>Postovani/a <strong>${participant.name}</strong>,</p>
                        <p>Radujemo se vasem dolasku na D&F Summer Essentials edukativni dogadjaj.</p>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #666;">Vas jedinstveni QR kod za ulaz:</p>
                            <img src="${qrDataUrl}" alt="QR Code" style="max-width: 200px; margin: 15px 0;">
                            <div style="font-size: 24px; font-weight: bold; color: #1a1a2e; font-family: monospace; letter-spacing: 2px; margin-top: 10px;">
                                ${participant.qrCode}
                            </div>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                                Prikazite ovaj kod na ulazu za brzi check-in
                            </p>
                        </div>
                        
                        <p><strong>Detalji dogadjaja:</strong></p>
                        <ul>
                            <li>Datum: ${event?.date || 'Maj 2026'}</li>
                            <li>Lokacija: ${event?.location || 'TBA'}</li>
                        </ul>
                        
                        <p style="margin-top: 20px; font-size: 14px; color: #666;">
                            Preuzmite mobilnu aplikaciju za interaktivni kviz i pracenje rezultata.
                        </p>
                    </div>
                    <div style="background: #1a1a2e; color: #fff; padding: 20px; text-align: center; font-size: 12px;">
                        <p>Organizator: Anapharm d.o.o. | anapharm.ba</p>
                    </div>
                </div>
            `
        });
        
        // Update participant
        participant.emailSent = true;
        participant.emailSentAt = new Date().toISOString();
        saveData(data);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Send QR email error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Send bulk QR emails
app.post('/api/send-bulk-qr-emails', async (req, res) => {
    try {
        const { participantIds } = req.body;
        
        if (!Array.isArray(participantIds) || participantIds.length === 0) {
            return res.status(400).json({ success: false, error: 'No participants specified' });
        }
        
        const data = loadData();
        if (!data) {
            return res.status(500).json({ success: false, error: 'Failed to load data' });
        }
        
        let sent = 0;
        let failed = 0;
        
        for (const participantId of participantIds) {
            try {
                const participant = data.participants.find(p => p.id == participantId);
                
                if (!participant || participant.emailSent) {
                    continue;
                }
                
                const qrText = participant.qrCode || `PART-${participant.id}`;
                const qrDataUrl = await QRCode.toDataURL(qrText, {
                    width: 300,
                    margin: 2,
                    color: { dark: '#1a1a2e', light: '#ffffff' }
                });
                
                const event = data.events.find(e => e.id == participant.eventId);
                
                await transporter.sendMail({
                    from: `"D&F Summer Essentials" <${GMAIL_USER}>`,
                    to: participant.email,
                    subject: 'Vas QR kod za D&F Summer Essentials 2026',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #C8A951 0%, #e8d78e 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #1a1a2e; margin: 0; font-size: 28px;">D&F Summer Essentials</h1>
                                <p style="color: #1a1a2e; margin: 10px 0 0 0;">Vasa prijava je potvrdjena!</p>
                            </div>
                            <div style="padding: 30px; background: #fff;">
                                <p>Postovani/a <strong>${participant.name}</strong>,</p>
                                <p>Radujemo se vasem dolasku na D&F Summer Essentials edukativni dogadjaj.</p>
                                <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                                    <p style="margin: 0 0 15px 0; color: #666;">Vas jedinstveni QR kod za ulaz:</p>
                                    <img src="${qrDataUrl}" alt="QR Code" style="max-width: 200px; margin: 15px 0;">
                                    <div style="font-size: 24px; font-weight: bold; color: #1a1a2e; font-family: monospace; letter-spacing: 2px; margin-top: 10px;">
                                        ${participant.qrCode}
                                    </div>
                                </div>
                                <p><strong>Detalji dogadjaja:</strong></p>
                                <ul>
                                    <li>Datum: ${event?.date || 'Maj 2026'}</li>
                                    <li>Lokacija: ${event?.location || 'TBA'}</li>
                                </ul>
                            </div>
                            <div style="background: #1a1a2e; color: #fff; padding: 20px; text-align: center; font-size: 12px;">
                                <p>Organizator: Anapharm d.o.o. | anapharm.ba</p>
                            </div>
                        </div>
                    `
                });
                
                participant.emailSent = true;
                participant.emailSentAt = new Date().toISOString();
                sent++;
                
            } catch (err) {
                console.error(`Failed to send email to participant ${participantId}:`, err);
                failed++;
            }
        }
        
        saveData(data);
        res.json({ success: true, sent, failed });
    } catch (err) {
        console.error('Bulk email error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== STATIC FILES ====================

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Summer Essentials 2026 server running on port ${PORT}`);
    console.log(`📱 Mobile App: http://localhost:${PORT}/app.html`);
    console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`📋 Check-in: http://localhost:${PORT}/checkin.html`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
});
