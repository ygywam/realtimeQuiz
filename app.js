(function() {
  'use strict';

  // 웹 오디오 합성 엔진 (100% 무설치 / 오프라인 / 교내망 차단 0% 안전 효과음)
  const AudioEngine = {
    ctx: null,
    enabled: true,
    bgmAudio: null,
    bgmPlaying: false,
    bgmSynthInterval: null,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },
    playTick() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 750;
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
      } catch (e) {}
    },
    playCorrect() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.25);
        });
      } catch (e) {}
    },
    playFanfare() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [
          { f: 523.25, d: 0.15, t: 0 },
          { f: 659.25, d: 0.15, t: 0.15 },
          { f: 783.99, d: 0.15, t: 0.30 },
          { f: 1046.50, d: 0.6, t: 0.45 }
        ];
        notes.forEach(n => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = n.f;
          gain.gain.setValueAtTime(0.1, now + n.t);
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + n.t);
          osc.stop(now + n.t + n.d);
        });
      } catch (e) {}
    },
    playBGM(customUrl) {
      this.stopBGM();
      this.init();
      if (customUrl) {
        try {
          this.bgmAudio = new Audio(customUrl);
          this.bgmAudio.loop = true;
          this.bgmAudio.volume = 0.4;
          this.bgmAudio.play().catch(e => console.warn('BGM 재생 제한:', e));
          this.bgmPlaying = true;
          return;
        } catch (e) {}
      }
      if (!this.ctx) return;
      this.bgmPlaying = true;
      const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
      let step = 0;
      this.bgmSynthInterval = setInterval(() => {
        if (!this.bgmPlaying || !this.ctx) return;
        try {
          const freq = notes[step % notes.length];
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.18);
          step++;
        } catch (e) {}
      }, 200);
    },
    stopBGM() {
      this.bgmPlaying = false;
      if (this.bgmAudio) {
        try { this.bgmAudio.pause(); this.bgmAudio.currentTime = 0; } catch (e) {}
        this.bgmAudio = null;
      }
      if (this.bgmSynthInterval) {
        clearInterval(this.bgmSynthInterval);
        this.bgmSynthInterval = null;
      }
    },
    toggleBGM(customUrl) {
      if (this.bgmPlaying) {
        this.stopBGM();
        return false;
      } else {
        this.playBGM(customUrl);
        return true;
      }
    }
  };

  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAt1jZhv7DlxRsKiMPBX0YNAI2iN7P8qFY",
    databaseURL: "https://recordtuner-default-rtdb.firebaseio.com",
    projectId: "recordtuner"
  };

  function getSavedTheme() {
    return localStorage.getItem('class_quiz_theme') || 'tv';
  }

  function setTheme(themeName) {
    const validThemes = ['tv', 'chalkboard', 'marble', 'woodlock'];
    const selected = validThemes.includes(themeName) ? themeName : 'tv';
    document.body.className = 'theme-' + selected;
    localStorage.setItem('class_quiz_theme', selected);

    document.querySelectorAll('.select-theme-dropdown').forEach(sel => {
      sel.value = selected;
    });
  }

  const defaultQuestions = [];

  const AVATARS = ['🐶', '🐱', '🦊', '🐯', '🦁', '🐸', '🤖', '🚀', '🎃', '🦄', '🐥', '🐼'];

  const state = {
    mode: 'home',
    roomId: null,
    role: null,
    nickname: '',
    avatar: '🐶',
    studentId: '',
    roomData: null,
    isDemo: false,
    hideResults: false,
    showWrongWordcloud: false,
    showShortNicknames: false
  };

  let currentEditingQuestions = null;
  let currentEditingUpdateFn = null;

  function isScoringQuestion(q) {
    if (!q) return false;
    if (q.type === 'wordcloud' || q.type === 'postit') return false;
    if (q.type === 'ox' || q.type === 'short') return true;
    if (q.type === 'choice' || q.type === 'poll') {
      if (q.isScoring === false || q.timeLimit === 0) return false;
      return true;
    }
    return false;
  }

  function hasScoringQuestions(questions) {
    if (!Array.isArray(questions)) return false;
    return questions.some(q => isScoringQuestion(q));
  }

  function getOrCreateStudentId() {
    let id = sessionStorage.getItem('class_quiz_student_id');
    if (!id) {
      id = 'std_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('class_quiz_student_id', id);
    }
    state.studentId = id;
    return id;
  }

  function generateRoomId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  function getMyLocalQuizRooms() {
    try {
      const raw = localStorage.getItem('my_created_quiz_rooms');
      const list = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const valid = list.filter(r => (now - (r.lastAccessedAt || r.createdAt || now)) < THREE_DAYS_MS);
      if (valid.length !== list.length) {
        localStorage.setItem('my_created_quiz_rooms', JSON.stringify(valid));
      }
      return valid;
    } catch (e) {
      return [];
    }
  }

  function saveMyLocalQuizRoom(roomMeta) {
    const list = getMyLocalQuizRooms();
    const idx = list.findIndex(r => r.roomId === roomMeta.roomId);
    const now = Date.now();
    const item = {
      roomId: roomMeta.roomId,
      title: roomMeta.title || '실시간 수업 퀴즈',
      questionCount: typeof roomMeta.questionCount === 'number' ? roomMeta.questionCount : 0,
      createdAt: roomMeta.createdAt || (idx >= 0 ? list[idx].createdAt : now),
      lastAccessedAt: now
    };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.unshift(item);
    }
    localStorage.setItem('my_created_quiz_rooms', JSON.stringify(list));
  }

  function removeMyLocalQuizRoom(roomId) {
    const list = getMyLocalQuizRooms().filter(r => r.roomId !== roomId);
    localStorage.setItem('my_created_quiz_rooms', JSON.stringify(list));
  }

  function isRoomCreatorLocal(roomId) {
    const list = getMyLocalQuizRooms();
    return list.some(r => r.roomId === roomId);
  }

  let db = null;
  let broadcastChannel = null;

  function getSavedFirebaseConfig() {
    const saved = localStorage.getItem('class_quiz_fb_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_FIREBASE_CONFIG;
  }

  function saveFirebaseConfig(config) {
    localStorage.setItem('class_quiz_fb_config', JSON.stringify(config));
  }

  function getFirebaseRestUrl(path) {
    const config = getSavedFirebaseConfig();
    const dbUrl = (config && config.databaseURL) ? config.databaseURL : DEFAULT_FIREBASE_CONFIG.databaseURL;
    const cleanUrl = dbUrl.replace(/\/$/, '');
    return path ? `${cleanUrl}/${path}.json` : `${cleanUrl}.json`;
  }

  async function fetchFirebaseRest(path) {
    try {
      const url = getFirebaseRestUrl(path);
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Firebase REST Fetch 경고:', e);
    }
    return null;
  }

  async function putFirebaseRest(path, data) {
    try {
      const url = getFirebaseRestUrl(path);
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return true;
    } catch (e) {
      console.warn('Firebase REST Put 경고:', e);
      return false;
    }
  }

  async function patchFirebaseRest(path, data) {
    try {
      const url = getFirebaseRestUrl(path);
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return true;
    } catch (e) {
      console.warn('Firebase REST Patch 경고:', e);
      return false;
    }
  }

  function initRealtimeEngine() {
    const config = getSavedFirebaseConfig();
    if (config && config.apiKey && config.databaseURL && window.firebase) {
      try {
        if (!window.firebase.apps.length) {
          window.firebase.initializeApp(config);
        }
        db = window.firebase.database();
        state.isDemo = false;
        return true;
      } catch (err) {
        console.error('Firebase SDK 초기화 실패, REST 통신으로 전환:', err);
      }
    }
    
    state.isDemo = false; // REST API로 항상 실시간 동기화 가능
    if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('class_quiz_channel');
    }
    return true;
  }

  async function createRoom(roomId, initialData) {
    if (db) {
      try {
        await db.ref(`rooms/${roomId}`).set(initialData);
      } catch (e) {
        console.warn('SDK set 실패, REST API로 생성:', e);
        await putFirebaseRest(`rooms/${roomId}`, initialData);
      }
    } else {
      await putFirebaseRest(`rooms/${roomId}`, initialData);
    }
    localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(initialData));
    broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: initialData });
  }

  function subscribeRoom(roomId, callback) {
    let unsubscribed = false;
    let hasData = false;

    // 1. Firebase SDK WebSocket 구독
    if (db) {
      try {
        const roomRef = db.ref(`rooms/${roomId}`);
        const handler = (snapshot) => {
          if (unsubscribed) return;
          const val = snapshot.val();
          if (val !== null) {
            hasData = true;
            callback(val);
          }
        };
        roomRef.on('value', handler);
      } catch (e) {
        console.warn('SDK 구독 오류:', e);
      }
    }

    // 2. REST API 즉시 조회 (초기 로딩 및 모바일 Safari/네이버 지연 완벽 방어)
    fetchFirebaseRest(`rooms/${roomId}`).then(data => {
      if (!unsubscribed && data) {
        hasData = true;
        callback(data);
      }
    });

    // 3. REST API 백업 주기적 폴링 (1.5초) - 네트워크 제약 환경 최후 보증
    const intervalId = setInterval(async () => {
      if (unsubscribed) return;
      const data = await fetchFirebaseRest(`rooms/${roomId}`);
      if (!unsubscribed && data) {
        hasData = true;
        callback(data);
      } else if (!unsubscribed && !hasData) {
        const raw = localStorage.getItem(`demo_room_${roomId}`);
        if (raw) callback(JSON.parse(raw));
      }
    }, 1500);

    return () => {
      unsubscribed = true;
      clearInterval(intervalId);
      if (db) {
        try { db.ref(`rooms/${roomId}`).off(); } catch (e) {}
      }
    };
  }

  async function joinParticipant(roomId, studentId, nickname, avatar = '🐶') {
    const pData = { nickname, avatar, joinedAt: Date.now(), score: 0 };
    if (db) {
      try {
        await db.ref(`rooms/${roomId}/participants/${studentId}`).set(pData);
      } catch (e) {
        await putFirebaseRest(`rooms/${roomId}/participants/${studentId}`, pData);
      }
    } else {
      await putFirebaseRest(`rooms/${roomId}/participants/${studentId}`, pData);
    }
  }

  async function updateRoomMeta(roomId, partialMeta) {
    if (db) {
      try {
        await db.ref(`rooms/${roomId}/meta`).update(partialMeta);
      } catch (e) {
        await patchFirebaseRest(`rooms/${roomId}/meta`, partialMeta);
      }
    } else {
      await patchFirebaseRest(`rooms/${roomId}/meta`, partialMeta);
    }
  }

  async function updateQuestions(roomId, questions) {
    if (db) {
      try {
        await db.ref(`rooms/${roomId}/questions`).set(questions);
      } catch (e) {
        await putFirebaseRest(`rooms/${roomId}/questions`, questions);
      }
    } else {
      await putFirebaseRest(`rooms/${roomId}/questions`, questions);
    }
  }

  async function submitResponse(roomId, qIndex, studentId, responseData) {
    const resData = { ...responseData, submittedAt: Date.now() };
    if (db) {
      try {
        await db.ref(`rooms/${roomId}/responses/${qIndex}/${studentId}`).set(resData);
      } catch (e) {
        await putFirebaseRest(`rooms/${roomId}/responses/${qIndex}/${studentId}`, resData);
      }
    } else {
      await putFirebaseRest(`rooms/${roomId}/responses/${qIndex}/${studentId}`, resData);
    }
  }

  async function updateParticipantScores(roomId, scoresMap) {
    const updates = {};
    Object.keys(scoresMap).forEach(sid => {
      updates[`rooms/${roomId}/participants/${sid}/score`] = scoresMap[sid];
    });
    if (db) {
      try {
        await db.ref().update(updates);
      } catch (e) {
        await patchFirebaseRest('', updates);
      }
    } else {
      await patchFirebaseRest('', updates);
    }
  }

  function calculateScore(timeLimitSeconds, elapsedSeconds, isDoublePoints = false) {
    const basePoints = 1000;
    if (timeLimitSeconds <= 0) return basePoints * (isDoublePoints ? 2 : 1);
    const speedRatio = Math.max(0, (timeLimitSeconds - elapsedSeconds) / timeLimitSeconds);
    const speedBonus = Math.round(speedRatio * 1000);
    const total = basePoints + speedBonus;
    return isDoublePoints ? total * 2 : total;
  }

  async function advanceToNextQuestion(roomId, roomData) {
    const currentIndex = roomData.meta.currentQuestionIndex || 0;
    const questions = roomData.questions || [];
    if (currentIndex + 1 < questions.length) {
      await updateRoomMeta(roomId, {
        status: 'PLAYING',
        currentQuestionIndex: currentIndex + 1,
        timerStartedAt: Date.now()
      });
    } else {
      await updateRoomMeta(roomId, { status: 'FINISHED' });
    }
  }

  async function processQuestionResults(roomId, roomData) {
    const qIndex = roomData.meta.currentQuestionIndex || 0;
    const question = roomData.questions[qIndex];
    const responses = (roomData.responses && roomData.responses[qIndex]) || {};
    const participants = roomData.participants || {};
    const timerStartedAt = roomData.meta.timerStartedAt || Date.now();

    const updatedScores = {};
    Object.keys(participants).forEach(sid => {
      updatedScores[sid] = participants[sid].score || 0;
    });

    if (['ox', 'choice', 'short'].includes(question.type)) {
      Object.keys(responses).forEach(sid => {
        const resp = responses[sid];
        let isCorrect = false;

        if (question.type === 'ox' || question.type === 'choice') {
          isCorrect = (Number(resp.answer) === Number(question.correctAnswer));
        } else if (question.type === 'short') {
          const userText = String(resp.answer || '').trim().toLowerCase();
          const targetText = String(question.correctText || '').trim().toLowerCase();
          isCorrect = (userText === targetText);
        }

        if (isCorrect) {
          const elapsedSec = (resp.submittedAt - timerStartedAt) / 1000;
          const earned = calculateScore(question.timeLimit || 20, elapsedSec, question.isDoublePoints);
          updatedScores[sid] = (updatedScores[sid] || 0) + earned;
        }
      });

      await updateParticipantScores(roomId, updatedScores);
    }

    await updateRoomMeta(roomId, { status: 'SHOW_ANSWER' });
  }

  function exportResultsToCSV(roomData) {
    const participants = roomData.participants || {};
    const questions = roomData.questions || [];
    const responses = roomData.responses || {};

    let csvContent = '\uFEFF아바타,닉네임,총점수';
    questions.forEach((q, idx) => {
      csvContent += `,Q${idx + 1} (${q.question.substring(0, 10)}...)`;
    });
    csvContent += '\n';

    Object.keys(participants).forEach(sid => {
      const p = participants[sid];
      let row = `"${p.avatar || '🐶'}","${p.nickname}",${p.score || 0}`;

      questions.forEach((q, qIdx) => {
        const resp = responses[qIdx] && responses[qIdx][sid];
        const ans = resp ? String(resp.answer).replace(/"/g, '""') : '미응답';
        row += `,"${ans}"`;
      });
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_results_${roomData.meta.title || 'class'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function initRouter() {
    const app = document.getElementById('app');
    if (!app) return;

    setTheme(getSavedTheme());

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    const role = params.get('role');

    initRealtimeEngine();

    if (roomId && role === 'student') {
      state.mode = 'student'; state.roomId = roomId; state.role = 'student';
      initStudentFlow(app);
    } else if (roomId && (role === 'display' || role === 'teacher')) {
      state.mode = role; state.roomId = roomId; state.role = role;
      initHostFlow(app, role === 'teacher');
    } else {
      renderHomeView(app);
    }
  }

  function renderHomeView(app) {
    const isFbConnected = !state.isDemo;
    const localRooms = getMyLocalQuizRooms();
    app.innerHTML = `
      <div class="home-container">
        <h1 class="home-title">⚡ 클래스 라이브 퀴즈</h1>
        <p class="home-subtitle">전자칠판과 학생 스마트폰을 실시간으로 잇는 반응형 퀴즈</p>

        <div style="margin-bottom: 25px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
          <span class="room-badge" style="font-size: 0.95rem; cursor: pointer; background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #10b981;" id="btn-open-fb-info">
            🟢 Firebase 실시간 DB 자동 연결됨 (클릭 시 사용 안내)
          </span>
          <select class="select-theme-dropdown" id="select-theme-home" style="padding: 8px 14px; border-radius: 999px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--primary); font-size: 0.9rem; font-weight: bold; cursor: pointer;">
            <option value="tv" ${getSavedTheme() === 'tv' ? 'selected' : ''}>📺 스마트 TV 테마</option>
            <option value="chalkboard" ${getSavedTheme() === 'chalkboard' ? 'selected' : ''}>🧹 초록 칠판 테마</option>
            <option value="marble" ${getSavedTheme() === 'marble' ? 'selected' : ''}>🏛️ 깔끔 대리석 테마</option>
            <option value="woodlock" ${getSavedTheme() === 'woodlock' ? 'selected' : ''}>🪵 우드락 보드 테마</option>
          </select>
        </div>

        <div class="mode-grid">
          <div class="mode-card">
            <div class="mode-icon">👨‍🏫</div>
            <h3>교사 모드</h3>
            <p>새로운 퀴즈 방을 만들고, 문항을 출제/수정하거나 진행을 제어합니다.</p>
            <button class="btn btn-primary" id="btn-create-room" style="width: 100%;">새 퀴즈 방 만들기</button>
          </div>

          <div class="mode-card">
            <div class="mode-icon">🖥️</div>
            <h3>전자칠판 모드</h3>
            <p>교사 PC에서 생성된 퀴즈 방의 PIN 코드를 입력해 큰 화면에 송출합니다.</p>
            <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
              <input type="text" id="input-display-pin" placeholder="PIN 6자리" maxlength="6" style="flex: 1; min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--color-bg); color: var(--color-text); text-align: center; font-weight: bold; font-size: 1rem;">
              <button class="btn btn-secondary" id="btn-enter-display" style="padding: 10px 16px; font-size: 1rem; white-space: nowrap; flex-shrink: 0;">접속</button>
            </div>
          </div>

          <div class="mode-card">
            <div class="mode-icon">📱</div>
            <h3>학생 모드</h3>
            <p>교실 화면의 QR코드를 스캔하거나 PIN 번호를 직접 입력해 참여합니다.</p>
            <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
              <input type="text" id="input-student-pin" placeholder="PIN 6자리" maxlength="6" style="flex: 1; min-width: 0; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--color-bg); color: var(--color-text); text-align: center; font-weight: bold; font-size: 1rem;">
              <button class="btn btn-primary" id="btn-enter-student" style="padding: 10px 16px; font-size: 1rem; white-space: nowrap; flex-shrink: 0;">참여</button>
            </div>
          </div>
        </div>

        <!-- 이 기기 전용 내가 생성한 퀴즈 방 목록 (3일 후 자동 정제) -->
        <div style="margin-top: 36px; text-align: left; background: var(--card-dark); border: 1px solid var(--border); border-radius: 16px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="font-size: 1.3rem; color: #38bdf8; display: flex; align-items: center; gap: 8px; margin: 0;">
              📁 내가 생성한 퀴즈 방 목록 <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(이 기기 전용 / 3일 지나면 자동 정리)</span>
            </h2>
            <span style="font-size: 0.9rem; color: #fbbf24; font-weight: bold;">보관: ${localRooms.length}개</span>
          </div>

          ${localRooms.length === 0 ? `
            <div style="text-align: center; color: var(--text-muted); padding: 26px 16px; font-size: 0.98rem; border: 1px dashed var(--border); border-radius: 12px; background: #0f172a;">
              💡 이 컴퓨터에서 생성한 퀴즈 방이 없습니다. 상단의 <strong>[새 퀴즈 방 만들기]</strong>로 첫 문항을 작성해 보세요!
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
              ${localRooms.map(room => {
                const dateStr = new Date(room.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `
                  <div style="background: #0f172a; border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="room-badge" style="font-size: 0.9rem;">PIN: ${room.roomId}</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
                      </div>
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
                        <h4 style="font-size: 1.05rem; color: #fff; margin: 0; flex: 1; word-break: break-all;">${escapeHtml(room.title)}</h4>
                        <button type="button" class="btn btn-outline-sm btn-rename-room" data-pin="${room.roomId}" data-title="${escapeHtml(room.title)}" style="padding: 2px 8px; font-size: 0.78rem; border-color: #38bdf8; color: #38bdf8; white-space: nowrap;">✏️ 이름 수정</button>
                      </div>
                      <p style="font-size: 0.9rem; color: #38bdf8; font-weight: bold; margin-bottom: 14px;">📝 문항 수: ${room.questionCount}개</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                      <button class="btn btn-primary btn-run-room" data-pin="${room.roomId}" style="padding: 8px 4px; font-size: 0.85rem;">🚀 교사 진행</button>
                      <button class="btn btn-secondary btn-display-room" data-pin="${room.roomId}" style="padding: 8px 4px; font-size: 0.85rem;">🖥️ 전자칠판</button>
                      <button class="btn btn-outline-sm btn-edit-room" data-pin="${room.roomId}" style="padding: 6px 4px; font-size: 0.82rem; border-color: #fbbf24; color: #fbbf24;">📝 문항 편집</button>
                      <button class="btn btn-danger btn-del-room" data-pin="${room.roomId}" style="padding: 6px 4px; font-size: 0.82rem;">🗑️ 삭제</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- 아래로 스크롤 안내 디바이더 -->
        <div class="landing-scroll-divider">
          <span>👇 클래스 라이브 퀴즈의 특별한 핵심 기능과 사용 예시 더 살펴보기 (아래로 스크롤)</span>
        </div>

        <!-- 스크롤 연동 랜딩 피처 소개 섹션 -->
        <div class="landing-section">
          <h2 class="landing-title">✨ 왜 클래스 라이브 퀴즈인가요?</h2>
          <p class="landing-subtitle">교내망 별도 설치 0%! 전자칠판과 학생 모바일을 연결하는 차세대 반응형 교실 퀴즈 플랫폼</p>

          <div class="landing-feature-grid">
            <!-- Feature 1: 3중 실시간 뷰 연동 -->
            <div class="landing-card">
              <div class="landing-card-header">
                <div class="landing-card-icon">⚡</div>
                <h3 class="landing-card-title">0.1초 실시간 3대 뷰 연동</h3>
              </div>
              <p class="landing-card-desc">
                전자칠판(대형 송출), 교사 PC(컨트롤러), 학생 스마트폰(QR 1초 응답 패드)이 클라우드 실시간 DB로 0.1초 만에 동기화됩니다. 교내망 AP Isolation 차단 환경도 100% 극복합니다.
              </p>
              <div class="landing-preview-box" style="text-align: center;">
                <div style="display: flex; justify-content: space-around; font-size: 0.9rem; font-weight: bold;">
                  <span style="color: #fbbf24;">🖥️ 전자칠판 (QR 송출)</span>
                  <span style="color: #38bdf8;">↔ 👨‍🏫 교사 PC</span>
                  <span style="color: #10b981;">↔ 📱 학생 (QR 스캔)</span>
                </div>
              </div>
            </div>

            <!-- Feature 2: 5종 스마트 문항 & 3종 차트 시각화 (인터랙티브 탭) -->
            <div class="landing-card">
              <div class="landing-card-header">
                <div class="landing-card-icon">📊</div>
                <h3 class="landing-card-title">5종 스마트 문항 & 3종 실시간 차트</h3>
              </div>
              <p class="landing-card-desc">
                O/X 참거짓, 선다형(그리드, 막대, 원형 도넛 차트), LaTeX 단답형, 실시간 워드클라우드, 50vh 그림 포스트잇까지 수업 성격에 맞게 1초 만에 차트 형태를 전환하세요!
              </p>
              <div class="landing-preview-box">
                <div style="display: flex; gap: 8px; margin-bottom: 12px; justify-content: center;">
                  <button type="button" class="landing-tab-btn active" id="tab-landing-grid">▦ 그리드</button>
                  <button type="button" class="landing-tab-btn" id="tab-landing-bar">📊 막대 그래프</button>
                  <button type="button" class="landing-tab-btn" id="tab-landing-pie">🍩 원형 차트</button>
                </div>
                <div id="landing-chart-demo" style="min-height: 120px; display: flex; align-items: center; justify-content: center;"></div>
              </div>
            </div>

            <!-- Feature 3: 블라인드 결과 가리기 & 오답 익명 워드클라우드 -->
            <div class="landing-card">
              <div class="landing-card-header">
                <div class="landing-card-icon">🔒</div>
                <h3 class="landing-card-title">결과 가리기 & 재미있는 오답 워드클라우드</h3>
              </div>
              <p class="landing-card-desc">
                '🙈 결과 가리기' 버튼을 누르면 또래 동조 현상 없이 소신껏 응답할 수 있도록 응답 수치만 블라인드 처리되며, 단답형 오답은 닉네임 없이 익명 워드클라우드로 유쾌하게 공유됩니다.
              </p>
              <div class="landing-preview-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="font-size: 0.85rem; color: #94a3b8;">실시간 블라인드 모드 시뮬레이션:</span>
                  <button type="button" id="btn-landing-toggle-results" class="btn btn-outline-sm" style="padding: 3px 10px; font-size: 0.8rem; border-color: #f59e0b; color: #fbbf24; background: rgba(245, 158, 11, 0.2);">
                    🙈 결과 가리기 (클릭해 보세요)
                  </button>
                </div>
                <div id="landing-blind-demo" style="background: #1e293b; padding: 12px; border-radius: 8px; display: flex; justify-content: space-around;">
                  <span>1. 세종대왕 <strong style="color: #fbbf24;" id="demo-stat-1">🔒 가림</strong></span>
                  <span>2. 이순신 <strong style="color: #fbbf24;" id="demo-stat-2">🔒 가림</strong></span>
                </div>
              </div>
            </div>

            <!-- Feature 4: 스피드 점수 & 3D 시상식 포디움 -->
            <div class="landing-card">
              <div class="landing-card-header">
                <div class="landing-card-icon">🏆</div>
                <h3 class="landing-card-title">스피드 점수 & 3D 시상식 & 무점수 요약</h3>
              </div>
              <p class="landing-card-desc">
                제한시간 내 정답 제출 시 스피드 가산점이 부여되고 팡파르 음악과 함께 3D 챔피언 시상식이 열립니다. 무점수 의견 수렴 퀴즈는 점수 랭킹 대신 '의견 수렴 완료 요약'을 제공합니다.
              </p>
              <div class="landing-preview-box" style="text-align: center;">
                <div style="display: flex; justify-content: center; gap: 16px; align-items: flex-end; padding: 10px 0;">
                  <div style="background: #334155; padding: 8px 14px; border-radius: 8px 8px 0 0; color: #e2e8f0; font-size: 0.85rem;">🥈 2위 (420점)</div>
                  <div style="background: #b45309; padding: 14px 18px; border-radius: 10px 10px 0 0; color: #fef08a; font-weight: bold; font-size: 1rem;">👑 🥇 1위 (580점)</div>
                  <div style="background: #334155; padding: 6px 12px; border-radius: 8px 8px 0 0; color: #fde68a; font-size: 0.85rem;">🥉 3위 (310점)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 교실 수업 적용 시나리오 4종 -->
          <h3 style="font-size: 1.6rem; font-weight: bold; text-align: center; margin: 40px 0 10px 0;">💡 교실 수업에서 이렇게 활용해 보세요!</h3>
          <div class="scenario-card-grid">
            <div class="scenario-card">
              <div class="scenario-icon">📐</div>
              <div class="scenario-title">수학 / 과학 수식 퀴즈</div>
              <div class="scenario-desc">LaTeX 수식 편집 보조 헬퍼 모달과 기호 툴바로 분수, 제곱, 근호 문제를 손쉽게 출제하고 시각화합니다.</div>
            </div>
            <div class="scenario-card">
              <div class="scenario-icon">💬</div>
              <div class="scenario-title">사회 / 국어 의견 수렴</div>
              <div class="scenario-desc">무점수 워드클라우드 및 50vh 그림 포스트잇으로 학생들의 창의적인 생각과 토론 의견을 실시간 수집합니다.</div>
            </div>
            <div class="scenario-card">
              <div class="scenario-icon">⚡</div>
              <div class="scenario-title">단원 형성평가 & 복습</div>
              <div class="scenario-desc">O/X 참거짓 및 3종 차트 선다형 문항으로 스피드 점수 경쟁을 유도하고 흥미진진한 복습 퀴즈를 진행합니다.</div>
            </div>
            <div class="scenario-card">
              <div class="scenario-icon">🎨</div>
              <div class="scenario-title">공개수업 4종 디자인 테마</div>
              <div class="scenario-desc">스마트 TV, 초록 칠판, 대리석, 우드락 보드 4종 감성 테마로 교실 및 공개수업 분위기에 맞춰 단번에 전환합니다.</div>
            </div>
          </div>

          <!-- 하단 최상단 이동 & 시작하기 CTA -->
          <div style="margin-top: 50px; text-align: center; padding: 30px; background: var(--card-dark); border: 2px solid var(--primary); border-radius: var(--radius-lg);">
            <h3 style="font-size: 1.6rem; color: var(--color-primary); margin-bottom: 10px;">🚀 지금 바로 우리 반 퀴즈를 시작해보세요!</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 1.05rem;">별도 회원가입이나 프로그램 설치 없이 클릭 한 번으로 시작할 수 있습니다.</p>
            <div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" id="btn-scroll-top-cta" style="font-size: 1.1rem; padding: 14px 28px;">⬆️ 맨 위로 이동하여 시작하기</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-create-room')?.addEventListener('click', handleCreateRoom);
    document.getElementById('btn-open-fb-info')?.addEventListener('click', openFirebaseInfoModal);
    document.getElementById('select-theme-home')?.addEventListener('change', (e) => setTheme(e.target.value));
    document.getElementById('btn-enter-display')?.addEventListener('click', () => {
      const pin = document.getElementById('input-display-pin').value.trim();
      if (pin.length === 6) window.location.search = `?room=${pin}&role=display`;
      else alert('6자리 PIN 번호를 입력해 주세요.');
    });
    document.getElementById('btn-enter-student')?.addEventListener('click', () => {
      const pin = document.getElementById('input-student-pin').value.trim();
      if (pin.length === 6) window.location.search = `?room=${pin}&role=student`;
      else alert('6자리 PIN 번호를 입력해 주세요.');
    });

    // 랜딩 예시 차트 탭 인터랙션
    const demoBox = document.getElementById('landing-chart-demo');
    const tabGrid = document.getElementById('tab-landing-grid');
    const tabBar = document.getElementById('tab-landing-bar');
    const tabPie = document.getElementById('tab-landing-pie');

    const renderChartDemo = (type) => {
      if (!demoBox) return;
      if (type === 'bar') {
        demoBox.innerHTML = `
          <div style="width: 100%; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 6px 12px; border-radius: 6px;">
              <span>1. 세종대왕</span>
              <div style="flex:1; margin: 0 12px; background: #0f172a; height: 16px; border-radius: 8px; overflow: hidden;"><div style="width: 75%; height: 100%; background: #38bdf8;"></div></div>
              <span style="color: #38bdf8; font-weight: bold;">75% (15명)</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 6px 12px; border-radius: 6px;">
              <span>2. 이순신</span>
              <div style="flex:1; margin: 0 12px; background: #0f172a; height: 16px; border-radius: 8px; overflow: hidden;"><div style="width: 25%; height: 100%; background: #f59e0b;"></div></div>
              <span style="color: #f59e0b; font-weight: bold;">25% (5명)</span>
            </div>
          </div>
        `;
      } else if (type === 'pie') {
        demoBox.innerHTML = `
          <div style="display: flex; align-items: center; gap: 20px; justify-content: center;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(#38bdf8 0% 75%, #f59e0b 75% 100%); display: flex; align-items: center; justify-content: center;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; color: #fff;">20명</div>
            </div>
            <div style="font-size: 0.85rem; text-align: left;">
              <div style="color: #38bdf8;">● 1. 세종대왕: 75%</div>
              <div style="color: #f59e0b; margin-top: 4px;">● 2. 이순신: 25%</div>
            </div>
          </div>
        `;
      } else {
        demoBox.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #38bdf8;">
              <span style="font-weight: bold;">1. 세종대왕</span>
              <div style="color: #38bdf8; font-weight: bold; margin-top: 4px;">15명 (75%)</div>
            </div>
            <div style="background: #1e293b; padding: 12px; border-radius: 8px; text-align: center;">
              <span style="font-weight: bold;">2. 이순신</span>
              <div style="color: #f59e0b; font-weight: bold; margin-top: 4px;">5명 (25%)</div>
            </div>
          </div>
        `;
      }
    };

    renderChartDemo('grid');

    tabGrid?.addEventListener('click', () => {
      [tabGrid, tabBar, tabPie].forEach(b => b?.classList.remove('active'));
      tabGrid.classList.add('active');
      renderChartDemo('grid');
    });
    tabBar?.addEventListener('click', () => {
      [tabGrid, tabBar, tabPie].forEach(b => b?.classList.remove('active'));
      tabBar.classList.add('active');
      renderChartDemo('bar');
    });
    tabPie?.addEventListener('click', () => {
      [tabGrid, tabBar, tabPie].forEach(b => b?.classList.remove('active'));
      tabPie.classList.add('active');
      renderChartDemo('pie');
    });

    // 결과 가리기 버튼 인터랙션 시뮬레이션
    let isLandingHide = true;
    document.getElementById('btn-landing-toggle-results')?.addEventListener('click', (e) => {
      isLandingHide = !isLandingHide;
      e.currentTarget.textContent = isLandingHide ? '🙈 결과 가리기 (클릭해 보세요)' : '👁️ 결과 공개 (클릭해 보세요)';
      const s1 = document.getElementById('demo-stat-1');
      const s2 = document.getElementById('demo-stat-2');
      if (s1) s1.innerHTML = isLandingHide ? '🔒 가림' : '15명 (75%)';
      if (s2) s2.innerHTML = isLandingHide ? '🔒 가림' : '5명 (25%)';
    });

    // 맨 위로 이동 CTA
    document.getElementById('btn-scroll-top-cta')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.querySelectorAll('.btn-run-room').forEach(btn => {
      btn.addEventListener('click', (e) => window.location.search = `?room=${e.currentTarget.dataset.pin}&role=teacher`);
    });
    document.querySelectorAll('.btn-display-room').forEach(btn => {
      btn.addEventListener('click', (e) => window.location.search = `?room=${e.currentTarget.dataset.pin}&role=display`);
    });
    document.querySelectorAll('.btn-rename-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const pin = e.currentTarget.dataset.pin;
        const oldTitle = e.currentTarget.dataset.title || '실시간 수업 퀴즈';
        const newTitle = prompt('퀴즈 방의 새 이름을 입력하세요:', oldTitle);
        if (newTitle !== null && newTitle.trim() !== '') {
          const title = newTitle.trim();
          saveMyLocalQuizRoom({ roomId: pin, title: title });
          await updateRoomMeta(pin, { title: title });
          renderHomeView(app);
        }
      });
    });
    document.querySelectorAll('.btn-edit-room').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const pin = e.currentTarget.dataset.pin;
        const roomData = await fetchFirebaseRest(`rooms/${pin}`) || JSON.parse(localStorage.getItem(`demo_room_${pin}`) || '{}');
        renderTeacherAdminModal(pin, roomData.questions || [], async () => {
          const updated = await fetchFirebaseRest(`rooms/${pin}`) || roomData;
          saveMyLocalQuizRoom({ roomId: pin, questionCount: (updated.questions || []).length });
          alert('문항이 성공적으로 저장되었습니다.');
          renderHomeView(app);
        });
      });
    });
    document.querySelectorAll('.btn-del-room').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pin = e.currentTarget.dataset.pin;
        if (confirm(`PIN [${pin}] 퀴즈 방을 삭제하시겠습니까?`)) {
          removeMyLocalQuizRoom(pin);
          renderHomeView(app);
        }
      });
    });
  }

  async function handleCreateRoom() {
    const roomId = generateRoomId();
    state.roomId = roomId;
    const initialRoomData = {
      meta: { title: '실시간 수업 퀴즈', createdAt: Date.now(), status: 'LOBBY', currentQuestionIndex: 0 },
      questions: [],
      participants: {}
    };
    await createRoom(roomId, initialRoomData);
    saveMyLocalQuizRoom({ roomId, title: '실시간 수업 퀴즈', questionCount: 0, createdAt: Date.now() });
    window.location.search = `?room=${roomId}&role=teacher`;
  }

  function initHostFlow(app, isTeacherControl) {
    subscribeRoom(state.roomId, (roomData) => {
      if (!roomData) {
        app.innerHTML = `
          <div class="mobile-view">
            <div class="mobile-card">
              <div style="font-size: 3rem; margin-bottom: 12px;">⚠️</div>
              <h2 style="font-size: 1.5rem; color: #f59e0b;">퀴즈 방이 생성되지 않았습니다</h2>
              <p style="color: var(--text-muted); margin-top: 10px;">교사 PC에서 먼저 [새 퀴즈 방 만들기]로 방을 생성해 주세요.</p>
              <button class="btn btn-secondary" onclick="window.location.search=''" style="margin-top: 20px;">메인 화면으로 이동</button>
            </div>
          </div>
        `;
        return;
      }
      state.roomData = roomData;
      const status = roomData.meta?.status || 'LOBBY';
      if (status === 'LOBBY') renderHostLobbyView(app, isTeacherControl);
      else renderHostDisplayView(app, roomData, state.roomId, isTeacherControl);
    });
  }

  function renderHostLobbyView(app, isTeacherControl) {
    const baseUrl = window.location.origin + window.location.pathname;
    const studentJoinUrl = `${baseUrl}?room=${state.roomId}&role=student`;
    const questions = state.roomData?.questions || [];

    app.innerHTML = `
      <div class="lobby-layout">
        <div class="lobby-header">
          <div style="display: flex; align-items: center;">
            <span class="room-badge">방 PIN : ${state.roomId}</span>
            <button class="btn btn-secondary" id="btn-go-home-lobby" style="margin-left: 12px; font-weight: bold; padding: 6px 14px; font-size: 0.9rem;">🏠 메인으로</button>
            <select id="select-theme-lobby" class="select-theme-dropdown" style="margin-left: 12px; padding: 6px 12px; border-radius: 8px; background: #1e293b; color: #fff; border: 1px solid var(--border); font-size: 0.9rem; font-weight: bold; cursor: pointer;">
              <option value="tv" ${getSavedTheme() === 'tv' ? 'selected' : ''}>📺 스마트 TV</option>
              <option value="chalkboard" ${getSavedTheme() === 'chalkboard' ? 'selected' : ''}>🧹 초록 칠판</option>
              <option value="marble" ${getSavedTheme() === 'marble' ? 'selected' : ''}>🏛️ 깔끔 대리석</option>
              <option value="woodlock" ${getSavedTheme() === 'woodlock' ? 'selected' : ''}>🪵 우드락 보드</option>
            </select>
            ${!isTeacherControl ? '<span style="margin-left: 12px; color: #38bdf8; font-weight: bold;">[전자칠판 디스플레이 모드]</span>' : ''}
          </div>
          <div style="display: flex; gap: 12px;">
            ${isTeacherControl ? '<button class="btn btn-secondary" id="btn-open-edit">📝 문제 출제 / 편집 (' + questions.length + '개)</button>' : ''}
            <button class="btn btn-primary" id="btn-start-quiz" style="font-size: 1.25rem; padding: 14px 32px;">🚀 퀴즈 시작</button>
          </div>
        </div>

        ${questions.length === 0 ? `
          <div style="background: rgba(245, 158, 11, 0.15); border: 1px dashed #f59e0b; padding: 14px 20px; border-radius: 12px; margin-top: 20px; color: #fbbf24; font-weight: bold; text-align: center; font-size: 1.1rem;">
            💡 출제된 문제가 아직 없습니다. 우측 상단의 <strong>[📝 문제 출제 / 편집]</strong> 버튼을 누르고 질문을 자유롭게 추가해 주세요!
          </div>
        ` : ''}

        <div class="lobby-content">
          <div class="qr-box">
            <h2>스마트폰으로 참여하세요</h2>
            <div class="pin-number">${state.roomId}</div>
            <div class="qr-canvas-container" id="qr-canvas-container" style="background:#fff; padding:10px; border-radius:12px;"></div>
            <p style="color: var(--text-muted); font-size: 0.95rem; word-break: break-all; margin-top: 10px;">
              접속 주소: <br><strong>${studentJoinUrl}</strong>
            </p>
          </div>

          <div class="participants-box">
            <div class="participants-header">
              <h2>대기 중인 학생들</h2>
              <span class="participant-count" id="count-display">0명</span>
            </div>
            <div class="participant-grid" id="participant-list"></div>
          </div>
        </div>
      </div>
    `;

    const qrContainer = document.getElementById('qr-canvas-container');
    if (qrContainer && window.QRCode) {
      qrContainer.innerHTML = '';
      new window.QRCode(qrContainer, { text: studentJoinUrl, width: 200, height: 200 });
    }

    updateParticipantList(state.roomData?.participants || {});

    document.getElementById('btn-go-home-lobby')?.addEventListener('click', () => window.location.search = '');
    document.getElementById('select-theme-lobby')?.addEventListener('change', (e) => setTheme(e.target.value));

    document.getElementById('btn-open-edit')?.addEventListener('click', () => {
      if (!isRoomCreatorLocal(state.roomId)) {
        alert('🔒 문제 편집 권한 안내\n\n이 퀴즈 방은 다른 컴퓨터/기기에서 작성된 방입니다.\n문제 수정 및 삭제는 처음 이 퀴즈를 출제하신 교사 PC(로컬)에서만 가능하며, 본 컴퓨터에서는 퀴즈 진행 및 송출만 실행하실 수 있습니다.');
        return;
      }
      renderTeacherAdminModal(state.roomId, state.roomData?.questions, () => {
        saveMyLocalQuizRoom({ roomId: state.roomId, questionCount: (state.roomData?.questions || []).length });
        alert('문항이 성공적으로 저장되었습니다.');
      });
    });

    document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
      const qs = state.roomData?.questions || [];
      if (qs.length === 0) {
        alert('출제된 문항이 없습니다. [📝 문제 출제 / 편집] 버튼을 먼저 눌러 문제를 추가해 주세요!');
        return;
      }
      await updateRoomMeta(state.roomId, {
        status: 'PLAYING',
        currentQuestionIndex: 0,
        timerStartedAt: Date.now()
      });
    });
  }

  function updateParticipantList(participants) {
    const container = document.getElementById('participant-list');
    const countDisplay = document.getElementById('count-display');
    if (!container || !countDisplay) return;

    const list = Object.values(participants);
    countDisplay.textContent = `${list.length}명`;

    if (list.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); margin: auto; font-size: 1.2rem;">학생들이 QR코드를 스캔해 입장하기를 기다리는 중입니다...</p>`;
      return;
    }

    container.innerHTML = list.map(p => `
      <div class="student-tag">
        <span>${p.avatar || '🐶'}</span>
        <span>${escapeHtml(p.nickname)}</span>
      </div>
    `).join('');
  }

  function initStudentFlow(app) {
    const studentId = getOrCreateStudentId();

    app.innerHTML = `
      <div class="mobile-view">
        <div class="mobile-card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 3rem; margin-bottom: 16px;">⚡</div>
          <h2 style="font-size: 1.4rem; color: #38bdf8; margin-bottom: 8px;">퀴즈 방 연결 중...</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">방 PIN: <strong>${state.roomId}</strong></p>
        </div>
      </div>
    `;

    let receiveCount = 0;
    subscribeRoom(state.roomId, (roomData) => {
      receiveCount++;
      if (!roomData) {
        if (receiveCount < 2) return;
        app.innerHTML = `
          <div class="mobile-view">
            <div class="mobile-card">
              <div style="font-size: 3.5rem; margin-bottom: 12px;">🔎</div>
              <h2 style="font-size: 1.5rem; color: #fbbf24;">퀴즈 방을 찾을 수 없습니다</h2>
              <p style="color: var(--text-muted); margin-top: 10px; font-size: 1rem; line-height: 1.5;">
                입력하신 방 PIN(<strong>${state.roomId}</strong>)이 존재하지 않거나,<br>교사 PC에서 아직 퀴즈 방 생성이 완료되지 않은 상태입니다.
              </p>
              <button class="btn btn-primary" onclick="window.location.search=''" style="width: 100%; margin-top: 20px;">메인 화면으로 이동</button>
            </div>
          </div>
        `;
        return;
      }

      state.roomData = roomData;
      const myParticipant = roomData.participants && roomData.participants[studentId];
      if (myParticipant) {
        state.nickname = myParticipant.nickname;
        renderStudentPadView(app, roomData, state.roomId, studentId, state.nickname, myParticipant.avatar);
      } else {
        if (!document.getElementById('student-join-card')) {
          renderStudentJoinView(app, studentId);
        }
      }
    });
  }

  function renderStudentJoinView(app, studentId) {
    let selectedAvatar = '🐶';
    app.innerHTML = `
      <div class="mobile-view">
        <div style="text-align: center; margin-bottom: 20px;">
          <span class="room-badge">PIN : ${state.roomId}</span>
        </div>
        <div class="mobile-card" id="student-join-card">
          <h2 style="font-size: 1.6rem; margin-bottom: 6px;">환영합니다! 👋</h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 16px;">닉네임과 캐릭터 아바타를 선택해 주세요.</p>

          <div style="font-size: 0.9rem; font-weight: bold; text-align: left; margin-bottom: 6px; color: var(--text-muted);">아바타 선택:</div>
          <div id="avatar-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
            ${AVATARS.map((av, idx) => `
              <div class="avatar-option ${idx === 0 ? 'selected' : ''}" data-avatar="${av}" style="font-size: 1.8rem; padding: 6px 2px; border-radius: 12px; cursor: pointer; background: #0f172a; border: 2px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}; text-align: center; user-select: none;">
                ${av}
              </div>
            `).join('')}
          </div>
          
          <input type="text" id="input-nickname" class="input-nickname" placeholder="닉네임 입력 (최대 8자)" maxlength="8" autofocus style="margin-top: 0;">
          <button class="btn btn-primary" id="btn-student-join" style="width: 100%; font-size: 1.2rem; margin-top: 12px;">입장하기</button>
        </div>
      </div>
    `;

    const avatarGrid = document.getElementById('avatar-grid');
    avatarGrid.querySelectorAll('.avatar-option').forEach(item => {
      item.addEventListener('click', (e) => {
        avatarGrid.querySelectorAll('.avatar-option').forEach(el => el.style.borderColor = 'transparent');
        e.currentTarget.style.borderColor = 'var(--primary)';
        selectedAvatar = e.currentTarget.dataset.avatar;
      });
    });

    const btnJoin = document.getElementById('btn-student-join');
    const inputNick = document.getElementById('input-nickname');

    const doJoin = async () => {
      const nick = inputNick.value.trim();
      if (!nick) return alert('닉네임을 입력해 주세요!');
      state.nickname = nick;
      await joinParticipant(state.roomId, studentId, nick, selectedAvatar);
    };

    btnJoin.addEventListener('click', doJoin);
    inputNick.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
  }

  function renderTeacherAdminModal(roomId, currentQuestions, onSaveCallback) {
    let questions = Array.isArray(currentQuestions) 
      ? JSON.parse(JSON.stringify(currentQuestions)) 
      : [];
    currentEditingQuestions = questions;

    const roomMeta = state.roomData?.meta || {};
    const currentTitle = roomMeta.title || '실시간 수업 퀴즈';

    const modalHtml = `
      <div id="admin-modal" class="modal-overlay">
        <div class="modal-box" style="max-width: 780px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h2>📝 퀴즈 출제 / 문항 관리</h2>
            <span style="color: var(--text-muted);">방 PIN: <strong>${roomId}</strong></span>
          </div>
          <div style="margin-bottom: 16px; background: #0f172a; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border);">
            <label style="font-weight: bold; font-size: 0.9rem; color: #38bdf8;">🏷️ 퀴즈 방 제목/이름:</label>
            <input type="text" id="input-admin-room-title" value="${escapeHtml(currentTitle)}" placeholder="퀴즈 방 제목을 입력하세요" style="width: 100%; margin-top: 6px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: #1e293b; color: #fff; font-weight: bold; font-size: 1rem;">
          </div>
          <div id="question-list-editor" style="margin-bottom: 20px; max-height: 50vh; overflow-y: auto;"></div>
          <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; background: #0f172a; padding: 16px; border-radius: 12px;">
            <span style="width: 100%; font-weight: bold; margin-bottom: 4px;">+ 새 문항 유형 선택 추가:</span>
            <button class="btn btn-outline-sm" id="btn-add-ox">+ O/X 참거짓</button>
            <button class="btn btn-outline-sm" id="btn-add-choice" style="border-color: #38bdf8; color: #38bdf8; font-weight: bold;">+ 선다형 (그리드/막대/원형)</button>
            <button class="btn btn-outline-sm" id="btn-add-short">+ 단답형</button>
            <button class="btn btn-outline-sm" id="btn-add-wordcloud">+ 워드클라우드</button>
            <button class="btn btn-outline-sm" id="btn-add-postit">+ 포스트잇 브레인스토밍</button>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="btn-cancel-admin">닫기</button>
            <button class="btn btn-primary" id="btn-save-questions">저장 및 반영하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const container = document.getElementById('question-list-editor');

    function renderEditorList() {
      if (questions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 50px 20px; font-size: 1.1rem; background: #0f172a; border-radius: 12px; border: 1px dashed var(--border);">
            📝 아직 작성된 문항이 없습니다.<br><br>아래의 <strong>[+ 새 문항 유형 선택 추가]</strong> 버튼을 눌러 첫 문제를 출제해 주세요!
          </div>
        `;
        return;
      }
      container.innerHTML = questions.map((q, idx) => `
        <div style="background: #0f172a; border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <span style="font-weight: 800; color: #38bdf8; font-size: 1.1rem;">Q${idx + 1}. [${getQuestionTypeLabel(q.type)}]</span>
            <div style="display: flex; gap: 12px; align-items: center;">
              <label style="font-size: 0.9rem; color: #fbbf24; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold;">
                <input type="checkbox" class="double-points-cb" data-idx="${idx}" ${q.isDoublePoints ? 'checked' : ''}>
                ⚡ 점수 2배 이벤트
              </label>
              <select class="time-limit-select" data-idx="${idx}" style="padding: 6px 10px; border-radius: 6px; background: #1e293b; color: #fff; border: 1px solid var(--border);">
                <option value="0" ${q.timeLimit == 0 ? 'selected' : ''}>⏱️ 무제한 (의견 수렴)</option>
                <option value="10" ${q.timeLimit == 10 ? 'selected' : ''}>10초</option>
                <option value="15" ${q.timeLimit == 15 ? 'selected' : ''}>15초</option>
                <option value="20" ${q.timeLimit == 20 ? 'selected' : ''}>20초</option>
                <option value="30" ${q.timeLimit == 30 ? 'selected' : ''}>30초</option>
              </select>
              <button class="btn btn-outline-sm btn-duplicate-q" data-idx="${idx}" style="padding: 6px 12px; font-size: 0.85rem; border-color: #38bdf8; color: #38bdf8; font-weight: bold;">📋 복제</button>
              <button class="btn btn-danger btn-delete-q" data-idx="${idx}" style="padding: 6px 12px; font-size: 0.85rem;">삭제</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <label style="font-size: 0.88rem; font-weight: bold;">질문 제목/내용:</label>
              <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn btn-outline-sm btn-open-formula" data-target="title_${idx}" style="padding: 3px 8px; font-size: 0.78rem; border-color: #38bdf8; color: #38bdf8; font-weight: bold; background: rgba(56, 189, 248, 0.1);">
                  ∑ 수식·도구
                </button>
                <button type="button" class="btn btn-outline-sm btn-quick-fmt" data-target="title_${idx}" data-fmt="**" style="padding: 3px 6px; font-size: 0.78rem;"><b>B</b></button>
                <button type="button" class="btn btn-outline-sm btn-quick-fmt" data-target="title_${idx}" data-fmt="*" style="padding: 3px 6px; font-size: 0.78rem;"><i>i</i></button>
                <button type="button" class="btn btn-outline-sm btn-quick-sym" data-target="title_${idx}" data-sym="△" style="padding: 3px 6px; font-size: 0.78rem;">△</button>
                <button type="button" class="btn btn-outline-sm btn-quick-sym" data-target="title_${idx}" data-sym="◯" style="padding: 3px 6px; font-size: 0.78rem;">◯</button>
                <button type="button" class="btn btn-outline-sm btn-quick-sym" data-target="title_${idx}" data-sym="□" style="padding: 3px 6px; font-size: 0.78rem;">□</button>
                <button type="button" class="btn btn-outline-sm btn-quick-sym" data-target="title_${idx}" data-sym="★" style="padding: 3px 6px; font-size: 0.78rem;">★</button>
                <button type="button" class="btn btn-outline-sm btn-quick-sym" data-target="title_${idx}" data-sym="→" style="padding: 3px 6px; font-size: 0.78rem;">→</button>
              </div>
            </div>
            <input type="text" id="input_title_${idx}" class="q-title-input" data-idx="${idx}" value="${escapeHtml(q.question)}" placeholder="질문 내용을 입력하세요 (버튼으로 수식/도형/서식 쉽게 입력)">
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 0.88rem; font-weight: bold;">🖼️ 문제 첨부 이미지 / 그래프 (선택):</label>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
              <input type="file" class="q-image-file" data-idx="${idx}" accept="image/*" style="font-size: 0.85rem; color: var(--text-muted);">
              <button type="button" class="btn btn-outline-sm btn-open-graph-modal" data-idx="${idx}" style="padding: 4px 10px; font-size: 0.82rem; border-color: #10b981; color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.12); border-radius: 6px;">
                📈 함수 그래프 그리기·삽입
              </button>
              ${q.imageUrl ? `<button type="button" class="btn btn-danger btn-del-image" data-idx="${idx}" style="padding: 4px 10px; font-size: 0.8rem;">❌ 이미지 삭제</button>` : ''}
            </div>
            ${q.imageUrl ? `<div style="margin-top: 8px; display: inline-block; background: #ffffff; padding: 4px; border-radius: 8px; border: 1px solid var(--border);"><img src="${q.imageUrl}" style="max-height: 140px; max-width: 100%; border-radius: 6px; display: block;"></div>` : ''}
          </div>
          ${renderTypeSpecificEditor(q, idx)}
        </div>
      `).join('');

      container.querySelectorAll('.q-title-input').forEach(input => {
        input.addEventListener('input', (e) => { questions[e.target.dataset.idx].question = e.target.value; });
      });
      container.querySelectorAll('.q-image-file').forEach(input => {
        input.addEventListener('change', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          const file = e.target.files[0];
          if (file) {
            compressImage(file, 600, (dataUrl) => {
              questions[qIdx].imageUrl = dataUrl;
              renderEditorList();
            });
          }
        });
      });
      container.querySelectorAll('.btn-open-graph-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.currentTarget.dataset.idx);
          openGraphEditorModal(qIdx, questions, () => renderEditorList());
        });
      });
      container.querySelectorAll('.btn-del-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          delete questions[qIdx].imageUrl;
          delete questions[qIdx].graphFormula;
          renderEditorList();
        });
      });
      container.querySelectorAll('.double-points-cb').forEach(cb => {
        cb.addEventListener('change', (e) => { questions[e.target.dataset.idx].isDoublePoints = e.target.checked; });
      });
      container.querySelectorAll('.time-limit-select').forEach(sel => {
        sel.addEventListener('change', (e) => { questions[e.target.dataset.idx].timeLimit = Number(e.target.value); });
      });
      container.querySelectorAll('.btn-duplicate-q').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.currentTarget.dataset.idx);
          const source = questions[qIdx];
          if (source) {
            const cloned = JSON.parse(JSON.stringify(source));
            cloned.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            questions.splice(qIdx + 1, 0, cloned);
            renderEditorList();
          }
        });
      });
      container.querySelectorAll('.btn-delete-q').forEach(btn => {
        btn.addEventListener('click', (e) => { questions.splice(Number(e.target.dataset.idx), 1); renderEditorList(); });
      });
      container.querySelectorAll('.choice-chartstyle-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          questions[qIdx].chartStyle = e.target.value;
          renderEditorList();
        });
      });
      container.querySelectorAll('.choice-isscoring-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          questions[qIdx].isScoring = e.target.checked;
          if (!e.target.checked) {
            questions[qIdx].timeLimit = 0;
          }
          renderEditorList();
        });
      });
      container.querySelectorAll('.poll-multiselect-cb').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          questions[qIdx].isMultiSelect = e.target.checked;
          renderEditorList();
        });
      });
      container.querySelectorAll('.poll-maxselect-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          questions[qIdx].maxSelect = Number(e.target.value);
        });
      });

      container.querySelectorAll('.btn-open-formula').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = 'input_' + e.currentTarget.dataset.target;
          const inputEl = document.getElementById(targetId);
          openFormulaEditorModal(inputEl, questions, () => renderEditorList());
        });
      });
      container.querySelectorAll('.btn-quick-fmt').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = 'input_' + e.currentTarget.dataset.target;
          const fmt = e.currentTarget.dataset.fmt;
          const inputEl = document.getElementById(targetId);
          if (inputEl) {
            const start = inputEl.selectionStart || 0;
            const end = inputEl.selectionEnd || inputEl.value.length;
            const val = inputEl.value;
            const sel = val.substring(start, end) || '텍스트';
            inputEl.value = val.substring(0, start) + fmt + sel + fmt + val.substring(end);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });
      container.querySelectorAll('.btn-quick-sym').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = 'input_' + e.currentTarget.dataset.target;
          const sym = e.currentTarget.dataset.sym;
          const inputEl = document.getElementById(targetId);
          if (inputEl) {
            const start = inputEl.selectionStart || inputEl.value.length;
            const end = inputEl.selectionEnd || inputEl.value.length;
            const val = inputEl.value;
            inputEl.value = val.substring(0, start) + sym + val.substring(end);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });

      container.querySelectorAll('.btn-add-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.currentTarget.dataset.qidx);
          if (questions[qIdx].options.length < 5) {
            questions[qIdx].options.push(`보기 ${questions[qIdx].options.length + 1}`);
            renderEditorList();
          }
        });
      });

      container.querySelectorAll('.btn-del-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.currentTarget.dataset.qidx);
          const optIdx = Number(e.currentTarget.dataset.optidx);
          if (questions[qIdx].options.length > 2) {
            questions[qIdx].options.splice(optIdx, 1);
            if (questions[qIdx].correctAnswer >= questions[qIdx].options.length) {
              questions[qIdx].correctAnswer = 0;
            }
            renderEditorList();
          }
        });
      });

      container.querySelectorAll('.opt-text-input').forEach(input => {
        input.addEventListener('input', (e) => {
          questions[Number(e.target.dataset.qidx)].options[Number(e.target.dataset.optidx)] = e.target.value;
        });
      });
      container.querySelectorAll('.correct-radio').forEach(radio => {
        radio.addEventListener('change', (e) => {
          questions[Number(e.target.dataset.qidx)].correctAnswer = Number(e.target.value);
        });
      });
      container.querySelectorAll('.short-target-input').forEach(input => {
        input.addEventListener('input', (e) => {
          questions[Number(e.target.dataset.qidx)].correctText = e.target.value;
        });
      });
    }

    renderEditorList();

    document.getElementById('btn-add-ox').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'ox', question: '신규 O/X 질문입니다.', options: ['O (그렇다)', 'X (아니다)'], correctAnswer: 0, timeLimit: 15, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-choice').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'choice', question: '신규 선다형 질문입니다.', options: ['보기 1', '보기 2'], correctAnswer: 0, timeLimit: 20, isDoublePoints: false, chartStyle: 'grid', isScoring: true });
      renderEditorList();
    });
    document.getElementById('btn-add-short').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'short', question: '신규 단답형 질문입니다.', correctText: '정답', timeLimit: 20, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-wordcloud').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'wordcloud', question: '신규 워드클라우드 질문입니다.', timeLimit: 0, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-postit').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'postit', question: '신규 포스트잇 질문입니다.', timeLimit: 0, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-cancel-admin').addEventListener('click', () => {
      document.getElementById('admin-modal').remove();
    });
    document.getElementById('btn-save-questions').addEventListener('click', async () => {
      const newTitleInput = document.getElementById('input-admin-room-title');
      if (newTitleInput) {
        const title = newTitleInput.value.trim() || '실시간 수업 퀴즈';
        saveMyLocalQuizRoom({ roomId, title, questionCount: questions.length });
        await updateRoomMeta(roomId, { title });
      }
      await updateQuestions(roomId, questions);
      document.getElementById('admin-modal').remove();
      if (onSaveCallback) onSaveCallback();
    });
  }

  function getQuestionTypeLabel(type) {
    switch(type) {
      case 'ox': return 'O/X 참거짓'; case 'choice': return '선다형'; case 'poll': return '선다형'; case 'short': return '단답형'; case 'wordcloud': return '워드클라우드'; case 'postit': return '포스트잇'; default: return '퀴즈';
    }
  }

  function renderTypeSpecificEditor(q, idx) {
    if (q.type === 'ox' || q.type === 'choice' || q.type === 'poll') {
      const isChoice = q.type === 'choice' || q.type === 'poll';
      const chartStyle = q.chartStyle || 'grid';
      const isScoring = q.isScoring !== false;

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 0.9rem; color: var(--text-muted);">보기 수정 및 정답 선택:</div>
          ${isChoice ? `
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <select class="choice-chartstyle-select" data-idx="${idx}" style="padding: 4px 8px; border-radius: 6px; background: #1e293b; color: #38bdf8; border: 1px solid var(--border); font-weight: bold; font-size: 0.85rem;">
                <option value="grid" ${chartStyle === 'grid' ? 'selected' : ''}>▦ 그리드 카드 형태</option>
                <option value="bar" ${chartStyle === 'bar' ? 'selected' : ''}>📊 막대 그래프 형태</option>
                <option value="pie" ${chartStyle === 'pie' ? 'selected' : ''}>🍩 원형 그래프 (차트) 형태</option>
              </select>
              ${q.options.length < 5 ? `<button type="button" class="btn btn-outline-sm btn-add-option" data-qidx="${idx}" style="padding: 4px 10px; font-size: 0.8rem;">+ 보기 추가</button>` : ''}
            </div>
          ` : ''}
        </div>

        ${isChoice ? `
          <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 12px; background: #1e293b; padding: 10px 12px; border-radius: 8px; flex-wrap: wrap;">
            <label style="font-size: 0.9rem; color: #10b981; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <input type="checkbox" class="choice-isscoring-cb" data-idx="${idx}" ${isScoring ? 'checked' : ''}>
              💯 점수 반영 (퀴즈 모드 - 정답 1개 선택)
            </label>
            ${!isScoring ? `
              <label style="font-size: 0.9rem; color: #fbbf24; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px; margin-left: 10px;">
                <input type="checkbox" class="poll-multiselect-cb" data-idx="${idx}" ${q.isMultiSelect ? 'checked' : ''}>
                ☑️ 중복 투표 허용 (다중 선택)
              </label>
              ${q.isMultiSelect ? `
                <label style="font-size: 0.88rem; color: #fff; display: flex; align-items: center; gap: 6px;">
                  최대 선택 개수:
                  <select class="poll-maxselect-select" data-idx="${idx}" style="padding: 4px 8px; border-radius: 6px; background: #0f172a; color: #fff; border: 1px solid var(--border);">
                    <option value="0" ${!q.maxSelect || q.maxSelect == 0 ? 'selected' : ''}>무제한 (자유 선택)</option>
                    <option value="2" ${q.maxSelect == 2 ? 'selected' : ''}>최대 2개</option>
                    <option value="3" ${q.maxSelect == 3 ? 'selected' : ''}>최대 3개</option>
                    <option value="4" ${q.maxSelect == 4 ? 'selected' : ''}>최대 4개</option>
                    <option value="5" ${q.maxSelect == 5 ? 'selected' : ''}>최대 5개</option>
                  </select>
                </label>
              ` : ''}
            ` : ''}
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${q.options.map((opt, optIdx) => `
            <div style="display: flex; align-items: center; gap: 10px;">
              ${isScoring ? `
                <input type="radio" class="correct-radio" name="correct_${idx}" data-qidx="${idx}" value="${optIdx}" ${q.correctAnswer == optIdx ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
              ` : `
                <span style="font-size: 1.1rem; width: 20px; text-align: center;">📊</span>
              `}
              <span style="font-weight: bold; min-width: 24px;">${optIdx + 1}.</span>
              <input type="text" id="input_opt_${idx}_${optIdx}" class="opt-text-input" data-qidx="${idx}" data-optidx="${optIdx}" value="${escapeHtml(opt)}" placeholder="보기 내용 입력 (비워두면 자동 제외)" style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: #1e293b; color: #fff;">
              <button type="button" class="btn btn-outline-sm btn-open-formula" data-target="opt_${idx}_${optIdx}" style="padding: 4px 8px; font-size: 0.8rem; border-color: #38bdf8; color: #38bdf8;">∑</button>
              ${isChoice && q.options.length > 2 ? `
                <button type="button" class="btn btn-danger btn-del-option" data-qidx="${idx}" data-optidx="${optIdx}" style="padding: 4px 8px; font-size: 0.8rem;">❌</button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'short') {
      return `
        <div class="form-group" style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label style="font-weight: bold;">단답형 정답 텍스트:</label>
            <button type="button" class="btn btn-outline-sm btn-open-formula" data-target="short_${idx}" style="padding: 3px 8px; font-size: 0.78rem; border-color: #38bdf8; color: #38bdf8;">∑ 수식 도구</button>
          </div>
          <input type="text" id="input_short_${idx}" class="short-target-input" data-qidx="${idx}" value="${escapeHtml(q.correctText || '')}" placeholder="정답 단어/문장 입력">
        </div>
      `;
    }
    return '';
  }

  let timerInterval = null;
  let activeTimerQIndex = -1;

  function renderHostDisplayView(container, roomData, roomId, isTeacherControl = false) {
    const meta = roomData.meta || {};
    const status = meta.status || 'LOBBY';
    const qIndex = meta.currentQuestionIndex || 0;
    const questions = roomData.questions || [];
    const currentQ = questions[qIndex] || {};
    const responses = (roomData.responses && roomData.responses[qIndex]) || {};
    const participants = roomData.participants || {};
    const responseCount = Object.keys(responses).length;
    const participantCount = Object.keys(participants).length;
    const isUnlimited = currentQ.type === 'wordcloud' || currentQ.type === 'postit' || currentQ.timeLimit === 0;
    const isScoringQ = isScoringQuestion(currentQ);

    if (status === 'SHOW_RANKING') {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      activeTimerQIndex = -1;
      renderIntermediateLeaderboardView(container, roomData, roomId, isTeacherControl);
      return;
    }

    if (status === 'FINISHED') {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      activeTimerQIndex = -1;
      renderLeaderboardView(container, roomData, isTeacherControl);
      return;
    }

    const currentDisplayCard = document.getElementById('host-display-card');
    const renderedStatus = currentDisplayCard ? currentDisplayCard.dataset.status : '';
    const renderedQIdx = currentDisplayCard ? Number(currentDisplayCard.dataset.qindex) : -1;
    const isLastQ = qIndex + 1 >= questions.length;

    if (currentDisplayCard && renderedStatus === status && renderedQIdx === qIndex) {
      const respEl = document.getElementById('resp-count');
      if (respEl) respEl.textContent = responseCount;

      const btnResults = document.getElementById('btn-toggle-results');
      if (btnResults) {
        btnResults.textContent = state.hideResults ? '👁️ 결과 공개' : '🙈 결과 가리기';
        btnResults.style.background = state.hideResults ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)';
      }

      const mainContentEl = document.getElementById('display-main-content');
      if (mainContentEl) {
        const newHash = JSON.stringify(responses) + '_' + status + '_' + state.hideResults + '_' + state.showWrongWordcloud + '_' + state.showShortNicknames + '_' + (currentQ.chartStyle || '');
        if (mainContentEl.dataset.resphash !== newHash) {
          mainContentEl.dataset.resphash = newHash;
          mainContentEl.innerHTML = renderQuestionContent(currentQ, responses, status, participants);
        }
      }
    } else {
      container.innerHTML = `
        <div class="quiz-display-container" id="host-display-card" data-qindex="${qIndex}" data-status="${status}">
          <div class="quiz-top-bar">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span class="room-badge">Q ${qIndex + 1} / ${questions.length}</span>
              <button id="btn-go-home-display" class="btn btn-secondary" style="font-weight: bold; padding: 6px 14px; font-size: 0.9rem;">🏠 메인으로</button>
              <select id="select-theme-display" class="select-theme-dropdown" style="padding: 6px 12px; border-radius: 8px; background: #1e293b; color: #fff; border: 1px solid var(--border); font-size: 0.9rem; font-weight: bold; cursor: pointer;">
                <option value="tv" ${getSavedTheme() === 'tv' ? 'selected' : ''}>📺 스마트 TV</option>
                <option value="chalkboard" ${getSavedTheme() === 'chalkboard' ? 'selected' : ''}>🧹 초록 칠판</option>
                <option value="marble" ${getSavedTheme() === 'marble' ? 'selected' : ''}>🏛️ 깔끔 대리석</option>
                <option value="woodlock" ${getSavedTheme() === 'woodlock' ? 'selected' : ''}>🪵 우드락 보드</option>
              </select>
            </div>
            <div id="display-timer" class="timer-badge">${isUnlimited ? '⏱️ 무제한 (의견 수렴)' : `⏱️ ${currentQ.timeLimit || 20}s`}</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button id="btn-toggle-results" class="btn btn-outline-sm" style="background: ${state.hideResults ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)'}; border-color: #f59e0b; color: #fbbf24; font-weight: bold;">
                ${state.hideResults ? '👁️ 결과 공개' : '🙈 결과 가리기'}
              </button>
              <button id="btn-toggle-bgm" class="btn btn-outline-sm" style="background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #fff; font-weight: bold;">
                ${AudioEngine.bgmPlaying ? '🎵 BGM 끄기' : '🎵 BGM 켜기'}
              </button>
            </div>
            <div style="font-size: 1.4rem; font-weight: bold; color: #38bdf8;">
              제출 인원: <span id="resp-count">${responseCount}</span> / ${participantCount}명
            </div>
          </div>
          <div class="question-card">
            <h1 class="question-title">${parseMath(currentQ.question || '')}</h1>
            ${currentQ.imageUrl ? `<div style="text-align: center; margin-top: 14px;"><img src="${currentQ.imageUrl}" style="max-height: 320px; max-width: 100%; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.4);"></div>` : ''}
            ${currentQ.isDoublePoints ? `<div style="color: #fbbf24; font-size: 1.2rem; font-weight: bold; margin-top: 10px;">⚡ 점수 2배 이벤트 문항!</div>` : ''}
          </div>
          <div id="display-main-content" style="flex: 1; display: flex; flex-direction: column;" data-resphash="${JSON.stringify(responses) + '_' + status + '_' + state.hideResults + '_' + state.showWrongWordcloud + '_' + state.showShortNicknames + '_' + (currentQ.chartStyle || '')}">
            ${renderQuestionContent(currentQ, responses, status, participants)}
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 20px; flex-wrap: wrap;">
            ${status === 'PLAYING' ? `<button class="btn btn-danger" id="btn-force-finish">${isUnlimited ? '⏹️ 응답 마감 및 의견 공유' : '⏹️ 응답 마감 및 정답 공개'}</button>` : ''}
            ${status === 'SHOW_ANSWER' ? `
              ${isScoringQ ? `<button class="btn btn-secondary" id="btn-show-ranking">📊 중간 순위 보기 (1~5위)</button>` : ''}
              ${isLastQ ? `
                <button class="btn btn-primary" id="btn-next-question-host" style="font-weight: bold; font-size: 1.1rem; padding: 12px 24px;">🏆 최종 시상식 결과 보기</button>
              ` : `
                <button class="btn btn-primary" id="btn-next-question-host" style="font-weight: bold; font-size: 1.1rem; padding: 12px 24px;">➡️ 다음 문제로 이동 (Q${qIndex + 2})</button>
              `}
            ` : ''}
          </div>
        </div>
      `;

      document.getElementById('btn-go-home-display')?.addEventListener('click', () => window.location.search = '');
      document.getElementById('select-theme-display')?.addEventListener('change', (e) => setTheme(e.target.value));

      document.getElementById('btn-toggle-results')?.addEventListener('click', () => {
        state.hideResults = !state.hideResults;
        const btn = document.getElementById('btn-toggle-results');
        if (btn) {
          btn.textContent = state.hideResults ? '👁️ 결과 공개' : '🙈 결과 가리기';
          btn.style.background = state.hideResults ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)';
        }
        const mainContentEl = document.getElementById('display-main-content');
        if (mainContentEl) {
          mainContentEl.dataset.resphash = '';
          mainContentEl.innerHTML = renderQuestionContent(currentQ, responses, status, participants);
        }
      });

      document.getElementById('btn-toggle-wrong-cloud')?.addEventListener('click', () => {
        state.showWrongWordcloud = !state.showWrongWordcloud;
        const mainContentEl = document.getElementById('display-main-content');
        if (mainContentEl) mainContentEl.dataset.resphash = '';
        renderHostDisplayView(container, roomData, roomId, isTeacherControl);
      });

      document.getElementById('btn-toggle-short-nicknames')?.addEventListener('click', () => {
        state.showShortNicknames = !state.showShortNicknames;
        const mainContentEl = document.getElementById('display-main-content');
        if (mainContentEl) mainContentEl.dataset.resphash = '';
        renderHostDisplayView(container, roomData, roomId, isTeacherControl);
      });

      document.getElementById('btn-toggle-bgm')?.addEventListener('click', (e) => {
        const isPlaying = AudioEngine.toggleBGM();
        e.currentTarget.textContent = isPlaying ? '🎵 BGM 끄기' : '🎵 BGM 켜기';
      });

      document.getElementById('btn-force-finish')?.addEventListener('click', () => {
        if (timerInterval) clearInterval(timerInterval);
        processQuestionResults(roomId, state.roomData || roomData);
      });

      document.getElementById('btn-show-ranking')?.addEventListener('click', () => {
        AudioEngine.playCorrect();
        updateRoomMeta(roomId, { status: 'SHOW_RANKING' });
      });

      document.getElementById('btn-next-question-host')?.addEventListener('click', () => {
        if (isLastQ) {
          AudioEngine.playFanfare();
          updateRoomMeta(roomId, { status: 'FINISHED' });
        } else {
          advanceToNextQuestion(roomId, state.roomData || roomData);
        }
      });
    }

    if (status === 'PLAYING') {
      if (isUnlimited) {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        activeTimerQIndex = qIndex;
        const timerEl = document.getElementById('display-timer');
        if (timerEl) timerEl.textContent = '⏱️ 무제한 (의견 수렴)';
      } else if (activeTimerQIndex !== qIndex) {
        activeTimerQIndex = qIndex;
        if (timerInterval) clearInterval(timerInterval);
        const timeLimit = currentQ.timeLimit || 20;
        const startedAt = meta.timerStartedAt || Date.now();

        timerInterval = setInterval(() => {
          const currentMeta = state.roomData?.meta || {};
          const currentStartedAt = currentMeta.timerStartedAt || startedAt;
          const elapsed = Math.floor((Date.now() - currentStartedAt) / 1000);
          const remaining = Math.max(0, timeLimit - elapsed);
          const timerEl = document.getElementById('display-timer');
          if (timerEl) timerEl.textContent = `⏱️ ${remaining}s`;
          if (remaining > 0 && remaining <= 5) AudioEngine.playTick();
          if (remaining <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            processQuestionResults(roomId, state.roomData || roomData);
          }
        }, 1000);
      }
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      activeTimerQIndex = -1;
    }
  }

  function renderIntermediateLeaderboardView(container, roomData, roomId, isTeacherControl) {
    const meta = roomData.meta || {};
    const qIndex = meta.currentQuestionIndex || 0;
    const questions = roomData.questions || [];
    const isLastQ = qIndex + 1 >= questions.length;

    const participants = Object.values(roomData.participants || {});
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top5 = participants.slice(0, 5);

    container.innerHTML = `
      <div class="quiz-display-container" id="intermediate-ranking-card" data-qindex="${qIndex}">
        <div class="leaderboard-container">
          <h1 class="leaderboard-title">📊 중간 점수 순위 (Top 5)</h1>
          <p style="text-align: center; color: var(--text-muted); margin-bottom: 20px; font-size: 1.1rem;">
            Q${qIndex + 1} / ${questions.length} 문제 진행 상황
          </p>
          ${top5.map((p, rank) => `
            <div class="leaderboard-row ${rank === 0 ? 'rank-1' : ''}">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div class="rank-badge">${rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}</div>
                <span style="font-size: 1.8rem; margin-right: 4px;">${p.avatar || '🐶'}</span>
                <span>${escapeHtml(p.nickname)}</span>
              </div>
              <span style="color: #38bdf8;">${p.score || 0}점</span>
            </div>
          `).join('')}
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 30px; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="btn-back-to-answer" style="font-size: 1.1rem; padding: 12px 24px;">🔙 문제 정답 화면으로 돌아가기</button>
            ${isLastQ ? `
              <button class="btn btn-primary" id="btn-show-ceremony" style="font-size: 1.2rem; padding: 12px 32px;">🏆 최종 시상식 결과 보기</button>
            ` : `
              <button class="btn btn-primary" id="btn-next-question-rank" style="font-size: 1.2rem; padding: 12px 32px;">➡️ 다음 문제로 이동 (Q${qIndex + 2})</button>
            `}
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-back-to-answer')?.addEventListener('click', () => {
      updateRoomMeta(roomId, { status: 'SHOW_ANSWER' });
    });
    document.getElementById('btn-show-ceremony')?.addEventListener('click', () => {
      AudioEngine.playFanfare();
      updateRoomMeta(roomId, { status: 'FINISHED' });
    });
    document.getElementById('btn-next-question-rank')?.addEventListener('click', () => {
      advanceToNextQuestion(roomId, roomData);
    });
  }

  function renderQuestionContent(currentQ, responses, status, participants = {}) {
    const showAnswer = status === 'SHOW_ANSWER';
    const isHidden = state.hideResults && status === 'PLAYING';

    if (currentQ.type === 'ox' || currentQ.type === 'choice' || currentQ.type === 'poll') {
      const rawOptions = currentQ.options || [];
      const validIndices = [];
      const options = [];
      rawOptions.forEach((opt, idx) => {
        if (String(opt || '').trim() !== '') {
          validIndices.push(idx);
          options.push(opt);
        }
      });
      const counts = validIndices.map(idx => Object.values(responses).filter(r => {
        if (Array.isArray(r.answer)) {
          return r.answer.map(Number).includes(idx);
        }
        return Number(r.answer) === idx;
      }).length);
      const totalCount = counts.reduce((sum, c) => sum + c, 0);

      const chartStyle = currentQ.type === 'ox' ? 'grid' : (currentQ.chartStyle || 'grid');
      const BAR_COLORS = ['#38bdf8', '#f59e0b', '#10b981', '#ec4899', '#a855f7'];

      if (chartStyle === 'bar') {
        return `
          <div class="poll-chart-container">
            ${options.map((opt, displayIdx) => {
              const realIdx = validIndices[displayIdx];
              const count = counts[displayIdx];
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              const barColor = BAR_COLORS[displayIdx % BAR_COLORS.length];
              const isCorrect = showAnswer && currentQ.isScoring !== false && realIdx === currentQ.correctAnswer;
              return `
                <div class="poll-bar-row" style="${isCorrect ? 'border: 2px solid #10b981; background: rgba(16, 185, 129, 0.1);' : ''}">
                  <div class="poll-option-label">
                    <span>${displayIdx + 1}. ${parseMath(opt)} ${isCorrect ? ' (정답! 🎉)' : ''}</span>
                  </div>
                  <div class="poll-bar-track">
                    <div class="poll-bar-fill" style="width: ${isHidden ? '0%' : pct + '%'}; background-color: ${barColor};"></div>
                  </div>
                  <div class="poll-stat-text" style="color: ${barColor};">
                    ${isHidden ? '🔒 가림' : `${pct}% <span style="font-size: 0.85em; color: var(--text-muted);">(${count}명)</span>`}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else if (chartStyle === 'pie') {
        let cumulativePercent = 0;
        const gradientStops = [];
        options.forEach((opt, idx) => {
          const count = counts[idx];
          const pct = totalCount > 0 ? (count / totalCount) * 100 : 0;
          const color = BAR_COLORS[idx % BAR_COLORS.length];
          gradientStops.push(`${color} ${cumulativePercent}% ${cumulativePercent + pct}%`);
          cumulativePercent += pct;
        });
        const conicStyle = gradientStops.length > 0 ? `conic-gradient(${gradientStops.join(', ')})` : '#334155';

        return `
          <div style="display: flex; align-items: center; justify-content: center; gap: 40px; padding: 20px; flex-wrap: wrap;">
            <div style="width: 240px; height: 240px; border-radius: 50%; background: ${isHidden || totalCount === 0 ? '#334155' : conicStyle}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.4); position: relative; transition: background 0.5s ease;">
              <div style="width: 130px; height: 130px; border-radius: 50%; background: #0f172a; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: bold; border: 2px solid var(--border);">
                <span style="font-size: 1.5rem; color: #38bdf8;">${isHidden ? '🔒' : totalCount + '명'}</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">${isHidden ? '가림 모드' : '총 응답'}</span>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; min-width: 280px; max-width: 440px; flex: 1;">
              ${options.map((opt, displayIdx) => {
                const realIdx = validIndices[displayIdx];
                const count = counts[displayIdx];
                const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                const color = BAR_COLORS[displayIdx % BAR_COLORS.length];
                const isCorrect = showAnswer && currentQ.isScoring !== false && realIdx === currentQ.correctAnswer;
                return `
                  <div style="display: flex; align-items: center; justify-content: space-between; background: #1e293b; padding: 12px 18px; border-radius: 12px; border-left: 6px solid ${color}; ${isCorrect ? 'border: 2px solid #10b981;' : ''}">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                      <span style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
                      <span style="font-weight: bold; color: #fff; font-size: 1.1rem;">${displayIdx + 1}. ${parseMath(opt)} ${isCorrect ? ' (정답! 🎉)' : ''}</span>
                    </div>
                    <div style="font-weight: bold; color: ${color}; font-size: 1.1rem; margin-left: 14px;">
                      ${isHidden ? '🔒 가림' : `${pct}% (${count}명)`}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        return `
          <div class="options-grid">
            ${options.map((opt, displayIdx) => {
              const realIdx = validIndices[displayIdx];
              const isCorrect = showAnswer && currentQ.isScoring !== false && realIdx === currentQ.correctAnswer;
              return `
                <div class="option-card-display opt-${realIdx} ${isCorrect ? 'correct-highlight' : ''}">
                  <span>${parseMath(opt)} ${isCorrect ? ' (정답! 🎉)' : ''}</span>
                  <span class="count-bar">${isHidden ? '🔒 가림' : counts[displayIdx] + '명'}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    } else if (currentQ.type === 'short') {
      const targetText = String(currentQ.correctText || '').trim().toLowerCase();
      const wrongCounts = {};
      let wrongTotal = 0;

      Object.values(responses).forEach(r => {
        const ans = String(r.answer || '').trim();
        if (ans && ans.toLowerCase() !== targetText) {
          const key = ans.toLowerCase();
          if (!wrongCounts[key]) wrongCounts[key] = { display: ans, count: 0 };
          wrongCounts[key].count++;
          wrongTotal++;
        }
      });

      const wrongList = Object.values(wrongCounts);

      return `
        <div style="background: var(--card-dark); padding: 30px; border-radius: 16px; text-align: center; flex: 1; display: flex; flex-direction: column;">
          ${showAnswer ? `<h2 style="font-size: 2.2rem; color: #10b981; margin-bottom: 12px;">💡 정답: ${parseMath(currentQ.correctText)}</h2>` : `<h2 style="font-size: 1.8rem; color: #94a3b8; margin-bottom: 12px;">학생들이 단답형 답안을 입력하는 중입니다...</h2>`}

          <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; flex-wrap: wrap;">
            ${showAnswer && wrongTotal > 0 ? `
              <button class="btn btn-outline-sm" id="btn-toggle-wrong-cloud" style="border-color: #ec4899; color: #ec4899; font-weight: bold; font-size: 0.95rem; padding: 8px 16px;">
                ${state.showWrongWordcloud ? '🙈 오답 가리기' : `💬 재미있는 오답 구경하기 (${wrongList.length}종류)`}
              </button>
            ` : ''}
            <button class="btn btn-outline-sm" id="btn-toggle-short-nicknames" style="border-color: #38bdf8; color: #38bdf8; font-weight: bold; font-size: 0.95rem; padding: 8px 16px;">
              ${state.showShortNicknames ? '🙈 닉네임 가리기' : '👤 닉네임 공개'}
            </button>
          </div>

          ${showAnswer && state.showWrongWordcloud && wrongList.length > 0 ? `
            <div style="background: #0f172a; border: 2px dashed #ec4899; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #ec4899; font-size: 1.3rem; margin-bottom: 14px;">☁️ 재미있는 오답 워드클라우드 (익명)</h3>
              <div class="wordcloud-container">
                ${wrongList.map(item => {
                  const freqClass = item.count >= 3 ? 'freq-3' : (item.count === 2 ? 'freq-2' : 'freq-1');
                  return `
                    <div class="word-chip ${freqClass}" style="background: rgba(236, 72, 153, 0.15); border-color: #ec4899; color: #f472b6;">
                      <span>${parseMath(item.display)}</span>
                      ${item.count > 1 ? `<span style="font-size: 0.8em; background: rgba(236, 72, 153, 0.3); padding: 2px 8px; border-radius: 999px;">${item.count}</span>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; justify-content: center;">
            ${isHidden ? `
              <div style="color: #fbbf24; font-size: 1.2rem; padding: 20px; font-weight: bold;">🔒 결과 가리기 모드 작동 중 (응답 집계 중)</div>
            ` : Object.entries(responses).map(([sid, r]) => {
              const p = (participants && participants[sid]) || {};
              const nick = p.nickname || r.nickname || '';
              const av = p.avatar || r.avatar || '';
              if (state.showShortNicknames) {
                return `<div class="student-tag" style="font-size: 1.1rem; background: #1e293b;">${av} ${escapeHtml(nick ? nick + ': ' : '')}${parseMath(r.answer)}</div>`;
              } else {
                return `<div class="student-tag" style="font-size: 1.1rem; background: #1e293b;">💬 ${parseMath(r.answer)}</div>`;
              }
            }).join('')}
          </div>
        </div>
      `;
    } else if (currentQ.type === 'wordcloud') {
      const counts = {};
      Object.values(responses).forEach(r => {
        const word = String(r.answer || '').trim();
        if (word) {
          const key = word.toLowerCase();
          if (!counts[key]) counts[key] = { display: word, count: 0 };
          counts[key].count++;
        }
      });

      const wordList = Object.values(counts);
      if (isHidden) {
        return `<div style="text-align: center; color: #fbbf24; padding: 40px; font-size: 1.2rem; font-weight: bold;">🔒 실시간 결과 가리기 모드 작동 중 (응답 집계 중)</div>`;
      }
      if (wordList.length === 0) {
        return `<div style="text-align: center; color: var(--text-muted); padding: 40px; font-size: 1.2rem;">학생들의 워드클라우드 응답을 기다리는 중입니다...</div>`;
      }

      return `
        <div class="wordcloud-container">
          ${wordList.map(item => {
            const freqClass = item.count >= 3 ? 'freq-3' : (item.count === 2 ? 'freq-2' : 'freq-1');
            return `
              <div class="word-chip ${freqClass}">
                <span>${parseMath(item.display)}</span>
                ${item.count > 1 ? `<span style="font-size: 0.8em; background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 999px;">${item.count}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (currentQ.type === 'postit') {
      if (isHidden) {
        return `<div style="text-align: center; color: #fbbf24; padding: 40px; font-size: 1.2rem; font-weight: bold;">🔒 실시간 결과 가리기 모드 작동 중 (응답 집계 중)</div>`;
      }
      return `
        <div class="postit-container">
          ${Object.entries(responses).map(([sid, r]) => {
            const p = (participants && participants[sid]) || {};
            const nick = p.nickname || r.nickname || '익명 학생';
            const av = p.avatar || r.avatar || '📌';
            return `
              <div class="postit-card">
                <div style="font-size: 0.95rem; color: #78350f; font-weight: 800; margin-bottom: 8px; border-bottom: 1px dashed rgba(120,53,15,0.3); padding-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                  <span>${av}</span>
                  <span>${escapeHtml(nick)}</span>
                </div>
                ${r.drawing ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${r.drawing}" style="max-height: 160px; border-radius: 6px; background: #fff; border: 1px solid rgba(120,53,15,0.2);"></div>` : ''}
                ${r.answer ? `<div style="font-size: 1.1rem; word-break: break-all; color: #451a03; font-weight: 700; line-height: 1.4;">${parseMath(r.answer)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
    return '';
  }

  function renderLeaderboardView(container, roomData, isTeacherControl) {
    if (document.getElementById('final-podium-container')) {
      return;
    }

    const questions = roomData.questions || [];
    const participants = Object.values(roomData.participants || {});

    if (!hasScoringQuestions(questions)) {
      container.innerHTML = `
        <div class="quiz-display-container" id="final-podium-container">
          <div class="leaderboard-container" style="text-align: center;">
            <h1 class="leaderboard-title" style="font-size: 2.6rem;">📝 전체 의견 수렴이 완료되었습니다!</h1>
            <p style="font-size: 1.3rem; color: #38bdf8; margin: 16px 0 30px 0;">
              총 <strong>${participants.length}명</strong>의 학생이 모든 의견 수렴 문항에 적극적으로 참여하였습니다. 👏
            </p>
            <div style="background: #0f172a; padding: 24px; border-radius: 16px; border: 1px solid var(--border); margin-bottom: 30px; display: inline-block; max-width: 540px; width: 100%;">
              <div style="font-size: 4rem; margin-bottom: 10px;">📊💡💬</div>
              <div style="font-size: 1.1rem; color: var(--text-muted); line-height: 1.6;">
                제출된 생각과 답변은 교사 보관함 및 CSV 내보내기를 통해 언제든 다시 확인하실 수 있습니다.
              </div>
            </div>
            <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
              <button class="btn btn-success" id="btn-export-csv" style="font-size: 1.1rem; padding: 12px 20px;">📥 전체 결과 CSV 내보내기</button>
              <button class="btn btn-primary" id="btn-export-image" style="font-size: 1.1rem; padding: 12px 20px;">📸 결과 이미지 저장 (PNG)</button>
              <button class="btn btn-danger" id="btn-reset-finish-app" style="font-size: 1.1rem; padding: 12px 20px;">🏁 수렴 완료 & 메인으로</button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-export-csv')?.addEventListener('click', () => exportResultsToCSV(roomData));

      document.getElementById('btn-export-image')?.addEventListener('click', async () => {
        const elem = document.getElementById('final-podium-container');
        if (!elem) return;
        if (window.html2canvas) {
          try {
            const canvas = await window.html2canvas(elem, { backgroundColor: '#090d16', scale: 2 });
            const a = document.createElement('a');
            a.download = `의견수렴_결과_PIN_${state.roomId}_${new Date().toISOString().slice(0, 10)}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
          } catch (err) {
            alert('이미지 저장 중 오류가 발생했습니다: ' + err.message);
          }
        } else {
          alert('이미지 저장 라이브러리를 준비 중입니다. 잠시 후 다시 시도해 주세요.');
        }
      });

      document.getElementById('btn-reset-finish-app')?.addEventListener('click', async () => {
        if (confirm('의견 수렴을 마감하고 방을 대기실(LOBBY) 상태로 초기화하시겠습니까?')) {
          await updateRoomMeta(state.roomId, { status: 'LOBBY', currentQuestionIndex: 0 });
          if (db) {
            try {
              await db.ref(`rooms/${state.roomId}/participants`).remove();
              await db.ref(`rooms/${state.roomId}/responses`).remove();
            } catch (e) {}
          } else {
            await putFirebaseRest(`rooms/${state.roomId}/participants`, {});
            await putFirebaseRest(`rooms/${state.roomId}/responses`, {});
          }
          window.location.search = '';
        }
      });
      return;
    }

    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    const first = participants[0] || { nickname: '1위', avatar: '🥇', score: 0 };
    const second = participants[1] || { nickname: '2위', avatar: '🥈', score: 0 };
    const third = participants[2] || { nickname: '3위', avatar: '🥉', score: 0 };

    AudioEngine.playFanfare();

    container.innerHTML = `
      <div class="quiz-display-container" id="final-podium-container">
        <div class="leaderboard-container">
          <h1 class="leaderboard-title" style="font-size: 2.8rem;">🏆 최종 퀴즈 시상식</h1>
          
          <div class="podium-wrapper">
            <div class="podium-step podium-2">
              <div style="font-size: 2.5rem;">${second.avatar || '🥈'}</div>
              <div style="font-size: 1.2rem;">${escapeHtml(second.nickname)}</div>
              <div style="font-size: 1rem; color: #e2e8f0; margin-top: 4px;">🥈 2위 (${second.score || 0}점)</div>
            </div>

            <div class="podium-step podium-1">
              <div style="font-size: 1.2rem; color: #fef08a;">👑 챔피언 👑</div>
              <div style="font-size: 3.2rem;">${first.avatar || '🥇'}</div>
              <div style="font-size: 1.4rem; color: #fff;">${escapeHtml(first.nickname)}</div>
              <div style="font-size: 1.2rem; color: #fef08a; margin-top: 4px;">🥇 1위 (${first.score || 0}점)</div>
            </div>

            <div class="podium-step podium-3">
              <div style="font-size: 2.5rem;">${third.avatar || '🥉'}</div>
              <div style="font-size: 1.2rem;">${escapeHtml(third.nickname)}</div>
              <div style="font-size: 1rem; color: #fde68a; margin-top: 4px;">🥉 3위 (${third.score || 0}점)</div>
            </div>
          </div>

          <h2 style="font-size: 1.4rem; color: #38bdf8; margin: 24px 0 12px 0; text-align: center;">전체 명예의 전당 랭킹</h2>
          ${participants.slice(0, 10).map((p, rank) => `
            <div class="leaderboard-row ${rank === 0 ? 'rank-1' : ''}">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div class="rank-badge">${rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1}</div>
                <span style="font-size: 1.8rem; margin-right: 4px;">${p.avatar || '🐶'}</span>
                <span>${escapeHtml(p.nickname)}</span>
              </div>
              <span style="color: #38bdf8;">${p.score || 0}점</span>
            </div>
          `).join('')}

          <div style="display: flex; justify-content: center; gap: 14px; margin-top: 30px; flex-wrap: wrap;">
            <button class="btn btn-success" id="btn-export-csv" style="font-size: 1.1rem; padding: 12px 20px;">📥 전체 결과 CSV 내보내기</button>
            <button class="btn btn-primary" id="btn-export-image" style="font-size: 1.1rem; padding: 12px 20px;">📸 결과 이미지 저장 (PNG)</button>
            <button class="btn btn-danger" id="btn-reset-finish-app" style="font-size: 1.1rem; padding: 12px 20px;">🏁 퀴즈 완료 & 방 초기화 (메인으로)</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-export-csv')?.addEventListener('click', () => exportResultsToCSV(roomData));

    document.getElementById('btn-export-image')?.addEventListener('click', async () => {
      const elem = document.getElementById('final-podium-container');
      if (!elem) return;
      if (window.html2canvas) {
        try {
          const canvas = await window.html2canvas(elem, { backgroundColor: '#090d16', scale: 2 });
          const a = document.createElement('a');
          a.download = `시상식_결과_PIN_${state.roomId}_${new Date().toISOString().slice(0, 10)}.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
        } catch (err) {
          alert('이미지 저장 중 오류가 발생했습니다: ' + err.message);
        }
      } else {
        alert('이미지 저장 라이브러리를 준비 중입니다. 잠시 후 다시 시도해 주세요.');
      }
    });

    document.getElementById('btn-reset-finish-app')?.addEventListener('click', async () => {
      if (confirm('퀴즈를 완료 처리하고 대기실(LOBBY) 상태로 방을 초기화하시겠습니까?\n\n초기화 완료 후 메인 화면으로 돌아가며, 다음 클래스 수업 시 본 방으로 즉시 퀴즈를 다시 진행할 수 있습니다.')) {
        await updateRoomMeta(state.roomId, { status: 'LOBBY', currentQuestionIndex: 0 });
        if (db) {
          try {
            await db.ref(`rooms/${state.roomId}/participants`).remove();
            await db.ref(`rooms/${state.roomId}/responses`).remove();
          } catch (e) {}
        } else {
          await putFirebaseRest(`rooms/${state.roomId}/participants`, {});
          await putFirebaseRest(`rooms/${state.roomId}/responses`, {});
        }
        window.location.search = '';
      }
    });
  }

  function renderStudentPadView(container, roomData, roomId, studentId, nickname, avatar = '🐶') {
    const meta = roomData.meta || {};
    const status = meta.status || 'LOBBY';
    const qIndex = meta.currentQuestionIndex || 0;
    const questions = roomData.questions || [];
    const currentQ = questions[qIndex] || {};
    const myResponse = (roomData.responses && roomData.responses[qIndex] && roomData.responses[qIndex][studentId]);
    const myParticipant = (roomData.participants && roomData.participants[studentId]) || {};

    if (status === 'LOBBY') {
      if (document.getElementById('student-lobby-card')) return;
      container.innerHTML = `
        <div class="mobile-view" id="student-lobby-card">
          <div class="mobile-card">
            <div style="font-size: 3.5rem; margin-bottom: 12px;">${avatar}</div>
            <h2 style="font-size: 1.6rem; color: #38bdf8;">${avatar} ${escapeHtml(nickname)} 님, 대기 중!</h2>
            <p style="color: var(--text-muted); margin-top: 10px; font-size: 1.1rem; line-height: 1.5;">
              입장이 완료되었습니다!<br>선생님이 퀴즈를 시작할 때까지 잠시 기다려 주세요.
            </p>
          </div>
        </div>
      `;
      return;
    }

    if (status === 'SHOW_RANKING') {
      const existingRankCard = document.getElementById('student-ranking-card');
      if (existingRankCard && existingRankCard.dataset.qindex == qIndex) return;

      const allP = Object.values(roomData.participants || {});
      allP.sort((a, b) => (b.score || 0) - (a.score || 0));
      const myRank = allP.findIndex(p => p.nickname === nickname) + 1;
      container.innerHTML = `
        <div class="mobile-view" id="student-ranking-card" data-qindex="${qIndex}">
          <div class="mobile-card" style="text-align: center; border-color: #f59e0b;">
            <div style="font-size: 3.5rem; margin-bottom: 12px;">${avatar}</div>
            <h2 style="font-size: 1.5rem; color: #fbbf24;">현재 ${myRank > 0 ? myRank + '위' : '순위 집계 중'} / 총 ${allP.length}명</h2>
            <p style="font-size: 1.3rem; font-weight: bold; color: #38bdf8; margin-top: 8px;">총 점수: ${myParticipant.score || 0}점</p>
            <p style="color: var(--text-muted); margin-top: 14px; font-size: 0.95rem;">선생님이 다음 문제를 시작할 때까지 대기해 주세요!</p>
          </div>
        </div>
      `;
      return;
    }

    if (status === 'FINISHED') {
      if (document.getElementById('student-final-card')) return;
      renderStudentFinalFeedback(container, roomData, studentId, nickname, avatar);
      return;
    }

    const existingPadCard = document.getElementById('student-pad-card');
    const renderedQIndex = existingPadCard ? Number(existingPadCard.dataset.qindex) : -1;
    const renderedStatus = existingPadCard ? existingPadCard.dataset.status : '';
    const hasMyResponseAlready = existingPadCard ? existingPadCard.dataset.submitted === 'true' : false;

    if (existingPadCard && renderedQIndex === qIndex && renderedStatus === status) {
      if (!myResponse) {
        return;
      } else if (hasMyResponseAlready) {
        return;
      }
    }

    container.innerHTML = `
      <div class="mobile-view" id="student-pad-card" data-qindex="${qIndex}" data-status="${status}" data-submitted="${!!myResponse}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span class="room-badge" style="font-size: 0.95rem;">Q${qIndex + 1} / ${questions.length}</span>
          <span style="font-weight: 800; color: #38bdf8; font-size: 1.1rem;">${avatar} ${escapeHtml(nickname)} (${myParticipant.score || 0}점)</span>
        </div>
        <div class="mobile-card">
          <h3 style="font-size: 1.3rem; margin-bottom: 8px;">${parseMath(currentQ.question)}</h3>
          ${currentQ.imageUrl ? `<div style="text-align: center; margin: 10px 0;"><img src="${currentQ.imageUrl}" style="max-height: 200px; max-width: 100%; border-radius: 8px; border: 1px solid var(--border);"></div>` : ''}
          ${currentQ.isDoublePoints ? `<span style="color: #fbbf24; font-weight: bold; font-size: 0.95rem;">⚡ 점수 2배 이벤트!</span>` : ''}
        </div>
        ${myResponse ? renderSubmittedLockView(myResponse, currentQ, status) : renderPadControls(currentQ)}
      </div>
    `;

    if (!myResponse) {
      if ((currentQ.type === 'choice' || currentQ.type === 'poll') && currentQ.isMultiSelect && currentQ.isScoring === false) {
        const selectedIndices = new Set();
        const maxSelect = currentQ.maxSelect || 0;
        container.querySelectorAll('.btn-poll-multi').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const choiceIdx = Number(e.currentTarget.dataset.idx);
            if (selectedIndices.has(choiceIdx)) {
              selectedIndices.delete(choiceIdx);
              e.currentTarget.style.border = 'none';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.opacity = '1';
            } else {
              if (maxSelect > 0 && selectedIndices.size >= maxSelect) {
                alert(`최대 ${maxSelect}개까지 선택할 수 있습니다.`);
                return;
              }
              selectedIndices.add(choiceIdx);
              e.currentTarget.style.border = '4px solid #fbbf24';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(251, 191, 36, 0.6)';
              e.currentTarget.style.opacity = '0.95';
            }
          });
        });

        document.getElementById('btn-submit-poll-multi')?.addEventListener('click', async () => {
          if (selectedIndices.size === 0) return alert('최소 1개 이상의 항목을 선택해 주세요.');
          await submitResponse(roomId, qIndex, studentId, { answer: Array.from(selectedIndices) });
        });
      }

      container.querySelectorAll('.btn-pad').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          if (e.currentTarget.classList.contains('btn-poll-multi')) return;
          const choiceIdx = Number(e.currentTarget.dataset.idx);
          await submitResponse(roomId, qIndex, studentId, { answer: choiceIdx });
        });
      });

      document.getElementById('btn-submit-text')?.addEventListener('click', async () => {
        const textVal = document.getElementById('input-student-text').value.trim();
        if (!textVal) return alert('답안을 입력해 주세요!');
        await submitResponse(roomId, qIndex, studentId, { answer: textVal });
      });

      if (currentQ.type === 'postit') {
        const tabText = document.getElementById('tab-text');
        const tabCanvas = document.getElementById('tab-canvas');
        const secText = document.getElementById('postit-text-section');
        const secCanvas = document.getElementById('postit-canvas-section');
        const canvas = document.getElementById('postit-canvas');

        if (tabText && tabCanvas && secText && secCanvas && canvas) {
          tabText.addEventListener('click', () => {
            secText.style.display = 'block';
            secCanvas.style.display = 'none';
            tabText.style.background = 'var(--primary)';
            tabText.style.color = '#fff';
            tabCanvas.style.background = 'transparent';
            tabCanvas.style.color = 'var(--text-muted)';
          });
          tabCanvas.addEventListener('click', () => {
            secText.style.display = 'none';
            secCanvas.style.display = 'block';
            tabCanvas.style.background = 'var(--primary)';
            tabCanvas.style.color = '#fff';
            tabText.style.background = 'transparent';
            tabText.style.color = 'var(--text-muted)';
          });

          const ctx = canvas.getContext('2d');
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          let isDrawing = false;
          let hasDrawn = false;

          const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
              x: (clientX - rect.left) * (canvas.width / rect.width),
              y: (clientY - rect.top) * (canvas.height / rect.height)
            };
          };

          const startDraw = (e) => {
            isDrawing = true;
            hasDrawn = true;
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
          };
          const draw = (e) => {
            if (!isDrawing) return;
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          };
          const stopDraw = () => {
            if (isDrawing) {
              ctx.closePath();
              isDrawing = false;
            }
          };

          canvas.addEventListener('mousedown', startDraw);
          canvas.addEventListener('mousemove', draw);
          canvas.addEventListener('mouseup', stopDraw);
          canvas.addEventListener('mouseleave', stopDraw);

          canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
          canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
          canvas.addEventListener('touchend', stopDraw);

          document.getElementById('draw-color')?.addEventListener('change', (e) => ctx.strokeStyle = e.target.value);
          document.getElementById('draw-width')?.addEventListener('change', (e) => ctx.lineWidth = Number(e.target.value));
          document.getElementById('btn-clear-canvas')?.addEventListener('click', () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            hasDrawn = false;
          });

          document.getElementById('btn-submit-postit')?.addEventListener('click', async () => {
            const textVal = document.getElementById('input-student-text').value.trim();
            const drawingData = hasDrawn ? canvas.toDataURL('image/png') : null;
            if (!textVal && !drawingData) return alert('의견 텍스트를 입력하거나 그림을 그려주세요!');
            await submitResponse(roomId, qIndex, studentId, { answer: textVal, drawing: drawingData });
          });
        }
      }
    }
  }

  function renderPadControls(currentQ) {
    if ((currentQ.type === 'choice' || currentQ.type === 'poll') && currentQ.isMultiSelect && currentQ.isScoring === false) {
      const rawOptions = currentQ.options || [];
      const validOptions = [];
      rawOptions.forEach((opt, idx) => {
        if (String(opt || '').trim() !== '') {
          validOptions.push({ opt, idx });
        }
      });
      const maxText = currentQ.maxSelect > 0 ? `최대 ${currentQ.maxSelect}개 선택 가능` : '자유 중복 선택';
      return `
        <div class="mobile-card">
          <div style="font-size: 0.95rem; color: #fbbf24; font-weight: bold; margin-bottom: 12px; text-align: center;">
            ☑️ 중복 투표 가능 (${maxText})
          </div>
          <div class="mobile-pad-grid" style="margin-bottom: 14px;">
            ${validOptions.map(item => `
              <button type="button" class="btn-pad pad-${item.idx} btn-poll-multi" data-idx="${item.idx}">
                ${parseMath(item.opt)}
              </button>
            `).join('')}
          </div>
          <button id="btn-submit-poll-multi" class="btn btn-primary" style="width: 100%; font-size: 1.2rem;">📌 선택 항목 제출하기</button>
        </div>
      `;
    } else if (currentQ.type === 'ox' || currentQ.type === 'choice' || currentQ.type === 'poll') {
      const rawOptions = currentQ.options || [];
      const validOptions = [];
      rawOptions.forEach((opt, idx) => {
        if (String(opt || '').trim() !== '') {
          validOptions.push({ opt, idx });
        }
      });
      return `
        <div class="mobile-pad-grid">
          ${validOptions.map(item => `
            <button class="btn-pad pad-${item.idx}" data-idx="${item.idx}">
              ${parseMath(item.opt)}
            </button>
          `).join('')}
        </div>
      `;
    } else if (currentQ.type === 'postit') {
      return `
        <div class="mobile-card">
          <div style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <button type="button" id="tab-text" class="btn btn-outline-sm" style="flex:1; background: var(--primary); color: #fff; font-weight: bold;">✏️ 텍스트</button>
            <button type="button" id="tab-canvas" class="btn btn-outline-sm" style="flex:1; color: var(--text-muted); font-weight: bold;">🎨 그림 그리기</button>
          </div>
          <div id="postit-text-section">
            <input type="text" id="input-student-text" class="input-nickname" placeholder="포스트잇 의견을 입력하세요" style="margin-top: 4px;">
          </div>
          <div id="postit-canvas-section" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="font-size: 0.8rem; color: var(--text-muted);">색상:</span>
                <input type="color" id="draw-color" value="#000000" style="width: 28px; height: 28px; border: none; border-radius: 4px; cursor: pointer; background: transparent;">
                <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 4px;">굵기:</span>
                <select id="draw-width" style="padding: 2px 6px; border-radius: 4px; background: #0f172a; color: #fff; border: 1px solid var(--border); font-size: 0.8rem;">
                  <option value="3">얇게</option>
                  <option value="6" selected>보통</option>
                  <option value="12">굵게</option>
                </select>
              </div>
              <button type="button" id="btn-clear-canvas" class="btn btn-outline-sm" style="padding: 4px 8px; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">🧹 지우기</button>
            </div>
            <div style="background: #ffffff; border-radius: 8px; padding: 4px; border: 2px solid var(--primary); touch-action: none; width: 100%;">
              <canvas id="postit-canvas" width="600" height="400" style="width: 100%; height: 50vh; max-height: 380px; min-height: 220px; display: block; border-radius: 6px; cursor: crosshair; background: #ffffff; touch-action: none;"></canvas>
            </div>
          </div>
          <button id="btn-submit-postit" class="btn btn-primary" style="width: 100%; font-size: 1.2rem; margin-top: 14px;">📌 포스트잇 제출하기</button>
        </div>
      `;
    } else {
      return `
        <div class="mobile-card">
          <input type="text" id="input-student-text" class="input-nickname" placeholder="답안을 입력해 주세요" style="margin-top: 10px;">
          <button id="btn-submit-text" class="btn btn-primary" style="width: 100%; font-size: 1.2rem; margin-top: 10px;">제출하기</button>
        </div>
      `;
    }
  }

  function renderSubmittedLockView(myResponse, currentQ, status) {
    const showAnswer = status === 'SHOW_ANSWER';
    if (!showAnswer) {
      return `
        <div class="mobile-card" style="border-color: var(--primary);">
          <div style="font-size: 3rem; margin-bottom: 10px;">✅</div>
          <h2 style="font-size: 1.5rem; color: #10b981;">제출 완료!</h2>
          <p style="color: var(--text-muted); margin-top: 8px;">선생님이 정답을 공개할 때까지 대기해 주세요.</p>
        </div>
      `;
    }

    let isCorrect = false;
    if (currentQ.type === 'ox' || currentQ.type === 'choice') {
      isCorrect = (Number(myResponse.answer) === Number(currentQ.correctAnswer));
    } else if (currentQ.type === 'short') {
      isCorrect = (String(myResponse.answer).trim().toLowerCase() === String(currentQ.correctText).trim().toLowerCase());
    } else {
      return `
        <div class="mobile-card" style="border-color: #38bdf8;">
          <div style="font-size: 3rem; margin-bottom: 10px;">👏</div>
          <h2 style="font-size: 1.5rem; color: #38bdf8;">의견이 공유되었습니다!</h2>
        </div>
      `;
    }

    return `
      <div class="mobile-card" style="border-color: ${isCorrect ? 'var(--accent-green)' : 'var(--accent-red)'};">
        <div style="font-size: 3.5rem; margin-bottom: 10px;">${isCorrect ? '🎉' : '😅'}</div>
        <h2 style="font-size: 1.8rem; color: ${isCorrect ? '#10b981' : '#ef4444'};">
          ${isCorrect ? (currentQ.isDoublePoints ? '정답입니다! (⚡ 2배 점수!)' : '정답입니다!') : '아쉽게 틀렸습니다'}
        </h2>
        ${currentQ.explanation ? `<p style="color: var(--text-muted); margin-top: 10px;">💡 ${escapeHtml(currentQ.explanation)}</p>` : ''}
      </div>
    `;
  }

  function renderStudentFinalFeedback(container, roomData, studentId, nickname, avatar) {
    const participants = Object.values(roomData.participants || {});
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    const myRank = participants.findIndex(p => p.nickname === nickname) + 1;
    const myP = (roomData.participants && roomData.participants[studentId]) || {};

    container.innerHTML = `
      <div class="mobile-view" id="student-final-card">
        <div class="mobile-card" style="text-align: center;">
          <div style="font-size: 3.5rem; margin-bottom: 10px;">${avatar}</div>
          <h1 style="font-size: 2.2rem; color: #fbbf24; margin-bottom: 12px;">🏆 수고하셨습니다!</h1>
          <h2 style="font-size: 1.4rem; color: #fff;">${avatar} ${escapeHtml(nickname)} 님의 최종 결과</h2>
          <div style="font-size: 2rem; font-weight: 900; color: #38bdf8; margin: 16px 0;">
            ${myP.score || 0}점 (전체 ${myRank}위 / ${participants.length}명)
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 24px;">
            <button class="btn btn-primary" id="btn-student-join-new" style="font-size: 1.1rem; padding: 12px;">🚀 다른 퀴즈 참여하기 (PIN 입력)</button>
            <button class="btn btn-secondary" id="btn-student-finish-home" style="font-size: 1.1rem; padding: 12px;">🏁 퀴즈 종료 (메인 홈으로)</button>
          </div>

          <div id="pin-modal-student" style="display: none; margin-top: 20px; background: #0f172a; padding: 16px; border-radius: 12px; border: 1px solid #38bdf8;">
            <h4 style="font-size: 1.1rem; color: #38bdf8; margin-bottom: 10px;">새로운 퀴즈 방 PIN 번호 입력</h4>
            <input type="text" id="input-new-pin-student" placeholder="6자리 PIN 번호" maxlength="6" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: #1e293b; color: #fff; text-align: center; font-size: 1.3rem; font-weight: bold; margin-bottom: 10px;">
            <button class="btn btn-primary" id="btn-submit-new-pin-student" style="width: 100%; font-size: 1.1rem;">접속 및 참여하기</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-student-finish-home')?.addEventListener('click', () => {
      window.location.search = '';
    });

    document.getElementById('btn-student-join-new')?.addEventListener('click', () => {
      const modal = document.getElementById('pin-modal-student');
      if (modal) {
        modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
        if (modal.style.display === 'block') {
          document.getElementById('input-new-pin-student')?.focus();
        }
      }
    });

    document.getElementById('btn-submit-new-pin-student')?.addEventListener('click', () => {
      const pin = document.getElementById('input-new-pin-student').value.trim();
      if (pin.length === 6) {
        window.location.search = `?room=${pin}&role=student`;
      } else {
        alert('6자리 PIN 번호를 입력해 주세요.');
      }
    });
  }

  function openFirebaseInfoModal() {
    const modal = document.getElementById('firebase-info-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeFirebaseInfoModal() {
    const modal = document.getElementById('firebase-info-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openFirebaseCustomModal() {
    closeFirebaseInfoModal();
    const modal = document.getElementById('firebase-custom-modal');
    if (!modal) return;

    const savedCustom = localStorage.getItem('class_quiz_fb_config');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        document.getElementById('fb-apiKey').value = parsed.apiKey || '';
        document.getElementById('fb-dbUrl').value = parsed.databaseURL || '';
        document.getElementById('fb-projectId').value = parsed.projectId || '';
      } catch (e) {}
    } else {
      document.getElementById('fb-apiKey').value = '';
      document.getElementById('fb-dbUrl').value = '';
      document.getElementById('fb-projectId').value = '';
    }
    modal.classList.remove('hidden');
  }

  function closeFirebaseCustomModal() {
    const modal = document.getElementById('firebase-custom-modal');
    if (modal) modal.classList.add('hidden');
  }

  document.getElementById('btn-close-fb-info')?.addEventListener('click', closeFirebaseInfoModal);
  document.getElementById('btn-open-custom-fb')?.addEventListener('click', openFirebaseCustomModal);
  document.getElementById('btn-close-fb-custom')?.addEventListener('click', closeFirebaseCustomModal);

  document.getElementById('btn-save-fb')?.addEventListener('click', () => {
    const apiKey = document.getElementById('fb-apiKey').value.trim();
    const databaseURL = document.getElementById('fb-dbUrl').value.trim();
    const projectId = document.getElementById('fb-projectId').value.trim();
    if (!apiKey || !databaseURL) return alert('API Key와 Database URL은 필수입니다.');
    saveFirebaseConfig({ apiKey, databaseURL, projectId });
    alert('개인 Firebase 설정이 저장되었습니다. 페이지를 새로고침합니다.');
    window.location.reload();
  });

  document.getElementById('btn-reset-fb')?.addEventListener('click', () => {
    if (confirm('기본 탑재 클라우드 DB 연결로 복원하시겠습니까?')) {
      localStorage.removeItem('class_quiz_fb_config');
      alert('기본 연결로 복원되었습니다. 새로고침합니다.');
      window.location.reload();
    }
  });

  function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function unescapeHtml(str) {
    return String(str || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function parseMath(str) {
    if (!str) return '';
    if (typeof str !== 'string') return str;
    let text = escapeHtml(str);

    // Markdown bold & italic formatting
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    if (window.katex) {
      text = text.replace(/\$\$(.*?)\$\$/g, (match, math) => {
        try { return window.katex.renderToString(unescapeHtml(math), { displayMode: true, throwOnError: false }); } catch (e) { return match; }
      });
      text = text.replace(/\\\[(.*?)\\\]/g, (match, math) => {
        try { return window.katex.renderToString(unescapeHtml(math), { displayMode: true, throwOnError: false }); } catch (e) { return match; }
      });
      text = text.replace(/\$(.*?)\$/g, (match, math) => {
        try { return window.katex.renderToString(unescapeHtml(math), { displayMode: false, throwOnError: false }); } catch (e) { return match; }
      });
      text = text.replace(/\\\((.*?)\\\)/g, (match, math) => {
        try { return window.katex.renderToString(unescapeHtml(math), { displayMode: false, throwOnError: false }); } catch (e) { return match; }
      });
    }
    return text;
  }

  function compressImage(file, maxWidth, callback) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function openFormulaEditorModal(targetInput, questionsRef, onUpdateRef) {
    let activeInput = targetInput || document.activeElement;
    const qList = questionsRef || currentEditingQuestions;
    const updateFn = onUpdateRef || currentEditingUpdateFn;
    const modalHtml = `
      <div id="formula-helper-modal" class="modal-overlay" style="z-index: 9999;">
        <div class="modal-box" style="max-width: 680px; width: 92%; background: #0f172a; border: 2px solid #38bdf8;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <h3 style="margin: 0; color: #38bdf8; font-size: 1.3rem;">∑ 수식 & 서식 보조 편집 도구</h3>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button id="btn-modal-open-graph" class="btn btn-outline-sm" style="padding: 4px 10px; font-size: 0.82rem; border-color: #10b981; color: #10b981; background: rgba(16, 185, 129, 0.15); font-weight: bold;">📈 함수 그래프 그리기</button>
              <button id="btn-close-formula-modal" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.9rem;">✕ 닫기</button>
            </div>
          </div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 12px;">
            LaTeX 문법을 몰라도 아래 기호/공식 버튼을 클릭하면 수식이 자동 생성됩니다. 입력 시 아래에 실시간 결과가 렌더링됩니다.
          </p>

          <div style="background: #1e293b; border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 14px;">
            <div style="font-size: 0.8rem; font-weight: bold; color: #fbbf24; margin-bottom: 8px;">자주 쓰는 수식 & 기호 팔레트 (클릭 시 자동 입력)</div>
            
            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px;">[분수 / 거듭제곱 / 근호 / 공식]</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\frac{a}{b}" style="font-size: 0.8rem; padding: 4px 8px;">분수 \\frac{a}{b}</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="x^{2}" style="font-size: 0.8rem; padding: 4px 8px;">거듭제곱 x²</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="x_{1}" style="font-size: 0.8rem; padding: 4px 8px;">아래첨자 x₁</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\sqrt{x}" style="font-size: 0.8rem; padding: 4px 8px;">제곱근 √x</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\sqrt[n]{x}" style="font-size: 0.8rem; padding: 4px 8px;">n제곱근</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\sum_{i=1}^{n}" style="font-size: 0.8rem; padding: 4px 8px;">시그마 ∑</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\int_{a}^{b}" style="font-size: 0.8rem; padding: 4px 8px;">적분 ∫</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\lim_{x \\to 0}" style="font-size: 0.8rem; padding: 4px 8px;">극한 lim</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\sin\\theta" style="font-size: 0.8rem; padding: 4px 8px;">sinθ</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\cos\\theta" style="font-size: 0.8rem; padding: 4px 8px;">cosθ</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\tan\\theta" style="font-size: 0.8rem; padding: 4px 8px;">tanθ</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\log x" style="font-size: 0.8rem; padding: 4px 8px;">log x</button>
            </div>

            <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px;">[도형 및 연산 기호]</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\triangle" style="font-size: 0.8rem; padding: 4px 8px;">△ 삼각형</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\bigcirc" style="font-size: 0.8rem; padding: 4px 8px;">◯ 원</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\square" style="font-size: 0.8rem; padding: 4px 8px;">□ 사각형</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\star" style="font-size: 0.8rem; padding: 4px 8px;">★ 별</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\angle" style="font-size: 0.8rem; padding: 4px 8px;">∠ 각도</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\perp" style="font-size: 0.8rem; padding: 4px 8px;">⊥ 수직</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\parallel" style="font-size: 0.8rem; padding: 4px 8px;">∥ 평행</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\alpha" style="font-size: 0.8rem; padding: 4px 8px;">α</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\beta" style="font-size: 0.8rem; padding: 4px 8px;">β</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\theta" style="font-size: 0.8rem; padding: 4px 8px;">θ</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\pi" style="font-size: 0.8rem; padding: 4px 8px;">π</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\times" style="font-size: 0.8rem; padding: 4px 8px;">×</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\div" style="font-size: 0.8rem; padding: 4px 8px;">÷</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\pm" style="font-size: 0.8rem; padding: 4px 8px;">±</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\neq" style="font-size: 0.8rem; padding: 4px 8px;">≠</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\le" style="font-size: 0.8rem; padding: 4px 8px;">≤</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\ge" style="font-size: 0.8rem; padding: 4px 8px;">≥</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\approx" style="font-size: 0.8rem; padding: 4px 8px;">≈</button>
              <button type="button" class="btn btn-outline-sm btn-f-sym" data-insert="\\infty" style="font-size: 0.8rem; padding: 4px 8px;">∞</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-weight: bold; font-size: 0.9rem; color: #fff;">LaTeX / 수식 텍스트 입력:</label>
            <input type="text" id="formula-latex-input" class="input-nickname" placeholder="예: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" style="margin-top: 4px; font-family: monospace; font-size: 1.05rem;">
          </div>

          <div style="margin-bottom: 16px;">
            <label style="font-weight: bold; font-size: 0.9rem; color: #fff;">📐 실시간 수식 미리보기:</label>
            <div id="formula-live-preview" style="background: #ffffff; color: #000; border-radius: 8px; padding: 16px; min-height: 60px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; overflow-x: auto; margin-top: 4px;">
              <span style="color: #94a3b8; font-size: 0.95rem;">수식을 입력하면 이곳에 완성된 모습이 보입니다.</span>
            </div>
          </div>

          <div class="modal-actions" style="justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" id="btn-cancel-formula">취소</button>
            <button class="btn btn-primary" id="btn-apply-formula">📥 문제/입력창에 수식 완료 삽입</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const inputEl = document.getElementById('formula-latex-input');
    const previewEl = document.getElementById('formula-live-preview');

    const updatePreview = () => {
      const val = inputEl.value.trim();
      if (!val) {
        previewEl.innerHTML = `<span style="color: #94a3b8; font-size: 0.95rem;">수식을 입력하면 이곳에 완성된 모습이 보입니다.</span>`;
      } else {
        previewEl.innerHTML = parseMath('$' + val + '$');
      }
    };

    inputEl.addEventListener('input', updatePreview);

    document.querySelectorAll('.btn-f-sym').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const insertText = e.currentTarget.dataset.insert;
        const start = inputEl.selectionStart || inputEl.value.length;
        const end = inputEl.selectionEnd || inputEl.value.length;
        const oldVal = inputEl.value;
        inputEl.value = oldVal.substring(0, start) + insertText + oldVal.substring(end);
        inputEl.focus();
        inputEl.setSelectionRange(start + insertText.length, start + insertText.length);
        updatePreview();
      });
    });

    document.getElementById('btn-close-formula-modal')?.addEventListener('click', () => {
      document.getElementById('formula-helper-modal')?.remove();
    });
    document.getElementById('btn-cancel-formula')?.addEventListener('click', () => {
      document.getElementById('formula-helper-modal')?.remove();
    });

    document.getElementById('btn-modal-open-graph')?.addEventListener('click', () => {
      let qIdx = 0;
      if (activeInput && activeInput.id) {
        const m = activeInput.id.match(/\d+/);
        if (m) qIdx = Number(m[0]);
      }
      document.getElementById('formula-helper-modal')?.remove();
      openGraphEditorModal(qIdx, qList, updateFn);
    });

    document.getElementById('btn-apply-formula')?.addEventListener('click', () => {
      const val = inputEl.value.trim();
      if (!val) return alert('수식을 먼저 입력해 주세요.');
      const formatted = ` $${val}$ `;
      if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA')) {
        const start = activeInput.selectionStart || activeInput.value.length;
        const end = activeInput.selectionEnd || activeInput.value.length;
        const oldVal = activeInput.value;
        activeInput.value = oldVal.substring(0, start) + formatted + oldVal.substring(end);
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      document.getElementById('formula-helper-modal')?.remove();
    });
  }

  // ============================================================
  // FUNCTION GRAPH COMPILER & HIGH-RES CANVAS PLOTTER
  // ============================================================
  function compileMathExpr(expr) {
    if (!expr || typeof expr !== 'string') return null;
    let s = expr.trim();
    if (!s) return null;

    s = s.replace(/−/g, '-');
    s = s.replace(/\^/g, '**');

    // Strip leading f(x)= or y= if user typed it
    s = s.replace(/^[fghFGH]\s*\(\s*x\s*\)\s*=\s*/, '');
    s = s.replace(/^[yY]\s*=\s*/, '');

    // Implicit multiplication: 2x -> 2*x, 3( -> 3*(, )x -> )*x, )( -> )*(, x( -> x*(
    s = s.replace(/(\d)\s*([xX\(])/g, '$1*$2');
    s = s.replace(/(\))\s*(\d|[xX\(])/g, '$1*$2');
    s = s.replace(/\b([xX])\s*([\(])/g, '$1*$2');

    // Placeholders for ln and log
    s = s.replace(/\bln\b/gi, '__LN__');
    s = s.replace(/\blog10\b/gi, '__LOG10__');
    s = s.replace(/\blog\b/gi, '__LOG10__');

    // Standard Math functions
    const mathFuncs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'abs', 'exp', 'floor', 'ceil', 'round'];
    mathFuncs.forEach(fn => {
      const re = new RegExp('\\b' + fn + '\\b', 'gi');
      s = s.replace(re, 'Math.' + fn);
    });

    s = s.replace(/__LN__/g, 'Math.log');
    s = s.replace(/__LOG10__/g, 'Math.log10');

    s = s.replace(/\bpi\b/gi, 'Math.PI');
    s = s.replace(/\be\b/gi, 'Math.E');

    try {
      const fn = new Function('x', 'Math', 'return (' + s + ');');
      // Test execution to catch any syntax issues
      fn(1, Math);
      return fn;
    } catch(err) {
      return null;
    }
  }

  function drawFunctionGraphToCanvas(canvas, options) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const xMin = Number(options.xMin ?? -5);
    const xMax = Number(options.xMax ?? 5);
    const yMin = Number(options.yMin ?? -5);
    const yMax = Number(options.yMax ?? 5);
    const showGrid = options.showGrid !== false;
    const showAxes = options.showAxes !== false;
    const showLabels = options.showLabels !== false;
    const showLegend = options.showLegend !== false;
    const lineWidth = options.lineWidth || 3.5;

    // 1. Crisp white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const pad = 42;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    const toPx = (x) => pad + ((x - xMin) / (xMax - xMin)) * plotW;
    const toPy = (y) => h - pad - ((y - yMin) / (yMax - yMin)) * plotH;

    // Step calculation for grid and ticks
    const xSpan = Math.max(0.1, xMax - xMin);
    const ySpan = Math.max(0.1, yMax - yMin);

    let xStep = 1;
    if (xSpan > 40) xStep = 5;
    else if (xSpan > 20) xStep = 2;
    else if (xSpan <= 4) xStep = 0.5;

    let yStep = 1;
    if (ySpan > 40) yStep = 5;
    else if (ySpan > 20) yStep = 2;
    else if (ySpan <= 4) yStep = 0.5;

    // 2. Grid lines
    if (showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#e2e8f0';

      const startX = Math.ceil(xMin / xStep) * xStep;
      for (let x = startX; x <= xMax + 0.0001; x += xStep) {
        const px = toPx(x);
        ctx.beginPath();
        ctx.moveTo(px, pad);
        ctx.lineTo(px, h - pad);
        ctx.stroke();
      }

      const startY = Math.ceil(yMin / yStep) * yStep;
      for (let y = startY; y <= yMax + 0.0001; y += yStep) {
        const py = toPy(y);
        ctx.beginPath();
        ctx.moveTo(pad, py);
        ctx.lineTo(w - pad, py);
        ctx.stroke();
      }
    }

    // 3. Axes
    if (showAxes) {
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#1e293b';

      const originX = Math.max(pad, Math.min(w - pad, toPx(0)));
      const originY = Math.max(pad, Math.min(h - pad, toPy(0)));

      // X-Axis
      ctx.beginPath();
      ctx.moveTo(pad - 12, originY);
      ctx.lineTo(w - pad + 18, originY);
      ctx.stroke();

      // X Arrowhead
      ctx.beginPath();
      ctx.moveTo(w - pad + 18, originY);
      ctx.lineTo(w - pad + 8, originY - 5);
      ctx.lineTo(w - pad + 8, originY + 5);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Y-Axis
      ctx.beginPath();
      ctx.moveTo(originX, h - pad + 12);
      ctx.lineTo(originX, pad - 18);
      ctx.stroke();

      // Y Arrowhead
      ctx.beginPath();
      ctx.moveTo(originX, pad - 18);
      ctx.lineTo(originX - 5, pad - 8);
      ctx.lineTo(originX + 5, pad - 8);
      ctx.fillStyle = '#1e293b';
      ctx.fill();

      // Origin 'O'
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      if (0 >= xMin && 0 <= xMax && 0 >= yMin && 0 <= yMax) {
        ctx.fillText('O', originX - 6, originY + 4);
      }

      // Axis labels: x and y
      ctx.font = 'italic bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('x', w - pad + 24, originY + 6);
      ctx.fillText('y', originX + 16, pad - 18);

      // Ticks & Numbers
      if (showLabels) {
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const startX = Math.ceil(xMin / xStep) * xStep;
        for (let x = startX; x <= xMax + 0.0001; x += xStep) {
          if (Math.abs(x) < 0.001) continue;
          const px = toPx(x);
          ctx.beginPath();
          ctx.moveTo(px, originY - 3);
          ctx.lineTo(px, originY + 3);
          ctx.strokeStyle = '#475569';
          ctx.stroke();
          ctx.fillText(Number(x.toFixed(2)).toString(), px, originY + 6);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const startY = Math.ceil(yMin / yStep) * yStep;
        for (let y = startY; y <= yMax + 0.0001; y += yStep) {
          if (Math.abs(y) < 0.001) continue;
          const py = toPy(y);
          ctx.beginPath();
          ctx.moveTo(originX - 3, py);
          ctx.lineTo(originX + 3, py);
          ctx.strokeStyle = '#475569';
          ctx.stroke();
          ctx.fillText(Number(y.toFixed(2)).toString(), originX - 7, py);
        }
      }
    }

    // 4. Function Curves
    const plotCurve = (fn, color, width) => {
      if (!fn) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const samples = 1000;
      const dx = (xMax - xMin) / samples;
      let inPath = false;
      let prevY = null;
      let prevPy = null;

      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const x = xMin + i * dx;
        let y;
        try {
          y = fn(x, Math);
        } catch (e) {
          y = NaN;
        }

        if (typeof y !== 'number' || isNaN(y) || !isFinite(y) || y < yMin - (ySpan * 2) || y > yMax + (ySpan * 2)) {
          inPath = false;
          prevY = null;
          prevPy = null;
          continue;
        }

        const px = toPx(x);
        const py = toPy(y);

        // Discontinuity / Asymptote check
        if (prevY !== null && prevPy !== null) {
          const dyPx = Math.abs(py - prevPy);
          if (dyPx > h * 0.6 && ((prevY > 0 && y < 0) || (prevY < 0 && y > 0))) {
            inPath = false;
          }
        }

        if (!inPath) {
          ctx.moveTo(px, py);
          inPath = true;
        } else {
          ctx.lineTo(px, py);
        }

        prevY = y;
        prevPy = py;
      }
      ctx.stroke();
    };

    if (options.fn1) {
      plotCurve(options.fn1, options.fn1Color || '#2563eb', lineWidth);
    }
    if (options.fn2) {
      plotCurve(options.fn2, options.fn2Color || '#ea580c', lineWidth);
    }

    // 5. Legend Badges in top-left
    if (showLegend) {
      let legendY = pad + 10;
      if (options.formula1) {
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;
        const txt = 'f(x) = ' + options.formula1;
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const tw = ctx.measureText(txt).width;
        ctx.fillRect(pad + 12, legendY, tw + 18, 26);
        ctx.strokeRect(pad + 12, legendY, tw + 18, 26);
        ctx.fillStyle = '#1d4ed8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, pad + 21, legendY + 13);
        legendY += 34;
      }
      if (options.formula2) {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.08)';
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.5;
        const txt = 'g(x) = ' + options.formula2;
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const tw = ctx.measureText(txt).width;
        ctx.fillRect(pad + 12, legendY, tw + 18, 26);
        ctx.strokeRect(pad + 12, legendY, tw + 18, 26);
        ctx.fillStyle = '#c2410c';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, pad + 21, legendY + 13);
      }
    }

    // 6. Crisp border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  function openGraphEditorModal(qIdx, questionsRef, onUpdateRef) {
    const qList = questionsRef || currentEditingQuestions || [];
    const updateFn = onUpdateRef || currentEditingUpdateFn;
    const q = qList[qIdx] || {};

    const initialFormula = q.graphFormula || 'x^2 - 4';

    const modalHtml = `
      <div id="graph-helper-modal" class="modal-overlay" style="z-index: 9999;">
        <div class="modal-box" style="max-width: 960px; width: 95%; max-height: 92vh; overflow-y: auto; background: #0f172a; border: 2px solid #10b981; padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.5rem;">📈</span>
              <h3 style="margin: 0; color: #10b981; font-size: 1.3rem;">함수 그래프 생성 & 문항 삽입 도구 (Q${qIdx + 1})</h3>
            </div>
            <button id="btn-close-graph-modal" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.9rem;">✕ 닫기</button>
          </div>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 14px; line-height: 1.5;">
            수식으로 함수를 입력하면 좌표평면 위에 함수의 그래프가 실시간으로 렌더링됩니다. 완성된 고화질 그래프 이미지를 <strong>[📥 이 그래프를 문제에 첨부하기]</strong> 버튼을 눌러 문제에 즉시 삽입할 수 있습니다.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 18px; margin-bottom: 16px;">
            <!-- 좌측: 수식 입력 및 설정 컨트롤 -->
            <div style="background: #1e293b; border: 1px solid var(--border); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px;">
              <!-- 1. 기본 함수 f(x) -->
              <div>
                <label style="font-weight: bold; font-size: 0.88rem; color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
                  <span>🔹 기본 함수 f(x) [파란색]:</span>
                  <span id="f1-status-badge" style="font-size: 0.75rem; color: #10b981;">● 실시간 렌더링 중</span>
                </label>
                <input type="text" id="graph-f1-input" class="input-nickname" value="${escapeHtml(initialFormula)}" placeholder="예: x^2 - 4, sin(x), 2x+1, 1/x, sqrt(x+2)" style="margin-top: 4px; font-family: monospace; font-size: 1.05rem; border-color: #38bdf8;">
              </div>

              <!-- 2. 보조 함수 g(x) 토글 -->
              <div style="background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                <label style="font-size: 0.85rem; font-weight: bold; color: #ea580c; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                  <input type="checkbox" id="graph-f2-enable">
                  <span>🔸 보조 함수 g(x) 함께 표시 (교점/비교 분석) [주황색]</span>
                </label>
                <div id="graph-f2-wrap" style="display: none; margin-top: 8px;">
                  <input type="text" id="graph-f2-input" class="input-nickname" value="2x - 1" placeholder="예: 2x - 1, cos(x)" style="font-family: monospace; font-size: 0.95rem; border-color: #ea580c;">
                </div>
              </div>

              <!-- 3. 원클릭 대표 함수 프리셋 -->
              <div>
                <div style="font-size: 0.8rem; font-weight: bold; color: #fbbf24; margin-bottom: 6px;">자주 출제되는 대표 함수 프리셋 (클릭 시 자동 적용):</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="2x - 1" data-xmin="-5" data-xmax="5" data-ymin="-5" data-ymax="5">일차: 2x-1</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="x^2 - 4" data-xmin="-5" data-xmax="5" data-ymin="-6" data-ymax="6">이차: x²-4</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="-x^2 + 2x + 3" data-xmin="-4" data-xmax="6" data-ymin="-5" data-ymax="6">이차(위): -x²+2x+3</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="x^3 - 3x" data-xmin="-4" data-xmax="4" data-ymin="-5" data-ymax="5">삼차: x³-3x</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="1/x" data-xmin="-5" data-xmax="5" data-ymin="-5" data-ymax="5">유리: 1/x</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="sqrt(x+2)" data-xmin="-3" data-xmax="7" data-ymin="-1" data-ymax="5">무리: √(x+2)</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="sin(x)" data-xmin="-7" data-xmax="7" data-ymin="-2.5" data-ymax="2.5">삼각: sin(x)</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="cos(2x)" data-xmin="-7" data-xmax="7" data-ymin="-2.5" data-ymax="2.5">삼각: cos(2x)</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="2^x" data-xmin="-5" data-xmax="5" data-ymin="-1" data-ymax="9">지수: 2ˣ</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="ln(x)" data-xmin="-1" data-xmax="8" data-ymin="-4" data-ymax="4">로그: ln(x)</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="abs(x) - 2" data-xmin="-6" data-xmax="6" data-ymin="-4" data-ymax="5">절댓값: |x|-2</button>
                  <button type="button" class="btn btn-outline-sm btn-g-preset" data-f1="x^2 - 2" data-f2="x" data-f2enable="true" data-xmin="-4" data-xmax="4" data-ymin="-4" data-ymax="6">연립: x²-2 & x</button>
                </div>
              </div>

              <!-- 4. 좌표축 범위 설정 -->
              <div>
                <div style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); margin-bottom: 6px;">좌표축 범위 설정:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div>
                    <label style="font-size: 0.75rem; color: #94a3b8;">X축 범위 (최소 ~ 최대):</label>
                    <div style="display: flex; gap: 4px; align-items: center; margin-top: 2px;">
                      <input type="number" id="graph-xmin" value="-5" step="1" style="width: 100%; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); background: #0f172a; color: #fff;">
                      <span>~</span>
                      <input type="number" id="graph-xmax" value="5" step="1" style="width: 100%; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); background: #0f172a; color: #fff;">
                    </div>
                  </div>
                  <div>
                    <label style="font-size: 0.75rem; color: #94a3b8;">Y축 범위 (최소 ~ 최대):</label>
                    <div style="display: flex; gap: 4px; align-items: center; margin-top: 2px;">
                      <input type="number" id="graph-ymin" value="-5" step="1" style="width: 100%; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); background: #0f172a; color: #fff;">
                      <span>~</span>
                      <input type="number" id="graph-ymax" value="5" step="1" style="width: 100%; padding: 4px 6px; border-radius: 4px; border: 1px solid var(--border); background: #0f172a; color: #fff;">
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 4px; margin-top: 6px;">
                  <button type="button" class="btn btn-outline-sm btn-quick-range" data-range="-5,5,-5,5" style="padding: 2px 6px; font-size: 0.75rem;">[-5, 5]</button>
                  <button type="button" class="btn btn-outline-sm btn-quick-range" data-range="-10,10,-10,10" style="padding: 2px 6px; font-size: 0.75rem;">[-10, 10]</button>
                  <button type="button" class="btn btn-outline-sm btn-quick-range" data-range="-3,3,-3,3" style="padding: 2px 6px; font-size: 0.75rem;">[-3, 3]</button>
                  <button type="button" class="btn btn-outline-sm btn-quick-range" data-range="0,10,-1,9" style="padding: 2px 6px; font-size: 0.75rem;">양수 [0, 10]</button>
                </div>
              </div>

              <!-- 5. 시각적 옵션 -->
              <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 8px;">
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="checkbox" id="graph-opt-grid" checked> 보조 눈금 격자선
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="checkbox" id="graph-opt-labels" checked> 원점(O) 및 축 눈금
                </label>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                  <input type="checkbox" id="graph-opt-legend" checked> 함수식 범례 뱃지
                </label>
              </div>
            </div>

            <!-- 우측: 실시간 캔버스 렌더링 미리보기 -->
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #1e293b; border: 1px solid var(--border); border-radius: 10px; padding: 14px;">
              <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: bold; font-size: 0.88rem; color: #10b981;">📐 실시간 그래프 미리보기</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">고해상도 600×450 벡터 렌더링</span>
              </div>
              <div style="width: 100%; display: flex; justify-content: center; background: #ffffff; border-radius: 8px; padding: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                <canvas id="graph-live-canvas" width="600" height="450" style="width: 100%; max-width: 520px; aspect-ratio: 4/3; display: block; border-radius: 4px;"></canvas>
              </div>
              <div id="graph-error-msg" style="color: #ef4444; font-size: 0.8rem; margin-top: 8px; min-height: 20px; text-align: center;"></div>
            </div>
          </div>

          <!-- 하단 버튼 바 -->
          <div class="modal-actions" style="justify-content: space-between; gap: 10px; border-top: 1px solid var(--border); padding-top: 12px;">
            <button class="btn btn-secondary" id="btn-cancel-graph">취소</button>
            <button class="btn btn-primary" id="btn-apply-graph" style="background: #10b981; border-color: #059669; font-size: 1rem; padding: 10px 20px;">
              📥 이 그래프를 문제(Q${qIdx + 1})에 첨부하기
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const canvas = document.getElementById('graph-live-canvas');
    const f1Input = document.getElementById('graph-f1-input');
    const f2Input = document.getElementById('graph-f2-input');
    const f2Enable = document.getElementById('graph-f2-enable');
    const f2Wrap = document.getElementById('graph-f2-wrap');
    const xMinInput = document.getElementById('graph-xmin');
    const xMaxInput = document.getElementById('graph-xmax');
    const yMinInput = document.getElementById('graph-ymin');
    const yMaxInput = document.getElementById('graph-ymax');
    const optGrid = document.getElementById('graph-opt-grid');
    const optLabels = document.getElementById('graph-opt-labels');
    const optLegend = document.getElementById('graph-opt-legend');
    const errorMsg = document.getElementById('graph-error-msg');
    const statusBadge = document.getElementById('f1-status-badge');

    let currentFn1 = null;

    const updateGraph = () => {
      const f1Val = f1Input.value.trim();
      const f2Val = f2Input.value.trim();
      const isF2 = f2Enable.checked;

      const xMin = parseFloat(xMinInput.value) || -5;
      const xMax = parseFloat(xMaxInput.value) || 5;
      const yMin = parseFloat(yMinInput.value) || -5;
      const yMax = parseFloat(yMaxInput.value) || 5;

      const fn1 = compileMathExpr(f1Val);
      currentFn1 = fn1;
      const fn2 = isF2 ? compileMathExpr(f2Val) : null;

      if (!fn1 && f1Val) {
        errorMsg.textContent = '⚠️ f(x) 수식 형식을 확인해 주세요. (예: x^2 - 4, sin(x), 2x+1)';
        statusBadge.textContent = '⚠️ 수식 오류';
        statusBadge.style.color = '#ef4444';
      } else {
        errorMsg.textContent = '';
        statusBadge.textContent = '● 실시간 렌더링 중';
        statusBadge.style.color = '#10b981';
      }

      drawFunctionGraphToCanvas(canvas, {
        xMin, xMax, yMin, yMax,
        showGrid: optGrid.checked,
        showAxes: true,
        showLabels: optLabels.checked,
        showLegend: optLegend.checked,
        fn1,
        fn1Color: '#2563eb',
        formula1: fn1 ? f1Val : null,
        fn2,
        fn2Color: '#ea580c',
        formula2: (isF2 && fn2) ? f2Val : null,
        lineWidth: 3.5
      });
    };

    // Event listeners
    f1Input.addEventListener('input', updateGraph);
    f2Input.addEventListener('input', updateGraph);
    f2Enable.addEventListener('change', () => {
      f2Wrap.style.display = f2Enable.checked ? 'block' : 'none';
      updateGraph();
    });
    [xMinInput, xMaxInput, yMinInput, yMaxInput].forEach(inp => inp.addEventListener('input', updateGraph));
    [optGrid, optLabels, optLegend].forEach(cb => cb.addEventListener('change', updateGraph));

    // Preset buttons
    document.querySelectorAll('.btn-g-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ds = e.currentTarget.dataset;
        if (ds.f1) f1Input.value = ds.f1;
        if (ds.xmin) xMinInput.value = ds.xmin;
        if (ds.xmax) xMaxInput.value = ds.xmax;
        if (ds.ymin) yMinInput.value = ds.ymin;
        if (ds.ymax) yMaxInput.value = ds.ymax;
        if (ds.f2) {
          f2Input.value = ds.f2;
          f2Enable.checked = true;
          f2Wrap.style.display = 'block';
        } else {
          f2Enable.checked = false;
          f2Wrap.style.display = 'none';
        }
        updateGraph();
      });
    });

    // Quick range buttons
    document.querySelectorAll('.btn-quick-range').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const [xmin, xmax, ymin, ymax] = e.currentTarget.dataset.range.split(',');
        xMinInput.value = xmin;
        xMaxInput.value = xmax;
        yMinInput.value = ymin;
        yMaxInput.value = ymax;
        updateGraph();
      });
    });

    // Close / Cancel
    document.getElementById('btn-close-graph-modal')?.addEventListener('click', () => {
      document.getElementById('graph-helper-modal')?.remove();
    });
    document.getElementById('btn-cancel-graph')?.addEventListener('click', () => {
      document.getElementById('graph-helper-modal')?.remove();
    });

    // Apply to question
    document.getElementById('btn-apply-graph')?.addEventListener('click', () => {
      const f1Val = f1Input.value.trim();
      if (!currentFn1) {
        alert('올바른 함수 수식을 먼저 입력해 주세요. (예: x^2 - 4)');
        f1Input.focus();
        return;
      }

      // Convert canvas to PNG dataUrl
      const dataUrl = canvas.toDataURL('image/png');
      if (qList[qIdx]) {
        qList[qIdx].imageUrl = dataUrl;
        qList[qIdx].graphFormula = f1Val;
      }

      if (typeof updateFn === 'function') {
        updateFn();
      }
      document.getElementById('graph-helper-modal')?.remove();
    });

    // Initial render
    setTimeout(updateGraph, 30);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initRouter, 10);
  } else {
    document.addEventListener('DOMContentLoaded', initRouter);
  }
})();
