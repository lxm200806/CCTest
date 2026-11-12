import { makeQuestions } from "@/lib/ai/subjects";
import {
  bandOf,
  clip,
  compareSvg,
  demoScore,
  esc,
  flowSvg,
  graphSvg,
  guessKind,
  methodLine,
  num,
  parseLinear,
  resolveFunctionGraph,
  section,
  timelineSvg,
  treeSvg,
  unsupportedGraphSvg,
  val,
  voice,
} from "@/lib/ai/shared";
import { trimNum } from "@/lib/ai/formula";
import type { ToolResult } from "@/lib/types";

const handlers: Record<string, (input: Record<string, string>) => ToolResult> = {
  "ai-lesson": lesson,
  "ai-prep": prep,
  "ai-handout": handout,
  "ai-teaching-aid": teachingAid,
  "ai-preview": preview,
  "ai-ppt": ppt,
  "ai-visualize": visualize,
  "ai-explain": explain,
  "ai-paper": paper,
  "ai-grade": grade,
  "ai-variant": variant,
  "ai-word": word,
  "ai-extend": extend,
  "ai-analysis": analysis,
  "ai-score-plan": scorePlan,
};

export function mockGenerate(toolId: string, input: Record<string, string>) {
  const handler = handlers[toolId];
  if (!handler) throw new Error("未知工具");
  return handler(input);
}

function lesson(input: Record<string, string>): ToolResult {
  const grade = val(input, "grade", "初二");
  const subject = val(input, "subject", "数学");
  const topic = val(input, "topic", "本节课题");
  const total = Number(val(input, "duration", "40")) || 40;
  const style = val(input, "style", "讲解型");
  const who = voice(grade);
  const primary = who.band === "primary";
  const names = ["导入", "探究", "例题", "练习", "收束"];
  const ratios = [0.1, 0.25, 0.3, 0.25, 0.1];
  let cursor = 0;
  const rows = names.map((name, index) => {
    const length = Math.max(2, Math.round(total * ratios[index]));
    const start = cursor;
    cursor += length;
    const end = index === names.length - 1 ? total : Math.min(total, cursor);
    return [name, `${start}–${end} 分钟`, styleCue(style, topic, index)];
  });
  return {
    title: `${topic} · ${total} 分钟课堂脚本`,
    subtitle: `${grade} ${subject} · ${style}`,
    summary: `这是一份给${who.adult}或教师拿着讲的草稿。${who.learner}不需要看到全部脚本，只在检查题时开口。`,
    sections: [
      section("这一节只完成一件事", [`课题是「${topic}」。下课前，${who.learner}要能${who.check}。`]),
      section("时间怎么切", [], { table: { headers: ["段落", "时间", "这一段做什么"], rows } }),
      section("教师口述", primary
        ? [`可以这样说：「今天只看${topic}。」`, `然后问：「你用一句话怎么说？」`]
        : [
            `导入可以这样开口：「今天只看${topic}。先别翻到后面的题。」`,
            `例题讲完停一次，问${who.learner}：「这一步用到的条件是哪一句？」`,
            `收束时只留一句：${methodLine(subject, topic)}`,
          ]),
      section("板书", [], { bullets: [`左上：课题「${topic}」`, "中间：一道完整例题", "右侧：一个易错", "最下：检查题的空"] }),
      section("检查题", [primary ? `用一句话说「${topic}」。` : `不看笔记，用两句话解释「${topic}」。做对才算过关。`]),
    ],
  };
}

function styleCue(style: string, topic: string, index: number) {
  const banks: Record<string, string[]> = {
    探究型: [`先给一个和「${topic}」矛盾的小例子`, "先猜，再对照例子修正", "例题只示范怎么把猜测写成步骤", "练习保留一个开放条件", "用自己的话总结"],
    复习型: ["两道诊断，看出卡在哪一步", "只展开错得多的那一步", "例题用来对照", "练习与诊断同结构", "写下明天还要再看的一句"],
  };
  const fallback = [`用一个生活句子引出「${topic}」`, "连续讲，中间停一次复述", "例题写全步骤", "练习限时，中途不对答案", "用一句话收束"];
  return (banks[style] ?? fallback)[index];
}

