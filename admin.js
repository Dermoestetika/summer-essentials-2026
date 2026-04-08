// Admin Panel JavaScript for D&F Summer Essentials 2026

// Global state
let currentData = {
    events: [],
    participants: [],
    sponsors: [],
    questions: [],
    settings: {}
};

let currentEventId = 'all';
let currentSponsorId = null;
let editingParticipantId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
});

async function initAdmin() {
    await loadData();
    renderDashboard();
    setupEventListeners();
    
    // Check authentication
    if (!sessionStorage.getItem('adminLoggedIn')) {
        showLoginModal();
    }
}

// Data Management
async function loadData() {
    try {
        const response = await fetch('/api/data');
        currentData = await response.json();
        return currentData;
    } catch (err) {
        console.error('Failed to load data:', err);
        showNotification('Greška pri učitavanju podataka', 'error');
    }
}

async function saveData() {
    try {
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentData)
        });
        
        if (response.ok) {
            showNotification('Podaci su sačuvani', 'success');
            return true;
        }
    } catch (err) {
        console.error('Failed to save data:', err);
        showNotification('Greška pri čuvanju podataka', 'error');
        return false;
    }
}

// Login
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function login() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (email === 'admin@anapharm.ba' && password === 'admin2026') {
        sessionStorage.setItem('adminLoggedIn', 'true');
        hideLoginModal();
        showNotification('Uspješna prijava!', 'success');
    } else {
        showNotification('Neispravni podaci za prijavu', 'error');
    }
}

function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    showLoginModal();
    showNotification('Odjavljeni ste', 'info');
}

// Navigation
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Load section data
    switch(sectionId) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'events':
            renderEvents();
            break;
        case 'sponsors':
            renderSponsors();
            break;
        case 'participants':
            renderParticipants();
            break;
        case 'questions':
            renderQuestions();
            break;
        case 'leaderboard':
            renderLeaderboard();
            break;
        case 'qrCodes':
            renderQRCodes();
            break;
    }
}

