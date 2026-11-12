export type FieldType = "text" | "textarea" | "select" | "file";

export type ToolField = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  rows?: number;
  numeric?: boolean;
  options?: { value: string; label: string }[];
};

export type ToolGroupId = "prep" | "class" | "practice" | "review";

export type ToolDef = {
  id: string;
  name: string;
  group: ToolGroupId;
  blurb: string;
  detail: string;
  cost: number;
  featured?: boolean;
  empty: string;
  mapsFrom: string[];
  fields: ToolField[];
  example: Record<string, string>;
};

export const GROUPS: { id: ToolGroupId; label: string; hint: string }[] = [
  { id: "prep", label: "课前备课", hint: "上课前把脚本、讲义和预习单准备好" },
  { id: "class", label: "课堂讲解", hint: "把一个点讲清楚，并画出来" },
  { id: "practice", label: "练习测评", hint: "组卷、批改、再出近亲题" },
  { id: "review", label: "课后巩固", hint: "排版、归因、分析，并排下一周" },
];

const GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "道德与法治", "科学"];

function choices(values: string[]) {
  return values.map((value) => ({ value, label: value }));
}

const gradeField: ToolField = { name: "grade", label: "年级", type: "select", required: true, options: choices(GRADES) };
const subjectField: ToolField = { name: "subject", label: "学科", type: "select", required: true, options: choices(SUBJECTS) };