function prep(input: Record<string, string>): ToolResult {
  const grade = val(input, "grade");
  const subject = val(input, "subject");
  const topic = val(input, "topic");
  const textbook = val(input, "textbook", "通用");
  const lessonType = val(input, "lessonType", "新授");
  const who = voice(grade);
  return {
    title: `${topic}备课纸条`,
    subtitle: `${grade} ${subject} · ${textbook} · ${lessonType}`,
    summary: `备课纸条给上课的人看。${textbook}只用来对齐用语，例题数字可以按班里的练习册改。`,
    sections: [
      section("目标", [], { bullets: [`知识：能说出「${topic}」的条件和结论`, `过程：${who.learner}先写步骤再写结论`, "做完一题再对答案"] }),
      section("重难点", [`重点是讲到${who.learner}能复述。`, lessonType === "复习" ? "难点是把重复出现的错因收成一条。" : "难点是条件没用完就开始算。"]),
      section("四十分钟", [], {
        table: {
          headers: ["时间", "活动", "谁"],
          rows: [
            ["0–5", "写出今天的完成线", who.adult],
            ["5–15", lessonType === "讲评" ? "看两道典型错题" : `讲解「${topic}」的结构`, "教师"],
            ["15–28", "一道例题，逐步停顿", who.learner],
            ["28–36", "限时两题", who.learner],
            ["36–40", "只订正一个错因", "一起"],
          ],
        },
      }),
      section("分层", [`需要支架的${who.learner}：例题保留第一步提示。`, "学有余力的：只改例题的一个条件，看结论变不变。"]),
    ],
  };
}

function handout(input: Record<string, string>): ToolResult {
  const subject = val(input, "subject");
  const topic = val(input, "topic");
  const depth = val(input, "depth", "基础");
  const primary = bandOf(val(input, "grade")) === "primary";
  const math = subject === "数学";
  return {
    title: `${topic}讲义`,
    subtitle: `${val(input, "grade")} ${subject} · ${depth}`,
    summary: "答案放在最后，打印时可以先裁掉。",
    sections: [
      section("概念卡", [`「${topic}」要先回答：它是什么，依赖什么条件，不能用在哪里。`, methodLine(subject, topic)]),
      section("例题", [math ? (primary ? `「${topic}」用 3 加 2。3 加 2 是 5。` : `y = 2x - 4 当作「${topic}」的例子。x = 2 时 y = 0。k 为正，x 增大则 y 增大。`) : `介绍「${topic}」时先引用一句具体的话，再说明它限定了什么。`]),
      section("常见错法", [], { bullets: math ? (primary ? ["把加号看成减号", "数漏了一个", "得数没有写单位"] : ["把负号当成绝对值", "条件没用完就计算", "坐标不说明哪一个是 x"]) : ["概括比原文更宽", "只写感觉，不指原文", "漏掉题干里的限定词"] }),
      section("练习", [`1. 用一句话写出「${topic}」的条件。`, "2. 改一个数字或一个词，说明结论变了没有。", math ? (primary ? "3. 4 加 3 是多少？" : "3. 计算 y = 2x - 4 在 x = 5 时的值。") : "3. 举一个不能使用的情形。"]),
      section("参考答案", ["1. 要写条件，不写评价。", "2. 改了关键条件，结论要重写。", math ? (primary ? "3. 7。" : "3. y = 2×5 - 4 = 6。") : "3. 只要情形确实缺了条件即可。"]),
    ],
  };
}

