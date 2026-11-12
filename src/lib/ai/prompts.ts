import { bandOf, voice } from "@/lib/ai/shared";
import type { ToolDef } from "@/lib/tools";

const COMMON_SHAPE = `只输出一个 JSON 对象，不要使用 Markdown 代码围栏。结构：
{
  "title": "结果标题",
  "subtitle": "年级 学科 以及其他范围",
  "summary": "给家长或教师的三五句说明",
  "sections": [
    {
      "heading": "小节标题",
      "paragraphs": ["完整段落"],
      "bullets": ["可选要点"],
      "table": { "headers": ["列"], "rows": [["单元格"]] }
    }
  ]
}`;

export function buildPrompt(tool: ToolDef, input: Record<string, string>) {
  const grade = input.grade || "未填年级";
  const subject = input.subject || "未填学科";
  const who = voice(grade);
  const materials = tool.fields
    .map((field) => `${field.label}：${input[field.name]?.trim() || "（空）"}`)
    .concat(
      tool.fields
        .filter((field) => field.type === "file" && input[`${field.name}Text`])
        .map((field) => `附件摘录：${input[`${field.name}Text`]}`),
    )
    .join("\n");
  const task = TASKS[tool.id] ?? `按「${tool.name}」的用途，写一份能直接使用的教学材料。`;
  const system = [
    "你是中国 K12 教研编辑，服务家长和任课教师。",
    `这次对象是${grade}${subject}。${who.learner}来学，${who.adult}负责验收：${who.check}。`,
    bandLine(grade),
    "必须使用用户给出的课题、题目、原文和数字，不要改换成别的知识点。",
    "能计算的题目写出可核验的步骤和结果。材料不足时明确缺什么，不要编一个看似精确的得数。",
    "语文和英语的答案要能指回原文或题干。",
    "不要写品牌名、客服号或外部联系方式。",
    COMMON_SHAPE,
    task.extra,
  ].join("\n");
  const user = [`工具：${tool.name}`, `用途：${tool.detail}`, "用户材料：", materials, "", task.ask].join("\n");
  return { system, user };
}

function bandLine(grade: string) {
  const band = bandOf(grade);
  if (band === "primary") return "小学：句子短，一步一件事，家长可以照着念。";
  if (band === "junior") return "初中：先写条件，再写步骤，结论单独成行。";
  return "高中：按得分点写完整过程，并说明适用边界。";
}

