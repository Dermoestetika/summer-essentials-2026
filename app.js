// Mobile App for Participants - API Version
const API_BASE = '';

const app = {
    data: {
        currentUser: null,
        participant: null,
        events: [],
        sponsors: [],
        questions: {},
        quizAttempts: [],
        leaderboard: [],
        currentQuiz: {
            sponsorId: null,
            sponsorName: null,
            questions: [],
            currentIndex: 0,
            answers: [],
            score: 0,
            startTime: null
        },
        html5QrCode: null,
        scannerMode: 'sponsor'
    },

    async init() {
        await this.loadData();
        this.checkLogin();
    },

    async loadData() {
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();
            
            this.data.events = data.events || [];
            this.data.sponsors = data.sponsors || [];
            this.data.questions = data.questions || {};
            this.data.quizAttempts = data.quizAttempts || [];
            
            // Cache in localStorage for offline fallback
            localStorage.setItem('summerEssentialsData', JSON.stringify(data));
        } catch (err) {
            console.error('API load failed, using cache:', err);
            // Fallback to localStorage
            const saved = localStorage.getItem('summerEssentialsData');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data.events = parsed.events || [];
                this.data.sponsors = parsed.sponsors || [];
                this.data.questions = parsed.questions || {};
                this.data.quizAttempts = parsed.quizAttempts || [];
            }
        }

        const session = localStorage.getItem('participantSession');
        if (session) {
            this.data.currentUser = JSON.parse(session);
        }
    },

    async saveData() {
        try {
            // Get current data
            const response = await fetch(`${API_BASE}/api/data`);
            const data = await response.json();
            
            // Update quiz attempts
            data.quizAttempts = this.data.quizAttempts;
            
            // Save back
            await fetch(`${API_BASE}/api/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            // Update cache
            localStorage.setItem('summerEssentialsData', JSON.stringify(data));
        } catch (err) {
            console.error('API save failed:', err);
        }
    },

    checkLogin() {
        if (this.data.currentUser) {
            this.loadParticipant();
            this.showMainApp();
        }
    },

    async loadParticipant() {
        if (!this.data.currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            const data = await response.json();
            this.data.participant = data.participants?.find(p => p.id === this.data.currentUser.id);
        } catch (err) {
            console.error('Failed to load participant:', err);
        }
    },

    async login() {
        const code = document.getElementById('qrCodeInput').value.trim().toUpperCase();
        
        if (!code) {
            this.showError('Unesite QR kod');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/data`);
            const data = await response.json();
            const participant = data.participants?.find(p => p.qrCode === code);
            
            if (participant) {
                this.data.currentUser = { id: participant.id, name: participant.name };
                this.data.participant = participant;
                localStorage.setItem('participantSession', JSON.stringify(this.data.currentUser));
                
                // Mark as app installed
                participant.appInstalled = true;
                await fetch(`${API_BASE}/api/data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                localStorage.setItem('summerEssentialsData', JSON.stringify(data));
                this.showMainApp();
            } else {
                this.showError('Neispravan QR kod');
            }
        } catch (err) {
            this.showError('Greška u komunikaciji s serverom');
            console.error(err);
        }
    },

    logout() {
        localStorage.removeItem('participantSession');
        this.data.currentUser = null;
        this.data.participant = null;
        location.reload();
    },

    showError(message) {
        const error = document.getElementById('loginError');
        if (error) {
            error.textContent = message;
            error.classList.remove('hidden');
            setTimeout(() => error.classList.add('hidden'), 3000);
        } else {
            alert(message);
        }
    },

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        this.updateHomePage();
        this.loadSponsors();
        this.updateLeaderboard();
        this.updateProfile();
    },

    navigate(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item:nth-child(${this.getPageIndex(page)})`)?.classList.add('active');
        
        if (page === 'leaderboard') {
            this.updateLeaderboard();
        } else if (page === 'profile') {
            this.updateProfile();
        }
    },

    getPageIndex(page) {
        const pages = { home: 1, quiz: 2, leaderboard: 3, profile: 4 };
        return pages[page] || 1;
    },

    // HOME PAGE
    async updateHomePage() {
        if (!this.data.participant) {
            await this.loadParticipant();
        }
        if (!this.data.participant) return;
        
        const p = this.data.participant;
        const event = this.data.events.find(e => e.id === p.eventId);
        
        document.getElementById('userName').textContent = p.name.split(' ')[0];
        document.getElementById('displayQrCode').textContent = p.qrCode;
        document.getElementById('eventName').textContent = event?.name || 'Summer Essentials';
        document.getElementById('eventDate').textContent = event?.date + ' u ' + event?.time || 'Maj 2026';
        document.getElementById('eventLocation').textContent = event?.location || 'TBA';
        
        // Generate QR code
        setTimeout(() => {
            const qrContainer = document.getElementById('homeQRCode');
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';
                new QRCode(qrContainer, {
                    text: JSON.stringify({ type: 'participant', id: p.id, code: p.qrCode }),
                    width: 120,
                    height: 120,
                    colorDark: '#1a1a2e',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }, 100);
        
        // Update stats
        const stats = this.getParticipantStats(p.id);
        document.getElementById('homeScore').textContent = stats.totalScore;
        document.getElementById('homeRank').textContent = stats.rank > 0 ? '#' + stats.rank : '-';
        
        // Update tier badge
        const tierEl = document.getElementById('userTier');
        const tier = stats.totalScore >= 25 ? 1 : stats.totalScore >= 15 ? 2 : 3;
        if (tierEl) {
            tierEl.innerHTML = `
                <i class="fas fa-trophy ${tier === 1 ? 'text-[#C8A951]' : tier === 2 ? 'text-[#2BBCB3]' : 'text-gray-400'}"></i>
                <span class="text-sm font-medium">Tier ${tier}</span>
            `;
        }
    },

    showMyQR() {
        if (!this.data.participant) return;
        
        const p = this.data.participant;
        const modalText = document.getElementById('modalQRText');
        if (modalText) modalText.textContent = p.qrCode;
        
        const qrContainer = document.getElementById('modalQRCode');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: JSON.stringify({ type: 'participant', id: p.id, code: p.qrCode }),
                width: 200,
                height: 200,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
        
        const modal = document.getElementById('qrModal');
        if (modal) modal.classList.add('active');
    },

    hideQRModal() {
        const modal = document.getElementById('qrModal');
        if (modal) modal.classList.remove('active');
    },

    // QUIZ PAGE
    loadSponsors() {
        const container = document.getElementById('sponsorsList');
        if (!container) return;
        
        // Use all sponsors for now
        const sponsors = this.data.sponsors.filter(s => s.tier <= 2);
        
        container.innerHTML = sponsors.map(sponsor => {
            const questions = sponsor.questions || [];
            const visited = this.data.quizAttempts.some(a => 
                a.participantId === this.data.participant?.id && a.sponsorId === sponsor.id
            );
            
            return `
                <div class="sponsor-card ${visited ? 'visited' : ''}" onclick="app.startQuiz(${sponsor.id})">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl ${sponsor.tier === 1 ? 'gradient-gold' : 'gradient-turquoise'} flex items-center justify-center text-white font-bold text-lg">
                            ${sponsor.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <h3 class="font-semibold text-[#1a1a2e]">${sponsor.name}</h3>
                            <p class="text-sm text-gray-500">${questions.length} pitanja</p>
                        </div>
                        ${visited ? 
                            '<div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><i class="fas fa-check text-green-600"></i></div>' :
                            '<div class="w-8 h-8 rounded-full bg-[#C8A951]/10 flex items-center justify-center"><i class="fas fa-chevron-right text-[#C8A951]"></i></div>'
                        }
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-gray-500 text-center py-4">Nema dostupnih sponzora</p>';
    },

    startQuiz(sponsorId) {
        const sponsor = this.data.sponsors.find(s => s.id === sponsorId);
        const allQuestions = sponsor?.questions || [];
        
        if (allQuestions.length === 0) {
            alert('Nema dostupnih pitanja za ovog sponzora.');
            return;
        }
        
        // Check if already completed - PREVENT REPETITION
        const alreadyCompleted = this.data.quizAttempts.some(a => 
            a.participantId === this.data.participant?.id && a.sponsorId === sponsorId
        );
        
        if (alreadyCompleted) {
            alert('Već ste riješili kviz za ovog sponzora. Možete riješiti samo jednom po sponzoru.');
            return; // Prevent repetition completely
        }
        
        // Select up to 5 random questions
        const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(5, shuffled.length));
        
        this.data.currentQuiz = {
            sponsorId: sponsorId,
            sponsorName: sponsor.name,
            questions: selected,
            currentIndex: 0,
            answers: [],
            score: 0,
            startTime: Date.now()
        };
        
        this.showQuestion();
        this.navigate('question');
    },

    showQuestion() {
        const quiz = this.data.currentQuiz;
        const question = quiz.questions[quiz.currentIndex];
        
        // Update progress
        const progress = ((quiz.currentIndex) / quiz.questions.length) * 100;
        const progressEl = document.getElementById('quizProgress');
        if (progressEl) progressEl.style.width = progress + '%';
        
        const currentQEl = document.getElementById('currentQuestion');
        if (currentQEl) currentQEl.textContent = quiz.currentIndex + 1;
        
        // Sponsor info
        const sponsor = this.data.sponsors.find(s => s.id === quiz.sponsorId);
        const sponsorInfo = document.getElementById('sponsorInfo');
        if (sponsorInfo) {
            sponsorInfo.innerHTML = `
                <div class="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center text-white font-bold">
                    ${sponsor.name.substring(0, 2).toUpperCase()}
                </div>
                <span class="font-medium">${sponsor.name}</span>
            `;
        }
        
        // Question
        const questionContainer = document.getElementById('questionContainer');
        if (questionContainer) {
            questionContainer.innerHTML = `
                <h3 class="text-lg font-semibold text-[#1a1a2e] mb-4">${question.text}</h3>
            `;
        }
        
        // Options
        const optionsContainer = document.getElementById('optionsContainer');
        if (optionsContainer) {
            const optionsHtml = question.options.map((opt, idx) => `
                <div class="quiz-option" onclick="app.selectAnswer(${idx})" data-index="${idx}">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 option-letter">
                            ${String.fromCharCode(65 + idx)}
                        </div>
                        <span class="flex-1">${opt}</span>
                    </div>
                </div>
            `).join('');
            
            optionsContainer.innerHTML = optionsHtml;
        }
        
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn) nextBtn.classList.add('hidden');
    },

    selectAnswer(index) {
        const quiz = this.data.currentQuiz;
        const question = quiz.questions[quiz.currentIndex];
        
        // Disable all options
        document.querySelectorAll('.quiz-option').forEach((opt, idx) => {
            opt.style.pointerEvents = 'none';
            if (idx === question.correct) {
                opt.classList.add('correct');
                const letter = opt.querySelector('.option-letter');
                if (letter) letter.innerHTML = '<i class="fas fa-check"></i>';
            } else if (idx === index && idx !== question.correct) {
                opt.classList.add('wrong');
                const letter = opt.querySelector('.option-letter');
                if (letter) letter.innerHTML = '<i class="fas fa-times"></i>';
            }
        });
        
        // Calculate score
        let points = 0;
        if (index === question.correct) {
            points = question.points || 5;
        }
        
        quiz.answers.push({
            questionIndex: quiz.currentIndex,
            selected: index,
            correct: question.correct,
            points: points
        });
        
        quiz.score += points;
        
        // Show next button
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn) {
            if (quiz.currentIndex < quiz.questions.length - 1) {
                nextBtn.innerHTML = `Sljedeće pitanje <i class="fas fa-arrow-right ml-2"></i>`;
            } else {
                nextBtn.innerHTML = `Završi kviz <i class="fas fa-check ml-2"></i>`;
            }
            nextBtn.classList.remove('hidden');
        }
    },

    nextQuestion() {
        const quiz = this.data.currentQuiz;
        
        if (quiz.currentIndex < quiz.questions.length - 1) {
            quiz.currentIndex++;
            this.showQuestion();
        } else {
            this.finishQuiz();
        }
    },

    async finishQuiz() {
        const quiz = this.data.currentQuiz;
        const timeSpent = Date.now() - quiz.startTime;
        
        // Save attempt
        const attempt = {
            participantId: this.data.participant.id,
            participantName: this.data.participant.name,
            sponsorId: quiz.sponsorId,
            sponsorName: quiz.sponsorName,
            score: quiz.score,
            total: quiz.questions.length * (quiz.questions[0]?.points || 5),
            timeSpent: timeSpent,
            timestamp: new Date().toISOString()
        };
        
        this.data.quizAttempts.push(attempt);
        await this.saveData();
        
        // Update participant score on server
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            const data = await response.json();
            const participant = data.participants.find(p => p.id === this.data.participant.id);
            if (participant) {
                participant.score = (participant.score || 0) + quiz.score;
                participant.answeredQuestions = participant.answeredQuestions || [];
                quiz.questions.forEach(q => {
                    if (!participant.answeredQuestions.includes(q.id)) {
                        participant.answeredQuestions.push(q.id);
                    }
                });
                participant.quizzes = (participant.quizzes || 0) + 1;
                
                await fetch(`${API_BASE}/api/data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                localStorage.setItem('summerEssentialsData', JSON.stringify(data));
                this.data.participant = participant;
            }
        } catch (err) {
            console.error('Failed to update score:', err);
        }
        
        // Show results
        const correctAnswers = quiz.answers.filter(a => a.points > 0).length;
        alert(`Kviz završen!\n\nTočnih odgovora: ${correctAnswers}/${quiz.questions.length}\nBodova: ${quiz.score}/${quiz.questions.length * (quiz.questions[0]?.points || 5)}`);
        
        this.navigate('quiz');
        this.loadSponsors();
        this.updateHomePage();
    },

    // SCANNER
    showScanner(mode = 'sponsor') {
        this.data.scannerMode = mode;
        const overlay = document.getElementById('scannerOverlay');
        if (overlay) overlay.classList.add('active');
        
        const error = document.getElementById('scannerError');
        if (error) error.classList.add('hidden');
        
        // Update title
        const title = document.getElementById('scannerTitle');
        if (title) {
            title.textContent = mode === 'login' ? 'Skenirajte svoj QR kod' : 'Skenirajte QR kod štanda';
        }
        
        // Initialize html5-qrcode
        const qrReader = document.getElementById('qr-reader');
        if (!qrReader) return;
        
        qrReader.innerHTML = '';
        
        if (typeof Html5Qrcode === 'undefined') {
            // Fallback to manual input
            setTimeout(() => {
                const code = prompt('Kamera nije dostupna. Unesite kod ručno:');
                if (code) {
                    this.onScanSuccess(code);
                }
                this.hideScanner();
            }, 500);
            return;
        }
        
        this.data.html5QrCode = new Html5Qrcode('qr-reader');
        
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
            const errorEl = document.getElementById('scannerError');
            if (errorEl) errorEl.classList.remove('hidden');
            
            setTimeout(() => {
                const code = prompt('Kamera nije dostupna. Unesite kod ručno:');
                if (code) {
                    this.onScanSuccess(code);
                }
                this.hideScanner();
            }, 1000);
        });
    },

    hideScanner() {
        const overlay = document.getElementById('scannerOverlay');
        if (overlay) overlay.classList.remove('active');
        
        if (this.data.html5QrCode) {
            this.data.html5QrCode.stop().then(() => {
                this.data.html5QrCode = null;
            }).catch(err => {
                console.error('Error stopping camera:', err);
            });
        }
    },

    onScanSuccess(decodedText) {
        this.hideScanner();
        
        if (this.data.scannerMode === 'login') {
            document.getElementById('qrCodeInput').value = decodedText.trim().toUpperCase();
            this.login();
        } else {
            this.processScannedCode(decodedText);
        }
    },

    processScannedCode(code) {
        try {
            const data = JSON.parse(code);
            if (data.type === 'sponsor' && data.id) {
                this.startQuiz(data.id);
            } else if (data.type === 'participant') {
                alert('Ovo je kod za ulaz, ne za kviz.');
            }
        } catch (e) {
            const upperCode = code.trim().toUpperCase();
            
            if (upperCode.startsWith('SE')) {
                alert('Ovo je kod za ulaz na događaj, ne za kviz. Skenirajte kod na štandu sponzora.');
                return;
            }
            
            const sponsor = this.data.sponsors.find(s => 
                upperCode.includes(s.id.toString()) || 
                upperCode.includes(s.name.toUpperCase())
            );
            
            if (sponsor) {
                this.startQuiz(sponsor.id);
            } else {
                alert('Neispravan QR kod. Skenirajte kod na štandu sponzora.');
            }
        }
    },

    // LEADERBOARD
    async updateLeaderboard() {
        try {
            const response = await fetch(`${API_BASE}/api/leaderboard?eventId=${this.data.participant?.eventId || 1}`);
            const leaderboard = await response.json();
            
            // Calculate all scores from quiz attempts
            const scores = {};
            this.data.quizAttempts.forEach(a => {
                if (!scores[a.participantId]) {
                    scores[a.participantId] = { 
                        id: a.participantId, 
                        name: a.participantName, 
                        score: 0,
                        totalTime: 0,
                        quizzes: 0
                    };
                }
                scores[a.participantId].score += a.score;
                scores[a.participantId].totalTime += a.timeSpent;
                scores[a.participantId].quizzes++;
            });
            
            // Add participants with 0 score
            leaderboard.forEach(p => {
                if (!scores[p.id]) {
                    scores[p.id] = {
                        id: p.id,
                        name: p.name,
                        score: p.score || 0,
                        totalTime: 0,
                        quizzes: p.quizzes || 0
                    };
                }
            });
            
            const sorted = Object.values(scores)
                .map(s => ({ ...s, tier: s.score >= 25 ? 1 : s.score >= 15 ? 2 : 3 }))
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.totalTime - b.totalTime;
                });
            
            this.data.leaderboard = sorted;
            
            // Update my position
            if (this.data.participant) {
                const myStats = this.getParticipantStats(this.data.participant.id);
                const myPos = document.getElementById('myPosition');
                if (myPos) {
                    myPos.innerHTML = `
                        <p class="text-[#1a1a2e]/70 text-sm mb-1">Vaša pozicija</p>
                        <p class="text-5xl font-bold text-[#1a1a2e] mb-2">#${myStats.rank || '-'}</p>
                        <p class="text-xl text-[#1a1a2e]">${myStats.totalScore} bodova</p>
                        <div class="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full ${myStats.tier === 1 ? 'tier-badge-1' : myStats.tier === 2 ? 'tier-badge-2' : 'tier-badge-3'}">
                            <i class="fas fa-trophy"></i>
                            <span>Tier ${myStats.tier}</span>
                        </div>
                    `;
                }
            }
            
            // Display TOP 5 + SELF
            const top5 = sorted.slice(0, 5);
            const myId = this.data.participant?.id;
            const isInTop5 = top5.some(e => e.id === myId);
            
            let displayList = [...top5.map((e, i) => ({ ...e, displayRank: i + 1 }))];
            
            if (!isInTop5 && myId) {
                const myIndex = sorted.findIndex(s => s.id === myId);
                if (myIndex >= 0) {
                    const myEntry = sorted[myIndex];
                    displayList.push({ ...myEntry, isMe: true, displayRank: myIndex + 1 });
                }
            }
            
            const listHtml = displayList.map((entry) => {
                const isMe = entry.id === myId;
                const rank = entry.displayRank;
                
                return `
                    <div class="leaderboard-item ${isMe ? 'border-2 border-[#C8A951] bg-[#C8A951]/10' : ''}">
                        <div class="rank-badge ${rank === 1 ? 'gradient-gold text-white' : rank === 2 ? 'gradient-turquoise text-white' : rank === 3 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}">
                            ${rank}
                        </div>
                        <div class="flex-1">
                            <p class="font-semibold text-[#1a1a2e] ${isMe ? 'text-[#C8A951]' : ''}">${entry.name} ${isMe ? '<span class="text-xs ml-1">(Vi)</span>' : ''}</p>
                            <p class="text-sm text-gray-500">${entry.quizzes} kvizova</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-bold text-[#1a1a2e]">${entry.score}</p>
                            <span class="inline-flex items-center px-2 py-1 rounded text-xs ${entry.tier === 1 ? 'tier-badge-1' : entry.tier === 2 ? 'tier-badge-2' : 'tier-badge-3'}">
                                Tier ${entry.tier}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            
            const listEl = document.getElementById('leaderboardList');
            if (listEl) listEl.innerHTML = listHtml;
            
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        }
    },

    getParticipantStats(participantId) {
        const attempts = this.data.quizAttempts.filter(a => a.participantId === participantId);
        const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
        
        const allScores = {};
        this.data.quizAttempts.forEach(a => {
            if (!allScores[a.participantId]) {
                allScores[a.participantId] = { id: a.participantId, name: a.participantName, score: 0 };
            }
            allScores[a.participantId].score += a.score;
        });
        
        // Add from leaderboard data
        this.data.leaderboard.forEach(e => {
            if (!allScores[e.id]) {
                allScores[e.id] = { id: e.id, name: e.name, score: e.score };
            }
        });
        
        const sorted = Object.values(allScores).sort((a, b) => b.score - a.score);
        const rank = sorted.findIndex(s => s.id === participantId) + 1;
        
        return {
            totalScore,
            quizzes: attempts.length,
            rank,
            tier: totalScore >= 25 ? 1 : totalScore >= 15 ? 2 : 3
        };
    },

    // PROFILE
    updateProfile() {
        if (!this.data.participant) return;
        
        const p = this.data.participant;
        const stats = this.getParticipantStats(p.id);
        
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = p.name;
        
        const emailEl = document.getElementById('profileEmail');
        if (emailEl) emailEl.textContent = p.email;
        
        const scoreEl = document.getElementById('profileScore');
        if (scoreEl) scoreEl.textContent = stats.totalScore;
        
        const quizzesEl = document.getElementById('profileQuizzes');
        if (quizzesEl) quizzesEl.textContent = stats.quizzes;
        
        const tierEl = document.getElementById('profileTier');
        if (tierEl) {
            tierEl.textContent = 'Tier ' + stats.tier;
            tierEl.className = `px-3 py-1 rounded-full text-sm font-medium ${stats.tier === 1 ? 'tier-badge-1' : stats.tier === 2 ? 'tier-badge-2' : 'tier-badge-3'}`;
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});