function teachingAid(input: Record<string, string>): ToolResult {
  const chapter = val(input, "chapter");
  const pages = Number(val(input, "pages", "2")) || 2;
  const answers = val(input, "answers", "答案另附");
  const rows = [
    ["第 1 页", "知识页", `「${chapter}」三行：是什么、看什么、不做什么`],
    ["第 2 页", "练习页", "4 道题，旁边留订正栏"],
    ["第 3 页", "变式页", "只改一个条件"],
    ["第 4 页", "家长页", "今晚只问哪一句"],
  ].slice(0, pages);
  return {
    title: `${chapter}教辅`,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${pages} 页 · ${answers}`,
    summary: answers === "答案另附" ? "学生页不印答案。答案在最后一节。" : "答案印在题下，适合带着订正，不适合限时独立做。",
    sections: [
      section("分页", [], { table: { headers: ["页", "作用", "内容"], rows } }),
      ...(pages === 1 ? [] : [section("练习", ["每题右侧留一厘米写错因词。", "做题时间建议 12 分钟。"])]),
      section(answers === "答案另附" ? "另附答案" : "页内答案", ["对答案时盖住这一节。错了只重写错的那一步。"]),
    ],
  };
}

function preview(input: Record<string, string>): ToolResult {
  const topic = val(input, "topic");
  const minutes = val(input, "minutes", "10");
  const primary = bandOf(val(input, "grade")) === "primary";
  return {
    title: `${topic}预习单`,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${minutes} 分钟`,
    summary: primary ? "这张单子由家长读。孩子只用手指和一句回答。" : `计时 ${minutes} 分钟，到点就停。`,
    sections: [
      section("要先知道的三件事", [], { bullets: [`「${topic}」讨论的对象`, "哪个符号或词会改变结果", "有一个暂时说不清的地方"] }),
      section("三个自测", [`1. 不看书写出「${topic}」。`, "2. 指出一个认识但不知道为什么出现的词。", "3. 猜明天会被问到的一个问题。"]),
      section("带到课堂上的一句", ["我还不知道：____________。"]),
    ],
  };
}

function ppt(input: Record<string, string>): ToolResult {
  const topic = val(input, "topic");
  const count = Number(val(input, "slides", "8")) || 8;
  const audience = val(input, "audience", "学生");
  const bank = [
    { kicker: "封面", title: topic, bullets: [val(input, "subject"), "今天只处理这一件事"], notes: "停三秒，让听众读完标题。" },
    { kicker: "目标", title: "结束时能做什么", bullets: [`用自己的话说清「${topic}」`, "独立完成一道同结构的题"], notes: "不要增加第二目标。" },
    { kicker: "概念", title: "只记三行", bullets: ["它是什么", "眼睛先落在哪", "不能用在哪"], notes: methodLine(val(input, "subject"), topic) },
    { kicker: "例题", title: "一起写一道", bullets: ["先抄条件", "再写因为", "结论单独一行"], notes: "写到一半停下来提问。" },
    { kicker: "易错", title: "最容易跳过的一步", bullets: ["符号", "条件没用完", "单位"], notes: "只展开第一条。" },
    { kicker: "练习", title: "限时，不对答案", bullets: ["题量少到能写完", "时间到就停"], notes: "自己不要提前念答案。" },
    { kicker: "收束", title: "带走一句", bullets: [methodLine(val(input, "subject"), topic)], notes: "收束不布置新章节。" },
    { kicker: "家长", title: "回家看哪两行", bullets: ["错因是哪一类", "明天的第一步"], notes: audience === "家长会" ? "这里多停一会儿。" : "学生课可以快翻。" },
    { kicker: "变式", title: "只改一个条件", bullets: ["数字", "情境", "问法"], notes: "让听众猜结论变不变。" },
    { kicker: "读图", title: "图怎么读", bullets: ["先找起点", "再看方向", "最后读数字"], notes: "配可视化的那张图。" },
    { kicker: "超时", title: "超时就砍什么", bullets: ["砍最后一题", "不砍收束"], notes: "把这句话念出来。" },
    { kicker: "分工", title: "谁来操作", bullets: ["学生写", "大人看完成线"], notes: "一个晚上不超过两个工具。" },
    { kicker: "检查", title: "怎样算过关", bullets: ["能复述", "能做对一道", "能说出一个错因"], notes: "三条里做到两条就可以停。" },
    { kicker: "对照", title: "如果是讲评", bullets: ["先看错因分布", "再讲一道代表题"], notes: "不要逐题念。" },
    { kicker: "结尾", title: "下次从这里开始", bullets: [`仍是「${topic}」`, "打开打卡把今天勾上"], notes: "结束。" },
    { kicker: "备用", title: "还剩时间", bullets: ["把例题的一个数字改掉", "问结论变不变"], notes: "不新开话题。" },
  ];
  return {
    title: topic,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${count} 页 · 给${audience}`,
    summary: "每一页只留三行。讲者备注写开口时要停顿的地方。",
    sections: [section("使用方式", [`共 ${Math.min(count, bank.length)} 页。下载 HTML 可以在浏览器里看，也可以打印成讲稿。`])],
    slides: bank.slice(0, count),
  };
}

function visualize(input: Record<string, string>): ToolResult {
  const concept = val(input, "concept");
  const visual = val(input, "visual", "流程图");
  const verdict = resolveFunctionGraph(concept);
  const falling = verdict.status === "exact" ? verdict.fn.k < 0 : false;
  let diagram: string;
  let reading: string;
  if (visual === "函数图像") {
    if (verdict.status === "exact") {
      const { k, b } = verdict.fn;
      const root = k === 0 ? null : -b / k;
      diagram = graphSvg(concept, verdict.fn);
      reading = `这条直线是 ${verdict.expression}。斜率 k = ${trimNum(k)}，与 y 轴交于 (0, ${trimNum(b)})。${k > 0 ? "x 增大时 y 增大。" : k < 0 ? "x 增大时 y 减小。" : "这是一条水平线。"}`;
      if (root !== null) reading += `与 x 轴交于 (${trimNum(root)}, 0)。`;
    } else {
      diagram = unsupportedGraphSvg(concept, verdict.reason);
      reading = verdict.reason;
    }
  } else if (visual === "对比表") {
    diagram = compareSvg(concept, "先看", "再判断", [
      ["方向", falling ? "向右下" : "先看解析式里的 k", "没有具体解析式就不要猜方向"],
      ["条件", "写在图旁边", "没用到的条件画圈"],
      ["结论", "用一句话", "不写第二层推论"],
    ]);
    reading = "按标注的顺序读，一次只停一处。";
  } else if (visual === "结构图") {
    diagram = treeSvg(concept, ["定义", "例子", "易错", "练习"]);
    reading = "按标注的顺序读，一次只停一处。";
  } else if (visual === "时间线") {
    diagram = timelineSvg(concept, ["条件", "过程", "现象", "结论"]);
    reading = "按标注的顺序读，一次只停一处。";
  } else {
    diagram = flowSvg(concept, ["看条件", "找关系", "写一步", "说结论"]);
    reading = "按标注的顺序读，一次只停一处。";
  }
  return {
    title: concept,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${visual}`,
    summary: visual === "函数图像" && verdict.status !== "exact" ? "这张图没有把概念画成一条确定的直线。" : "先看图的阅读顺序，再看字。坐标按解析式计算，措辞可以按课本改。",
    diagramSvg: diagram,
    sections: [
      section("怎么读这张图", [reading]),
      section("讲的时候停在哪", [methodLine(val(input, "subject"), concept)]),
    ],
  };
}