const TASKS: Record<string, { ask: string; extra: string }> = {
  "ai-lesson": {
    ask: "写一份可以拿着上课的课堂脚本。sections 里必须有：学习目标、时间安排（table，列：段落/分钟/做什么）、教师口述、板书、检查题。口述要引用用户课题里的具体概念，检查题要能在课上当堂做。",
    extra: "时间安排表的各段时长相加必须等于用户选择的课时分钟数。可以写「5」或「0-5 分钟」这种时段。不要靠行数冒充分钟。若写了合计行，合计不会再加一次。别的表里的数字不算课时。",
  },
  "ai-prep": {
    ask: "写备课纸条，不是学生讲义。sections 必须有：教学目标、重难点、四十分钟节奏（table，列：时间/活动/谁）、分层（需要支架的学生和学有余力的学生分别做什么）、课后一句。用语对齐用户选的教材口径，但例题按课题现写。",
    extra: "课型是新授、复习或讲评时，活动要跟着变，不要三种课用同一套流程。",
  },
  "ai-handout": {
    ask: "写学生能直接读的讲义。sections 必须有：概念、例题一、例题二、常见错法、练习、参考答案。两道例题的数字或材料不同。练习至少 3 题，参考答案与练习一一对应。深度为冲刺时，最后一题要写出不适用的情形。",
    extra: "答案放在最后一节，前面的练习不要把答案写进题干。",
  },
  "ai-teaching-aid": {
    ask: "按用户要求的页数编排教辅。sections 必须有：分页（table，列：页/作用/内容）、知识页正文、练习、答案。页数是 1 就不要编练习页。答案选择「答案另附」时，答案只出现在最后一节；「印在页内」时，在练习后紧跟简短答案。",
    extra: "练习要能在一页内做完，不要堆成另一套试卷。",
  },
  "ai-preview": {
    ask: "写一张学生在给定分钟数里能做完的预习单，不要写成完整新授课。sections 必须有：开始前、先知道的三件事、三个自测、带到课堂上的一句。自测要针对用户给的下一节内容。",
    extra: "小学预习单用家长可读的短句。到时间没做完也要告诉学生停在哪里。",
  },
  "ai-ppt": {
    ask: "按用户要求的页数写分页讲稿。除 sections 里的使用说明外，必须给出 slides 数组，长度等于要求的页数。每个元素是 {kicker, title, bullets, notes}。bullets 每页不超过 4 条。notes 是讲的人要停顿或提问的话。听众是家长会时少讲题、多讲这一周谁做什么；是教研组时写结构，不写学生姓名。",
    extra: '额外字段："slides": [{"kicker":"","title":"","bullets":[""],"notes":""}]',
  },
  "ai-visualize": {
    ask: "解释这张图怎么读。sections 必须有：怎么读、讲的时候停在哪、不要同时做的事。另外给出 diagram 对象，kind 必须与用户选择的图类型对应：流程图 flow、对比表 compare、函数图像 graph、结构图 tree、时间线 timeline。nodes、rows、leaves、events 用这个概念本身的词，写全需要的分支，不要只用空泛的「步骤一」。函数图像由服务端按用户解析式作图：若是确定的一次函数，说明里写出 k、b 和与坐标轴的交点；若是字母参数、二次或反比例、或有不止一个式子，要明确说不能画成一条确定的直线，不要假装已经画出准确图像。",
    extra: '额外字段："diagram": {"kind":"flow|compare|graph|tree|timeline","title":"","nodes":["概念本身的步骤"],"rows":[["维度","左","右"]],"leaves":["全部分支"],"events":["全部节点"]}',
  },
  "ai-explain": {
    ask: "讲用户贴出的这道题，不要换成相似题。sections 必须有：审题、分步、得分点。若用户给了草稿，再加一节对照草稿，先指出草稿里对的部分。数学题能算的要把结果算出来；不能从题面确定的量，写明缺哪一个条件。",
    extra: "分步里要出现题干中的具体数字或关键词，方便学生对照原题。",
  },
  "ai-paper": {
    ask: "按范围、题量、难度和建议用时组一套卷。必须给出 questions 数组，长度等于题量。每题 {type, stem, options, answer, points, explanation}。选择或判断题 options 写完整选项，解答题 options 为空数组。points 合计接近 100。sections 里写作答说明即可，试题和答案由数组生成。难度为提高为主时，后三分之一题要多一个条件。",
    extra: '额外字段："questions": [{"type":"","stem":"","options":[],"answer":"","points":4,"explanation":""}]',
  },
  "ai-grade": {
    ask: "对照题目要求批改学生作答。必须给出 score（0 到 100 的整数）、errorKind（只能是知识、审题、计算、时间、规范之一）、comments（字符串数组，至少两条，其中一条引用学生原句）、rewrite（改写示例）。sections 用这些内容展开：对照要求、批注、错因、改写。没有把握的地方不要装成扫描阅卷。图片附件若没有识别出文字，就只依据贴上的作答。",
    extra: '额外字段："score": 0, "errorKind": "计算", "comments": [""], "rewrite": ""',
  },
  "ai-variant": {
    ask: "基于原题出变式，保留原来的方法，只按用户选的杠杆改。必须给出 variants 数组，长度等于变式数量。每题 {stem, answer, changed}。changed 说明相对原题动了哪一处。答案要和 stem 里的数字一致。sections 先写原题要保住的方法。",
    extra: '额外字段："variants": [{"stem":"","answer":"","changed":""}]',
  },
  "ai-word": {
    ask: "把用户贴的正文排成指定文稿，不要另写一套无关内容。事实、分数和人名以原文为准，可以调整顺序和分段，不能改数字。sections 的段落就是打印正文。再给 paragraphs 字符串数组，按阅读顺序放每一段。",
    extra: '额外字段："paragraphs": ["打印用的段落"]',
  },
  "ai-extend": {
    ask: "从这道错题出三道递进题：同构、变条件、综合。必须给出 items 数组，长度正好 3，元素 {level, stem, answer}。level 依次是同构、变条件、综合。题目要针对用户写的错法，而不是随机知识点。sections 先写错因和方法，再可以简述三题。",
    extra: '额外字段："items": [{"level":"同构","stem":"","answer":""}]',
  },
  "ai-analysis": {
    ask: "分析这一张卷，使用用户给出的得分、满分、用时和错题摘录。必须给出 items 数组，每行错题一个元素 {no, point, kind}，kind 只能是知识、审题、计算、时间、规范。再给 priorities，最多两条，写先处理哪一类。sections 必须有得分结构、错因分布、明天的一步。错题明细只放在 items 里，不要在 sections 里再做一张相同的错题表。得分高于满分时先指出数据异常。",
    extra: '额外字段："items": [{"no":"","point":"","kind":"计算"}], "priorities": [""]',
  },
  "ai-score-plan": {
    ask: "用最近分数、目标分、周数和薄弱点排计划。必须给出 plan 数组，长度等于周数，元素 {week, focus, step, check}。step 从每日六步里选：对齐目标、预习探路、精讲过关、限时操练、订正归因、复盘打卡。sections 说明缺口是否现实：每周提高超过 8 分要写明建议把目标改近。计划只覆盖用户列出的薄弱点。",
    extra: '额外字段："plan": [{"week":"第 1 周","focus":"","step":"精讲过关","check":""}]',
  },
};
