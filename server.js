const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Fix: Patch admin.html to ensure selectedParticipants is always a Set
app.get('/admin.html', (req, res) => {
    const filePath = path.join(__dirname, 'admin.html');
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Inject patch script before closing body tag (or append at end if no body tag)
    const patchScript = `
<script>
// Patch: Ensure selectedParticipants is always a Set
(function() {
    const originalInit = app.init.bind(app);
    app.init = function() {
        originalInit();
        if (app.data && !(app.data.selectedParticipants instanceof Set)) {
            app.data.selectedParticipants = new Set();
        }
    };
    
    const origLoad = app.loadData.bind(app);
    app.loadData = async function() {
        await origLoad();
        if (this.data && !(this.data.selectedParticipants instanceof Set)) {
            this.data.selectedParticipants = new Set();
        }
    };
})();
</script>
</body>
</html>`;
    
    // Replace closing body/html tags or append at end
    if (html.includes('</body>')) {
        html = html.replace('</body>', patchScript);
    } else {
        html = html + patchScript;
    }
    
    res.type('html').send(html);
});

app.use(express.static('.'));

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// API Routes

// Get all data (events, participants, sponsors, questions)
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
        
        // Sort by score
        participants.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        res.json(participants.slice(0, 50)); // Top 50
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

// Serve index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.html'));
});

// Create data directory if not exists
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}

// Initialize data file if not exists
if (!fs.existsSync('./data/summer-essentials-data.json')) {
    const initialData = {
        events: [
            { id: 1, name: 'Banja Luka - 15.05.2026', date: '2026-05-15', time: '16:30', location: 'Vila Slatina' },
            { id: 2, name: 'Sarajevo - 22.05.2026', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran" hotela Bosnia' },
            { id: 3, name: 'Mostar - 29.05.2026', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna' }
        ],
        participants: [],
        sponsors: [],
        questions: [],
        settings: {
            eventStarted: false,
            quizEnabled: false
        }
    };
    fs.writeFileSync('./data/summer-essentials-data.json', JSON.stringify(initialData, null, 2));
}

app.listen(PORT, () => {
    console.log(`🚀 Summer Essentials 2026 server running on port ${PORT}`);
    console.log(`📱 Mobile App: http://localhost:${PORT}/app.html`);
    console.log(`🎛️  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`📋 Check-in: http://localhost:${PORT}/checkin.html`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
});