function explain(input: Record<string, string>): ToolResult {
  const subject = val(input, "subject");
  const question = val(input, "question");
  const draft = val(input, "draft");
  const linear = subject === "数学" ? parseLinear(question) : null;
  const sections: ToolResult["sections"] = [
    section("审题卡", [], {
      table: {
        headers: ["看什么", "从题目里拿到的"],
        rows: [
          ["问句", String((question.match(/[？?]/g) ?? []).length || 1)],
          ["数字", (question.match(/-?\d+(\.\d+)?/g) ?? []).slice(0, 8).join("、") || "没有明显数字"],
          ["方法", methodLine(subject, clip(question, 18))],
        ],
      },
    }),
  ];
  if (linear) {
    const root = -linear.b / linear.k;
    sections.push(
      section("这是一次函数，可以算到底", [
        `解析式 y = ${linear.k}x ${linear.b >= 0 ? "+" : "-"} ${Math.abs(linear.b)}。`,
        `与 y 轴交点是 (0, ${linear.b})。纵坐标就是 b，不取绝对值。`,
        `令 y = 0，x = ${Number.isInteger(root) ? root : root.toFixed(2)}。`,
        linear.k > 0 ? "k 为正，x 增大时 y 增大。" : "k 为负，x 增大时 y 减小。",
      ]),
    );
  } else {
    sections.push(section("分步", ["圈出问句和限制词。", `把条件逐条抄下来。题目开头是：「${clip(question, 48)}」`, "结论单独成行。没有可核验的公式时，不编造一个精确得数。"]));
  }
  sections.push(section("得分点", [], { bullets: ["条件没有遗漏", "关键步骤单独成行", "结论回答的是题干的问句"] }));
  if (draft) sections.push(section("对照草稿", [`草稿摘要：${clip(draft, 80)}`, /不确定/.test(draft) ? "草稿写了不确定。把那一问单独再写三行。" : "缺哪一行就补哪一行。"]));
  return {
    title: "讲题稿",
    subtitle: `${val(input, "grade")} ${subject}`,
    summary: linear ? "这道题能识别成一次函数，交点和增减性是算出来的。" : "没有套进可核验的公式，讲稿只拆步骤。",
    sections,
  };
}