export const TOOLS: ToolDef[] = [
  {
    id: "ai-lesson",
    name: "AI出课",
    group: "prep",
    blurb: "把一个知识点收成可讲的课堂脚本",
    detail: "按课时写出分段、教师要说的话、板书和一道检查题。适合课前把 20 到 45 分钟排开。",
    cost: 2,
    featured: true,
    empty: "生成后会看到时间分段、口述脚本、板书和收束时的检查题。",
    mapsFrom: ["学习资料生成器的课堂脚本"],
    fields: [
      gradeField,
      subjectField,
      { name: "topic", label: "课题", type: "text", required: true, placeholder: "例如：一次函数的图像与性质" },
      {
        name: "duration",
        label: "课时",
        type: "select",
        required: true,
        hint: "各教学段的分钟数相加必须等于这个课时。合计行不会再加一次，其他表里的数字不算课时。",
        options: choices(["20", "40", "45"]),
      },
      { name: "style", label: "课型", type: "select", required: true, options: choices(["讲解型", "探究型", "复习型"]) },
    ],
    example: { grade: "初二", subject: "数学", topic: "一次函数的图像与性质", duration: "40", style: "讲解型" },
  },
  {
    id: "ai-prep",
    name: "AI备课",
    group: "prep",
    blurb: "写出目标、节奏和分层活动",
    detail: "给教师或家长一份备课纸条：目标、重难点、时间表、学有余力和需要支架的两类活动。",
    cost: 1,
    empty: "生成后会看到三维目标、时间表和两类学生分别做什么。",
    mapsFrom: ["AI备课器"],
    fields: [
      gradeField,
      subjectField,
      { name: "topic", label: "课题", type: "text", required: true, placeholder: "这一节要备的内容" },
      { name: "textbook", label: "教材口径", type: "select", required: true, options: choices(["人教版", "北师大版", "沪教版", "通用"]) },
      { name: "lessonType", label: "课的类型", type: "select", required: true, options: choices(["新授", "复习", "讲评"]) },
    ],
    example: { grade: "初二", subject: "数学", topic: "一次函数与实际问题", textbook: "人教版", lessonType: "新授" },
  },
  {
    id: "ai-handout",
    name: "AI讲义",
    group: "prep",
    blurb: "概念、例题、易错和练习装成一份",
    detail: "学生可直接阅读的讲义：概念卡、两道例题、常见错法，以及附在最后的练习答案。",
    cost: 1,
    empty: "生成后会得到一份能打印的讲义结构，答案单独放在末尾。",
    mapsFrom: ["学习资料生成器"],
    fields: [
      gradeField,
      subjectField,
      { name: "topic", label: "主题", type: "text", required: true, placeholder: "讲义围绕的知识点" },
      { name: "depth", label: "深度", type: "select", required: true, options: choices(["基础", "提升", "冲刺"]) },
    ],
    example: { grade: "初二", subject: "数学", topic: "一次函数的解析式", depth: "基础" },
  },
  {
    id: "ai-teaching-aid",
    name: "AI教辅制作器",
    group: "prep",
    blurb: "做成可打印的知识页和练习页",
    detail: "按页编排教辅：知识页、练习页，需要时再加一页给家长的使用说明。",
    cost: 2,
    empty: "生成后按页展开，并标明答案是印在页内还是另附。",
    mapsFrom: ["教辅资料生成器"],
    fields: [
      gradeField,
      subjectField,
      { name: "chapter", label: "章节", type: "text", required: true, placeholder: "例如：第十九章 一次函数" },
      {
        name: "pages",
        label: "页数",
        type: "select",
        required: true,
        hint: "下载的是可打印 HTML，不是排版软件源文件。",
        options: [
          { value: "1", label: "1 页" },
          { value: "2", label: "2 页" },
          { value: "4", label: "4 页" },
        ],
      },
      { name: "answers", label: "答案", type: "select", required: true, options: choices(["印在页内", "答案另附"]) },
    ],
    example: { grade: "初二", subject: "数学", chapter: "第十九章 一次函数", pages: "2", answers: "答案另附" },
  },
  {
    id: "ai-preview",
    name: "AI预习",
    group: "prep",
    blurb: "给学生一张上课前能做完的预习单",
    detail: "面向学生的短预习：要先知道什么、三个自测、以及带到课堂上的一个问题。",
    cost: 1,
    empty: "生成后是一张限时预习单，不是另一份完整讲义。",
    mapsFrom: ["考前抢分清单的预习侧"],
    fields: [
      gradeField,
      subjectField,
      { name: "topic", label: "下一节内容", type: "text", required: true, placeholder: "明天要上的课题" },
      {
        name: "minutes",
        label: "可用时间",
        type: "select",
        required: true,
        options: [
          { value: "10", label: "10 分钟" },
          { value: "15", label: "15 分钟" },
          { value: "25", label: "25 分钟" },
        ],
      },
    ],
    example: { grade: "初二", subject: "数学", topic: "平面直角坐标系", minutes: "10" },
  },
  {
    id: "ai-ppt",
    name: "AIPPT",
    group: "prep",
    blurb: "按页给出标题、要点和讲者备注",
    detail: "不导出二进制幻灯片，而是一份能投屏、也能下载成 HTML 的分页讲稿。",
    cost: 2,
    empty: "生成后每一页都有标题、要点和你站在旁边要说的话。",
    mapsFrom: ["试卷讲评PPT"],
    fields: [
      gradeField,
      subjectField,
      { name: "topic", label: "主题", type: "text", required: true, placeholder: "这一叠幻灯片要讲什么" },
      { name: "slides", label: "页数", type: "select", required: true, hint: "得到的是分页讲稿和 HTML，不是 .pptx 文件。", options: choices(["8", "12", "16"]) },
      { name: "audience", label: "听众", type: "select", required: true, options: choices(["学生", "家长会", "教研组"]) },
    ],
    example: { grade: "初二", subject: "数学", topic: "一次函数图像怎么读", slides: "8", audience: "学生" },
  },
  {
    id: "ai-visualize",
    name: "AI可视化",
    group: "class",
    blurb: "把关系画成图，并写清怎么读",
    detail: "输出一张图和一段读图说明。图的类型可以是流程、对比、函数图像、结构或时间线。",
    cost: 1,
    featured: true,
    empty: "生成后左边是说明，图可以直接看，也可以随 HTML 一起下载。",
    mapsFrom: ["课堂图解（把口述步骤收成一张图）"],
    fields: [
      gradeField,
      subjectField,
      {
        name: "concept",
        label: "要画的概念",
        type: "text",
        required: true,
        placeholder: "例如：一次函数 y=2x-4 的图像",
        hint: "函数图像请写具体解析式，例如 y=2x-4。y=kx+b、二次函数或有歧义的式子不会被画成一条确定的直线。",
      },
      { name: "visual", label: "图的类型", type: "select", required: true, options: choices(["流程图", "对比表", "函数图像", "结构图", "时间线"]) },
    ],
    example: { grade: "初二", subject: "数学", concept: "一次函数 y=2x-4 的图像", visual: "函数图像" },
  },
  {
    id: "ai-explain",
    name: "AI讲题",
    group: "class",
    blurb: "审题、步骤、得分点和对照草稿",
    detail: "把一道题拆开讲。若贴了学生草稿，会先指出草稿里已经对的部分，再补缺口。",
    cost: 1,
    empty: "生成后包含审题卡、分步、得分点和一句可以记住的方法。",
    mapsFrom: ["AI解题步骤器", "AI审题器", "AI得分点拆解器"],
    fields: [
      gradeField,
      subjectField,
      { name: "question", label: "题目", type: "textarea", required: true, rows: 6, placeholder: "把完整题目贴在这里" },
      { name: "draft", label: "学生草稿（可选）", type: "textarea", rows: 4, placeholder: "没有草稿也可以直接生成" },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      question: "一次函数 y = 2x - 4。\n（1）它与 y 轴的交点坐标是多少？\n（2）当 y = 0 时，x 是多少？\n（3）x 增大时，y 怎样变化？",
      draft: "交点是 (0, -4)。y=0 时 x=2。x 增大 y 也增大。第三问我不确定图像往哪边斜。",
    },
  },
  {
    id: "ai-paper",
    name: "AI组卷",
    group: "practice",
    blurb: "按范围组一套带答案和评分的卷",
    detail: "生成小题、分值和参考答案。答案按题干里的数字计算，方便直接用来限时练。",
    cost: 2,
    featured: true,
    empty: "生成后先是试卷，参考答案放在后面，避免做的时候瞄到。",
    mapsFrom: ["AI出题机"],
    fields: [
      gradeField,
      subjectField,
      { name: "scope", label: "范围", type: "text", required: true, placeholder: "这一套卷覆盖什么" },
      { name: "count", label: "题量", type: "select", required: true, options: choices(["6", "10", "16"]) },
      { name: "difficulty", label: "难度", type: "select", required: true, options: choices(["基础为主", "均衡", "提高为主"]) },
      {
        name: "minutes",
        label: "建议用时",
        type: "select",
        required: true,
        options: [
          { value: "20", label: "20 分钟" },
          { value: "40", label: "40 分钟" },
          { value: "60", label: "60 分钟" },
        ],
      },
    ],
    example: { grade: "初二", subject: "数学", scope: "一次函数：解析式、图像、实际应用", count: "6", difficulty: "基础为主", minutes: "20" },
  },
  {
    id: "ai-grade",
    name: "AI作业批改",
    group: "practice",
    blurb: "对照要求批改，并归到一种错因",
    detail: "根据学生写下的文字给评分和改写建议。不识别照片里的字，图片只记录文件名。",
    cost: 1,
    featured: true,
    empty: "生成后有分数、引用学生原句的批注、一个错因，以及改写示例。",
    mapsFrom: ["智批作业机"],
    fields: [
      gradeField,
      subjectField,
      { name: "prompt", label: "题目要求", type: "textarea", required: true, rows: 4, placeholder: "老师或家长布置了什么" },
      { name: "answer", label: "学生作答", type: "textarea", required: true, rows: 6, placeholder: "把学生写的文字贴进来" },
      { name: "attachment", label: "附件（可选）", type: "file", hint: "文本会读入。图片和扫描件不会被识别，只保留文件名，请把文字贴到作答里。" },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      prompt: "写出 y=2x-4 与 y 轴的交点，并说明 x 增大时 y 如何变化。要有理由。",
      answer: "交点是 (0, 4)。因为 b 是 -4 的绝对值。\ny=0 时 2x-4=0，x=2。\nx 变大时 y 变大，因为 2 是正的。\n我不确定要不要画图。",
    },
  },
  {
    id: "ai-variant",
    name: "AI试卷变式",
    group: "practice",
    blurb: "改数字、情境或问法，生成近亲题",
    detail: "保留原题的方法，只动一个杠杆，并写出新题的答案和「改了什么」。",
    cost: 1,
    empty: "生成后能看到原题方法、每一道变式，以及它相对原题动了哪一处。",
    mapsFrom: ["试卷变式机"],
    fields: [
      gradeField,
      subjectField,
      { name: "original", label: "原题", type: "textarea", required: true, rows: 5, placeholder: "贴一道希望变式的题" },
      { name: "count", label: "变式数量", type: "select", required: true, options: choices(["3", "5"]) },
      { name: "lever", label: "主要改什么", type: "select", required: true, options: choices(["数字", "情境", "条件", "问法"]) },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      original: "一条电话套餐的月费是 20 元，之后每分钟 0.2 元。设通话 x 分钟，费用 y 元。写出 y 与 x 的关系，并求通话 30 分钟的费用。",
      count: "3",
      lever: "数字",
    },
  },
  {
    id: "ai-word",
    name: "AIWORD",
    group: "review",
    blurb: "把材料排成可打印的版面",
    detail: "把粘贴的文字排成试卷、讲义、学情周报或家长通知。下载 HTML 后可用浏览器打印。",
    cost: 1,
    featured: true,
    empty: "生成后是一页纸的版式预览，正文来自你贴上的材料。",
    mapsFrom: ["题卷重排WORD"],
    fields: [
      gradeField,
      subjectField,
      { name: "docType", label: "文稿类型", type: "select", required: true, options: choices(["试卷", "讲义", "学情周报", "家长通知"]) },
      { name: "title", label: "标题", type: "text", required: true, placeholder: "印在页首的标题" },
      { name: "source", label: "正文材料", type: "textarea", required: true, rows: 7, placeholder: "一段一段贴上。空行会分成新段落。", hint: "可下载 HTML 后用浏览器打印。这一阶段不导出 .docx。" },
      { name: "layout", label: "栏式", type: "select", required: true, options: choices(["单栏", "双栏"]) },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      docType: "学情周报",
      title: "林晓禾数学周报 · 一次函数",
      layout: "单栏",
      source: "本周焦点：一次函数的图像和解析式。\n\n最近一次小练 78 分。丢分集中在符号和交点坐标，方法本身基本会。\n\n下周第一步：默写 y=kx+b 与 y 轴的交点，并独立做 4 道只改数字的变式。\n\n请家长只看这一句：明天不用重讲概念，看他能不能把 b 的符号写对。",
    },
  },
  {
    id: "ai-extend",
    name: "AI举一反三",
    group: "review",
    blurb: "从一道错题长出三道递进题",
    detail: "先认定一个错因，再给同构题、变条件题和一道综合题。每题都带答案。",
    cost: 1,
    empty: "生成后是错因卡片加三道由易到难的题，不是另一张完整试卷。",
    mapsFrom: ["错题举一反三", "题感训练提分器"],
    fields: [
      gradeField,
      subjectField,
      { name: "wrong", label: "错题", type: "textarea", required: true, rows: 5, placeholder: "原题和学生的错误答案" },
      { name: "reason", label: "当时的错法", type: "textarea", required: true, rows: 3, placeholder: "例如：把纵截距写成了绝对值" },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      wrong: "题目：y=2x-4 与 y 轴的交点。学生写成 (0, 4)。",
      reason: "看到 -4 就取了绝对值，没把 b 本身当作纵坐标。",
    },
  },
  {
    id: "ai-analysis",
    name: "AI试卷分析",
    group: "review",
    blurb: "把丢分拆开，标出先补哪一处",
    detail: "把一卷的分数和错题收成结构：知识、审题、计算、时间、规范。诊断类能力都收在这里，不再拆成多个入口。",
    cost: 2,
    empty: "生成后有得分结构、错因分布，以及建议先处理的两处。",
    mapsFrom: ["AI丢分诊断器", "AI错因判断器", "卷后提分试卷分析", "错题归因追分器", "AI得分点拆解器"],
    fields: [
      gradeField,
      subjectField,
      { name: "paper", label: "试卷名称", type: "text", required: true, placeholder: "例如：期中数学" },
      { name: "score", label: "得分", type: "text", required: true, numeric: true, placeholder: "78", hint: "填数字。错题表只出现一次。" },
      { name: "total", label: "满分", type: "text", required: true, numeric: true, placeholder: "100" },
      { name: "usedMinutes", label: "用时（分钟）", type: "text", required: true, numeric: true, placeholder: "90" },
      {
        name: "wrongs",
        label: "错题摘录",
        type: "textarea",
        required: true,
        rows: 6,
        hint: "一行一道。推荐：题号|知识点|错因。错因用知识、审题、计算、时间、规范。",
        placeholder: "12|求解析式|计算",
      },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      paper: "期中数学",
      score: "78",
      total: "100",
      usedMinutes: "90",
      wrongs: "12|求解析式|计算\n15|图像过象限|审题\n18|方案选择|知识\n21|应用题单位|规范",
    },
  },
  {
    id: "ai-score-plan",
    name: "AI提分评测",
    group: "review",
    blurb: "估算提分空间，并排进每日六步",
    detail: "用最近分数、目标分和周数排一张周计划，并写明家长和学生各自看什么。查缺、行动计划和提分空间都收在这一处。",
    cost: 1,
    empty: "生成后会看到缺口是否现实、每周焦点，以及六步里该加重哪一步。",
    mapsFrom: ["知识查缺补漏器", "AI题型提分卡", "提分行动计划器", "考前抢分清单器", "AI提分空间评测器"],
    fields: [
      gradeField,
      subjectField,
      { name: "recent", label: "最近一次分数", type: "text", required: true, numeric: true, placeholder: "78" },
      { name: "target", label: "目标分", type: "text", required: true, numeric: true, placeholder: "88" },
      { name: "weeks", label: "周数", type: "select", required: true, options: choices(["2", "4", "6", "8"]) },
      { name: "weak", label: "薄弱点", type: "textarea", required: true, rows: 4, placeholder: "一行一个，最多写三个", hint: "一行一个。计划只覆盖这里写下的点。" },
    ],
    example: {
      grade: "初二",
      subject: "数学",
      recent: "78",
      target: "88",
      weeks: "4",
      weak: "一次函数图像与 k 的符号\n待定系数求解析式\n应用题里单位忘写",
    },
  },
];

