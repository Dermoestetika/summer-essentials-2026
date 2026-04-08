// Admin Panel JavaScript for D&F Summer Essentials 2026

let currentData = { events: [], participants: [], sponsors: [], questions: [], settings: {} };
let currentEventId = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
});

async function initAdmin() {
    await loadData();
    if (!sessionStorage.getItem('adminLoggedIn')) {
        showLoginModal();
    } else {
        showSection('dashboard');
    }
}

async function loadData() {
    try {
        const response = await fetch('/api/data');
        currentData = await response.json();
    } catch (err) {
        console.error('Failed to load data:', err);
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function login() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (email === 'admin@anapharm.ba' && password === 'admin2026') {
        sessionStorage.setItem('adminLoggedIn', 'true');
        hideLoginModal();
        showSection('dashboard');
    } else {
        alert('Neispravni podaci za prijavu');
    }
}

function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    showLoginModal();
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
    const selected = document.getElementById(sectionId);
    if (selected) selected.style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const navItem = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (navItem) navItem.classList.add('active');
    
    switch(sectionId) {
        case 'dashboard': renderDashboard(); break;
        case 'participants': renderParticipants(); break;
        case 'qrCodes': renderQRCodes(); break;
        case 'leaderboard': renderLeaderboard(); break;
    }
}

function renderDashboard() {
    const total = currentData.participants?.length || 0;
    const checkedIn = currentData.participants?.filter(p => p.checkedIn).length || 0;
    const emailsSent = currentData.participants?.filter(p => p.emailSent).length || 0;
    
    const stats = document.getElementById('dashboardStats');
    if (stats) {
        stats.innerHTML = `
            <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Učesnika</div></div>
            <div class="stat-card"><div class="stat-value">${checkedIn}</div><div class="stat-label">Check-in</div></div>
            <div class="stat-card"><div class="stat-value">${emailsSent}</div><div class="stat-label">Email poslano</div></div>
        `;
    }
}

function renderParticipants() {
    const tbody = document.getElementById('participantsList');
    if (!tbody) return;
    
    let participants = currentData.participants || [];
    if (currentEventId !== 'all') {
        participants = participants.filter(p => p.eventId == currentEventId);
    }
    
    tbody.innerHTML = participants.map(p => `
        <tr>
            <td><input type="checkbox" value="${p.id}"></td>
            <td>${p.name}</td>
            <td>${p.email}</td>
            <td>${getEventName(p.eventId)}</td>
            <td>${p.city}</td>
            <td>${p.qrCode}</td>
            <td>${p.emailSent ? '✅' : '❌'}</td>
            <td>
                <button onclick="sendQREmail(${p.id})" class="btn-sm">📧 Pošalji</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8">Nema učesnika</td></tr>';
}

function getEventName(id) {
    const e = currentData.events?.find(ev => ev.id == id);
    return e?.name || 'Nepoznato';
}

// EMAIL FUNKCIJE

function sendTestEmail() {
    const email = prompt('Unesite email za test:');
    if (!email) return;
    
    fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(r => r.json())
    .then(result => {
        alert(result.success ? 'Testni email poslan!' : 'Greška: ' + result.error);
    })
    .catch(err => alert('Greška: ' + err.message));
}

function sendQREmail(participantId) {
    if (!confirm('Poslati QR kod emailom?')) return;
    
    fetch('/api/send-qr-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId })
    })
    .then(r => r.json())
    .then(result => {
        alert(result.success ? 'Email poslan!' : 'Greška: ' + result.error);
        if (result.success) {
            const p = currentData.participants.find(x => x.id === participantId);
            if (p) { p.emailSent = true; renderParticipants(); }
        }
    })
    .catch(err => alert('Greška: ' + err.message));
}

function sendBulkEmails() {
    const checkboxes = document.querySelectorAll('#participantsList input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
        alert('Odaberite učesnike!');
        return;
    }
    
    if (!confirm(`Poslati ${ids.length} emailova?`)) return;
    
    fetch('/api/send-bulk-qr-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: ids })
    })
    .then(r => r.json())
    .then(result => {
        alert(`Poslano: ${result.results?.sent || 0}, Neuspješno: ${result.results?.failed || 0}`);
        if (result.results?.sent > 0) loadData().then(renderParticipants);
    })
    .catch(err => alert('Greška: ' + err.message));
}

function sendAllUnsentEmails() {
    const unsent = currentData.participants?.filter(p => !p.emailSent && p.email) || [];
    if (unsent.length === 0) {
        alert('Nema neposlanih emailova!');
        return;
    }
    if (!confirm(`Poslati ${unsent.length} emailova?`)) return;
    
    const ids = unsent.map(p => p.id);
    fetch('/api/send-bulk-qr-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: ids })
    })
    .then(r => r.json())
    .then(result => {
        alert(`Poslano: ${result.results?.sent || 0}`);
        if (result.results?.sent > 0) loadData().then(renderQRCodes);
    })
    .catch(err => alert('Greška: ' + err.message));
}

function renderQRCodes() {
    const container = document.getElementById('qrCodesList');
    if (!container) return;
    
    const total = currentData.participants?.length || 0;
    const sent = currentData.participants?.filter(p => p.emailSent).length || 0;
    const unsent = total - sent;
    
    container.innerHTML = `
        <div style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; gap: 30px; margin-bottom: 15px;">
                <div><strong>Ukupno:</strong> ${total}</div>
                <div><strong>Poslano:</strong> ${sent}</div>
                <div><strong>Neposlano:</strong> ${unsent}</div>
            </div>
            <button onclick="sendTestEmail()" style="margin-right: 10px;">📧 Test Email</button>
            <button onclick="sendAllUnsentEmails()" ${unsent === 0 ? 'disabled' : ''}>
                Pošalji sve neposlane (${unsent})
            </button>
        </div>
        <table class="data-table">
            <thead>
                <tr><th>Učesnik</th><th>Email</th><th>Događaj</th><th>QR Kod</th><th>Status</th><th>Akcija</th></tr>
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
                            <button onclick="sendQREmail(${p.id})">
                                ${p.emailSent ? 'Ponovi' : 'Pošalji'}
                            </button>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="6">Nema učesnika</td></tr>'}
            </tbody>
        </table>
    `;
}

async function renderLeaderboard() {
    const tbody = document.getElementById('leaderboardList');
    if (!tbody) return;
    
    try {
        const response = await fetch(`/api/leaderboard?eventId=${currentEventId}`);
        const participants = await response.json();
        
        tbody.innerHTML = participants.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${getEventName(p.eventId)}</td>
                <td>${p.city}</td>
                <td><strong>${p.score || 0}</strong></td>
            </tr>
        `).join('') || '<tr><td colspan="5">Nema podataka</td></tr>';
    } catch (err) {
        console.error('Leaderboard error:', err);
    }
}

setInterval(() => {
    if (document.visibilityState === 'visible' && sessionStorage.getItem('adminLoggedIn')) {
        loadData();
    }
}, 30000);

console.log('🎛️ Admin Panel loaded');