// Dashboard
function renderDashboard() {
    const totalParticipants = currentData.participants?.length || 0;
    const checkedIn = currentData.participants?.filter(p => p.checkedIn).length || 0;
    const quizCompleted = currentData.participants?.filter(p => p.quizCompleted).length || 0;
    const emailsSent = currentData.participants?.filter(p => p.emailSent).length || 0;
    
    // Update stats
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${totalParticipants}</div>
            <div class="stat-label">Ukupno učesnika</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${checkedIn}</div>
            <div class="stat-label">Check-in</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${emailsSent}</div>
            <div class="stat-label">Email poslano</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${quizCompleted}</div>
            <div class="stat-label">Završenih kvizova</div>
        </div>
    `;
    
    const statsContainer = document.getElementById('dashboardStats');
    if (statsContainer) {
        statsContainer.innerHTML = statsHtml;
    }
    
    // Recent activity
    const recentActivity = currentData.participants
        ?.filter(p => p.checkedInAt)
        .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
        .slice(0, 5) || [];
    
    const activityHtml = recentActivity.map(p => `
        <tr>
            <td>${formatDate(p.checkedInAt)}</td>
            <td>${p.name}</td>
            <td>Check-in</td>
            <td>${p.qrCode}</td>
        </tr>
    `).join('');
    
    const activityTable = document.getElementById('recentActivity');
    if (activityTable) {
        activityTable.innerHTML = activityHtml || '<tr><td colspan="4">Nema nedavnih aktivnosti</td></tr>';
    }
}

// Events
function renderEvents() {
    const eventsList = document.getElementById('eventsList');
    if (!eventsList) return;
    
    const html = currentData.events?.map(event => `
        <div class="event-card">
            <h3>${event.name}</h3>
            <p><strong>Datum:</strong> ${event.date}</p>
            <p><strong>Vrijeme:</strong> ${event.time}</p>
            <p><strong>Lokacija:</strong> ${event.location}</p>
            <div class="event-actions">
                <button onclick="editEvent(${event.id})" class="btn-secondary">Uredi</button>
            </div>
        </div>
    `).join('') || '<p>Nema događaja</p>';
    
    eventsList.innerHTML = html;
}

// Sponsors
function renderSponsors() {
    const sponsorsList = document.getElementById('sponsorsList');
    if (!sponsorsList) return;
    
    const html = currentData.sponsors?.map(sponsor => `
        <div class="sponsor-card">
            <h3>${sponsor.name}</h3>
            <p><strong>Tip:</strong> ${sponsor.type}</p>
            <p><strong>Status:</strong> ${sponsor.active ? 'Aktivan' : 'Neaktivan'}</p>
            <div class="sponsor-actions">
                <button onclick="editSponsor(${sponsor.id})" class="btn-secondary">Uredi</button>
                <button onclick="manageQuestions(${sponsor.id})" class="btn-primary">Pitanja</button>
            </div>
        </div>
    `).join('') || '<p>Nema sponzora</p>';
    
    sponsorsList.innerHTML = html;
}

// Participants
function renderParticipants() {
    const participantsList = document.getElementById('participantsList');
    if (!participantsList) return;
    
    let participants = currentData.participants || [];
    
    // Filter by event
    if (currentEventId !== 'all') {
        participants = participants.filter(p => p.eventId == currentEventId);
    }
    
    const html = participants.map(p => `
        <tr>
            <td><input type="checkbox" class="email-checkbox" data-id="${p.id}"></td>
            <td>${p.name}</td>
            <td>${p.email}</td>
            <td>${getEventName(p.eventId)}</td>
            <td>${p.city}</td>
            <td>${p.pharmacy || '-'}</td>
            <td>${p.qrCode}</td>
            <td>${p.emailSent ? '✅' : '❌'}</td>
            <td>${p.checkedIn ? '✅' : '❌'}</td>
            <td>
                <button onclick="editParticipant(${p.id})" class="btn-sm">Uredi</button>
                <button onclick="sendQREmail(${p.id})" class="btn-sm btn-secondary">📧 Pošalji</button>
            </td>
        </tr>
    `).join('');
    
    participantsList.innerHTML = html || '<tr><td colspan="10">Nema učesnika</td></tr>';
    
    // Update event filter
    const eventFilter = document.getElementById('eventFilter');
    if (eventFilter && eventFilter.options.length <= 1) {
        currentData.events?.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = event.name;
            eventFilter.appendChild(option);
        });
    }
}

// Email Functions
async function sendQREmail(participantId) {
    try {
        showNotification('Slanje emaila...', 'info');
        
        const response = await fetch('/api/send-qr-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Email uspješno poslan!', 'success');
            // Mark as sent locally
            const participant = currentData.participants.find(p => p.id === participantId);
            if (participant) {
                participant.emailSent = true;
                participant.emailSentAt = new Date().toISOString();
            }
            renderParticipants();
            return true;
        } else {
            showNotification('Greška: ' + result.error, 'error');
            return false;
        }
    } catch (err) {
        console.error('Send email error:', err);
        showNotification('Greška pri slanju emaila', 'error');
        return false;
    }
}

async function sendBulkEmails() {
    const checkboxes = document.querySelectorAll('.email-checkbox:checked');
    const participantIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    if (participantIds.length === 0) {
        showNotification('Odaberite učesnike za slanje', 'warning');
        return;
    }
    
    try {
        showNotification(`Slanje ${participantIds.length} emailova...`, 'info');
        
        const response = await fetch('/api/send-bulk-qr-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantIds })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Poslano: ${result.results.sent}, Neuspješno: ${result.results.failed}`, 'success');
            // Update local data
            participantIds.forEach(id => {
                const p = currentData.participants.find(part => part.id === id);
                if (p && !result.results.errors.find(e => e.id === id)) {
                    p.emailSent = true;
                    p.emailSentAt = new Date().toISOString();
                }
            });
            renderParticipants();
        } else {
            showNotification('Greška pri slanju', 'error');
        }
    } catch (err) {
        console.error('Bulk send error:', err);
        showNotification('Greška pri slanju emailova', 'error');
    }
}

