// Admin Panel - Summer Essentials 2026

let currentData = { events: [], participants: [], sponsors: [], questions: [], settings: {} };
let currentEventId = 'all';

document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

async function initAdmin() {
  await loadData();
  if (!sessionStorage.getItem('adminLoggedIn')) showLoginModal();
  else showSection('dashboard');
}

async function loadData() {
  try {
    const r = await fetch('/api/data');
    currentData = await r.json();
  } catch (e) { console.error(e); }
}

function showLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) m.style.display = 'flex';
}

function hideLoginModal() {
  const m = document.getElementById('loginModal');
  if (m) m.style.display = 'none';
}

function login() {
  const email = document.getElementById('loginEmail')?.value;
  const pass = document.getElementById('loginPassword')?.value;
  if (email === 'admin@anapharm.ba' && pass === 'admin2026') {
    sessionStorage.setItem('adminLoggedIn', 'true');
    hideLoginModal();
    showSection('dashboard');
  } else {
    alert('Pogrešan login!');
  }
}

function logout() {
  sessionStorage.removeItem('adminLoggedIn');
  showLoginModal();
}

function showSection(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`[onclick="showSection('${id}')"]`);
  if (nav) nav.classList.add('active');
  
  if (id === 'dashboard') renderDashboard();
  if (id === 'participants') renderParticipants();
  if (id === 'qrCodes') renderQRCodes();
}

function renderDashboard() {
  const total = currentData.participants?.length || 0;
  const checked = currentData.participants?.filter(p => p.checkedIn).length || 0;
  const emails = currentData.participants?.filter(p => p.emailSent).length || 0;
  
  const stats = document.getElementById('dashboardStats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Učesnika</div></div>
      <div class="stat-card"><div class="stat-value">${checked}</div><div class="stat-label">Check-in</div></div>
      <div class="stat-card"><div class="stat-value">${emails}</div><div class="stat-label">Email poslano</div></div>
    `;
  }
}

function getEventName(id) {
  const e = currentData.events?.find(ev => ev.id == id);
  return e?.name?.split(' - ')[0] || 'Nepoznato';
}

function renderParticipants() {
  const tbody = document.getElementById('participantsList');
  if (!tbody) return;
  
  let list = currentData.participants || [];
  if (currentEventId !== 'all') list = list.filter(p => p.eventId == currentEventId);
  
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><input type="checkbox" value="${p.id}"></td>
      <td>${p.name}</td>
      <td>${p.email}</td>
      <td>${getEventName(p.eventId)}</td>
      <td>${p.city}</td>
      <td>${p.qrCode}</td>
      <td>${p.emailSent ? '✅' : '❌'}</td>
      <td><button onclick="sendOneEmail(${p.id})" style="padding:5px 10px;background:#667eea;color:white;border:none;border-radius:4px;cursor:pointer;">📧 Pošalji</button></td>
    </tr>
  `).join('') || '<tr><td colspan="8">Nema učesnika</td></tr>';
}

// EMAIL FUNKCIJE

function sendOneEmail(id) {
  if (!confirm('Poslati email ovom učesniku?')) return;
  
  fetch('/api/send-qr-email', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({participantId: id})
  })
  .then(r => r.json())
  .then(res => {
    alert(res.success ? '✅ Email poslan!' : '❌ Greška: ' + res.error);
    if (res.success) {
      const p = currentData.participants.find(x => x.id === id);
      if (p) { p.emailSent = true; renderParticipants(); renderDashboard(); }
    }
  })
  .catch(e => alert('Greška: ' + e.message));
}

function sendTest() {
  const email = prompt('Unesi email za test:');
  if (!email) return;
  
  fetch('/api/test-email', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email})
  })
  .then(r => r.json())
  .then(res => alert(res.success ? '✅ Testni email poslan!' : '❌ Greška: ' + res.error))
  .catch(e => alert('Greška: ' + e.message));
}

function sendAllPending() {
  const unsent = currentData.participants?.filter(p => !p.emailSent && p.email) || [];
  if (unsent.length === 0) {
    alert('Nema neposlanih emailova!');
    return;
  }
  if (!confirm(`Poslati ${unsent.length} emailova?`)) return;
  
  fetch('/api/send-bulk-qr-emails', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({participantIds: unsent.map(p => p.id)})
  })
  .then(r => r.json())
  .then(res => {
    alert(`✅ Poslano: ${res.results?.sent || 0}\n❌ Neuspješno: ${res.results?.failed || 0}`);
    loadData().then(() => { renderQRCodes(); renderDashboard(); });
  })
  .catch(e => alert('Greška: ' + e.message));
}

function renderQRCodes() {
  const div = document.getElementById('qrCodesList');
  if (!div) return;
  
  const total = currentData.participants?.length || 0;
  const sent = currentData.participants?.filter(p => p.emailSent).length || 0;
  const pending = total - sent;
  
  div.innerHTML = `
    <div style="padding:20px;background:#f5f5f5;border-radius:8px;margin-bottom:20px;">
      <div style="display:flex;gap:30px;margin-bottom:15px;font-size:18px;">
        <div>👥 <strong>Ukupno:</strong> ${total}</div>
        <div>✅ <strong>Poslano:</strong> ${sent}</div>
        <div>⏳ <strong>Čeka:</strong> ${pending}</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="sendTest()" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;">📧 Test Email</button>
        <button onclick="sendAllPending()" ${pending === 0 ? 'disabled' : ''} style="padding:10px 20px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;${pending === 0 ? 'opacity:0.5;' : ''}">🚀 Pošalji svih ${pending} emailova</button>
      </div>
    </div>
    <table class="data-table" style="width:100%;border-collapse:collapse;">
      <thead style="background:#f8f9fa;">
        <tr><th style="padding:12px;">Učesnik</th><th>Email</th><th>Grad</th><th>QR Kod</th><th>Status</th><th>Akcija</th></tr>
      </thead>
      <tbody>
        ${currentData.participants?.map(p => `
          <tr style="border-bottom:1px solid #dee2e6;">
            <td style="padding:12px;">${p.name}</td>
            <td>${p.email}</td>
            <td>${p.city}</td>
            <td><code>${p.qrCode}</code></td>
            <td>${p.emailSent ? '✅ Poslano' : '⏳ Čeka'}</td>
            <td><button onclick="sendOneEmail(${p.id})" style="padding:5px 10px;background:${p.emailSent ? '#6c757d' : '#667eea'};color:white;border:none;border-radius:4px;cursor:pointer;">${p.emailSent ? 'Ponovi' : '📧 Pošalji'}</button></td>
          </tr>
        `).join('') || '<tr><td colspan="6" style="padding:20px;text-align:center;">Nema učesnika</td></tr>'}
      </tbody>
    </table>
  `;
}
