import { processQuestionResults, advanceToNextQuestion, exportResultsToCSV } from '../engine/quizEngine.js';

let timerInterval = null;

export function renderHostDisplayView(container, roomData, roomId, isTeacherControl = false) {
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

  // 타이머 실행 (PLAYING 상태일 때만)
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
        if (isTeacherControl) {
          processQuestionResults(roomId, roomData);
        }
      }
    }, 500);
  } else {
    if (timerInterval) clearInterval(timerInterval);
  }

  // 교사 버튼 이벤트
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
    const counts = options.map((_, idx) => {
      return Object.values(responses).filter(r => Number(r.answer) === idx).length;
    });

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
        ${showAnswer ? `
          <h2 style="font-size: 2.2rem; color: #10b981; margin-bottom: 20px;">💡 정답: ${escapeHtml(currentQ.correctText)}</h2>
        ` : `<h2 style="font-size: 1.8rem; color: #94a3b8;">학생들이 단답형 답안을 입력하는 중입니다...</h2>`}
        <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; justify-content: center;">
          ${Object.values(responses).map(r => `
            <div class="student-tag" style="font-size: 1.1rem; background: #1e293b;">
              ${escapeHtml(r.answer)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (currentQ.type === 'wordcloud') {
    return `
      <div class="wordcloud-container">
        ${Object.values(responses).map(r => `
          <div class="word-chip">${escapeHtml(r.answer)}</div>
        `).join('')}
      </div>
    `;
  } else if (currentQ.type === 'postit') {
    return `
      <div class="postit-container">
        ${Object.values(responses).map(r => `
          <div class="postit-card">${escapeHtml(r.answer)}</div>
        `).join('')}
      </div>
    `;
  }
  return '';
}

// 리더보드 순위표 렌더링
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

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    exportResultsToCSV(roomData);
  });

  document.getElementById('btn-restart-app')?.addEventListener('click', () => {
    window.location.search = '';
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