async function sendAllUnsentEmails() {
    const unsentParticipants = currentData.participants.filter(p => !p.emailSent && p.email);
    
    if (unsentParticipants.length === 0) {
        showNotification('Nema neposlanih emailova', 'info');
        return;
    }
    
    if (!confirm(`Poslati ${unsentParticipants.length} emailova?`)) return;
    
    const participantIds = unsentParticipants.map(p => p.id);
    
    try {
        showNotification(`Slanje ${participantIds.length} emailova...`, 'info');
        
        const response = await fetch('/api/send-bulk-qr-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantIds })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Poslano: ${result.results.sent}, Neuspješno: ${result.results.failed}`, 'success');
            await loadData();
            renderParticipants();
        }
    } catch (err) {
        console.error('Bulk send error:', err);
        showNotification('Greška pri slanju', 'error');
    }
}

async function sendTestEmail() {
    const email = prompt('Unesite email za test:');
    if (!email) return;
    
    try {
        showNotification('Slanje testnog emaila...', 'info');
        
        const response = await fetch('/api/test-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Testni email poslan! Provjerite inbox.', 'success');
        } else {
            showNotification('Greška: ' + result.error, 'error');
        }
    } catch (err) {
        console.error('Test email error:', err);
        showNotification('Greška pri slanju testnog emaila', 'error');
    }
}

function selectAllEmails() {
    const checkboxes = document.querySelectorAll('.email-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
}

// Questions
function renderQuestions() {
    const questionsList = document.getElementById('questionsList');
    if (!questionsList) return;
    
    let questions = currentData.questions || [];
    
    if (currentSponsorId) {
        questions = questions.filter(q => q.sponsorId === currentSponsorId);
    }
    
    const html = questions.map((q, index) => `
        <div class="question-card">
            <div class="question-header">
                <span class="question-number">#${index + 1}</span>
                <span class="sponsor-badge">${getSponsorName(q.sponsorId)}</span>
            </div>
            <p class="question-text">${q.question}</p>
            <div class="question-options">
                ${q.options.map((opt, i) => `
                    <div class="option ${i === q.correctAnswer ? 'correct' : ''}">
                        ${String.fromCharCode(65 + i)}. ${opt}
                    </div>
                `).join('')}
            </div>
            <div class="question-actions">
                <button onclick="editQuestion(${q.id})" class="btn-secondary">Uredi</button>
                <button onclick="deleteQuestion(${q.id})" class="btn-danger">Obriši</button>
            </div>
        </div>
    `).join('');
    
    questionsList.innerHTML = html || '<p>Nema pitanja</p>';
}

// Leaderboard
async function renderLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList) return;
    
    try {
        const response = await fetch(`/api/leaderboard?eventId=${currentEventId}`);
        const participants = await response.json();
        
        const html = participants.map((p, index) => `
            <tr class="${index < 3 ? 'top-' + (index + 1) : ''}">
                <td class="rank">${index + 1}</td>
                <td>${p.name}</td>
                <td>${getEventName(p.eventId)}</td>
                <td>${p.city}</td>
                <td class="score">${p.score || 0}</td>
                <td>${p.quizCompleted ? '✅' : '❌'}</td>
            </tr>
        `).join('');
        
        leaderboardList.innerHTML = html || '<tr><td colspan="6">Nema podataka</td></tr>';
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
    }
}

