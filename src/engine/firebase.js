import { state } from '../store/state.js';

let db = null;
let broadcastChannel = null;

export function getSavedFirebaseConfig() {
  const saved = localStorage.getItem('class_quiz_fb_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem('class_quiz_fb_config', JSON.stringify(config));
}

export function initRealtimeEngine() {
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
      console.error('Firebase 초기화 실패, 데모 모드로 전환합니다:', err);
    }
  }
  
  state.isDemo = true;
  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('class_quiz_channel');
  }
  return false;
}

export async function createRoom(roomId, initialData) {
  if (db) {
    await db.ref(`rooms/${roomId}`).set(initialData);
  } else {
    localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(initialData));
    broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: initialData });
  }
}

export function subscribeRoom(roomId, callback) {
  if (db) {
    const roomRef = db.ref(`rooms/${roomId}`);
    const handler = (snapshot) => {
      const val = snapshot.val();
      callback(val);
    };
    roomRef.on('value', handler);
    return () => roomRef.off('value', handler);
  } else {
    const check = () => {
      const raw = localStorage.getItem(`demo_room_${roomId}`);
      if (raw) {
        callback(JSON.parse(raw));
      }
    };
    check();
    
    const handler = (e) => {
      if (e.data.roomId === roomId) {
        check();
      }
    };
    broadcastChannel?.addEventListener('message', handler);
    return () => broadcastChannel?.removeEventListener('message', handler);
  }
}

export async function joinParticipant(roomId, studentId, nickname, avatar = '🐶') {
  if (db) {
    await db.ref(`rooms/${roomId}/participants/${studentId}`).set({
      nickname,
      avatar,
      joinedAt: Date.now(),
      score: 0
    });
  } else {
    const raw = localStorage.getItem(`demo_room_${roomId}`);
    if (raw) {
      const room = JSON.parse(raw);
      if (!room.participants) room.participants = {};
      room.participants[studentId] = {
        nickname,
        avatar,
        joinedAt: Date.now(),
        score: 0
      };
      localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
      broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
    }
  }
}

export async function updateRoomMeta(roomId, partialMeta) {
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

export async function updateQuestions(roomId, questions) {
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

export async function submitResponse(roomId, qIndex, studentId, responseData) {
  if (db) {
    await db.ref(`rooms/${roomId}/responses/${qIndex}/${studentId}`).set({
      ...responseData,
      submittedAt: Date.now()
    });
  } else {
    const raw = localStorage.getItem(`demo_room_${roomId}`);
    if (raw) {
      const room = JSON.parse(raw);
      if (!room.responses) room.responses = {};
      if (!room.responses[qIndex]) room.responses[qIndex] = {};
      room.responses[qIndex][studentId] = {
        ...responseData,
        submittedAt: Date.now()
      };
      localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
      broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
    }
  }
}

export async function updateParticipantScores(roomId, scoresMap) {
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
          if (room.participants[sid]) {
            room.participants[sid].score = scoresMap[sid];
          }
        });
      }
      localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(room));
      broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: room });
    }
  }
}
