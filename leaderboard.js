// TV Leaderboard Display Application
const app = {
    data: {
        events: [],
        participants: [],
        currentEventId: 'all',
        refreshInterval: null
    },

    init() {
        this.loadData();
        this.populateEvents();
        this.render();
        this.startAutoRefresh();
        
        // Initial animation delay
        setTimeout(() => {
            this.triggerConfetti();
        }, 1000);
    },

    loadData() {
        const saved = localStorage.getItem('summerEssentialsData');
        if (saved) {
            const parsed = JSON.parse(saved);
            this.data.events = parsed.events || [];
            this.data.participants = parsed.participants || [];
        }
        
        // Default events if none exist
        if (this.data.events.length === 0) {
            this.data.events = [
                { id: 1, name: 'Banja Luka - 15.05.2026' },
                { id: 2, name: 'Sarajevo - 22.05.2026' },
                { id: 3, name: 'Mostar - 29.05.2026' }
            ];
        }
        
        // Add demo scores if participants exist but have no scores
        this.data.participants.forEach(p => {
            if (!p.score) {
                p.score = Math.floor(Math.random() * 40) + 5; // Random score 5-45
            }
            if (!p.answeredQuestions) {
                p.answeredQuestions = Math.floor(Math.random() * 20);
            }
        });
    },

    populateEvents() {
        const select = document.getElementById('eventSelect');
        if (!select) return;
        
        const options = this.data.events.map(e => 
            `<option value="${e.id}">${e.name}</option>`
        ).join('');
        
        select.innerHTML = '<option value="all">Svi događaji</option>' + options;
    },

    changeEvent() {
        this.data.currentEventId = document.getElementById('eventSelect').value;
        this.render();
    },

    getFilteredParticipants() {
        let participants = [...this.data.participants];
        
        // Filter by event
        if (this.data.currentEventId !== 'all') {
            participants = participants.filter(p => p.eventId == this.data.currentEventId);
        }
        
        // Sort by score (descending)
        return participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    },

    getTier(score) {
        if (score >= 25) return { tier: 1, class: 'tier-1', name: 'Gold' };
        if (score >= 15) return { tier: 2, class: 'tier-2', name: 'Silver' };
        return { tier: 3, class: 'tier-3', name: 'Bronze' };
    },

    render() {
        const participants = this.getFilteredParticipants();
        this.renderStats(participants);
        this.renderPodium(participants.slice(0, 3));
        this.renderList(participants);
    },

    renderStats(participants) {
        const total = participants.length;
        const totalPoints = participants.reduce((sum, p) => sum + (p.score || 0), 0);
        const avg = total > 0 ? Math.round(totalPoints / total) : 0;
        
        document.getElementById('totalParticipants').textContent = total;
        document.getElementById('totalPoints').textContent = totalPoints.toLocaleString();
        document.getElementById('avgScore').textContent = avg;
    },

    renderPodium(top3) {
        const podium = document.getElementById('podium');
        if (!podium) return;
        
        if (top3.length === 0) {
            podium.innerHTML = '<p class="text-gray-500">Nema učesnika</p>';
            return;
        }
        
        // Reorder for podium display: 2nd, 1st, 3rd
        const order = [1, 0, 2];
        const heights = ['h-40', 'h-56', 'h-32'];
        // Rank-based colors: 1st=gold, 2nd=silver, 3rd=bronze
        const rankClasses = ['rank-silver', 'rank-gold', 'rank-bronze'];
        
        podium.innerHTML = order.map((idx, pos) => {
            const p = top3[idx];
            if (!p) return '';
            
            const rank = idx + 1;
            const rankClass = rankClasses[pos];
            
            return `
                <div class="flex flex-col items-center ${pos === 1 ? 'pulse' : ''}" style="animation-delay: ${pos * 0.2}s">
                    <div class="w-20 h-20 rounded-full ${rankClass} flex items-center justify-center text-3xl font-bold mb-2 shadow-lg text-[#1a1a2e]">
                        ${rank}
                    </div>
                    <div class="${heights[pos]} w-32 ${rankClass} rounded-t-2xl flex flex-col items-center justify-end pb-4 shadow-2xl overflow-hidden">
                        <p class="font-display text-lg font-bold text-center px-2 truncate w-full text-[#1a1a2e] drop-shadow-sm">${p.name}</p>
                        <p class="text-2xl font-bold text-[#1a1a2e]">${p.score || 0}</p>
                        <p class="text-xs opacity-80 text-[#1a1a2e]">bodova</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderList(participants) {
        const list = document.getElementById('leaderboardList');
        if (!list) return;
        
        // Skip top 3 for the list (they're on podium)
        const listParticipants = participants.slice(3, 13); // Show ranks 4-13
        
        if (listParticipants.length === 0 && participants.length <= 3) {
            list.innerHTML = '';
            return;
        }
        
        const maxScore = Math.max(...participants.map(p => p.score || 0), 1);
        
        list.innerHTML = listParticipants.map((p, idx) => {
            const rank = idx + 4;
            const tier = this.getTier(p.score || 0);
            const percentage = ((p.score || 0) / maxScore) * 100;
            
            return `
                <div class="leaderboard-item flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur" style="animation-delay: ${idx * 0.1}s">
                    <div class="rank-number ${tier.class} text-[#1a1a2e]">
                        ${rank}
                    </div>
                    <div class="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-[#1a1a2e] font-bold">
                        ${p.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                            <p class="font-semibold text-lg">${p.name}</p>
                            <p class="font-bold text-xl text-[#C8A951]">${p.score || 0}</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="score-bar flex-1">
                                <div class="score-fill ${tier.class}" style="width: ${percentage}%"></div>
                            </div>
                            <span class="text-xs text-gray-400">${p.answeredQuestions || 0} odgovora</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    triggerConfetti() {
        const colors = ['#C8A951', '#2BBCB3', '#FFD700', '#e8d78e', '#FF6B6B', '#4ECDC4'];
        
        // Create more confetti particles
        for (let i = 0; i < 100; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 3 + 3) + 's';
                confetti.style.width = (Math.random() * 10 + 8) + 'px';
                confetti.style.height = (Math.random() * 10 + 8) + 'px';
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 6000);
            }, i * 30);
        }
        
        // Trigger again every 30 seconds
        setTimeout(() => this.triggerConfetti(), 30000);
    },

    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadData();
            this.render();
        }, 30000);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Handle visibility change - pause/resume refresh
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (app.refreshInterval) {
            clearInterval(app.refreshInterval);
        }
    } else {
        app.startAutoRefresh();
    }
});