// QR Codes
function renderQRCodes() {
    const qrCodesList = document.getElementById('qrCodesList');
    if (!qrCodesList) return;
    
    const unsentParticipants = currentData.participants?.filter(p => !p.emailSent) || [];
    
    const statsHtml = `
        <div class="email-stats">
            <div class="stat-item">
                <span class="stat-label">Ukupno učesnika:</span>
                <span class="stat-value">${currentData.participants?.length || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Poslano emailova:</span>
                <span class="stat-value">${currentData.participants?.filter(p => p.emailSent).length || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Neposlano:</span>
                <span class="stat-value">${unsentParticipants.length}</span>
            </div>
        </div>
        <div class="email-actions">
            <button onclick="sendTestEmail()" class="btn-secondary">📧 Test Email</button>
            <button onclick="sendAllUnsentEmails()" class="btn-primary" ${unsentParticipants.length === 0 ? 'disabled' : ''}>
                Pošalji sve neposlane (${unsentParticipants.length})
            </button>
        </div>
    `;
    
    const tableHtml = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Učesnik</th>
                    <th>Email</th>
                    <th>Događaj</th>
                    <th>QR Kod</th>
                    <th>Status</th>
                    <th>Akcije</th>
                </tr>
            </thead>
            <tbody>
                ${currentData.participants?.map(p => `
                    <tr>
                        <td>${p.name}</td>
                        <td>${p.email}</td>
                        <td>${getEventName(p.eventId)}</td>
                        <td>${p.qrCode}</td>
                        <td>${p.emailSent ? '✅ Poslano' : '❌ Neposlano'}</td>
                        <td>
                            ${!p.emailSent ? `
                                <button onclick="sendQREmail(${p.id})" class="btn-sm btn-primary">Pošalji</button>
                            ` : `
                                <button onclick="sendQREmail(${p.id})" class="btn-sm btn-secondary">Ponovi</button>
                            `}
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="6">Nema učesnika</td></tr>'}
            </tbody>
        </table>
    `;
    
    qrCodesList.innerHTML = statsHtml + tableHtml;
}

// Participant Management
function showAddParticipantModal() {
    editingParticipantId = null;
    document.getElementById('participantModalTitle').textContent = 'Dodaj učesnika';
    document.getElementById('participantForm').reset();
    document.getElementById('participantModal').style.display = 'flex';
}

function hideParticipantModal() {
    document.getElementById('participantModal').style.display = 'none';
}

function editParticipant(id) {
    const participant = currentData.participants.find(p => p.id === id);
    if (!participant) return;
    
    editingParticipantId = id;
    document.getElementById('participantModalTitle').textContent = 'Uredi učesnika';
    document.getElementById('participantName').value = participant.name;
    document.getElementById('participantEmail').value = participant.email;
    document.getElementById('participantEvent').value = participant.eventId;
    document.getElementById('participantCity').value = participant.city || '';
    document.getElementById('participantPharmacy').value = participant.pharmacy || '';
    document.getElementById('participantQR').value = participant.qrCode;
    
    document.getElementById('participantModal').style.display = 'flex';
}

async function saveParticipant() {
    const name = document.getElementById('participantName').value;
    const email = document.getElementById('participantEmail').value;
    const eventId = parseInt(document.getElementById('participantEvent').value);
    const city = document.getElementById('participantCity').value;
    const pharmacy = document.getElementById('participantPharmacy').value;
    const qrCode = document.getElementById('participantQR').value || generateQRCode();
    
    if (!name || !email || !eventId) {
        showNotification('Popunite obavezna polja', 'warning');
        return;
    }
    
    const participantData = {
        id: editingParticipantId || Date.now(),
        name,
        email,
        eventId,
        city,
        pharmacy,
        qrCode,
        score: 0,
        checkedIn: false,
        emailSent: false,
        quizCompleted: false,
        answeredQuestions: [],
        createdAt: new Date().toISOString()
    };
    
    if (editingParticipantId) {
        const index = currentData.participants.findIndex(p => p.id === editingParticipantId);
        if (index !== -1) {
            currentData.participants[index] = { ...currentData.participants[index], ...participantData };
        }
    } else {
        currentData.participants.push(participantData);
    }
    
    await saveData();
    hideParticipantModal();
    renderParticipants();
    renderDashboard();
}

function generateQRCode() {
    const prefix = 'SE';
    const random = Math.floor(10000000 + Math.random() * 90000000);
    return prefix + random;
}

function deleteParticipant(id) {
    if (!confirm('Jeste li sigurni da želite obrisati učesnika?')) return;
    
    currentData.participants = currentData.participants.filter(p => p.id !== id);
    saveData();
    renderParticipants();
    renderDashboard();
}

// Import/Export
function exportToCSV() {
    const headers = ['ID', 'Ime', 'Email', 'Događaj', 'Grad', 'Apoteka', 'QR Kod', 'Check-in', 'Email Poslan', 'Bodovi'];
    const rows = currentData.participants.map(p => [
        p.id,
        p.name,
        p.email,
        getEventName(p.eventId),
        p.city,
        p.pharmacy,
        p.qrCode,
        p.checkedIn ? 'Da' : 'Ne',
        p.emailSent ? 'Da' : 'Ne',
        p.score || 0
    ]);
    
    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    downloadFile(csv, 'participants.csv', 'text/csv');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import CSV
function showImportModal() {
    document.getElementById('importModal').style.display = 'flex';
}

function hideImportModal() {
    document.getElementById('importModal').style.display = 'none';
}

function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result;
        parseCSV(text);
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const importedParticipants = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const participant = {};
        
        headers.forEach((header, index) => {
            participant[header.toLowerCase()] = values[index];
        });
        
        // Map CSV fields to participant object
        const newParticipant = {
            id: Date.now() + i,
            name: participant.ime || participant.name || '',
            email: participant.email || '',
            eventId: getEventIdByName(participant.događaj || participant.event),
            city: participant.grad || participant.city || '',
            pharmacy: participant.apoteka || participant.pharmacy || '',
            qrCode: generateQRCode(),
            score: 0,
            checkedIn: false,
            emailSent: false,
            quizCompleted: false,
            answeredQuestions: [],
            createdAt: new Date().toISOString()
        };
        
        if (newParticipant.name && newParticipant.email) {
            importedParticipants.push(newParticipant);
        }
    }
    
    currentData.participants = [...currentData.participants, ...importedParticipants];
    saveData();
    hideImportModal();
    renderParticipants();
    renderDashboard();
    
    showNotification(`Uvezeno ${importedParticipants.length} učesnika`, 'success');
}

// Helpers
function getEventName(eventId) {
    const event = currentData.events?.find(e => e.id == eventId);
    return event?.name || 'Nepoznato';
}

function getEventIdByName(name) {
    const event = currentData.events?.find(e => e.name.toLowerCase().includes(name.toLowerCase()));
    return event?.id || 1;
}

function getSponsorName(sponsorId) {
    const sponsor = currentData.sponsors?.find(s => s.id === sponsorId);
    return sponsor?.name || 'Nepoznato';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('bs-BA');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Event Listeners
function setupEventListeners() {
    // Login
    document.getElementById('loginBtn')?.addEventListener('click', login);
    
    // Filter change
    document.getElementById('eventFilter')?.addEventListener('change', (e) => {
        currentEventId = e.target.value;
        renderParticipants();
    });
    
    // Form submissions
    document.getElementById('participantForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveParticipant();
    });
    
    // CSV import
    document.getElementById('csvFile')?.addEventListener('change', handleCSVImport);
}

// Settings
function toggleEventStart() {
    currentData.settings.eventStarted = !currentData.settings.eventStarted;
    saveData();
    showNotification(currentData.settings.eventStarted ? 'Događaj je pokrenut!' : 'Događaj je pauziran', 'success');
}

function toggleQuiz() {
    currentData.settings.quizEnabled = !currentData.settings.quizEnabled;
    saveData();
    showNotification(currentData.settings.quizEnabled ? 'Kviz je omogućen!' : 'Kviz je onemogućen', 'success');
}

// Live updates
setInterval(async () => {
    if (document.visibilityState === 'visible') {
        await loadData();
        const activeSection = document.querySelector('.admin-section[style*="block"]');
        if (activeSection) {
            const sectionId = activeSection.id;
            switch(sectionId) {
                case 'dashboard':
                    renderDashboard();
                    break;
                case 'participants':
                    renderParticipants();
                    break;
                case 'leaderboard':
                    renderLeaderboard();
                    break;
                case 'qrCodes':
                    renderQRCodes();
                    break;
            }
        }
    }
}, 30000); // Update every 30 seconds

// Export data
function exportData() {
    const dataStr = JSON.stringify(currentData, null, 2);
    downloadFile(dataStr, 'summer-essentials-backup.json', 'application/json');
}

// Import data
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            currentData = importedData;
            await saveData();
            renderDashboard();
            showNotification('Podaci su uvezeni!', 'success');
        } catch (err) {
            showNotification('Greška pri uvozu podataka', 'error');
        }
    };
    reader.readAsText(file);
}

console.log('🎛️ Admin Panel loaded');