function paper(input: Record<string, string>): ToolResult {
  const subject = val(input, "subject");
  const scope = val(input, "scope");
  const count = Number(val(input, "count", "6")) || 6;
  const difficulty = val(input, "difficulty", "基础为主");
  const questions = scalePoints(makeQuestions(subject, scope, count, difficulty !== "基础为主", val(input, "grade")));
  const total = questions.reduce((sum, item) => sum + item.points, 0);
  return {
    title: scope,
    subtitle: `${val(input, "grade")} ${subject} · ${count} 题 · ${val(input, "minutes", "20")} 分钟 · 约 ${total} 分`,
    summary: `${difficulty}。先做卷，再翻到参考答案。`,
    sections: [
      section("试题", questions.map((item, index) => `${index + 1}.（${item.points} 分，${item.type}）${item.stem}${item.options ? `\n${item.options.join("  ")}` : ""}`)),
      section("参考答案", questions.map((item, index) => `${index + 1}. ${item.answer}`)),
    ],
  };
}

function grade(input: Record<string, string>): ToolResult {
  const prompt = val(input, "prompt");
  const answer = val(input, "answer");
  let score = demoScore(answer);
  const notes: string[] = [];
  if (/\(0,\s*4\)|（0，\s*4）|（0,4）/.test(answer) && /2x-4|2x\s*-\s*4/.test(`${prompt}\n${answer}`)) {
    notes.push("纵截距写成了 (0, 4)。y = 2x - 4 与 y 轴的交点是 (0, -4)，不取绝对值。");
    score = Math.min(score, 74);
  }
  if (/x\s*=\s*2/.test(answer)) notes.push("令 y = 0 得到 x = 2，这一步是对的。");
  if (!notes.length) notes.push(`从作答里能看到：「${clip(answer, 42)}」。分数只看文字里有没有把理由写出来。`);
  const fileName = val(input, "attachment");
  if (fileName) notes.push(`附件 ${fileName} 只作记录。图片不识别画面。`);
  const kind = notes.some((note) => note.includes("纵截距")) ? "计算" : guessKind(answer);
  return {
    title: "作业批改",
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · 文字评分 ${score}/100`,
    summary: "这不是阅卷扫描。分数依据文字是否把理由写出来。",
    sections: [
      section("对照要求", [`题目要求：${clip(prompt, 120)}`, `作答摘要：${clip(answer, 120)}`]),
      section("批注", notes),
      section("只归一个错因", [`本次归为「${kind}」。`]),
      section("改写示例", [kind === "计算" ? "交点是 (0, -4)。因为与 y 轴交于 (0, b)，这里 b = -4。" : `先重写问句，再写因为。要求的核心是：「${clip(prompt, 40)}」`]),
    ],
  };
}

function variant(input: Record<string, string>): ToolResult {
  const count = Number(val(input, "count", "3")) || 3;
  const lever = val(input, "lever", "数字");
  const items = Array.from({ length: count }, (_, index) => {
    const fee = 20 + (index + 1) * 5;
    const per = 0.2 + index * 0.05;
    const used = 30 + index * 10;
    const cost = fee + per * used;
    if (lever === "情境") return { changed: "情境从话费换成骑行", stem: `会员月费 ${fee} 元，之后每分钟 ${per.toFixed(2)} 元。骑了 ${used} 分钟，费用是多少？`, answer: `${cost.toFixed(2)} 元。` };
    if (lever === "条件") return { changed: "增加费用上限", stem: `月费 ${fee} 元，每分钟 ${per.toFixed(2)} 元，费用不超过 ${Math.ceil(cost + 10)} 元。使用 ${used} 分钟实际收费多少？`, answer: `按公式 ${cost.toFixed(2)} 元，未超过上限。` };
    if (lever === "问法") return { changed: "改求分钟数", stem: `月费 ${fee} 元，每分钟 ${per.toFixed(2)} 元。费用是 ${(fee + per * 20).toFixed(2)} 元，用了多少分钟？`, answer: "20 分钟。先减月费，再除以单价。" };
    return { changed: "只改数字", stem: `月费 ${fee} 元，每分钟 ${per.toFixed(2)} 元。使用 ${used} 分钟，y 是多少？`, answer: `y = ${cost.toFixed(2)}。` };
  });
  return {
    title: "变式题",
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · 改「${lever}」`,
    summary: "原题若是固定费用加单价的模型，下面的数字是算出来的。",
    sections: [
      section("原题要保住的方法", [clip(val(input, "original"), 180), "不变量：先找固定部分和随数量变化的部分。"]),
      ...items.map((item, index) => section(`变式 ${index + 1}`, [item.stem, `答案：${item.answer}`], { bullets: [`改了什么：${item.changed}`] })),
    ],
  };
}

