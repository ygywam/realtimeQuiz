import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, get } from 'firebase/database';
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
  if (config && config.apiKey && config.databaseURL) {
    try {
      const app = initializeApp(config);
      db = getDatabase(app);
      state.isDemo = false;
      return true;
    } catch (err) {
      console.error('Firebase 초기화 실패, 데모 모드로 전환합니다:', err);
    }
  }
  
  state.isDemo = true;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel('class_quiz_channel');
  }
  return false;
}

export async function createRoom(roomId, initialData) {
  if (db) {
    const roomRef = ref(db, `rooms/${roomId}`);
    await set(roomRef, initialData);
  } else {
    localStorage.setItem(`demo_room_${roomId}`, JSON.stringify(initialData));
    broadcastChannel?.postMessage({ type: 'ROOM_UPDATED', roomId, data: initialData });
  }
}

export function subscribeRoom(roomId, callback) {
  if (db) {
    const roomRef = ref(db, `rooms/${roomId}`);
    return onValue(roomRef, (snapshot) => {
      const val = snapshot.val();
      callback(val);
    });
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
    const pRef = ref(db, `rooms/${roomId}/participants/${studentId}`);
    await set(pRef, {
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
    const metaRef = ref(db, `rooms/${roomId}/meta`);
    await update(metaRef, partialMeta);
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
    const qRef = ref(db, `rooms/${roomId}/questions`);
    await set(qRef, questions);
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
    const rRef = ref(db, `rooms/${roomId}/responses/${qIndex}/${studentId}`);
    await set(rRef, {
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
    await update(ref(db), updates);
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
