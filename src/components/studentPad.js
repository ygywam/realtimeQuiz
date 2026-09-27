import { submitResponse } from '../engine/firebase.js';

export function renderStudentPadView(container, roomData, roomId, studentId, nickname, avatar = '🐶') {
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

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