function word(input: Record<string, string>): ToolResult {
  const title = val(input, "title");
  const layout = val(input, "layout", "单栏");
  const paragraphs = val(input, "source")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${esc(line)}</p>`)
    .join("");
  return {
    title,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${val(input, "docType")} · ${layout}`,
    summary: "版面用的是你贴上的正文。可以下载 DOCX，也可以下载 HTML 后用浏览器打印。公式按普通文字保存。",
    docHtml: `<article class="study-sheet"><p class="meta">${esc(val(input, "grade"))} · ${esc(val(input, "subject"))} · ${esc(val(input, "docType"))}</p><h1>${esc(title)}</h1><div class="${layout === "双栏" ? "columns-2" : ""}">${paragraphs}</div><p class="foot">学习工作台 · 本地草稿 · 可打印</p></article>`,
    sections: [section("排版说明", [layout === "双栏" ? "双栏适合短条目。打印前看有没有一段被拦腰截断。" : "单栏适合连续阅读。"])],
  };
}

function extend(input: Record<string, string>): ToolResult {
  const subject = val(input, "subject");
  const primary = bandOf(val(input, "grade")) === "primary";
  const math = subject === "数学" && !primary;
  const kind = guessKind(`${val(input, "reason")}\n${val(input, "wrong")}`);
  return {
    title: "举一反三",
    subtitle: `${val(input, "grade")} ${subject} · 错因：${kind}`,
    summary: "三道题递进。做对第一道再做第二道。",
    sections: [
      section("错因卡片", [clip(val(input, "wrong"), 160), `当时的错法：${val(input, "reason")}`, `归类用「${kind}」。`]),
      section("第一道 · 同构", [math ? "y = 3x - 5 与 y 轴的交点是多少？" : primary && subject === "数学" ? "3 加 2 是多少？" : "用和原题相同的问法，只换一个无关的名词。", math ? "答案：(0, -5)。" : primary && subject === "数学" ? "答案：5。" : "方法与原题相同。"]),
      section("第二道 · 变条件", [math ? "y = -2x + 6 的图像向哪边倾斜？" : primary && subject === "数学" ? "5 加 1 是多少？" : "把一个关键条件改成相反。", math ? "答案：向右下，因为 k 为负。" : primary && subject === "数学" ? "答案：6。" : "要指出结论哪里跟着变。"]),
      section("第三道 · 综合", [math ? "直线过 (0, -4)，x 增加 1 时 y 增加 2。写出解析式，并求 y = 0 时的 x。" : primary && subject === "数学" ? "小明有 4 个，又得到 3 个。一共有多少个？" : "把前两道的方法放进一个更长的问句。", math ? "答案：y = 2x - 4，x = 2。" : primary && subject === "数学" ? "答案：7 个。" : "评分看步骤是否还在。"]),
    ],
  };
}

