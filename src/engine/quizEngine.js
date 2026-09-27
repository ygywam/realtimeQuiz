import { updateRoomMeta, updateParticipantScores } from './firebase.js';

export function calculateScore(timeLimitSeconds, elapsedSeconds, isDoublePoints = false) {
  const basePoints = 1000;
  if (timeLimitSeconds <= 0) return basePoints * (isDoublePoints ? 2 : 1);
  
  const speedRatio = Math.max(0, (timeLimitSeconds - elapsedSeconds) / timeLimitSeconds);
  const speedBonus = Math.round(speedRatio * 1000);
  const total = basePoints + speedBonus;
  return isDoublePoints ? total * 2 : total;
}

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
    await updateRoomMeta(roomId, {
      status: 'FINISHED'
    });
  }
}

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
        const earned = calculateScore(question.timeLimit || 20, elapsedSec, question.isDoublePoints);
        updatedScores[sid] = (updatedScores[sid] || 0) + earned;
      }
    });

    await updateParticipantScores(roomId, updatedScores);
  }

  await updateRoomMeta(roomId, {
    status: 'SHOW_ANSWER'
  });
}

export function exportResultsToCSV(roomData) {
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
