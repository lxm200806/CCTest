import type { GradeBand } from "@/lib/types";

export const STEPS = [
  { id: 1, name: "对齐目标", brief: "今天只啃一个点，并写清怎样算做完。" },
  { id: 2, name: "预习探路", brief: "先看框架，标出上课要问的那一句。" },
  { id: 3, name: "精讲过关", brief: "把这个点讲给别人听，讲不清的地方才是洞。" },
  { id: 4, name: "限时操练", brief: "计时做一小套，中途不翻答案。" },
  { id: 5, name: "订正归因", brief: "每道错题只归一个原因。" },
  { id: 6, name: "复盘打卡", brief: "记下明天的第一步，不补写长日记。" },
];

export type FlowStep = {
  id: number;
  name: string;
  minutes: string;
  who: string;
  do: string;
  done: string;
  href?: string;
  hrefLabel?: string;
};

export type BandPage = {
  id: GradeBand;
  title: string;
  role: string;
  summary: string;
  caution: string;
  rhythm: string;
  sampleTitle: string;
  sampleNote: string;
  sample: { time: string; text: string }[];
  steps: FlowStep[];
};

export const BANDS: Record<GradeBand, BandPage> = {
  primary: {
    id: "primary",
    title: "小学",
    role: "家长操作员",
    summary: "家长打开工具、读题、掐时间。孩子负责开口说、在纸上写。一天 20 到 30 分钟，六步里走完四步也算这一天成立。",
    caution: "一次只生成一份。打印或投屏，不要让孩子在好几份结果里自己翻。",
    rhythm: "低年级把「精讲过关」收成家长讲一句、孩子复述一句。",
    sampleTitle: "举例：三年级认识整点的一个晚上",
    sampleNote: "小满只是方法举例，不会写进演示档案。档案里只有初二的林晓禾。",
    sample: [
      { time: "18:40", text: "对齐目标。家长写下：今天只认钟面上的整点。" },
      { time: "18:42", text: "预习探路。看三张钟面，孩子指出时针在哪。" },
      { time: "18:48", text: "精讲过关。用讲题稿讲一道，孩子把句子复述出来。" },
      { time: "18:55", text: "限时 6 分钟做 4 题，铅笔放下才对答案。" },
      { time: "19:01", text: "订正归因。只标一处看错，不把整页重做。" },
      { time: "19:05", text: "打卡，收铅笔。明天的第一步写在纸角。" },
    ],
    steps: [
      { id: 1, name: "对齐目标", minutes: "2 分钟", who: "家长写，孩子点头", do: "用一句口语说清今天的点，不要同时加新内容。", done: "纸上有一句今天的目标。" },
      { id: 2, name: "预习探路", minutes: "5 分钟", who: "家长读，孩子指", do: "只看标题、一张图和三个词，让孩子指出不懂的那一处。", done: "有一个带到课堂上的问题。", href: "/workbench/ai-preview", hrefLabel: "用 AI预习" },
      { id: 3, name: "精讲过关", minutes: "8 分钟", who: "家长讲，孩子复述", do: "只讲一道。讲完盖住稿子，让孩子用自己的话说。", done: "孩子能不看稿子说完这一道。", href: "/workbench/ai-explain", hrefLabel: "用 AI讲题" },
      { id: 4, name: "限时操练", minutes: "6 分钟", who: "孩子写，家长计时", do: "题量要少到能写完。时间到就停。", done: "有一份写完或按时停下的练习。", href: "/workbench/ai-paper", hrefLabel: "用 AI组卷出一小套" },
      { id: 5, name: "订正归因", minutes: "5 分钟", who: "家长问，孩子改一处", do: "每道错题只选一个原因：知识、审题、计算、时间、规范。", done: "错题旁边有一个原因词。", href: "/workbench/ai-grade", hrefLabel: "用 AI作业批改" },
      { id: 6, name: "复盘打卡", minutes: "2 分钟", who: "家长勾，孩子说明天", do: "勾上今天真的走过的步。明天的第一步只写一件事。", done: "打卡板上今天有勾。", href: "/checkin", hrefLabel: "去打卡" },
    ],
  },
  junior: {
    id: "junior",
    title: "初中",
    role: "孩子操作，家长验收",
    summary: "学生自己填年级、学科和题目。家长不重讲整道题，只看结果里的两行：错因归类，以及明天的第一步。单科 30 到 40 分钟。",
    caution: "工具换得越勤，越看不出是哪一步断了。一个晚上最多用两个工具。",
    rhythm: "林晓禾目前把时间放在数学一次函数，英语维持阅读，不再加新的专项。",
    sampleTitle: "档案：林晓禾今晚的一次函数",
    sampleNote: "这是演示档案里的学生，打卡和点数都会记在本机。",
    sample: [
      { time: "19:30", text: "对齐目标。写下：今晚只处理图像与解析式，不做几何。" },
      { time: "19:33", text: "预习探路。用 10 分钟预习单标出「k 的符号」这一问。" },
      { time: "19:45", text: "精讲过关。讲题稿对照自己的草稿，先改符号，再讲斜率。" },
      { time: "20:05", text: "限时 15 分钟做 6 道变式，中间不看答案。" },
      { time: "20:22", text: "订正归因。错题归到「计算」，只重做错的那一步。" },
      { time: "20:30", text: "打卡。明天第一步：默写 y=kx+b 与 y 轴交点。" },
    ],
    steps: [
      { id: 1, name: "对齐目标", minutes: "3 分钟", who: "学生写，家长看一眼", do: "写出今天的知识点和「做完」的样子。", done: "目标和完成线写在同一行。", href: "/workbench/ai-score-plan", hrefLabel: "用 AI提分评测看这一周" },
      { id: 2, name: "预习探路", minutes: "10 分钟", who: "学生独立", do: "只预下一节的框架。生词和公式各列三条。", done: "预习单上有一个问号。", href: "/workbench/ai-preview", hrefLabel: "用 AI预习" },
      { id: 3, name: "精讲过关", minutes: "12 分钟", who: "学生对着稿子讲", do: "先讲审题，再讲步骤。卡壳就用可视化把关系画出来。", done: "能指出这道题的一个得分点。", href: "/workbench/ai-explain", hrefLabel: "用 AI讲题" },
      { id: 4, name: "限时操练", minutes: "15 分钟", who: "学生计时", do: "用一组小卷或三道举一反三。时间到就停。", done: "有做完的痕迹，也有按时停下的痕迹。", href: "/workbench/ai-paper", hrefLabel: "用 AI组卷" },
      { id: 5, name: "订正归因", minutes: "8 分钟", who: "学生归类，家长只看类别", do: "一道错题只留一个原因。同一原因出现两次，再进入举一反三。", done: "每道错题旁有五个词里的一个。", href: "/workbench/ai-extend", hrefLabel: "用 AI举一反三" },
      { id: 6, name: "复盘打卡", minutes: "3 分钟", who: "学生勾，家长看明天一句", do: "不写感想。只留明天打开书要做的第一件具体的事。", done: "打卡板和明天的一句都在。", href: "/checkin", hrefLabel: "去打卡" },
    ],
  },
  senior: {
    id: "senior",
    title: "高中",
    role: "孩子自主闭环",
    summary: "以一套卷或一次考试为单元，而不是每天换一个工具。学生用分析排一周，家长看目标有没有挪动，不进入每一道题。",
    caution: "分数缺口很大时，先把目标改成两周内够得着的数，再排工具。",
    rhythm: "一周里，分析一次，变式两次，周报一次。其余晚上走六步的缩短版。",
    sampleTitle: "举例：高二周予安的物理单元",
    sampleNote: "周予安只出现在这个方法页，帮助对照角色。演示档案仍然是林晓禾。",
    sample: [
      { time: "周日晚", text: "对齐目标。本周只补受力图，目标是单元小测多 6 分。" },
      { time: "周一", text: "预习探路。看讲义框架，把适用条件抄成三行。" },
      { time: "周二", text: "精讲过关。选一道丢分题，按得分点重写过程。" },
      { time: "周四", text: "限时操练。做 5 道变式，40 分钟。" },
      { time: "周六", text: "订正归因。用试卷分析把错题分成知识、审题、计算。" },
      { time: "周六末", text: "复盘。把周报排进 AIWORD，只给家长看目标和缺口。" },
    ],
    steps: [
      { id: 1, name: "对齐目标", minutes: "10 分钟 / 周", who: "学生定，家长听结论", do: "用最近一次分数、目标分和周数算出每周要挪动多少。", done: "一周只保留一个学科焦点。", href: "/workbench/ai-score-plan", hrefLabel: "用 AI提分评测" },
      { id: 2, name: "预习探路", minutes: "15 分钟", who: "学生", do: "看讲义结构：条件、公式、适用边界。不在预习时做完所有题。", done: "能说出这个模型不能用在哪。", href: "/workbench/ai-handout", hrefLabel: "用 AI讲义" },
      { id: 3, name: "精讲过关", minutes: "20 分钟", who: "学生按得分点讲", do: "选卷上丢分最多的一道，缺的步骤用另一种颜色补上。", done: "这道题的得分点能独立写全。", href: "/workbench/ai-explain", hrefLabel: "用 AI讲题" },
      { id: 4, name: "限时操练", minutes: "40 分钟", who: "学生", do: "用变式而不是再找一套全新的卷。每次只改一个条件。", done: "变式有对错，也有用时。", href: "/workbench/ai-variant", hrefLabel: "用 AI试卷变式" },
      { id: 5, name: "订正归因", minutes: "20 分钟", who: "学生", do: "把丢分题收成一张表：题号、知识点、一个错因。", done: "有一张可以排序的错因表。", href: "/workbench/ai-analysis", hrefLabel: "用 AI试卷分析" },
      { id: 6, name: "复盘打卡", minutes: "10 分钟 / 周", who: "学生写周报，家长看周报", do: "周报只留三块：这周焦点、正确率、下周第一步。", done: "家长不用打开题目，也能知道这一周有没有往前。", href: "/workbench/ai-word", hrefLabel: "用 AIWORD 排周报" },
    ],
  },
};