function scalePoints<T extends { points: number }>(questions: T[]) {
  const sum = questions.reduce((total, item) => total + item.points, 0);
  if (!questions.length || sum === 100) return questions;
  const scaled = questions.map((item) => ({ ...item, points: Math.max(1, Math.round((item.points * 100) / sum)) }));
  const drift = 100 - scaled.reduce((total, item) => total + item.points, 0);
  scaled[scaled.length - 1].points = Math.max(1, scaled[scaled.length - 1].points + drift);
  const rest = 100 - scaled.slice(1).reduce((total, item) => total + item.points, 0);
  scaled[0].points = Math.max(1, rest);
  return scaled;
}

function analysis(input: Record<string, string>): ToolResult {
  const score = num(val(input, "score"), 0);
  const total = num(val(input, "total"), 100);
  const items = val(input, "wrongs")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length >= 3) return { no: parts[0], point: parts[1], kind: normalizeKind(parts[2]) };
      return { no: String(index + 1), point: clip(line, 18), kind: guessKind(line) };
    });
  const kinds = ["知识", "审题", "计算", "时间", "规范"];
  const counts = kinds.map((kind) => [kind, String(items.filter((item) => item.kind === kind).length)]);
  const top = [...counts].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const rate = total > 0 ? Math.round((score / total) * 100) : 0;
  return {
    title: `${val(input, "paper")}分析`,
    subtitle: `${val(input, "grade")} ${val(input, "subject")} · ${score}/${total} · ${val(input, "usedMinutes")} 分钟`,
    summary: score > total ? "得分高于满分，先核对是不是把两列填反了。" : `得分率约 ${rate}%。先处理出现次数最多的错因。`,
    sections: [
      section("错题", [], { table: { headers: ["题号", "知识点", "错因"], rows: items.map((item) => [item.no, item.point, item.kind]) } }),
      section("错因分布", [], { table: { headers: ["错因", "条数"], rows: counts } }),
      section("明天的一步", [`用举一反三处理「${top?.[0] ?? "审题"}」，限时 15 分钟。`]),
    ],
  };
}

function normalizeKind(kind: string) {
  if (kind.includes("知识")) return "知识";
  if (kind.includes("审")) return "审题";
  if (kind.includes("算") || kind.includes("计算")) return "计算";
  if (kind.includes("时")) return "时间";
  if (kind.includes("范") || kind.includes("格式")) return "规范";
  return guessKind(kind);
}

function scorePlan(input: Record<string, string>): ToolResult {
  const recent = num(val(input, "recent"), 0);
  const target = num(val(input, "target"), 0);
  const weeks = Number(val(input, "weeks", "4")) || 4;
  const weaks = val(input, "weak").split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 3);
  const gap = target - recent;
  const perWeek = weeks > 0 ? gap / weeks : gap;
  const caution = gap < 0 ? "目标低于最近一次分数。若是想稳住，不要按提分来加题。" : perWeek > 8 ? `平均每周要提高 ${perWeek.toFixed(1)} 分，建议先把目标改近一点。` : `缺口 ${gap} 分，大约每周 ${perWeek.toFixed(1)} 分。`;
  const focuses = weaks.length ? weaks : ["错因最多的一类"];
  const rows = Array.from({ length: weeks }, (_, index) => [`第 ${index + 1} 周`, focuses[index % focuses.length], ["精讲过关", "限时操练", "订正归因", "复盘打卡"][index % 4], index === weeks - 1 ? `小测靠近 ${target} 分` : "焦点题能独立讲清"]);
  const who = voice(val(input, "grade"));
  return {
    title: `${val(input, "subject")}提分安排`,
    subtitle: `${val(input, "grade")} · ${recent} → ${target} · ${weeks} 周`,
    summary: caution,
    sections: [
      section("每周", [], { table: { headers: ["周", "焦点", "六步里加重", "怎样算过"], rows } }),
      section("每天仍走六步", [], { bullets: ["对齐目标", "预习探路", "精讲过关", "限时操练", "订正归因", "复盘打卡"] }),
      section("谁看什么", [`${who.learner}看题目和步骤。`, `${who.adult}${who.check}。`]),
    ],
  };
}
