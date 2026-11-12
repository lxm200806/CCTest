export type MadeQuestion = { type: string; stem: string; options?: string[]; answer: string; points: number };

export function makeQuestions(subject: string, topic: string, count: number, hard: boolean): MadeQuestion[] {
  return Array.from({ length: count }, (_, index) => makeOne(subject, topic, index, hard || index >= Math.ceil(count * 0.7)));
}

function makeOne(subject: string, topic: string, index: number, hard: boolean): MadeQuestion {
  if (subject === "数学") return mathQuestion(topic, index, hard);
  if (subject === "语文") return chineseQuestion(topic, index, hard);
  if (subject === "英语") return englishQuestion(topic, index, hard);
  if (subject === "物理" || subject === "化学" || subject === "科学") return scienceQuestion(subject, topic, index, hard);
  return {
    type: "简答",
    points: hard ? 8 : 6,
    stem: `${subject}：围绕「${topic}」先写一条已知，再写一个还需要确认的问题。`,
    answer: "已知和问题要分开。问题应该能在下一节课里被回答。",
  };
}

function mathQuestion(topic: string, index: number, hard: boolean): MadeQuestion {
  const a = 2 + (index % 4);
  const b = 1 + (index % 3);
  const type = ["填空", "选择", "解答"][index % 3];
  if (type === "填空") {
    return { type, points: hard ? 6 : 4, stem: `「${topic}」中，结果随条件每增加 1 就增加 ${a}。当条件增加 ${b} 时，结果增加 ____。`, answer: String(a * b) };
  }
  if (type === "选择") {
    const correct = a + b;
    return {
      type,
      points: 4,
      stem: `关于「${topic}」，若两个相关量分别是 ${a} 和 ${b}，按「先相加再判断方向」，下列哪一个是这一步的结果？`,
      options: [`A. ${correct - 2}`, `B. ${correct}`, `C. ${correct + 3}`, `D. ${a * b + 5}`],
      answer: `B. ${correct}`,
    };
  }
  const x = 2 + index;
  return {
    type,
    points: hard ? 12 : 10,
    stem: `已知与「${topic}」有关的一次关系 y = ${a}x - ${b}。\n（1）写出 x = ${x} 时的 y；\n（2）说明 x 增大时 y 怎样变化。`,
    answer: `（1）${a * x - b}；（2）因为 ${a} > 0，y 随 x 增大而增大。`,
  };
}

function chineseQuestion(topic: string, index: number, hard: boolean): MadeQuestion {
  if (index % 2 === 0) {
    return { type: "填空", points: 4, stem: `他把「${topic}」写进日常，不求快，只求每一次都说得清。作者强调的是：____。`, answer: "说得清楚（依据句末）" };
  }
  return { type: "简答", points: hard ? 8 : 6, stem: `用不超过六十个字介绍「${topic}」，必须包含一个具体动作。`, answer: "评分看两点：有一个看得见的动作；没有空泛评价。" };
}

function englishQuestion(topic: string, index: number, hard: boolean): MadeQuestion {
  if (index % 2 === 0) {
    return {
      type: "选择",
      points: 4,
      stem: `Choose the best word for "${topic}".\nWe need one clear ____ before we decide.`,
      options: ["A. evidence", "B. weather", "C. kitchen", "D. ticket"],
      answer: "A. evidence",
    };
  }
  return { type: "简答", points: hard ? 8 : 6, stem: `Write 2 sentences about "${topic}". Use because in the second sentence.`, answer: "第一句给事实，第二句用 because 写原因。" };
}

function scienceQuestion(subject: string, topic: string, index: number, hard: boolean): MadeQuestion {
  const speed = 2 + index;
  const time = 3 + (index % 3);
  if (index % 2 === 0) {
    return { type: "填空", points: 4, stem: `${subject}：「${topic}」。速度 ${speed} m/s，运动 ${time} s，路程是 ____ m。`, answer: String(speed * time) };
  }
  return { type: "简答", points: hard ? 10 : 8, stem: `为「${topic}」写目的、操作、现象、结论四行。结论不要写还没测到的数字。`, answer: "四行都要有，结论不超出现象。" };
}