export function getTool(id: string) {
  return TOOLS.find((tool) => tool.id === id) ?? null;
}

export function groupLabel(group: ToolGroupId) {
  return GROUPS.find((item) => item.id === group)?.label ?? group;
}

export function fieldIssues(tool: ToolDef, raw: unknown) {
  if (!raw || typeof raw !== "object") return [{ name: "", message: "缺少输入" }];
  const src = raw as Record<string, unknown>;
  const issues: { name: string; message: string }[] = [];
  for (const field of tool.fields) {
    const value = src[field.name];
    const text = typeof value === "string" ? value.trim() : "";
    if (field.required && !text) {
      issues.push({ name: field.name, message: `请填写${field.label}` });
      continue;
    }
    if (text.length > 8000) issues.push({ name: field.name, message: `${field.label}太长了，请控制在 8000 字以内` });
    if (field.type === "select" && text && field.options && !field.options.some((option) => option.value === text)) {
      issues.push({ name: field.name, message: `${field.label}不在可选范围内` });
    }
    if (field.numeric && text && !Number.isFinite(Number(text))) issues.push({ name: field.name, message: `${field.label}请填数字` });
  }
  return issues;
}

export function normalizeInput(tool: ToolDef, raw: unknown): { ok: true; input: Record<string, string> } | { ok: false; error: string } {
  const issues = fieldIssues(tool, raw);
  if (issues.length) return { ok: false, error: issues[0]?.message || "缺少输入" };
  const src = raw as Record<string, unknown>;
  const input: Record<string, string> = {};
  for (const field of tool.fields) {
    const value = src[field.name];
    input[field.name] = typeof value === "string" ? value.trim() : "";
    if (field.type === "file") {
      const extra = src[`${field.name}Text`];
      input[`${field.name}Text`] = typeof extra === "string" ? extra.slice(0, 8000) : "";
    }
  }
  return { ok: true, input };
}
