
// Admin Panel Application
const app = {
    data: {
        currentUser: null,
        events: [],
        sponsors: [],
        participants: [],
        questions: {},
        quizAttempts: [],
        activityLog: [],
        selectedParticipants: new Set(),
        currentEmailFilter: 'all',
        currentPreviewParticipant: null
    },

    init() {
        this.loadData();
        this.setupEventListeners();
        this.initDefaultData();
        this.renderDashboard();
        this.updateEmailBadge();

        const session = localStorage.getItem('adminSession');
        if (session) {
            this.data.currentUser = JSON.parse(session);
            this.showMainApp();
        }
    },

    loadData() {
        const saved = localStorage.getItem('summerEssentialsData');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data = { ...this.data, ...parsed };
        }
    },

    saveData() {
        localStorage.setItem('summerEssentialsData', JSON.stringify(this.data));
    },

    initDefaultData() {
        // Default events
        if (this.data.events.length === 0) {
            this.data.events = [
                { id: 1, name: 'Summer Essentials - Banja Luka', date: '2026-05-15', time: '16:30', location: 'Vila Slatina', maxParticipants: 100 },
                { id: 2, name: 'Summer Essentials - Sarajevo', date: '2026-05-22', time: '16:30', location: 'Bašta "Kišobran" hotela Bosnia', maxParticipants: 100 },
                { id: 3, name: 'Summer Essentials - Mostar', date: '2026-05-29', time: '16:30', location: 'Terasa hotela Buna', maxParticipants: 100 }
            ];
        }

        // Default sponsors
        if (this.data.sponsors.length === 0) {
            this.data.sponsors = [
                { id: 1, name: 'La Roche-Posay', type: 'exclusive', level: 'Ekskluzivni Partner', contact: 'contact@laroche-posay.ba' },
                { id: 2, name: 'Vichy', type: 'exclusive', level: 'Ekskluzivni Partner', contact: 'contact@vichy.ba' },
                { id: 3, name: 'Eucerin', type: 'exclusive', level: 'Ekskluzivni Partner', contact: 'contact@eucerin.ba' }
            ];
        }

        // Ensure all participants have QR codes and email status
        let needsSave = false;
        this.data.participants.forEach(p => {
            if (!p.qrCode) {
                p.qrCode = this.generateQRCode();
                needsSave = true;
            }
            if (p.emailSent === undefined) {
                p.emailSent = false;
                p.emailSentAt = null;
                needsSave = true;
            }
        });

        if (needsSave) this.saveData();
    },

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
    },

    login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (email === 'admin@anapharm.ba' && password === 'admin2026') {
            this.data.currentUser = { email, name: 'Admin', role: 'organizer' };
            localStorage.setItem('adminSession', JSON.stringify(this.data.currentUser));
            this.showMainApp();
            this.showToast('Dobrodošli!', 'success');
            this.logActivity('Admin prijava', 'Sistem', 'Uspješna prijava');
        } else {
            document.getElementById('loginError').classList.remove('hidden');
        }
    },

    logout() {
        localStorage.removeItem('adminSession');
        this.data.currentUser = null;
        location.reload();
    },

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    },

    navigate(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.getElementById(`page-${page}`).classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

        switch(page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'events': this.renderEvents(); break;
            case 'sponsors': this.renderSponsors(); break;
            case 'participants': this.renderParticipants(); break;
            case 'emails': this.renderEmailPage(); break;
            case 'questions': this.renderQuestions(); break;
            case 'leaderboard': this.renderLeaderboard(); break;
        }
    },

    generateQRCode() {
        // Generate QR code with ONLY numbers (SE + 8 digits) for easy manual entry
        let code = 'SE';
        for (let i = 0; i < 8; i++) {
            code += Math.floor(Math.random() * 10);
        }
        return code;
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>${message}`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    showModal(content) {
        document.getElementById('modalContent').innerHTML = content;
        document.getElementById('modalOverlay').classList.remove('hidden');
    },

    showLargeModal(content) {
        document.getElementById('largeModalContent').innerHTML = content;
        document.getElementById('largeModalOverlay').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.getElementById('largeModalOverlay').classList.add('hidden');
    },

    logActivity(action, user, details) {
        this.data.activityLog.unshift({
            time: new Date().toISOString(),
            action,
            user,
            details
        });
        this.saveData();
    },

    // DASHBOARD
    renderDashboard() {
        const totalParticipants = this.data.participants.length;
        const checkedIn = this.data.participants.filter(p => p.checkedIn).length;
        const emailsSent = this.data.participants.filter(p => p.emailSent).length;
        const emailsPending = totalParticipants - emailsSent;
        const totalQuizzes = this.data.quizAttempts.length;

        document.getElementById('stat-total-participants').textContent = totalParticipants;
        document.getElementById('stat-checked-in').textContent = checkedIn;
        document.getElementById('stat-emails-sent').textContent = emailsSent;
        document.getElementById('stat-emails-pending').textContent = emailsPending;
        document.getElementById('stat-quizzes').textContent = totalQuizzes;

        const avgScore = totalQuizzes > 0
            ? Math.round(this.data.quizAttempts.reduce((a, b) => a + (b.score / b.total * 100), 0) / totalQuizzes)
            : 0;
        document.getElementById('stat-avg-score').textContent = avgScore;

        const activeNow = this.data.participants.filter(p => {
            if (!p.lastActive) return false;
            const lastActive = new Date(p.lastActive);
            return (new Date() - lastActive) < 5 * 60 * 1000;
        }).length;
        document.getElementById('stat-active').textContent = activeNow;
        document.getElementById('stat-installed').textContent = this.data.participants.filter(p => p.appInstalled).length;

        // Show email alert if pending
        const alert = document.getElementById('emailAlert');
        if (emailsPending > 0) {
            alert.classList.remove('hidden');
            document.getElementById('pendingCount').textContent = emailsPending;
        } else {
            alert.classList.add('hidden');
        }

        // Events overview
        const eventsHtml = this.data.events.map(event => {
            const participants = this.data.participants.filter(p => p.eventId === event.id);
            const checkedInCount = participants.filter(p => p.checkedIn).length;

            return `
                <div class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-lg gradient-gold flex items-center justify-center text-white font-bold">
                            ${event.name.split(' ').pop().substring(0, 2)}
                        </div>
                        <div>
                            <h4 class="font-semibold text-[#1a1a2e]">${event.name}</h4>
                            <p class="text-sm text-gray-500">${event.date} | ${event.location}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-[#1a1a2e]">${participants.length}</p>
                        <p class="text-sm text-gray-500">${checkedInCount} check-in</p>
                    </div>
                </div>
            `;
        }).join('');
        document.getElementById('events-overview').innerHTML = eventsHtml;

        this.renderMiniLeaderboard();
        this.renderActivityLog();
        this.updateEmailBadge();
    },

    renderMiniLeaderboard() {
        const leaderboard = this.calculateLeaderboard().slice(0, 5);
        const html = leaderboard.map((entry, index) => `
            <div class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                <div class="w-8 h-8 rounded-full ${index < 3 ? 'gradient-gold text-white' : 'bg-gray-100 text-gray-600'} flex items-center justify-center font-bold text-sm">
                    ${index + 1}
                </div>
                <div class="flex-1">
                    <p class="font-medium text-[#1a1a2e]">${entry.name}</p>
                    <p class="text-xs text-gray-500">${entry.totalScore} bodova</p>
                </div>
                <div class="text-right">
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${entry.tier === 1 ? 'tier-badge-1' : entry.tier === 2 ? 'tier-badge-2' : 'tier-badge-3'}">
                        Tier ${entry.tier}
                    </span>
                </div>
            </div>
        `).join('');
        document.getElementById('mini-leaderboard').innerHTML = html || '<p class="text-gray-500 text-center py-4">Nema podataka</p>';
    },

    renderActivityLog() {
        const html = this.data.activityLog.slice(0, 10).map(log => `
            <tr class="border-b border-gray-50 last:border-0">
                <td class="py-3 text-gray-500">${new Date(log.time).toLocaleTimeString('bs-BA')}</td>
                <td class="py-3 font-medium">${log.user}</td>
                <td class="py-3">
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        log.action.includes('check-in') ? 'bg-green-100 text-green-700' :
                        log.action.includes('email') ? 'bg-blue-100 text-blue-700' :
                        log.action.includes('kviz') ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                    }">${log.action}</span>
                </td>
                <td class="py-3 text-gray-600">${log.details}</td>
            </tr>
        `).join('');
        document.getElementById('activity-log').innerHTML = html || '<tr><td colspan="4" class="py-4 text-center text-gray-500">Nema aktivnosti</td></tr>';
    },

    calculateLeaderboard() {
        const scores = {};
        this.data.quizAttempts.forEach(attempt => {
            if (!scores[attempt.participantId]) {
                scores[attempt.participantId] = {
                    participantId: attempt.participantId,
                    name: attempt.participantName,
                    totalScore: 0,
                    totalTime: 0,
                    quizzes: 0,
                    tier: 3
                };
            }
            scores[attempt.participantId].totalScore += attempt.score;
            scores[attempt.participantId].totalTime += attempt.timeSpent;
            scores[attempt.participantId].quizzes++;
        });

        return Object.values(scores)
            .map(s => ({ ...s, tier: s.totalScore >= 25 ? 1 : s.totalScore >= 15 ? 2 : 3 }))
            .sort((a, b) => {
                if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                return a.totalTime - b.totalTime;
            });
    },

    // EVENTS
    renderEvents() {
        const html = this.data.events.map(event => {
            const participants = this.data.participants.filter(p => p.eventId === event.id);
            const checkedIn = participants.filter(p => p.checkedIn).length;

            return `
                <div class="glass rounded-xl p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-1">${event.name}</h3>
                            <p class="text-gray-500">${event.location}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="app.editEvent(${event.id})" class="action-btn edit" title="Uredi">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="app.deleteEvent(${event.id})" class="action-btn delete" title="Obriši">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="space-y-2 mb-4">
                        <div class="flex items-center gap-2 text-sm text-gray-600">
                            <i class="fas fa-calendar"></i>
                            ${event.date} u ${event.time}
                        </div>
                        <div class="flex items-center gap-2 text-sm text-gray-600">
                            <i class="fas fa-map-marker-alt"></i>
                            ${event.location}
                        </div>
                    </div>
                    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div>
                            <p class="text-2xl font-bold text-[#1a1a2e]">${participants.length}</p>
                            <p class="text-sm text-gray-500">prijavljenih</p>
                        </div>
                        <div class="text-right">
                            <p class="text-2xl font-bold text-[#2BBCB3]">${checkedIn}</p>
                            <p class="text-sm text-gray-500">check-in</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        document.getElementById('events-list').innerHTML = html || '<p class="text-gray-500 text-center py-8">Nema događaja</p>';
    },

    addEvent() {
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Novi događaj</h3>
                <form id="eventForm" class="space-y-4">
                    <div>
                        <label class="form-label">Naziv</label>
                        <input type="text" name="name" required class="form-input" placeholder="npr. Summer Essentials - Sarajevo">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Datum</label>
                            <input type="date" name="date" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Vrijeme</label>
                            <input type="time" name="time" required class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Lokacija</label>
                        <input type="text" name="location" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Maksimalno učesnika</label>
                        <input type="number" name="maxParticipants" value="100" required class="form-input">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('eventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const event = {
                id: Date.now(),
                name: formData.get('name'),
                date: formData.get('date'),
                time: formData.get('time'),
                location: formData.get('location'),
                maxParticipants: parseInt(formData.get('maxParticipants'))
            };
            this.data.events.push(event);
            this.saveData();
            this.closeModal();
            this.renderEvents();
            this.showToast('Događaj dodat!', 'success');
            this.logActivity('Novi događaj', 'Admin', event.name);
        });
    },

    editEvent(eventId) {
        const event = this.data.events.find(e => e.id === eventId);
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Uredi događaj</h3>
                <form id="eventForm" class="space-y-4">
                    <div>
                        <label class="form-label">Naziv</label>
                        <input type="text" name="name" value="${event.name}" required class="form-input">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Datum</label>
                            <input type="date" name="date" value="${event.date}" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Vrijeme</label>
                            <input type="time" name="time" value="${event.time}" required class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Lokacija</label>
                        <input type="text" name="location" value="${event.location}" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Maksimalno učesnika</label>
                        <input type="number" name="maxParticipants" value="${event.maxParticipants}" required class="form-input">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('eventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            event.name = formData.get('name');
            event.date = formData.get('date');
            event.time = formData.get('time');
            event.location = formData.get('location');
            event.maxParticipants = parseInt(formData.get('maxParticipants'));
            this.saveData();
            this.closeModal();
            this.renderEvents();
            this.showToast('Događaj ažuriran!', 'success');
        });
    },

    deleteEvent(eventId) {
        if (!confirm('Da li ste sigurni da želite obrisati ovaj događaj?')) return;
        this.data.events = this.data.events.filter(e => e.id !== eventId);
        this.saveData();
        this.renderEvents();
        this.showToast('Događaj obrisan!', 'success');
    },

    // SPONSORS
    renderSponsors() {
        const html = this.data.sponsors.map(sponsor => {
            const questions = this.data.questions[sponsor.id] || [];
            const attempts = this.data.quizAttempts.filter(a => a.sponsorId === sponsor.id);

            return `
                <div class="glass rounded-xl p-6">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-lg ${sponsor.type === 'exclusive' ? 'gradient-gold' : 'gradient-turquoise'} flex items-center justify-center text-white font-bold text-lg">
                                ${sponsor.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 class="font-display text-lg font-bold text-[#1a1a2e]">${sponsor.name}</h3>
                                <p class="text-sm text-gray-500">${sponsor.level}</p>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="app.editSponsor(${sponsor.id})" class="action-btn edit" title="Uredi">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="app.deleteSponsor(${sponsor.id})" class="action-btn delete" title="Obriši">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div class="text-center p-3 bg-white rounded-lg">
                            <p class="text-xl font-bold text-[#1a1a2e]">${questions.length}</p>
                            <p class="text-xs text-gray-500">pitanja</p>
                        </div>
                        <div class="text-center p-3 bg-white rounded-lg">
                            <p class="text-xl font-bold text-[#2BBCB3]">${attempts.length}</p>
                            <p class="text-xs text-gray-500">kvizova</p>
                        </div>
                        <div class="text-center p-3 bg-white rounded-lg">
                            <p class="text-xl font-bold text-purple-600">${attempts.length > 0 ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / attempts.length) : 0}</p>
                            <p class="text-xs text-gray-500">prosjek</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="app.viewSponsorQR(${sponsor.id})" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">
                            <i class="fas fa-qrcode mr-1"></i> QR kod štanda
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        document.getElementById('sponsors-list').innerHTML = html || '<p class="text-gray-500 text-center py-8">Nema sponzora</p>';
    },

    addSponsor() {
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Novi sponzor</h3>
                <form id="sponsorForm" class="space-y-4">
                    <div>
                        <label class="form-label">Naziv</label>
                        <input type="text" name="name" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Tip</label>
                        <select name="type" class="form-input">
                            <option value="exclusive">Ekskluzivni Partner</option>
                            <option value="vibes">Summer Vibes Partner</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Kontakt email</label>
                        <input type="email" name="contact" class="form-input">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('sponsorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const sponsor = {
                id: Date.now(),
                name: formData.get('name'),
                type: formData.get('type'),
                level: formData.get('type') === 'exclusive' ? 'Ekskluzivni Partner' : 'Summer Vibes Partner',
                contact: formData.get('contact')
            };
            this.data.sponsors.push(sponsor);
            this.saveData();
            this.closeModal();
            this.renderSponsors();
            this.showToast('Sponzor dodat!', 'success');
            this.logActivity('Novi sponzor', 'Admin', sponsor.name);
        });
    },

    editSponsor(sponsorId) {
        const sponsor = this.data.sponsors.find(s => s.id === sponsorId);
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Uredi sponzora</h3>
                <form id="sponsorForm" class="space-y-4">
                    <div>
                        <label class="form-label">Naziv</label>
                        <input type="text" name="name" value="${sponsor.name}" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Tip</label>
                        <select name="type" class="form-input">
                            <option value="exclusive" ${sponsor.type === 'exclusive' ? 'selected' : ''}>Ekskluzivni Partner</option>
                            <option value="vibes" ${sponsor.type === 'vibes' ? 'selected' : ''}>Summer Vibes Partner</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Kontakt email</label>
                        <input type="email" name="contact" value="${sponsor.contact || ''}" class="form-input">
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('sponsorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            sponsor.name = formData.get('name');
            sponsor.type = formData.get('type');
            sponsor.level = sponsor.type === 'exclusive' ? 'Ekskluzivni Partner' : 'Summer Vibes Partner';
            sponsor.contact = formData.get('contact');
            this.saveData();
            this.closeModal();
            this.renderSponsors();
            this.showToast('Sponzor ažuriran!', 'success');
        });
    },

    deleteSponsor(sponsorId) {
        if (!confirm('Da li ste sigurni da želite obrisati ovog sponzora? Sva pitanja vezana za njega će biti obrisana.')) return;
        this.data.sponsors = this.data.sponsors.filter(s => s.id !== sponsorId);
        delete this.data.questions[sponsorId];
        this.saveData();
        this.renderSponsors();
        this.showToast('Sponzor obrisan!', 'success');
    },

    viewSponsorQR(sponsorId) {
        const sponsor = this.data.sponsors.find(s => s.id === sponsorId);
        this.showLargeModal(`
            <div class="p-8 text-center">
                <h3 class="font-display text-2xl font-bold text-[#1a1a2e] mb-6">QR kod za ${sponsor.name}</h3>
                <div class="mb-6 flex justify-center">
                    <div id="sponsorQRCode"></div>
                </div>
                <div class="bg-gray-100 rounded-lg p-4 mb-6 inline-block">
                    <p class="text-3xl font-mono font-bold text-[#1a1a2e]">${sponsor.id}</p>
                    <p class="text-sm text-gray-500 mt-1">ID Štanda</p>
                </div>
                <p class="text-gray-600 mb-6">Skenirajte ovaj kod na štandu da pokrenete kviz</p>
                <div class="flex gap-3 justify-center">
                    <button onclick="app.downloadSponsorQR(${sponsor.id})" class="btn-primary px-6 py-3 rounded-lg">
                        <i class="fas fa-download mr-2"></i>Preuzmi QR
                    </button>
                    <button onclick="app.closeModal()" class="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Zatvori</button>
                </div>
            </div>
        `);

        setTimeout(() => {
            new QRCode(document.getElementById('sponsorQRCode'), {
                text: JSON.stringify({ type: 'sponsor', id: sponsor.id, name: sponsor.name }),
                width: 200,
                height: 200,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }, 100);
    },

    downloadSponsorQR(sponsorId) {
        const sponsor = this.data.sponsors.find(s => s.id === sponsorId);
        this.showToast('QR kod preuzet!', 'success');
    },

    // PARTICIPANTS
    renderParticipants() {
        const eventFilter = document.getElementById('eventFilter');
        eventFilter.innerHTML = '<option value="">Svi događaji</option>' +
            this.data.events.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

        this.filterParticipants();
    },

    filterParticipants() {
        const search = document.getElementById('participantSearch').value.toLowerCase();
        const eventId = document.getElementById('eventFilter').value;

        let filtered = this.data.participants;
        if (eventId) filtered = filtered.filter(p => p.eventId == eventId);
        if (search) filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.email.toLowerCase().includes(search) ||
            (p.city && p.city.toLowerCase().includes(search))
        );

        const html = filtered.map(p => {
            const event = this.data.events.find(e => e.id === p.eventId);
            return `
                <tr class="table-row">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-white text-xs font-bold">
                                ${p.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                                <p class="font-medium text-[#1a1a2e]">${p.name}</p>
                                <p class="text-xs text-gray-500">${p.title || ''}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">${p.email}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${p.city || '-'}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${p.pharmacy || '-'}</td>
                    <td class="px-6 py-4">
                        <button onclick="app.showParticipantQR(${p.id})" class="text-[#C8A951] hover:text-[#1a1a2e] font-mono text-sm font-medium">
                            ${p.qrCode}
                        </button>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${p.emailSent ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${p.emailSent ? '<i class="fas fa-check mr-1"></i>Da' : '<i class="fas fa-times mr-1"></i>Ne'}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            p.checkedIn ? 'bg-green-100 text-green-700' :
                            p.appInstalled ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                        }">${p.checkedIn ? 'Check-in' : p.appInstalled ? 'Instalirano' : 'Registrovan'}</span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="app.showParticipantQR(${p.id})" class="action-btn qr" title="QR kod">
                                <i class="fas fa-qrcode"></i>
                            </button>
                            <button onclick="app.previewEmail(${p.id})" class="action-btn email" title="Pošalji email">
                                <i class="fas fa-envelope"></i>
                            </button>
                            <button onclick="app.editParticipant(${p.id})" class="action-btn edit" title="Uredi">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="app.deleteParticipant(${p.id})" class="action-btn delete" title="Obriši">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('participants-table').innerHTML = html || '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">Nema učesnika</td></tr>';
    },

    searchParticipants() {
        this.filterParticipants();
    },

    addParticipant() {
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Novi učesnik</h3>
                <form id="participantForm" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Ime</label>
                            <input type="text" name="name" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Prezime</label>
                            <input type="text" name="surname" required class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Email</label>
                        <input type="email" name="email" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Telefon</label>
                        <input type="tel" name="phone" class="form-input">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Grad</label>
                            <input type="text" name="city" class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Apoteka</label>
                            <input type="text" name="pharmacy" class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Titula (opciono)</label>
                        <select name="title" class="form-input">
                            <option value="">-- Izaberi titulu --</option>
                            <option value="Magistar farmacije">Magistar farmacije</option>
                            <option value="Farmaceutski tehničar">Farmaceutski tehničar</option>
                            <option value="Ljekar">Ljekar</option>
                            <option value="Drugo">Drugo</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Događaj</label>
                        <select name="eventId" class="form-input">
                            ${this.data.events.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('participantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const participant = {
                id: Date.now(),
                name: formData.get('name') + ' ' + formData.get('surname'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                city: formData.get('city'),
                pharmacy: formData.get('pharmacy'),
                title: formData.get('title') || '',
                eventId: parseInt(formData.get('eventId')),
                qrCode: this.generateQRCode(),
                checkedIn: false,
                appInstalled: false,
                emailSent: false,
                emailSentAt: null,
                registeredAt: new Date().toISOString()
            };
            this.data.participants.push(participant);
            this.saveData();
            this.closeModal();
            this.renderParticipants();
            this.updateEmailBadge();
            this.showToast('Učesnik dodat!', 'success');
            this.logActivity('Novi učesnik', 'Admin', participant.name);
        });
    },

    editParticipant(participantId) {
        const p = this.data.participants.find(x => x.id === participantId);
        const names = p.name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');

        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Uredi učesnika</h3>
                <form id="participantForm" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Ime</label>
                            <input type="text" name="name" value="${firstName}" required class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Prezime</label>
                            <input type="text" name="surname" value="${lastName}" required class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Email</label>
                        <input type="email" name="email" value="${p.email}" required class="form-input">
                    </div>
                    <div>
                        <label class="form-label">Telefon</label>
                        <input type="tel" name="phone" value="${p.phone || ''}" class="form-input">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="form-label">Grad</label>
                            <input type="text" name="city" value="${p.city || ''}" class="form-input">
                        </div>
                        <div>
                            <label class="form-label">Apoteka</label>
                            <input type="text" name="pharmacy" value="${p.pharmacy || ''}" class="form-input">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Titula (opciono)</label>
                        <select name="title" class="form-input">
                            <option value="" ${!p.title ? 'selected' : ''}>-- Izaberi titulu --</option>
                            <option value="Magistar farmacije" ${p.title === 'Magistar farmacije' ? 'selected' : ''}>Magistar farmacije</option>
                            <option value="Farmaceutski tehničar" ${p.title === 'Farmaceutski tehničar' ? 'selected' : ''}>Farmaceutski tehničar</option>
                            <option value="Ljekar" ${p.title === 'Ljekar' ? 'selected' : ''}>Ljekar</option>
                            <option value="Drugo" ${p.title === 'Drugo' ? 'selected' : ''}>Drugo</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Događaj</label>
                        <select name="eventId" class="form-input">
                            ${this.data.events.map(e => `<option value="${e.id}" ${e.id === p.eventId ? 'selected' : ''}>${e.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('participantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            p.name = formData.get('name') + ' ' + formData.get('surname');
            p.email = formData.get('email');
            p.phone = formData.get('phone');
            p.city = formData.get('city');
            p.pharmacy = formData.get('pharmacy');
            p.title = formData.get('title') || '';
            p.eventId = parseInt(formData.get('eventId'));
            this.saveData();
            this.closeModal();
            this.renderParticipants();
            this.showToast('Učesnik ažuriran!', 'success');
        });
    },

    deleteParticipant(participantId) {
        if (!confirm('Da li ste sigurni da želite obrisati ovog učesnika?')) return;
        this.data.participants = this.data.participants.filter(p => p.id !== participantId);
        this.saveData();
        this.renderParticipants();
        this.updateEmailBadge();
        this.showToast('Učesnik obrisan!', 'success');
    },

    showParticipantQR(participantId) {
        const p = this.data.participants.find(x => x.id === participantId);
        this.showLargeModal(`
            <div class="p-8 text-center">
                <h3 class="font-display text-2xl font-bold text-[#1a1a2e] mb-2">${p.name}</h3>
                <p class="text-gray-600 mb-6">${p.email}</p>
                <div class="mb-6 flex justify-center">
                    <div id="participantQRCode"></div>
                </div>
                <div class="bg-gray-100 rounded-lg p-4 mb-6 inline-block">
                    <p class="text-3xl font-mono font-bold text-[#1a1a2e]">${p.qrCode}</p>
                    <p class="text-sm text-gray-500 mt-1">Kod za check-in</p>
                </div>
                <div class="flex gap-3 justify-center">
                    <button onclick="app.downloadParticipantQR(${p.id})" class="btn-primary px-6 py-3 rounded-lg">
                        <i class="fas fa-download mr-2"></i>Preuzmi QR
                    </button>
                    <button onclick="app.closeModal()" class="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Zatvori</button>
                </div>
            </div>
        `);

        setTimeout(() => {
            new QRCode(document.getElementById('participantQRCode'), {
                text: JSON.stringify({ type: 'participant', id: p.id, code: p.qrCode }),
                width: 200,
                height: 200,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }, 100);
    },

    downloadParticipantQR(participantId) {
        this.showToast('QR kod preuzet!', 'success');
    },

    importCSV(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n');
            let imported = 0;

            lines.forEach((line, index) => {
                if (index === 0 || !line.trim()) return;
                const cols = line.split(',');
                if (cols.length >= 4) {
                    const participant = {
                        id: Date.now() + Math.random(),
                        name: (cols[0].trim() + ' ' + cols[1].trim()).trim(),
                        email: cols[2].trim(),
                        phone: cols[3]?.trim(),
                        city: cols[4]?.trim(),
                        pharmacy: cols[5]?.trim(),
                        title: cols[6]?.trim() || '',
                        eventId: parseInt(cols[7]) || 1,
                        qrCode: this.generateQRCode(),
                        checkedIn: false,
                        appInstalled: false,
                        emailSent: false,
                        emailSentAt: null,
                        registeredAt: new Date().toISOString()
                    };
                    this.data.participants.push(participant);
                    imported++;
                }
            });

            this.saveData();
            this.renderParticipants();
            this.updateEmailBadge();
            this.logActivity('Import učesnika', 'Admin', `Uvezeno ${imported} učesnika`);
            this.showToast(`Uspješno uvezeno ${imported} učesnika!`, 'success');
        };
        reader.readAsText(file);
    },

    exportCSV() {
        const headers = ['Ime', 'Prezime', 'Email', 'Telefon', 'Grad', 'Apoteka', 'Titula', 'DogađajID', 'QR Kod', 'Email Poslan', 'Check-in'];
        const rows = this.data.participants.map(p => {
            const names = p.name.split(' ');
            const event = this.data.events.find(e => e.id === p.eventId);
            return [
                names[0],
                names.slice(1).join(' '),
                p.email,
                p.phone || '',
                p.city || '',
                p.pharmacy || '',
                p.title || 'Magistar farmacije',
                p.eventId,
                p.qrCode,
                p.emailSent ? 'Da' : 'Ne',
                p.checkedIn ? 'Da' : 'Ne'
            ];
        });

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ucesnici_summer_essentials.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('CSV exportiran!', 'success');
    },

    // EMAILS
    updateEmailBadge() {
        const pending = this.data.participants.filter(p => !p.emailSent).length;
        const badge = document.getElementById('emailBadge');
        if (pending > 0) {
            badge.textContent = pending;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    renderEmailPage() {
        this.updateEmailStats();
        this.renderEmailList();
        this.updateEmailBadge();
    },

    updateEmailStats() {
        const sent = this.data.participants.filter(p => p.emailSent).length;
        const pending = this.data.participants.filter(p => !p.emailSent).length;

        document.getElementById('emailSentCount').textContent = sent;
        document.getElementById('emailPendingCount').textContent = pending;
        document.getElementById('emailTotalCount').textContent = this.data.participants.length;
    },

    renderEmailList() {
        const filter = this.data.currentEmailFilter || 'all';
        let filtered = [...this.data.participants];

        if (filter === 'pending') filtered = filtered.filter(p => !p.emailSent);
        if (filter === 'sent') filtered = filtered.filter(p => p.emailSent);

        console.log('Email list filter:', filter, 'Total:', this.data.participants.length, 'Filtered:', filtered.length);

        if (filtered.length === 0) {
            document.getElementById('email-list').innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">Nema učesnika</td></tr>';
            return;
        }

        const html = filtered.map(p => {
            const event = this.data.events.find(e => e.id === p.eventId);
            const isSelected = this.data.selectedParticipants.has(p.id);
            const eventName = event ? event.name.split(' - ')[1] : (p.city || '-');

            return `
                <tr class="table-row">
                    <td class="px-4 py-4">
                        ${!p.emailSent ? `<div class="custom-checkbox ${isSelected ? 'checked' : ''}" onclick="app.toggleParticipantSelection(${p.id})"></div>` : ''}
                    </td>
                    <td class="px-4 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full gradient-gold flex items-center justify-center text-white text-xs font-bold">
                                ${p.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <span class="font-medium text-[#1a1a2e]">${p.name}</span>
                        </div>
                    </td>
                    <td class="px-4 py-4 text-sm text-gray-600">${p.email}</td>
                    <td class="px-4 py-4 text-sm text-gray-600">${eventName}</td>
                    <td class="px-4 py-4">
                        <button onclick="app.showParticipantQR(${p.id})" class="text-[#C8A951] hover:text-[#1a1a2e] font-mono text-sm font-medium">
                            ${p.qrCode}
                        </button>
                    </td>
                    <td class="px-4 py-4">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${p.emailSent ? 'email-sent text-white' : 'email-pending text-white'}">
                            ${p.emailSent ? '<i class="fas fa-check mr-1"></i>Poslano' : '<i class="fas fa-times mr-1"></i>Neposlano'}
                        </span>
                    </td>
                    <td class="px-4 py-4 text-sm text-gray-500">
                        ${p.emailSentAt ? new Date(p.emailSentAt).toLocaleDateString('bs-BA') : '-'}
                    </td>
                    <td class="px-4 py-4">
                        ${p.emailSent ?
                            `<button onclick="app.resendEmail(${p.id})" class="text-[#C8A951] hover:text-[#1a1a2e] text-sm font-medium">Ponovi</button>` :
                            `<button onclick="app.previewEmail(${p.id})" class="btn-primary px-3 py-1 rounded text-sm">Pošalji</button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('email-list').innerHTML = html || '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">Nema učesnika</td></tr>';
    },

    filterEmailList(filter) {
        this.data.currentEmailFilter = filter;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');

        this.renderEmailList();
    },

    toggleParticipantSelection(id) {
        if (this.data.selectedParticipants.has(id)) {
            this.data.selectedParticipants.delete(id);
        } else {
            this.data.selectedParticipants.add(id);
        }
        this.updateSelectedCount();
        this.renderEmailList();
    },

    toggleSelectAll() {
        const pending = this.data.participants.filter(p => !p.emailSent);
        const allSelected = pending.every(p => this.data.selectedParticipants.has(p.id));

        if (allSelected) {
            this.data.selectedParticipants.clear();
        } else {
            pending.forEach(p => this.data.selectedParticipants.add(p.id));
        }

        this.updateSelectedCount();
        this.renderEmailList();
    },

    updateSelectedCount() {
        const count = this.data.selectedParticipants.size;
        document.getElementById('selectedCount').textContent = count;
        document.getElementById('sendSelectedBtn').disabled = count === 0;
        document.getElementById('sendSelectedBtn').classList.toggle('opacity-50', count === 0);

        const pending = this.data.participants.filter(p => !p.emailSent);
        const allSelected = pending.length > 0 && pending.every(p => this.data.selectedParticipants.has(p.id));
        const checkbox = document.getElementById('selectAllCheckbox');
        if (allSelected) checkbox.classList.add('checked');
        else checkbox.classList.remove('checked');
    },

    previewEmail(participantId) {
        const p = this.data.participants.find(x => x.id === participantId);
        this.data.currentPreviewParticipant = p;

        this.showLargeModal(`
            <div class="p-8">
                <h3 class="font-display text-2xl font-bold text-[#1a1a2e] mb-6 text-center">Pregled emaila</h3>

                <div class="bg-gray-50 rounded-xl p-6 mb-6">
                    <div class="mb-4">
                        <span class="text-sm text-gray-500">Prima:</span>
                        <p class="font-medium text-[#1a1a2e] text-lg">${p.name} (${p.email})</p>
                    </div>
                    <div class="border-t border-gray-200 pt-4">
                        <p class="text-sm text-gray-500 mb-2">Predmet: Vaš QR kod za D&F Summer Essentials 2026</p>
                        <div class="bg-white rounded-lg p-6 border border-gray-200">
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #C8A951 0%, #e8d78e 100%); padding: 30px; text-align: center;">
                                    <h1 style="color: #1a1a2e; margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">D&F Summer Essentials</h1>
                                    <p style="color: #1a1a2e; margin: 10px 0 0 0;">Vaša prijava je potvrđena!</p>
                                </div>
                                <div style="padding: 30px; background: #fff;">
                                    <p>Poštovani/a <strong>${p.name}</strong>,</p>
                                    <p>Radujemo se vašem dolasku na D&F Summer Essentials edukativni događaj.</p>

                                    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                                        <p style="margin: 0 0 15px 0; color: #666;">Vaš jedinstveni QR kod za ulaz:</p>
                                        
                                        <!-- QR Code Image Container -->
                                        <div id="emailQRCode" style="display: flex; justify-content: center; margin: 15px 0;"></div>
                                        
                                        <div style="font-size: 24px; font-weight: bold; color: #1a1a2e; font-family: monospace; letter-spacing: 2px; margin-top: 10px;">
                                            ${p.qrCode}
                                        </div>
                                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                                            Prikažite ovaj kod na ulazu za brzi check-in
                                        </p>
                                    </div>

                                    <p><strong>Detalji događaja:</strong></p>
                                    <ul>
                                        <li>Datum: ${this.data.events.find(e => e.id === p.eventId)?.date || 'Maj 2026'}</li>
                                        <li>Lokacija: ${this.data.events.find(e => e.id === p.eventId)?.location || 'TBA'}</li>
                                    </ul>

                                    <p style="margin-top: 20px; font-size: 14px; color: #666;">
                                        Preuzmite mobilnu aplikaciju za interaktivni kviz i praćenje rezultata.
                                    </p>
                                </div>
                                <div style="background: #1a1a2e; color: #fff; padding: 20px; text-align: center; font-size: 12px;">
                                    <p>Organizator: Anapharm d.o.o. | anapharm.ba</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex gap-3">
                    <button onclick="app.closeModal()" class="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Zatvori</button>
                    <button onclick="app.confirmSendEmail()" class="flex-1 py-3 rounded-lg btn-primary flex items-center justify-center gap-2">
                        <i class="fas fa-paper-plane"></i>Pošalji email
                    </button>
                </div>
            </div>
        `);

        // Generate QR code after modal is shown
        setTimeout(() => {
            const qrContainer = document.getElementById('emailQRCode');
            if (qrContainer) {
                new QRCode(qrContainer, {
                    text: JSON.stringify({ type: 'participant', id: p.id, code: p.qrCode }),
                    width: 180,
                    height: 180,
                    colorDark: '#1a1a2e',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }, 100);
    },

    confirmSendEmail() {
        if (!this.data.currentPreviewParticipant) return;
        this.sendEmailToParticipant(this.data.currentPreviewParticipant.id);
        this.closeModal();
    },

    sendEmailToParticipant(participantId) {
        const p = this.data.participants.find(x => x.id === participantId);

        // Simulate email sending
        p.emailSent = true;
        p.emailSentAt = new Date().toISOString();
        this.saveData();

        this.logActivity('Email poslan', p.name, `QR kod poslan na ${p.email}`);

        this.updateEmailStats();
        this.renderEmailList();
        this.updateEmailBadge();
        this.updateSelectedCount();

        this.showToast(`Email uspješno poslan: ${p.name}`, 'success');
    },

    resendEmail(participantId) {
        if (!confirm('Da li ste sigurni da želite ponovno poslati email?')) return;
        const p = this.data.participants.find(x => x.id === participantId);
        p.emailSentAt = new Date().toISOString();
        this.saveData();
        this.logActivity('Email ponovljen', p.name, `Ponovno slanje na ${p.email}`);
        this.showToast(`Email ponovno poslan: ${p.name}`, 'success');
    },

    sendSelectedEmails() {
        const ids = Array.from(this.data.selectedParticipants);
        if (ids.length === 0) return;

        if (!confirm(`Poslati email ${ids.length} učesnicima?`)) return;

        let sent = 0;
        ids.forEach(id => {
            const p = this.data.participants.find(x => x.id === id);
            if (p && !p.emailSent) {
                p.emailSent = true;
                p.emailSentAt = new Date().toISOString();
                sent++;
            }
        });

        this.saveData();
        this.data.selectedParticipants.clear();
        this.updateSelectedCount();
        this.renderEmailList();
        this.updateEmailStats();
        this.updateEmailBadge();

        this.showToast(`Poslano ${sent} emailova`, 'success');
        this.logActivity('Masovno slanje', 'Admin', `Poslano ${sent} emailova`);
    },

    sendAllPendingEmails() {
        const pending = this.data.participants.filter(p => !p.emailSent);
        if (pending.length === 0) {
            this.showToast('Svi emailovi su već poslani!', 'warning');
            return;
        }

        if (!confirm(`Poslati email svim ${pending.length} neposlanim učesnicima?`)) return;

        pending.forEach(p => {
            p.emailSent = true;
            p.emailSentAt = new Date().toISOString();
        });

        this.saveData();
        this.renderEmailList();
        this.updateEmailStats();
        this.updateEmailBadge();

        this.showToast(`Poslano ${pending.length} emailova`, 'success');
        this.logActivity('Masovno slanje', 'Admin', `Poslano ${pending.length} emailova`);
    },

    // QUESTIONS
    renderQuestions() {
        const html = this.data.sponsors.filter(s => s.type === 'exclusive').map(sponsor => {
            const questions = this.data.questions[sponsor.id] || [];

            return `
                <div class="glass rounded-xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center text-white font-bold">
                                ${sponsor.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h3 class="font-display text-lg font-bold text-[#1a1a2e]">${sponsor.name}</h3>
                                <p class="text-sm text-gray-500">${questions.length}/20 pitanja</p>
                            </div>
                        </div>
                        <button onclick="app.addQuestion(${sponsor.id})" class="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                            <i class="fas fa-plus"></i>Dodaj pitanje
                        </button>
                    </div>

                    ${questions.length > 0 ? `<div class="space-y-3">
                        ${questions.map((q, idx) => `
                            <div class="p-4 bg-white rounded-lg border border-gray-100">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <p class="font-medium text-[#1a1a2e] mb-2">${idx + 1}. ${q.text}</p>
                                        <div class="grid grid-cols-2 gap-2 text-sm">
                                            ${q.options.map((opt, i) => `
                                                <div class="flex items-center gap-2 ${i === q.correct ? 'text-green-600 font-medium' : 'text-gray-600'}">
                                                    <span class="w-5 h-5 rounded-full ${i === q.correct ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center text-xs">${String.fromCharCode(65 + i)}</span>
                                                    ${opt}
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="flex gap-2 ml-4">
                                        <button onclick="app.editQuestion(${sponsor.id}, ${idx})" class="action-btn edit" title="Uredi">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="app.deleteQuestion(${sponsor.id}, ${idx})" class="action-btn delete" title="Obriši">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>` : '<p class="text-gray-500 text-center py-4">Nema pitanja. Dodajte prvo pitanje.</p>'}
                </div>
            `;
        }).join('');

        document.getElementById('questions-container').innerHTML = html || '<p class="text-gray-500 text-center py-8">Nema ekskluzivnih sponzora</p>';
    },

    addQuestion(sponsorId) {
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Novo pitanje</h3>
                <form id="questionForm" class="space-y-4">
                    <div>
                        <label class="form-label">Tekst pitanja</label>
                        <textarea name="text" required rows="3" class="form-input"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="form-label">Odgovor A</label><input type="text" name="opt0" required class="form-input"></div>
                        <div><label class="form-label">Odgovor B</label><input type="text" name="opt1" required class="form-input"></div>
                        <div><label class="form-label">Odgovor C</label><input type="text" name="opt2" required class="form-input"></div>
                        <div><label class="form-label">Odgovor D</label><input type="text" name="opt3" required class="form-input"></div>
                    </div>
                    <div>
                        <label class="form-label">Tačan odgovor</label>
                        <select name="correct" class="form-input">
                            <option value="0">A</option>
                            <option value="1">B</option>
                            <option value="2">C</option>
                            <option value="3">D</option>
                        </select>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('questionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const question = {
                text: formData.get('text'),
                options: [formData.get('opt0'), formData.get('opt1'), formData.get('opt2'), formData.get('opt3')],
                correct: parseInt(formData.get('correct'))
            };

            if (!this.data.questions[sponsorId]) this.data.questions[sponsorId] = [];
            this.data.questions[sponsorId].push(question);
            this.saveData();
            this.closeModal();
            this.renderQuestions();
            this.showToast('Pitanje dodato!', 'success');
            this.logActivity('Novo pitanje', 'Admin', `Dodato pitanje za sponzora ${sponsorId}`);
        });
    },

    editQuestion(sponsorId, idx) {
        const q = this.data.questions[sponsorId][idx];
        this.showModal(`
            <div class="p-6">
                <h3 class="font-display text-xl font-bold text-[#1a1a2e] mb-4">Uredi pitanje</h3>
                <form id="questionForm" class="space-y-4">
                    <div>
                        <label class="form-label">Tekst pitanja</label>
                        <textarea name="text" required rows="3" class="form-input">${q.text}</textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="form-label">Odgovor A</label><input type="text" name="opt0" value="${q.options[0]}" required class="form-input"></div>
                        <div><label class="form-label">Odgovor B</label><input type="text" name="opt1" value="${q.options[1]}" required class="form-input"></div>
                        <div><label class="form-label">Odgovor C</label><input type="text" name="opt2" value="${q.options[2]}" required class="form-input"></div>
                        <div><label class="form-label">Odgovor D</label><input type="text" name="opt3" value="${q.options[3]}" required class="form-input"></div>
                    </div>
                    <div>
                        <label class="form-label">Tačan odgovor</label>
                        <select name="correct" class="form-input">
                            <option value="0" ${q.correct === 0 ? 'selected' : ''}>A</option>
                            <option value="1" ${q.correct === 1 ? 'selected' : ''}>B</option>
                            <option value="2" ${q.correct === 2 ? 'selected' : ''}>C</option>
                            <option value="3" ${q.correct === 3 ? 'selected' : ''}>D</option>
                        </select>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="button" onclick="app.closeModal()" class="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Otkaži</button>
                        <button type="submit" class="flex-1 py-2 rounded-lg btn-primary">Sačuvaj</button>
                    </div>
                </form>
            </div>
        `);

        document.getElementById('questionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            q.text = formData.get('text');
            q.options = [formData.get('opt0'), formData.get('opt1'), formData.get('opt2'), formData.get('opt3')];
            q.correct = parseInt(formData.get('correct'));
            this.saveData();
            this.closeModal();
            this.renderQuestions();
            this.showToast('Pitanje ažurirano!', 'success');
        });
    },

    deleteQuestion(sponsorId, idx) {
        if (!confirm('Da li ste sigurni da želite obrisati ovo pitanje?')) return;
        this.data.questions[sponsorId].splice(idx, 1);
        this.saveData();
        this.renderQuestions();
        this.showToast('Pitanje obrisano!', 'success');
    },

    // LEADERBOARD
    renderLeaderboard() {
        const leaderboard = this.calculateLeaderboard();

        const html = leaderboard.map((entry, index) => `
            <div class="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 ${index < 3 ? 'border-l-4 border-l-[#C8A951]' : ''}">
                <div class="w-12 h-12 rounded-full ${index === 0 ? 'gradient-gold' : index === 1 ? 'gradient-turquoise' : index === 2 ? 'bg-purple-500' : 'bg-gray-100'} flex items-center justify-center text-white font-bold text-lg">
                    ${index + 1}
                </div>
                <div class="flex-1">
                    <h4 class="font-semibold text-[#1a1a2e] text-lg">${entry.name}</h4>
                    <p class="text-sm text-gray-500">${entry.quizzes} kvizova • ${Math.round(entry.totalTime / 1000)}s ukupno</p>
                </div>
                <div class="text-right">
                    <p class="text-3xl font-bold text-[#1a1a2e]">${entry.totalScore}</p>
                    <p class="text-sm text-gray-500">bodova</p>
                </div>
                <div class="px-4">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${entry.tier === 1 ? 'tier-badge-1' : entry.tier === 2 ? 'tier-badge-2' : 'tier-badge-3'}">
                        Tier ${entry.tier}
                    </span>
                </div>
            </div>
        `).join('');

        document.getElementById('full-leaderboard').innerHTML = html || '<p class="text-gray-500 text-center py-8">Nema podataka o kvizovima</p>';
    },

    // DATA EXPORT/IMPORT
    exportData() {
        const data = JSON.stringify(this.data, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'summer_essentials_backup.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Backup exportiran!', 'success');
    },

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    this.data = { ...this.data, ...data };
                    this.saveData();
                    this.showToast('Backup učitan!', 'success');
                    this.renderDashboard();
                } catch (err) {
                    this.showToast('Greška pri učitavanju!', 'error');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
