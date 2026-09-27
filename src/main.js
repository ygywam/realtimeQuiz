import { state, getOrCreateStudentId, generateRoomId } from './store/state.js';
import { 
  initRealtimeEngine, 
  createRoom, 
  subscribeRoom, 
  joinParticipant, 
  saveFirebaseConfig, 
  getSavedFirebaseConfig 
} from './engine/firebase.js';

import defaultQuestions from './data/defaultQuiz.js';
import { renderTeacherAdminModal } from './components/teacherAdmin.js';
import { renderHostDisplayView } from './components/hostDisplay.js';
import { renderStudentPadView } from './components/studentPad.js';

const app = document.getElementById('app');
const AVATARS = ['🐶', '🐱', '🦊', '🐯', '🦁', '🐸', '🤖', '🚀', '🎃', '🦄', '🐥', '🐼'];

function initRouter() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const role = params.get('role');

  initRealtimeEngine();

  if (roomId && role === 'student') {
    state.mode = 'student';
    state.roomId = roomId;
    state.role = 'student';
    initStudentFlow();
  } else if (roomId && (role === 'display' || role === 'teacher')) {
    state.mode = role;
    state.roomId = roomId;
    state.role = role;
    initHostFlow(role === 'teacher');
  } else {
    renderHomeView();
  }
}

function renderHomeView() {
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
    if (pin.length === 6) {
      window.location.search = `?room=${pin}&role=display`;
    } else {
      alert('6자리 PIN 번호를 입력해 주세요.');
    }
  });
  document.getElementById('btn-enter-student')?.addEventListener('click', () => {
    const pin = document.getElementById('input-student-pin').value.trim();
    if (pin.length === 6) {
      window.location.search = `?room=${pin}&role=student`;
    } else {
      alert('6자리 PIN 번호를 입력해 주세요.');
    }
  });
}

async function handleCreateRoom() {
  const roomId = generateRoomId();
  state.roomId = roomId;
  
  const initialRoomData = {
    meta: {
      title: '실시간 수업 퀴즈',
      createdAt: Date.now(),
      status: 'LOBBY',
      currentQuestionIndex: 0
    },
    questions: defaultQuestions,
    participants: {}
  };

  await createRoom(roomId, initialRoomData);
  window.location.search = `?room=${roomId}&role=teacher`;
}

function initHostFlow(isTeacherControl) {
  subscribeRoom(state.roomId, (roomData) => {
    if (!roomData) return;
    state.roomData = roomData;
    const status = roomData.meta?.status || 'LOBBY';

    if (status === 'LOBBY') {
      renderHostLobbyView(isTeacherControl);
    } else {
      renderHostDisplayView(app, roomData, state.roomId, isTeacherControl);
    }
  });
}

function renderHostLobbyView(isTeacherControl) {
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

  // 호환성 100% QRCode 생성
  const qrContainer = document.getElementById('qr-canvas-container');
  if (qrContainer && window.QRCode) {
    qrContainer.innerHTML = '';
    new window.QRCode(qrContainer, {
      text: studentJoinUrl,
      width: 200,
      height: 200
    });
  }

  updateParticipantList(state.roomData?.participants || {});

  document.getElementById('btn-open-edit')?.addEventListener('click', () => {
    renderTeacherAdminModal(state.roomId, state.roomData?.questions, () => {
      alert('문항이 업데이트되었습니다.');
    });
  });

  document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
    const { updateRoomMeta } = await import('./engine/firebase.js');
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

function initStudentFlow() {
  const studentId = getOrCreateStudentId();
  
  subscribeRoom(state.roomId, (roomData) => {
    if (!roomData) return;
    state.roomData = roomData;

    const myParticipant = roomData.participants && roomData.participants[studentId];
    if (myParticipant) {
      state.nickname = myParticipant.nickname;
      renderStudentPadView(app, roomData, state.roomId, studentId, state.nickname, myParticipant.avatar);
    } else {
      renderStudentJoinView(studentId);
    }
  });
}

function renderStudentJoinView(studentId) {
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
  inputNick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doJoin();
  });
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

  if (!apiKey || !databaseURL) {
    alert('API Key와 Database URL은 필수입니다.');
    return;
  }

  saveFirebaseConfig({ apiKey, databaseURL, projectId });
  alert('Firebase 설정이 저장되었습니다. 새로고침합니다.');
  window.location.reload();
});

document.getElementById('btn-use-demo')?.addEventListener('click', () => {
  localStorage.removeItem('class_quiz_fb_config');
  document.getElementById('firebase-modal').classList.add('hidden');
  alert('데모 모드로 동작합니다. (동일 브라우저 내 탭/창 간 실시간 연동 지원)');
  window.location.reload();
});

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

initRouter();
