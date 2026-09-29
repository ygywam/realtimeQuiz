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
    isDemo: false
  };

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
                      <h4 style="font-size: 1.05rem; color: #fff; margin-bottom: 6px;">${escapeHtml(room.title)}</h4>
                      <p style="font-size: 0.9rem; color: #38bdf8; font-weight: bold; margin-bottom: 14px;">📝 문항 수: ${room.questionCount}개</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                      <button class="btn btn-primary btn-run-room" data-pin="${room.roomId}" style="padding: 8px 4px; font-size: 0.85rem;">🚀 교사 진행</button>
                      <button class="btn btn-secondary btn-display-room" data-pin="${room.roomId}" style="padding: 8px 4px; font-size: 0.85rem;">🖥️ 전자칠판</button>
                      <button class="btn btn-outline-sm btn-edit-room" data-pin="${room.roomId}" style="padding: 6px 4px; font-size: 0.82rem; border-color: #fbbf24; color: #fbbf24;">📝 편집</button>
                      <button class="btn btn-danger btn-del-room" data-pin="${room.roomId}" style="padding: 6px 4px; font-size: 0.82rem;">🗑️ 삭제</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
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

    document.querySelectorAll('.btn-run-room').forEach(btn => {
      btn.addEventListener('click', (e) => window.location.search = `?room=${e.currentTarget.dataset.pin}&role=teacher`);
    });
    document.querySelectorAll('.btn-display-room').forEach(btn => {
      btn.addEventListener('click', (e) => window.location.search = `?room=${e.currentTarget.dataset.pin}&role=display`);
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

    const modalHtml = `
      <div id="admin-modal" class="modal-overlay">
        <div class="modal-box" style="max-width: 780px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>📝 퀴즈 출제 / 문항 관리</h2>
            <span style="color: var(--text-muted);">방 PIN: <strong>${roomId}</strong></span>
          </div>
          <div id="question-list-editor" style="margin-bottom: 20px; max-height: 55vh; overflow-y: auto;"></div>
          <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; background: #0f172a; padding: 16px; border-radius: 12px;">
            <span style="width: 100%; font-weight: bold; margin-bottom: 4px;">+ 새 문항 유형 선택 추가:</span>
            <button class="btn btn-outline-sm" id="btn-add-ox">+ O/X 참거짓</button>
            <button class="btn btn-outline-sm" id="btn-add-choice">+ 선다형 (2~5지선다)</button>
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
            <label style="font-size: 0.88rem; font-weight: bold;">🖼️ 문제 첨부 이미지 (선택):</label>
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
              <input type="file" class="q-image-file" data-idx="${idx}" accept="image/*" style="font-size: 0.85rem; color: var(--text-muted);">
              ${q.imageUrl ? `<button type="button" class="btn btn-danger btn-del-image" data-idx="${idx}" style="padding: 4px 10px; font-size: 0.8rem;">❌ 이미지 삭제</button>` : ''}
            </div>
            ${q.imageUrl ? `<div style="margin-top: 8px;"><img src="${q.imageUrl}" style="max-height: 120px; border-radius: 8px; border: 1px solid var(--border);"></div>` : ''}
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
      container.querySelectorAll('.btn-del-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const qIdx = Number(e.target.dataset.idx);
          delete questions[qIdx].imageUrl;
          renderEditorList();
        });
      });
      container.querySelectorAll('.double-points-cb').forEach(cb => {
        cb.addEventListener('change', (e) => { questions[e.target.dataset.idx].isDoublePoints = e.target.checked; });
      });
      container.querySelectorAll('.time-limit-select').forEach(sel => {
        sel.addEventListener('change', (e) => { questions[e.target.dataset.idx].timeLimit = Number(e.target.value); });
      });
      container.querySelectorAll('.btn-delete-q').forEach(btn => {
        btn.addEventListener('click', (e) => { questions.splice(Number(e.target.dataset.idx), 1); renderEditorList(); });
      });

      container.querySelectorAll('.btn-open-formula').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = 'input_' + e.currentTarget.dataset.target;
          const inputEl = document.getElementById(targetId);
          openFormulaEditorModal(inputEl);
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
      questions.push({ id: 'q_' + Date.now(), type: 'choice', question: '신규 선다형 질문입니다.', options: ['보기 1', '보기 2'], correctAnswer: 0, timeLimit: 20, isDoublePoints: false });
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
      await updateQuestions(roomId, questions);
      document.getElementById('admin-modal').remove();
      if (onSaveCallback) onSaveCallback();
    });
  }

  function getQuestionTypeLabel(type) {
    switch(type) {
      case 'ox': return 'O/X 참거짓'; case 'choice': return '선다형'; case 'short': return '단답형'; case 'wordcloud': return '워드클라우드'; case 'postit': return '포스트잇'; default: return '퀴즈';
    }
  }

  function renderTypeSpecificEditor(q, idx) {
    if (q.type === 'ox' || q.type === 'choice') {
      const isChoice = q.type === 'choice';
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 0.9rem; color: var(--text-muted);">보기 수정 및 정답 선택 (라디오 버튼 클릭):</div>
          ${isChoice ? `
            <div style="display: flex; gap: 8px;">
              ${q.options.length < 5 ? `<button type="button" class="btn btn-outline-sm btn-add-option" data-qidx="${idx}" style="padding: 4px 10px; font-size: 0.8rem;">+ 보기 추가</button>` : ''}
            </div>
          ` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${q.options.map((opt, optIdx) => `
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" class="correct-radio" name="correct_${idx}" data-qidx="${idx}" value="${optIdx}" ${q.correctAnswer == optIdx ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
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

    if (currentDisplayCard && renderedStatus === status && renderedQIdx === qIndex) {
      const respEl = document.getElementById('resp-count');
      if (respEl) respEl.textContent = responseCount;

      const mainContentEl = document.getElementById('display-main-content');
      if (mainContentEl) {
        const newHash = JSON.stringify(responses) + '_' + status;
        if (mainContentEl.dataset.resphash !== newHash) {
          mainContentEl.dataset.resphash = newHash;
          mainContentEl.innerHTML = renderQuestionContent(currentQ, responses, status, participants);
        }
      }
    } else {
      container.innerHTML = `
        <div class="quiz-display-container" id="host-display-card" data-qindex="${qIndex}" data-status="${status}">
          <div class="quiz-top-bar">
            <div style="display: flex; align-items: center; gap: 12px;">
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
            <button id="btn-toggle-bgm" class="btn btn-outline-sm" style="background: rgba(56, 189, 248, 0.2); border-color: #38bdf8; color: #fff; font-weight: bold;">
              ${AudioEngine.bgmPlaying ? '🎵 BGM 끄기' : '🎵 BGM 켜기'}
            </button>
            <div style="font-size: 1.4rem; font-weight: bold; color: #38bdf8;">
              제출 인원: <span id="resp-count">${responseCount}</span> / ${participantCount}명
            </div>
          </div>
          <div class="question-card">
            <h1 class="question-title">${parseMath(currentQ.question || '')}</h1>
            ${currentQ.imageUrl ? `<div style="text-align: center; margin-top: 14px;"><img src="${currentQ.imageUrl}" style="max-height: 320px; max-width: 100%; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.4);"></div>` : ''}
            ${currentQ.isDoublePoints ? `<div style="color: #fbbf24; font-size: 1.2rem; font-weight: bold; margin-top: 10px;">⚡ 점수 2배 이벤트 문항!</div>` : ''}
          </div>
          <div id="display-main-content" style="flex: 1; display: flex; flex-direction: column;" data-resphash="${JSON.stringify(responses) + '_' + status}">
            ${renderQuestionContent(currentQ, responses, status, participants)}
          </div>
          ${isTeacherControl ? `
            <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 20px;">
              ${status === 'PLAYING' ? `<button class="btn btn-danger" id="btn-force-finish">${isUnlimited ? '⏹️ 응답 마감 및 의견 공유' : '⏹️ 응답 마감 및 정답 공개'}</button>` : ''}
              ${status === 'SHOW_ANSWER' ? `<button class="btn btn-primary" id="btn-show-ranking">📊 중간 순위 보기 (1~5위)</button>` : ''}
            </div>
          ` : ''}
        </div>
      `;

      document.getElementById('btn-go-home-display')?.addEventListener('click', () => window.location.search = '');
      document.getElementById('select-theme-display')?.addEventListener('change', (e) => setTheme(e.target.value));

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
            if (isTeacherControl) processQuestionResults(roomId, state.roomData || roomData);
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

    const existingIntCard = document.getElementById('intermediate-ranking-card');
    if (existingIntCard && existingIntCard.dataset.qindex == qIndex) {
      return;
    }

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
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 30px;">
            ${isTeacherControl ? (isLastQ ? `
              <button class="btn btn-primary" id="btn-show-ceremony" style="font-size: 1.2rem; padding: 12px 32px;">🏆 최종 시상식 결과 보기</button>
            ` : `
              <button class="btn btn-primary" id="btn-next-question-rank" style="font-size: 1.2rem; padding: 12px 32px;">➡️ 다음 문제로 이동 (Q${qIndex + 2})</button>
            `) : (isLastQ ? `
              <button class="btn btn-primary" id="btn-show-ceremony" style="font-size: 1.2rem; padding: 12px 32px;">🏆 최종 시상식 결과 보기</button>
            ` : `<p style="color: #38bdf8; font-size: 1.1rem;">선생님이 다음 문제를 진행할 때까지 대기 중입니다...</p>`)}
          </div>
        </div>
      </div>
    `;

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

    if (currentQ.type === 'ox' || currentQ.type === 'choice') {
      const rawOptions = currentQ.options || [];
      const validIndices = [];
      const options = [];
      rawOptions.forEach((opt, idx) => {
        if (String(opt || '').trim() !== '') {
          validIndices.push(idx);
          options.push(opt);
        }
      });
      const counts = validIndices.map(idx => Object.values(responses).filter(r => Number(r.answer) === idx).length);
      return `
        <div class="options-grid">
          ${options.map((opt, displayIdx) => {
            const realIdx = validIndices[displayIdx];
            const isCorrect = showAnswer && realIdx === currentQ.correctAnswer;
            return `
              <div class="option-card-display opt-${realIdx} ${isCorrect ? 'correct-highlight' : ''}">
                <span>${parseMath(opt)} ${isCorrect ? ' (정답! 🎉)' : ''}</span>
                <span class="count-bar">${counts[displayIdx]}명</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (currentQ.type === 'short') {
      return `
        <div style="background: var(--card-dark); padding: 30px; border-radius: 16px; text-align: center; flex: 1;">
          ${showAnswer ? `<h2 style="font-size: 2.2rem; color: #10b981; margin-bottom: 20px;">💡 정답: ${parseMath(currentQ.correctText)}</h2>` : `<h2 style="font-size: 1.8rem; color: #94a3b8;">학생들이 단답형 답안을 입력하는 중입니다...</h2>`}
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; justify-content: center;">
            ${Object.entries(responses).map(([sid, r]) => {
              const p = (participants && participants[sid]) || {};
              const nick = p.nickname || r.nickname || '';
              const av = p.avatar || r.avatar || '';
              return `<div class="student-tag" style="font-size: 1.1rem; background: #1e293b;">${av} ${escapeHtml(nick ? nick + ': ' : '')}${parseMath(r.answer)}</div>`;
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
                ${r.drawing ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${r.drawing}" style="max-width: 100%; max-height: 160px; border-radius: 6px; background: #fff; border: 1px solid rgba(120,53,15,0.2);"></div>` : ''}
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

    const participants = Object.values(roomData.participants || {});
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
      container.querySelectorAll('.btn-pad').forEach(btn => {
        btn.addEventListener('click', async (e) => {
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
    if (currentQ.type === 'ox' || currentQ.type === 'choice') {
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
            <div style="background: #ffffff; border-radius: 8px; padding: 4px; border: 2px solid var(--primary); touch-action: none;">
              <canvas id="postit-canvas" width="300" height="180" style="width: 100%; height: 180px; display: block; border-radius: 6px; cursor: crosshair; background: #ffffff;"></canvas>
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

  function openFormulaEditorModal(targetInput) {
    let activeInput = targetInput || document.activeElement;
    const modalHtml = `
      <div id="formula-helper-modal" class="modal-overlay" style="z-index: 9999;">
        <div class="modal-box" style="max-width: 680px; width: 92%; background: #0f172a; border: 2px solid #38bdf8;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
            <h3 style="margin: 0; color: #38bdf8; font-size: 1.3rem;">∑ 수식 & 서식 보조 편집 도구</h3>
            <button id="btn-close-formula-modal" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.9rem;">✕ 닫기</button>
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

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initRouter, 10);
  } else {
    document.addEventListener('DOMContentLoaded', initRouter);
  }
})();