export function getBand(id: string) {
  if (id === "primary" || id === "junior" || id === "senior") return BANDS[id];
  return null;
}

export type KnowledgeNode = {
  id: string;
  title: string;
  kind: "folder" | "doc";
  children?: KnowledgeNode[];
  summary?: string;
  outline?: string[];
  links?: { label: string; href: string }[];
};

export const KNOWLEDGE: KnowledgeNode[] = [
  {
    id: "method",
    title: "学段方法",
    kind: "folder",
    children: [
      { id: "method-primary", title: "小学一日", kind: "doc", summary: "家长是操作员。孩子的任务是说和写，不是挑选工具。", outline: ["一天 20–30 分钟，超时就停。", "六步里完成四步，这一天就成立。", "一次只留一份生成结果。"], links: [{ label: "打开小学流程", href: "/flow/primary" }] },
      { id: "method-junior", title: "初中一日", kind: "doc", summary: "学生填表单、做订正。家长验收错因和明天的一句。", outline: ["单科 30–40 分钟。", "一个晚上最多两个工具。", "林晓禾的当前焦点是一次函数。"], links: [{ label: "打开初中流程", href: "/flow/junior" }] },
      { id: "method-senior", title: "高中一周", kind: "doc", summary: "以试卷为单元排一周，而不是以晚上为单元换工具。", outline: ["每周一次试卷分析。", "变式只改一个条件。", "家长看周报，不看每一道题。"], links: [{ label: "打开高中流程", href: "/flow/senior" }] },
    ],
  },
  {
    id: "subjects",
    title: "学科架子",
    kind: "folder",
    children: [
      { id: "sub-chinese", title: "语文", kind: "doc", summary: "先圈题干动词，再回原文找句。概括要带着限定词。", outline: ["题干动词：概括、分析、赏析、说明。", "答案必须能指回原文的一句。"], links: [{ label: "去讲一道语文题", href: "/workbench/ai-explain" }] },
      { id: "sub-math", title: "数学", kind: "doc", summary: "先画图或列出关系，再计算。符号和单位单独检查。", outline: ["一次函数先看 k 和 b。", "交点先写坐标，再解释含义。"], links: [{ label: "画一张函数图", href: "/workbench/ai-visualize" }] },
      { id: "sub-english", title: "英语", kind: "doc", summary: "阅读先定位题干里的名词，再回段落找同义替换。", outline: ["细节题先划数字、人名、否定词。", "主旨看首尾句。"], links: [{ label: "出一组阅读小题", href: "/workbench/ai-paper" }] },
      { id: "sub-science", title: "科学与社会", kind: "doc", summary: "理科先写条件和公式，文科先写时间或位置。", outline: ["实验题分目的、操作、现象、结论。", "观点后面要有一条材料依据。"], links: [{ label: "做一份讲义", href: "/workbench/ai-handout" }] },
    ],
  },
  {
    id: "roles",
    title: "家庭角色",
    kind: "folder",
    children: [
      { id: "role-parent", title: "家长操作清单", kind: "doc", summary: "家长负责边界：时间、工具数量，以及看哪两行结果。", outline: ["确认点数还够这一次。", "核对年级和学科。", "验收时只问错因和明天第一步。"], links: [{ label: "进入工作台", href: "/workbench" }] },
      { id: "role-child", title: "孩子自主清单", kind: "doc", summary: "初中开始自己填，高中自己排周。自主不是无人看。", outline: ["先写目标，再点生成。", "限时中途不看答案。", "打卡只勾真正走过的步。"], links: [{ label: "去打卡板", href: "/checkin" }] },
    ],
  },
  {
    id: "templates",
    title: "模板",
    kind: "folder",
    children: [
      { id: "tpl-error", title: "错因五种", kind: "doc", summary: "一道题只选一个。选不出来，就先选「审题」。", outline: ["知识：概念或公式本身不会。", "审题：看错条件、范围或问法。", "计算：方法对，数字或符号错。", "时间：会做，但没写完。", "规范：步骤跳了、单位漏了。"], links: [{ label: "用在试卷分析", href: "/workbench/ai-analysis" }] },
      { id: "tpl-paper", title: "试卷摘录格式", kind: "doc", summary: "分析工具按行读取。一行一道错题。", outline: ["推荐：题号|知识点|错因", "示例：12|求解析式|计算", "错因只用知识、审题、计算、时间、规范。"], links: [{ label: "打开 AI试卷分析", href: "/workbench/ai-analysis" }] },
      { id: "tpl-checkin", title: "六步打卡说明", kind: "doc", summary: "打卡记录的是步骤，不是心情，也不是分数。", outline: ["一天六格，走过才勾。", "勾满四格，这一天计入连续打卡。", "未登录可以看演示档案，不能改。"], links: [{ label: "打开打卡板", href: "/checkin" }] },
    ],
  },
];

export function firstDoc(nodes: KnowledgeNode[] = KNOWLEDGE): KnowledgeNode | null {
  for (const node of nodes) {
    if (node.kind === "doc") return node;
    if (node.children) {
      const found = firstDoc(node.children);
      if (found) return found;
    }
  }
  return null;
}
