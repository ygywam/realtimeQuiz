(function() {
  'use strict';

  const defaultQuestions = [
    {
      id: "q1",
      type: "ox",
      question: "지구는 태양 주위를 공전한다.",
      options: ["O (그렇다)", "X (아니다)"],
      correctAnswer: 0,
      timeLimit: 15,
      explanation: "지구는 태양 주위를 약 365일에 걸쳐 1바퀴씩 공전합니다.",
      isDoublePoints: false
    },
    {
      id: "q2",
      type: "choice",
      question: "대한민국의 수도는 어디일까요?",
      options: ["부산", "인천", "서울", "대구"],
      correctAnswer: 2,
      timeLimit: 15,
      explanation: "대한민국의 수도는 서울특별시입니다.",
      isDoublePoints: false
    },
    {
      id: "q3",
      type: "short",
      question: "식물이 빛을 받아 양분을 만드는 작용을 무엇이라고 할까요?",
      correctText: "광합성",
      timeLimit: 20,
      explanation: "정답은 '광합성'입니다.",
      isDoublePoints: true
    },
    {
      id: "q4",
      type: "wordcloud",
      question: "오늘 수업을 한 단어로 표현한다면?",
      timeLimit: 25,
      explanation: "자유롭게 의견을 적어보세요.",
      isDoublePoints: false
    },
    {
      id: "q5",
      type: "postit",
      question: "환경 보호를 위해 우리가 실천할 수 있는 일은?",
      timeLimit: 30,
      explanation: "좋은 아이디어를 작성해 주세요.",
      isDoublePoints: false
    }
  ];

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

  let db = null;
  let broadcastChannel = null;

  function getSavedFirebaseConfig() {
    const saved = localStorage.getItem('class_quiz_fb_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  }

  function saveFirebaseConfig(config) {
    localStorage.setItem('class_quiz_fb_config', JSON.stringify(config));
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
        console.error('Firebase 초기화 실패, 데모 모드로 전환:', err);
      }
    }
    
    state.isDemo = true;
    if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('class_quiz_channel');
    }
    return false;
  }

  async function createRoom(roomId, initialData) {
    if (db) {
      await db.ref(`rooms/${roomId}`).set(initialData);
    } else {
      localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(initialData));
      broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: initialData });
    }
  }

  function subscribeRoom(roomId, callback) {
    if (db) {
      const roomRef = db.ref(`rooms/${roomId}`);
      const handler = (snapshot) => {
        callback(snapshot.val());
      };
      roomRef.on('value', handler);
      return () => roomRef.off('value', handler);
    } else {
      const check = () => {
        const raw = localStorage.getItem(`demo_room_${roomId}`);
        if (raw) callback(JSON.parse(raw));
        else callback(null);
      };
      check();
      const handler = (e) => {
        if (e.data.roomId === roomId) check();
      };
      broadcastChannel?.addEventListener('message', handler);
      return () => broadcastChannel?.removeEventListener('message', handler);
    }
  }

  async function joinParticipant(roomId, studentId, nickname, avatar = '🐶') {
    if (db) {
      await db.ref(`rooms/${roomId}/participants/${studentId}`).set({
        nickname, avatar, joinedAt: Date.now(), score: 0
      });
    } else {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        const room = JSON.parse(raw);
        if (!room.participants) room.participants = {};
        room.participants[studentId] = { nickname, avatar, joinedAt: Date.now(), score: 0 };
        localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
        broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
      }
    }
  }

  async function updateRoomMeta(roomId, partialMeta) {
    if (db) {
      await db.ref(`rooms/${roomId}/meta`).update(partialMeta);
    } else {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        const room = JSON.parse(raw);
        room.meta = { ...room.meta, ...partialMeta };
        localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
        broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
      }
    }
  }

  async function updateQuestions(roomId, questions) {
    if (db) {
      await db.ref(`rooms/${roomId}/questions`).set(questions);
    } else {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        const room = JSON.parse(raw);
        room.questions = questions;
        localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
        broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
      }
    }
  }

  async function submitResponse(roomId, qIndex, studentId, responseData) {
    if (db) {
      await db.ref(`rooms/${roomId}/responses/${qIndex}/${studentId}`).set({
        ...responseData, submittedAt: Date.now()
      });
    } else {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        const room = JSON.parse(raw);
        if (!room.responses) room.responses = {};
        if (!room.responses[qIndex]) room.responses[qIndex] = {};
        room.responses[qIndex][studentId] = { ...responseData, submittedAt: Date.now() };
        localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
        broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
      }
    }
  }

  async function updateParticipantScores(roomId, scoresMap) {
    if (db) {
      const updates = {};
      Object.keys(scoresMap).forEach(sid => {
        updates[`rooms/${roomId}/participants/${sid}/score`] = scoresMap[sid];
      });
      await db.ref().update(updates);
    } else {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        const room = JSON.parse(raw);
        if (room.participants) {
          Object.keys(scoresMap).forEach(sid => {
            if (room.participants[sid]) room.participants[sid].score = scoresMap[sid];
          });
        }
        localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
        broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
      }
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
    app.innerHTML = `
      <div class="home-container">
        <h1 class="home-title">⚡ 클래스 라이브 퀴즈</h1>
        <p class="home-subtitle">전자칠판과 학생 스마트폰을 실시간으로 잇는 반응형 퀴즈</p>

        <div style="margin-bottom: 25px;">
          <span class="room-badge" style="font-size: 0.95rem; cursor: pointer;" id="btn-open-fb">
            ${isFbConnected ? '🟢 Firebase 실시간 DB 연결됨' : '🟡 데모/로컬 모드 (설정 변경)'}
          </span>
        </div>

        <div class="mode-grid">
          <div class="mode-card">
            <div class="mode-icon">👨‍🏫</div>
            <h3>교사 모드</h3>
            <p>새로운 퀴즈 방을 만들고, 문항을 출제/수정하거나 진행을 제어합니다.</p>
            <button class="btn btn-primary" id="btn-create-room">새 퀴즈 방 만들기</button>
          </div>

          <div class="mode-card">
            <div class="mode-icon">🖥️</div>
            <h3>전자칠판 모드</h3>
            <p>교사 PC에서 생성된 퀴즈 방의 PIN 코드를 입력해 큰 화면에 송출합니다.</p>
            <div style="display: flex; gap: 8px; width: 100%;">
              <input type="text" id="input-display-pin" placeholder="PIN 6자리" style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: #0f172a; color: #fff; text-align: center; font-weight: bold;">
              <button class="btn btn-secondary" id="btn-enter-display">접속</button>
            </div>
          </div>

          <div class="mode-card">
            <div class="mode-icon">📱</div>
            <h3>학생 모드</h3>
            <p>교실 화면의 QR코드를 스캔하거나 PIN 번호를 직접 입력해 참여합니다.</p>
            <div style="display: flex; gap: 8px; width: 100%;">
              <input type="text" id="input-student-pin" placeholder="PIN 6자리" style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid var(--border); background: #0f172a; color: #fff; text-align: center; font-weight: bold;">
              <button class="btn btn-primary" id="btn-enter-student">참여</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-create-room')?.addEventListener('click', handleCreateRoom);
    document.getElementById('btn-open-fb')?.addEventListener('click', openFirebaseModal);
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
  }

  async function handleCreateRoom() {
    const roomId = generateRoomId();
    state.roomId = roomId;
    const initialRoomData = {
      meta: { title: '실시간 수업 퀴즈', createdAt: Date.now(), status: 'LOBBY', currentQuestionIndex: 0 },
      questions: defaultQuestions,
      participants: {}
    };
    await createRoom(roomId, initialRoomData);
    window.location.search = `?room=${roomId}&role=teacher`;
  }

  function initHostFlow(app, isTeacherControl) {
    subscribeRoom(state.roomId, (roomData) => {
      if (!roomData) {
        // 존재하지 않거나 초기화되지 않은 방 안내
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

    app.innerHTML = `
      <div class="lobby-layout">
        <div class="lobby-header">
          <div>
            <span class="room-badge">방 PIN : ${state.roomId}</span>
            ${!isTeacherControl ? '<span style="margin-left: 12px; color: #38bdf8; font-weight: bold;">[전자칠판 디스플레이 모드]</span>' : ''}
          </div>
          <div style="display: flex; gap: 12px;">
            ${isTeacherControl ? '<button class="btn btn-secondary" id="btn-open-edit">📝 문제 출제 / 편집</button>' : ''}
            ${isTeacherControl ? '<button class="btn btn-primary" id="btn-start-quiz" style="font-size: 1.25rem; padding: 14px 32px;">🚀 퀴즈 시작</button>' : ''}
          </div>
        </div>

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

    document.getElementById('btn-open-edit')?.addEventListener('click', () => {
      renderTeacherAdminModal(state.roomId, state.roomData?.questions, () => {
        alert('문항이 업데이트되었습니다.');
      });
    });

    document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
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
    subscribeRoom(state.roomId, (roomData) => {
      if (!roomData) {
        // 아직 교사가 방을 만들지 않았거나 PIN 번호가 틀렸을 때의 명확한 안내 화면
        app.innerHTML = `
          <div class="mobile-view">
            <div class="mobile-card">
              <div style="font-size: 3.5rem; margin-bottom: 12px;">🔎</div>
              <h2 style="font-size: 1.5rem; color: #fbbf24;">퀴즈 방을 찾을 수 없습니다</h2>
              <p style="color: var(--text-muted); margin-top: 10px; font-size: 1rem; line-height: 1.5;">
                방 PIN 번호(<strong>${state.roomId}</strong>)를 다시 확인하시거나,<br>선생님이 교사 모드에서 [새 퀴즈 방 만들기]를 실행하셨는지 확인해 주세요.
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
        renderStudentJoinView(app, studentId);
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
          <div id="avatar-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 20px;">
            ${AVATARS.map((av, idx) => `
              <div class="avatar-option ${idx === 0 ? 'selected' : ''}" data-avatar="${av}" style="font-size: 1.8rem; padding: 8px; border-radius: 12px; cursor: pointer; background: #0f172a; border: 2px solid ${idx === 0 ? 'var(--primary)' : 'transparent'}; text-align: center;">
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
    let questions = currentQuestions && currentQuestions.length > 0 
      ? JSON.parse(JSON.stringify(currentQuestions)) 
      : JSON.parse(JSON.stringify(defaultQuestions));

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
            <button class="btn btn-outline-sm" id="btn-add-choice">+ 4지선다형</button>
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
                <option value="10" ${q.timeLimit == 10 ? 'selected' : ''}>10초</option>
                <option value="15" ${q.timeLimit == 15 ? 'selected' : ''}>15초</option>
                <option value="20" ${q.timeLimit == 20 ? 'selected' : ''}>20초</option>
                <option value="30" ${q.timeLimit == 30 ? 'selected' : ''}>30초</option>
              </select>
              <button class="btn btn-danger btn-delete-q" data-idx="${idx}" style="padding: 6px 12px; font-size: 0.85rem;">삭제</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 0.88rem;">질문 제목/내용:</label>
            <input type="text" class="q-title-input" data-idx="${idx}" value="${escapeHtml(q.question)}" placeholder="질문 내용을 입력하세요">
          </div>
          ${renderTypeSpecificEditor(q, idx)}
        </div>
      `).join('');

      container.querySelectorAll('.q-title-input').forEach(input => {
        input.addEventListener('input', (e) => { questions[e.target.dataset.idx].question = e.target.value; });
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
      questions.push({ id: 'q_' + Date.now(), type: 'choice', question: '신규 4지선다 질문입니다.', options: ['보기 1', '보기 2', '보기 3', '보기 4'], correctAnswer: 0, timeLimit: 20, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-short').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'short', question: '신규 단답형 질문입니다.', correctText: '정답', timeLimit: 20, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-wordcloud').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'wordcloud', question: '신규 워드클라우드 질문입니다.', timeLimit: 25, isDoublePoints: false });
      renderEditorList();
    });
    document.getElementById('btn-add-postit').addEventListener('click', () => {
      questions.push({ id: 'q_' + Date.now(), type: 'postit', question: '신규 포스트잇 질문입니다.', timeLimit: 30, isDoublePoints: false });
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
      case 'ox': return 'O/X 참거짓'; case 'choice': return '4지선다'; case 'short': return '단답형'; case 'wordcloud': return '워드클라우드'; case 'postit': return '포스트잇'; default: return '퀴즈';
    }
  }

  function renderTypeSpecificEditor(q, idx) {
    if (q.type === 'ox' || q.type === 'choice') {
      return `
        <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 8px;">보기 수정 및 정답 선택 (라디오 버튼 클릭):</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${q.options.map((opt, optIdx) => `
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="radio" class="correct-radio" name="correct_${idx}" data-qidx="${idx}" value="${optIdx}" ${q.correctAnswer == optIdx ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
              <span style="font-weight: bold; min-width: 24px;">${optIdx + 1}.</span>
              <input type="text" class="opt-text-input" data-qidx="${idx}" data-optidx="${optIdx}" value="${escapeHtml(opt)}" placeholder="보기 내용 입력" style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border); background: #1e293b; color: #fff;">
            </div>
          `).join('')}
        </div>
      `;
    } else if (q.type === 'short') {
      return `
        <div class="form-group" style="margin-top: 8px;">
          <label>단답형 정답 텍스트:</label>
          <input type="text" class="short-target-input" data-qidx="${idx}" value="${escapeHtml(q.correctText || '')}" placeholder="정답 단어/문장 입력">
        </div>
      `;
    }
    return '';
  }

  let timerInterval = null;

  function renderHostDisplayView(container, roomData, roomId, isTeacherControl = false) {
    const meta = roomData.meta || {};
    const status = meta.status || 'LOBBY';
    const qIndex = meta.currentQuestionIndex || 0;
    const questions = roomData.questions || [];
    const currentQ = questions[qIndex] || {};
    const responses = (roomData.responses && roomData.responses[qIndex]) || {};
    const participants = roomData.participants || {};

    if (status === 'FINISHED') {
      renderLeaderboardView(container, roomData, isTeacherControl);
      return;
    }

    const responseCount = Object.keys(responses).length;
    const participantCount = Object.keys(participants).length;

    container.innerHTML = `
      <div class="quiz-display-container">
        <div class="quiz-top-bar">
          <span class="room-badge">Q ${qIndex + 1} / ${questions.length}</span>
          <div id="display-timer" class="timer-badge">⏱️ ${currentQ.timeLimit || 20}s</div>
          <div style="font-size: 1.4rem; font-weight: bold; color: #38bdf8;">
            제출 인원: <span id="resp-count">${responseCount}</span> / ${participantCount}명
          </div>
        </div>
        <div class="question-card">
          <h1 class="question-title">${escapeHtml(currentQ.question || '')}</h1>
          ${currentQ.isDoublePoints ? `<div style="color: #fbbf24; font-size: 1.2rem; font-weight: bold; margin-top: 10px;">⚡ 점수 2배 이벤트 문항!</div>` : ''}
        </div>
        <div id="display-main-content" style="flex: 1; display: flex; flex-direction: column;">
          ${renderQuestionContent(currentQ, responses, status)}
        </div>
        ${isTeacherControl ? `
          <div style="display: flex; justify-content: flex-end; gap: 16px; margin-top: 20px;">
            ${status === 'PLAYING' ? `<button class="btn btn-danger" id="btn-force-finish">⏹️ 응답 마감 및 정답 공개</button>` : ''}
            ${status === 'SHOW_ANSWER' ? `<button class="btn btn-primary" id="btn-next-question">➡️ 다음 문제 / 순위 보기</button>` : ''}
          </div>
        ` : ''}
      </div>
    `;

    if (status === 'PLAYING') {
      const timeLimit = currentQ.timeLimit || 20;
      const startedAt = meta.timerStartedAt || Date.now();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, timeLimit - elapsed);
        const timerEl = document.getElementById('display-timer');
        if (timerEl) timerEl.textContent = `⏱️ ${remaining}s`;
        if (remaining <= 0) {
          clearInterval(timerInterval);
          if (isTeacherControl) processQuestionResults(roomId, roomData);
        }
      }, 500);
    } else {
      if (timerInterval) clearInterval(timerInterval);
    }

    document.getElementById('btn-force-finish')?.addEventListener('click', () => {
      if (timerInterval) clearInterval(timerInterval);
      processQuestionResults(roomId, roomData);
    });

    document.getElementById('btn-next-question')?.addEventListener('click', () => {
      advanceToNextQuestion(roomId, roomData);
    });
  }

  function renderQuestionContent(currentQ, responses, status) {
    const showAnswer = status === 'SHOW_ANSWER';

    if (currentQ.type === 'ox' || currentQ.type === 'choice') {
      const options = currentQ.options || [];
      const counts = options.map((_, idx) => Object.values(responses).filter(r => Number(r.answer) === idx).length);
      return `
        <div class="options-grid">
          ${options.map((opt, idx) => {
            const isCorrect = showAnswer && idx === currentQ.correctAnswer;
            return `
              <div class="option-card-display opt-${idx} ${isCorrect ? 'correct-highlight' : ''}">
                <span>${opt} ${isCorrect ? ' (정답! 🎉)' : ''}</span>
                <span class="count-bar">${counts[idx]}명</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (currentQ.type === 'short') {
      return `
        <div style="background: var(--card-dark); padding: 30px; border-radius: 16px; text-align: center; flex: 1;">
          ${showAnswer ? `<h2 style="font-size: 2.2rem; color: #10b981; margin-bottom: 20px;">💡 정답: ${escapeHtml(currentQ.correctText)}</h2>` : `<h2 style="font-size: 1.8rem; color: #94a3b8;">학생들이 단답형 답안을 입력하는 중입니다...</h2>`}
          <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; justify-content: center;">
            ${Object.values(responses).map(r => `<div class="student-tag" style="font-size: 1.1rem; background: #1e293b;">${escapeHtml(r.answer)}</div>`).join('')}
          </div>
        </div>
      `;
    } else if (currentQ.type === 'wordcloud') {
      return `
        <div class="wordcloud-container">
          ${Object.values(responses).map(r => `<div class="word-chip">${escapeHtml(r.answer)}</div>`).join('')}
        </div>
      `;
    } else if (currentQ.type === 'postit') {
      return `
        <div class="postit-container">
          ${Object.values(responses).map(r => `<div class="postit-card">${escapeHtml(r.answer)}</div>`).join('')}
        </div>
      `;
    }
    return '';
  }

  function renderLeaderboardView(container, roomData, isTeacherControl) {
    const participants = Object.values(roomData.participants || {});
    participants.sort((a, b) => (b.score || 0) - (a.score || 0));
    const top5 = participants.slice(0, 5);

    container.innerHTML = `
      <div class="quiz-display-container">
        <div class="leaderboard-container">
          <h1 class="leaderboard-title">🏆 최종 명예의 전당 (Top 5)</h1>
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
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 40px;">
            <button class="btn btn-success" id="btn-export-csv" style="font-size: 1.2rem;">📥 퀴즈 결과 CSV 다운로드</button>
            <button class="btn btn-secondary" id="btn-restart-app" style="font-size: 1.2rem;">🏠 메인으로 돌아가기</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-export-csv')?.addEventListener('click', () => exportResultsToCSV(roomData));
    document.getElementById('btn-restart-app')?.addEventListener('click', () => window.location.search = '');
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
      container.innerHTML = `
        <div class="mobile-view">
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

    if (status === 'FINISHED') {
      renderStudentFinalFeedback(container, roomData, studentId, nickname, avatar);
      return;
    }

    container.innerHTML = `
      <div class="mobile-view">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span class="room-badge" style="font-size: 0.95rem;">Q${qIndex + 1} / ${questions.length}</span>
          <span style="font-weight: 800; color: #38bdf8; font-size: 1.1rem;">${avatar} ${escapeHtml(nickname)} (${myParticipant.score || 0}점)</span>
        </div>
        <div class="mobile-card">
          <h3 style="font-size: 1.3rem; margin-bottom: 8px;">${escapeHtml(currentQ.question)}</h3>
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
    }
  }

  function renderPadControls(currentQ) {
    if (currentQ.type === 'ox' || currentQ.type === 'choice') {
      const options = currentQ.options || [];
      return `
        <div class="mobile-pad-grid">
          ${options.map((opt, idx) => `
            <button class="btn-pad pad-${idx}" data-idx="${idx}">
              ${opt}
            </button>
          `).join('')}
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
    const myP = roomData.participants[studentId] || {};

    container.innerHTML = `
      <div class="mobile-view">
        <div class="mobile-card">
          <div style="font-size: 3.5rem; margin-bottom: 10px;">${avatar}</div>
          <h1 style="font-size: 2.2rem; color: #fbbf24; margin-bottom: 12px;">🏆 수고하셨습니다!</h1>
          <h2 style="font-size: 1.5rem; color: #fff;">${avatar} ${escapeHtml(nickname)} 님의 최종 결과</h2>
          <div style="font-size: 2rem; font-weight: 900; color: #38bdf8; margin: 16px 0;">
            ${myP.score || 0}점 (전체 ${myRank}위 / ${participants.length}명)
          </div>
        </div>
      </div>
    `;
  }

  function openFirebaseModal() {
    const modal = document.getElementById('firebase-modal');
    const saved = getSavedFirebaseConfig();
    if (saved) {
      document.getElementById('fb-apiKey').value = saved.apiKey || '';
      document.getElementById('fb-dbUrl').value = saved.databaseURL || '';
      document.getElementById('fb-projectId').value = saved.projectId || '';
    }
    modal.classList.remove('hidden');
  }

  document.getElementById('btn-close-fb')?.addEventListener('click', () => {
    document.getElementById('firebase-modal').classList.add('hidden');
  });

  document.getElementById('btn-save-fb')?.addEventListener('click', () => {
    const apiKey = document.getElementById('fb-apiKey').value.trim();
    const databaseURL = document.getElementById('fb-dbUrl').value.trim();
    const projectId = document.getElementById('fb-projectId').value.trim();
    if (!apiKey || !databaseURL) return alert('API Key와 Database URL은 필수입니다.');
    saveFirebaseConfig({ apiKey, databaseURL, projectId });
    alert('Firebase 설정이 저장되었습니다. 새로고침합니다.');
    window.location.reload();
  });

  document.getElementById('btn-use-demo')?.addEventListener('click', () => {
    localStorage.removeItem('class_quiz_fb_config');
    document.getElementById('firebase-modal').classList.add('hidden');
    alert('데모 모드로 동작합니다.');
    window.location.reload();
  });

  function escapeHtml(str) {
    return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initRouter, 10);
  } else {
    document.addEventListener('DOMContentLoaded', initRouter);
  }
})();
