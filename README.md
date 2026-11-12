# 学习工作台

给家长和教师用的 K12 学习方法台，带 15 个可离线演示的学科工具。界面不使用第三方品牌名称。没有账号体系对接，也没有客服联系方式。

## 本地运行

需要 Node.js 22。

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:4317](http://localhost:4317)。

生产构建：

```bash
npm run build
npm start
```

## 演示账号

| 账号 | 密码 | 初始点数 |
| --- | --- | --- |
| demo | demo123 | 36 |

也可以在登录页创建本地账号，新账号 20 点。演示学生档案是初二的林晓禾，打卡记录写在本机 `data/store.json`。想恢复初始数据，停掉服务后删除这个文件再启动。

每次点「生成」会按工具扣 1 或 2 点。点数不够时不会调用生成。

## 模型

默认走内置示例生成器，不需要密钥，断网也能出结果。

要改用真模型，复制 `.env.example` 为 `.env.local`：

```bash
# 只开其中一个即可。两个都写时，默认用 OpenAI。
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat

# mock | openai | deepseek。留空则按上面的密钥自动选。
AI_PROVIDER=
```

密钥只从环境变量读取，不会写进页面或仓库。接口失败时不扣点，并退回错误说明。

## 页面

- `/` 方法首页：每日六步、三个学段、常用工具、林晓禾档案
- `/flow/primary` `/flow/junior` `/flow/senior` 学段流程
- `/checkin` 打卡板
- `/knowledge` 知识库目录（只有大纲，不是网盘）
- `/tools` 15 个工具和能力归并表
- `/login` 登录 / 注册
- `/workbench` 工作台
- `/workbench/[toolId]` 单个工具

## 15 个工具

课前备课：AI出课、AI备课、AI讲义、AI教辅制作器、AI预习、AIPPT

课堂讲解：AI可视化、AI讲题

练习测评：AI组卷、AI作业批改、AI试卷变式

课后巩固：AIWORD、AI举一反三、AI试卷分析、AI提分评测

常用标记在出课、组卷、作业批改、AIWORD、可视化上。诊断、查缺、提分计划和得分点拆解收进「AI试卷分析」或「AI提分评测」，不再各开一个入口。

每个工具都能下载 Markdown、JSON 和 HTML。

## 结构

```
src/app            页面和 Route Handler
src/components     门户、工作台、打卡、知识库
src/lib/tools.ts   15 个工具的表单和点数
src/lib/ai         示例生成器，以及可选的 OpenAI / DeepSeek
src/lib/store.ts   JSON 文件里的账号、点数、打卡、生成记录
data/store.json    运行后出现，不提交
```

登录用 httpOnly cookie。生成在服务端扣点并保存最近记录。
