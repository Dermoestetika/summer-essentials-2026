// Check-in Tablet Application - API Version
const API_BASE = '';

const app = {
    data: {
        currentEvent: null,
        events: [],
        participants: [],
        recentCheckins: [],
        soundEnabled: true,
        currentMode: 'scan',
        html5QrCode: null
    },

    async init() {
        await this.loadData();
        this.populateEvents();
        this.setupKeyboardListener();
    },

    async loadData() {
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();
            
            this.data.events = data.events || [];
            this.data.participants = data.participants || [];
            
            // Cache in localStorage for offline fallback
            localStorage.setItem('summerEssentialsData', JSON.stringify(data));
        } catch (err) {
            console.error('API load failed, using cache:', err);
            // Fallback to localStorage
            const saved = localStorage.getItem('summerEssentialsData');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data.events = parsed.events || [];
                this.data.participants = parsed.participants || [];
            }
        }
    },

    async saveData() {
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            const data = await response.json();
            data.participants = this.data.participants;
            
            await fetch(`${API_BASE}/api/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            localStorage.setItem('summerEssentialsData', JSON.stringify(data));
        } catch (err) {
            console.error('API save failed:', err);
        }
    },

    populateEvents() {
        const select = document.getElementById('eventSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Izaberite događaj...</option>' +
            this.data.events.map(e => `<option value="${e.id}">${e.name}</option>`
            ).join('');
    },

    async login() {
        const eventId = document.getElementById('eventSelect').value;
        if (!eventId) {
            alert('Izaberite događaj');
            return;
        }

        // Reload data to ensure fresh state
        await this.loadData();
        
        this.data.currentEvent = this.data.events.find(e => e.id == eventId);
        
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('currentEvent').textContent = this.data.currentEvent.name;
        
        this.updateStats();
        this.loadRecentCheckins();
        
        if (this.data.currentMode === 'scan') {
            setTimeout(() => this.startScanner(), 500);
        }
    },

    logout() {
        this.stopScanner();
        this.data.currentEvent = null;
        location.reload();
    },

    updateStats() {
        if (!this.data.currentEvent) return;
        
        const eventParticipants = this.data.participants.filter(p => p.eventId === this.data.currentEvent.id);
        const checkedIn = eventParticipants.filter(p => p.checkedIn).length;
        
        document.getElementById('checkedInCount').textContent = checkedIn;
        document.getElementById('totalCount').textContent = eventParticipants.length;
    },

    setMode(mode) {
        this.data.currentMode = mode;
        
        document.getElementById('scanModeBtn').className = mode === 'scan' 
            ? 'flex-1 py-3 rounded-xl bg-[#C8A951] text-white font-medium'
            : 'flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-medium';
            
        document.getElementById('manualModeBtn').className = mode === 'manual'
            ? 'flex-1 py-3 rounded-xl bg-[#C8A951] text-white font-medium'
            : 'flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-medium';
        
        document.getElementById('scannerMode').classList.toggle('hidden', mode !== 'scan');
        document.getElementById('manualMode').classList.toggle('hidden', mode !== 'manual');
        
        if (mode === 'scan') {
            this.startScanner();
        } else {
            this.stopScanner();
        }
    },

    startScanner() {
        if (this.data.html5QrCode) {
            this.stopScanner();
        }
        
        const qrReader = document.getElementById('checkin-qr-reader');
        if (!qrReader) return;
        
        qrReader.innerHTML = '';
        document.getElementById('cameraError')?.classList.add('hidden');
        
        if (typeof Html5Qrcode === 'undefined') {
            // Fallback if library not loaded
            return;
        }
        
        try {
            this.data.html5QrCode = new Html5Qrcode('checkin-qr-reader');
            
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 }
            };
            
            this.data.html5QrCode.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    this.onScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Normal during scanning
                }
            ).catch(err => {
                console.error('Camera error:', err);
                document.getElementById('cameraError')?.classList.remove('hidden');
            });
        } catch (err) {
            console.error('Scanner init error:', err);
            document.getElementById('cameraError')?.classList.remove('hidden');
        }
    },

    stopScanner() {
        if (this.data.html5QrCode) {
            this.data.html5QrCode.stop().then(() => {
                this.data.html5QrCode = null;
            }).catch(err => {
                console.error('Error stopping camera:', err);
            });
        }
    },

    restartScanner() {
        this.stopScanner();
        setTimeout(() => this.startScanner(), 500);
    },

    onScanSuccess(decodedText) {
        this.stopScanner();
        
        const code = decodedText.trim().toUpperCase();
        this.processCheckIn(code);
        
        setTimeout(() => {
            if (this.data.currentMode === 'scan') {
                this.startScanner();
            }
        }, 2000);
    },

    keypadInput(value) {
        const input = document.getElementById('manualCodeInput');
        if (input && input.value.length < 10) {
            input.value += value;
        }
    },

    keypadDelete() {
        const input = document.getElementById('manualCodeInput');
        if (input) input.value = input.value.slice(0, -1);
    },

    async checkInManual() {
        const input = document.getElementById('manualCodeInput');
        const code = input?.value.trim().toUpperCase();
        if (code) {
            await this.processCheckIn(code);
            input.value = '';
        }
    },

    simulateScan() {
        const code = prompt('Unesite QR kod za test (npr. SE12345678):');
        if (code) {
            this.processCheckIn(code.trim().toUpperCase());
        }
    },

    async processCheckIn(code) {
        if (!code) return;

        // Reload fresh data
        await this.loadData();
        
        // Use API endpoint for check-in
        try {
            const response = await fetch(`${API_BASE}/api/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qrCode: code,
                    eventId: this.data.currentEvent.id
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const participant = result.participant;
                
                // Add to recent
                this.addRecentCheckin(participant);
                
                // Show success
                this.showResult('success', 'Check-in uspješan!', 
                    participant.name,
                    participant.email);
                
                this.playSound('success');
                this.updateStats();
                
                // Update local data
                const idx = this.data.participants.findIndex(p => p.id === participant.id);
                if (idx >= 0) {
                    this.data.participants[idx] = participant;
                }
            } else {
                // Check for specific errors
                const wrongEvent = this.data.participants.find(p => p.qrCode === code);
                if (wrongEvent && wrongEvent.eventId !== this.data.currentEvent.id) {
                    const event = this.data.events.find(e => e.id === wrongEvent.eventId);
                    this.showResult('error', 'Pogrešan događaj', 
                        `${wrongEvent.name} je prijavljen/a za: ${event?.name || 'drugi događaj'}`);
                } else if (result.alreadyCheckedIn) {
                    const checkedInAt = result.participant?.checkedInAt 
                        ? new Date(result.participant.checkedInAt).toLocaleTimeString('bs-BA') 
                        : 'nepoznato vrijeme';
                    this.showResult('warning', 'Već checkiran!', 
                        `${result.participant?.name || 'Učesnik'} je već checkiran.`,
                        `Prvi check-in: ${checkedInAt}`);
                    this.playSound('warning');
                } else {
                    this.showResult('error', 'Kod nije pronađen', 
                        `QR kod ${code} ne postoji u bazi.`);
                }
                this.playSound('error');
            }
        } catch (err) {
            console.error('Check-in error:', err);
            // Fallback to local processing
            this.processCheckInLocal(code);
        }
    },

    processCheckInLocal(code) {
        // Fallback if API fails
        const participant = this.data.participants.find(p => 
            p.qrCode === code && p.eventId === this.data.currentEvent.id
        );

        if (!participant) {
            const wrongEvent = this.data.participants.find(p => p.qrCode === code);
            if (wrongEvent) {
                const event = this.data.events.find(e => e.id === wrongEvent.eventId);
                this.showResult('error', 'Pogrešan događaj', 
                    `${wrongEvent.name} je prijavljen/a za: ${event?.name || 'drugi događaj'}`);
            } else {
                this.showResult('error', 'Kod nije pronađen', 
                    `QR kod ${code} ne postoji u bazi.`);
            }
            this.playSound('error');
            return;
        }

        if (participant.checkedIn) {
            const checkedInAt = participant.checkedInAt 
                ? new Date(participant.checkedInAt).toLocaleTimeString('bs-BA') 
                : 'nepoznato vrijeme';
            this.showResult('warning', 'Već checkiran!', 
                `${participant.name} je već bio/a checkiran/a.`,
                `Prvi check-in: ${checkedInAt}`);
            this.playSound('warning');
            return;
        }

        // Success
        participant.checkedIn = true;
        participant.checkedInAt = new Date().toISOString();
        this.saveData();

        this.addRecentCheckin(participant);
        this.showResult('success', 'Check-in uspješan!', 
            participant.name,
            participant.email);
        
        this.playSound('success');
        this.updateStats();
    },

    showResult(type, title, name, details = '') {
        const modal = document.getElementById('resultModal');
        const card = document.getElementById('resultCard');
        const icon = document.getElementById('resultIcon');
        
        if (!modal || !card || !icon) return;
        
        card.className = 'result-card max-w-md w-full ' + 
            (type === 'success' ? 'result-success' : 
             type === 'error' ? 'result-error' : 'result-warning');
        
        icon.innerHTML = type === 'success' ? '<i class="fas fa-check text-4xl"></i>' :
                        type === 'error' ? '<i class="fas fa-times text-4xl"></i>' :
                        '<i class="fas fa-exclamation text-4xl"></i>';
        
        document.getElementById('resultTitle').textContent = title;
        document.getElementById('resultName').textContent = name;
        document.getElementById('resultDetails').textContent = details;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        if (type === 'success') {
            setTimeout(() => this.closeResult(), 3000);
        }
    },

    closeResult() {
        const modal = document.getElementById('resultModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    addRecentCheckin(participant) {
        const checkin = {
            ...participant,
            checkInTime: new Date().toLocaleTimeString('bs-BA')
        };
        
        this.data.recentCheckins.unshift(checkin);
        if (this.data.recentCheckins.length > 10) {
            this.data.recentCheckins.pop();
        }
        
        this.renderRecentCheckins();
    },

    loadRecentCheckins() {
        const today = new Date().toDateString();
        this.data.recentCheckins = this.data.participants
            .filter(p => p.checkedIn && p.eventId === this.data.currentEvent.id)
            .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
            .slice(0, 10)
            .map(p => ({
                ...p,
                checkInTime: new Date(p.checkedInAt).toLocaleTimeString('bs-BA')
            }));
        
        this.renderRecentCheckins();
    },

    renderRecentCheckins() {
        const container = document.getElementById('recentCheckins');
        if (!container) return;
        
        if (this.data.recentCheckins.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Nema nedavnih check-in-a</p>';
            return;
        }
        
        container.innerHTML = this.data.recentCheckins.map(p => `
            <div class="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm">
                <div class="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-white font-bold">
                    ${p.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div class="flex-1">
                    <p class="font-semibold text-[#1a1a2e]">${p.name}</p>
                    <p class="text-sm text-gray-500">${p.email || ''}</p>
                </div>
                <div class="text-right">
                    <span class="text-sm font-medium text-green-600">
                        <i class="fas fa-check mr-1"></i>${p.checkInTime}
                    </span>
                </div>
            </div>
        `).join('');
    },

    toggleSound() {
        this.data.soundEnabled = !this.data.soundEnabled;
        const icon = document.getElementById('soundIcon');
        if (icon) {
            icon.className = this.data.soundEnabled 
                ? 'fas fa-volume-up text-[#C8A951]'
                : 'fas fa-volume-mute text-gray-400';
        }
    },

    playSound(type) {
        if (!this.data.soundEnabled) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'error') {
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'warning') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        }
    },

    setupKeyboardListener() {
        let buffer = '';
        let lastKeyTime = Date.now();

        document.addEventListener('keypress', (e) => {
            const now = Date.now();
            
            if (now - lastKeyTime > 100) {
                buffer = '';
            }
            lastKeyTime = now;

            if (e.key.length === 1) {
                buffer += e.key;
            }

            if (e.key === 'Enter' && buffer.length >= 8) {
                const code = buffer.trim().toUpperCase();
                buffer = '';
                
                if (this.data.currentEvent) {
                    this.processCheckIn(code);
                }
            }
        });
    },

    showTestQRs() {
        const testDiv = document.getElementById('testQRCodes');
        if (testDiv) testDiv.classList.remove('hidden');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});