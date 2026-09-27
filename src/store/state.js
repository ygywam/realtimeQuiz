// 전역 상태 관리 모듈

export const state = {
  mode: 'home', // 'home' | 'admin' | 'display' | 'student'
  roomId: null,
  role: null, // 'teacher' | 'display' | 'student'
  nickname: '',
  studentId: '',
  roomData: null,
  isDemo: false
};

// 학생 고유 ID 생성 또는 복구 (새로고침 시 재진입 지원)
export function getOrCreateStudentId() {
  let id = sessionStorage.getItem('class_quiz_student_id');
  if (!id) {
    id = 'std_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('class_quiz_student_id', id);
  }
  state.studentId = id;
  return id;
}

// 6자리 핀 코드(방 ID) 생성
export function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
