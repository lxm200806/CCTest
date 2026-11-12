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

配置了 `DEEPSEEK_API_KEY` 后，15 个工具默认调用 DeepSeek 的 `deepseek-flash`（当前对应 DeepSeek-V4.1-Flash-1017）。接口与 OpenAI 兼容，`base_url` 是 `https://api.deepseek.com`。每个工具有自己的提示词：带上年级、学科和用户贴上的材料，并要求返回课案、讲义、试卷、批改、变式、讲稿或提分计划这类结构。解析通过才扣点。超时 60 秒，网络和 5xx 会重试；结果不合格会再要一次修正。

没有密钥时仍可生成，界面会写明：当前为本地示例，配置 `DEEPSEEK_API_KEY` 后走真模型。

把 `.env.example` 复制为 `.env.local`，只在本机填写密钥：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

密钥只从环境变量或 `.env.local` 读取，不会写进页面或仓库。调用失败不扣点。

若要强制本地示例，设置 `AI_PROVIDER=mock`。只有 `AI_PROVIDER=openai` 且配置了 `OPENAI_API_KEY` 时才改走 OpenAI。

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

## 这一阶段

函数图像按解析式作图。能确定的一次函数会画出坐标轴、刻度和截距；字母参数、二次函数、反比例，或不止一个式子时，只说明不能确定，不补一条示意直线。结构图保留长标题和全部分支，文字可以换行。

试卷分析只保留一张错题表。得分结构、错因分布和其他不同的说明会留下来。

AI出课核对时间安排里各段分钟是否等于所选课时。合计行和其他表不计入，也不把行数当成分钟。对不上就走原来的修正流程，失败不扣点。

15 个工具共用同一张表单：必填项会指出哪一栏，草稿留在这台浏览器，生成中不能重复提交。页面写明成功后才扣点。结果可以复制 Markdown、打印或下载 HTML。图片识别、PPTX 和 DOCX 还没有做。

页面、复制的 Markdown 和下载的 HTML 都按北京时间（Asia/Shanghai）显示生成时间，不跟服务器所在时区走。

## 图片识别

AI作业批改可以把印刷体图片交给本机的 [Tesseract](https://github.com/tesseract-ocr/tesseract) 识别。它是开源程序，不调用付费接口，也不把图片发给模型。系统需要：

```bash
sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng
```

语言数据一般在 `/usr/share/tesseract-ocr/5/tessdata`，要有 `chi_sim.traineddata` 和 `eng.traineddata`。没有程序或语言包时，页面写明缺什么，不会返回假文字，也不会扣点。

识别结果要自己改，并点「写入题目要求」或「写入学生作答」之后，才会进入原来的生成。手写和复杂公式可能不准。图片不写入账号 JSON，也不放进浏览器草稿。上传只接受 PNG、JPEG、WebP，有大小和尺寸上限；SVG 和网址不会被读取。

检查用的是确定性夹具，不调用在线模型：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 结构

```
src/app            页面和 Route Handler
src/components     门户、工作台、打卡、知识库
src/lib/tools.ts   15 个工具的表单和点数
src/lib/ai         各工具的提示词、DeepSeek 调用与结果解析；无密钥时回退示例
src/lib/store.ts   JSON 文件里的账号、点数、打卡、生成记录
data/store.json    运行后出现，不提交
```

登录用 httpOnly cookie。生成在服务端扣点并保存最近记录。
