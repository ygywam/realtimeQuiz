import defaultQuestions from '../data/defaultQuiz.js';
import { updateQuestions, updateRoomMeta } from '../engine/firebase.js';

export function renderTeacherAdminModal(roomId, currentQuestions, onSaveCallback) {
  let questions = currentQuestions && currentQuestions.length > 0 ? JSON.parse(JSON.stringify(currentQuestions)) : JSON.parse(JSON.stringify(defaultQuestions));

  const modalHtml = `
    <div id="admin-modal" class="modal-overlay">
      <div class="modal-box" style="max-width: 750px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>📝 퀴즈 출제 / 문항 관리</h2>
          <span style="color: var(--text-muted);">방 PIN: <strong>${roomId}</strong></span>
        </div>

        <div id="question-list-editor" style="margin-bottom: 20px; max-height: 50vh; overflow-y: auto;">
          <!-- 질문 목록 렌더링 -->
        </div>

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
      <div style="background: #0f172a; border: 1px solid var(--border); padding: 18px; border-radius: 12px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: 800; color: #38bdf8;">Q${idx + 1}. [${getQuestionTypeLabel(q.type)}]</span>
          <div style="display: flex; gap: 8px;">
            <select class="time-limit-select" data-idx="${idx}" style="padding: 4px 8px; border-radius: 6px;">
              <option value="10" ${q.timeLimit == 10 ? 'selected' : ''}>10초</option>
              <option value="15" ${q.timeLimit == 15 ? 'selected' : ''}>15초</option>
              <option value="20" ${q.timeLimit == 20 ? 'selected' : ''}>20초</option>
              <option value="30" ${q.timeLimit == 30 ? 'selected' : ''}>30초</option>
            </select>
            <button class="btn btn-danger btn-delete-q" data-idx="${idx}" style="padding: 4px 10px; font-size: 0.85rem;">삭제</button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 10px;">
          <input type="text" class="q-title-input" data-idx="${idx}" value="${escapeHtml(q.question)}" placeholder="질문 내용을 입력하세요">
        </div>

        ${renderTypeSpecificEditor(q, idx)}
      </div>
    `).join('');

    // 이벤트 바인딩
    container.querySelectorAll('.q-title-input').forEach(input => {
      input.addEventListener('change', (e) => {
        questions[e.target.dataset.idx].question = e.target.value;
      });
    });

    container.querySelectorAll('.time-limit-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        questions[e.target.dataset.idx].timeLimit = Number(e.target.value);
      });
    });

    container.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.dataset.idx);
        questions.splice(idx, 1);
        renderEditorList();
      });
    });
  }

  renderEditorList();

  // 문항 추가 버튼 이벤트
  document.getElementById('btn-add-ox').addEventListener('click', () => {
    questions.push({
      id: 'q_' + Date.now(),
      type: 'ox',
      question: '신규 O/X 질문입니다.',
      options: ['O (그렇다)', 'X (아니다)'],
      correctAnswer: 0,
      timeLimit: 15
    });
    renderEditorList();
  });

  document.getElementById('btn-add-choice').addEventListener('click', () => {
    questions.push({
      id: 'q_' + Date.now(),
      type: 'choice',
      question: '신규 4지선다 질문입니다.',
      options: ['보기 1', '보기 2', '보기 3', '보기 4'],
      correctAnswer: 0,
      timeLimit: 20
    });
    renderEditorList();
  });

  document.getElementById('btn-add-short').addEventListener('click', () => {
    questions.push({
      id: 'q_' + Date.now(),
      type: 'short',
      question: '신규 단답형 질문입니다.',
      correctText: '정답',
      timeLimit: 20
    });
    renderEditorList();
  });

  document.getElementById('btn-add-wordcloud').addEventListener('click', () => {
    questions.push({
      id: 'q_' + Date.now(),
      type: 'wordcloud',
      question: '신규 워드클라우드 질문입니다.',
      timeLimit: 25
    });
    renderEditorList();
  });

  document.getElementById('btn-add-postit').addEventListener('click', () => {
    questions.push({
      id: 'q_' + Date.now(),
      type: 'postit',
      question: '신규 포스트잇 질문입니다.',
      timeLimit: 30
    });
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
    case 'ox': return 'O/X 참거짓';
    case 'choice': return '4지선다';
    case 'short': return '단답형';
    case 'wordcloud': return '워드클라우드';
    case 'postit': return '포스트잇';
    default: return '퀴즈';
  }
}

function renderTypeSpecificEditor(q, idx) {
  if (q.type === 'ox' || q.type === 'choice') {
    return `
      <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 6px;">정답 선택:</div>
      <div style="display: flex; gap: 10px;">
        ${q.options.map((opt, optIdx) => `
          <label style="display: flex; align-items: center; gap: 4px; font-size: 0.9rem; cursor: pointer;">
            <input type="radio" name="correct_${idx}" value="${optIdx}" ${q.correctAnswer == optIdx ? 'checked' : ''} onchange="window._setCorrectAnswer(${idx}, ${optIdx})">
            ${opt}
          </label>
        `).join('')}
      </div>
    `;
  } else if (q.type === 'short') {
    return `
      <div class="form-group">
        <label>단답형 정답 (텍스트):</label>
        <input type="text" value="${escapeHtml(q.correctText || '')}" onchange="window._setCorrectText(${idx}, this.value)">
      </div>
    `;
  }
  return '';
}

window._setCorrectAnswer = (qIdx, optIdx) => {};
window._setCorrectText = (qIdx, text) => {};
function escapeHtml(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
