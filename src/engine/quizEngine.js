import { updateRoomMeta, updateParticipantScores } from './firebase.js';

// 카훗 스타일 스피드 점수 계산 유틸리티
export function calculateScore(timeLimitSeconds, elapsedSeconds) {
  const basePoints = 1000;
  if (timeLimitSeconds <= 0) return basePoints;
  
  const speedRatio = Math.max(0, (timeLimitSeconds - elapsedSeconds) / timeLimitSeconds);
  const speedBonus = Math.round(speedRatio * 1000);
  return basePoints + speedBonus;
}

// 다음 퀴즈 문제로 이동
export async function advanceToNextQuestion(roomId, roomData) {
  const currentIndex = roomData.meta.currentQuestionIndex || 0;
  const questions = roomData.questions || [];
  
  if (currentIndex + 1 < questions.length) {
    await updateRoomMeta(roomId, {
      status: 'PLAYING',
      currentQuestionIndex: currentIndex + 1,
      timerStartedAt: Date.now()
    });
  } else {
    // 최종 퀴즈 종료
    await updateRoomMeta(roomId, {
      status: 'FINISHED'
    });
  }
}

// 퀴즈 문제 결과 채점 및 점수 동기화
export async function processQuestionResults(roomId, roomData) {
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
        const earned = calculateScore(question.timeLimit || 20, elapsedSec);
        updatedScores[sid] = (updatedScores[sid] || 0) + earned;
      }
    });

    await updateParticipantScores(roomId, updatedScores);
  }

  // 상태를 결과 공개로 변경
  await updateRoomMeta(roomId, {
    status: 'SHOW_ANSWER'
  });
}

// 퀴즈 결과 CSV 다운로드
export function exportResultsToCSV(roomData) {
  const participants = roomData.participants || {};
  const questions = roomData.questions || [];
  const responses = roomData.responses || {};

  let csvContent = '\uFEFF닉네임,총점수';
  questions.forEach((q, idx) => {
    csvContent += `,Q${idx + 1} (${q.question.substring(0, 10)}...)`;
  });
  csvContent += '\n';

  Object.keys(participants).forEach(sid => {
    const p = participants[sid];
    let row = `"${p.nickname}",${p.score || 0}`;

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
