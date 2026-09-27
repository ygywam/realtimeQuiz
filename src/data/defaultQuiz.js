const defaultQuestions = [
  {
    "id": "q1",
    "type": "ox",
    "question": "지구는 태양 주위를 공전한다.",
    "options": ["O (그렇다)", "X (아니다)"],
    "correctAnswer": 0,
    "timeLimit": 15,
    "explanation": "지구는 태양 주위를 약 365일에 걸쳐 1 바퀴씩 공전합니다."
  },
  {
    "id": "q2",
    "type": "choice",
    "question": "대한민국의 수도는 어디일까요?",
    "options": ["부산", "인천", "서울", "대구"],
    "correctAnswer": 2,
    "timeLimit": 15,
    "explanation": "대한민국의 수도는 서울특별시입니다."
  },
  {
    "id": "q3",
    "type": "short",
    "question": "식물이 빛을 받아 양분을 만드는 작용을 무엇이라고 할까요?",
    "correctText": "광합성",
    "timeLimit": 20,
    "explanation": "정답은 '광합성'입니다."
  },
  {
    "id": "q4",
    "type": "wordcloud",
    "question": "오늘 수업을 한 단어로 표현한다면?",
    "timeLimit": 25,
    "explanation": "자유롭게 의견을 적어보세요."
  },
  {
    "id": "q5",
    "type": "postit",
    "question": "환경 보호를 위해 우리가 실천할 수 있는 일은?",
    "timeLimit": 30,
    "explanation": "좋은 아이디어를 작성해 주세요."
  }
];

export default defaultQuestions;
