# 内部测试运行

这是单机内部测试的数据库说明，不是生产验收。没有对外地址，也不会联系任何人。

## 依赖

- Node.js 22
- PostgreSQL 16。本机或 CI 用一次性数据库，不需要付费云账号。
- 识别印刷体时，主机要另装 `tesseract-ocr`、`tesseract-ocr-chi-sim`、`tesseract-ocr-eng`。没有这些包时，识别接口会说明未就绪，不扣点。

## 环境

复制 `.env.example` 为 `.env.local`。`DATABASE_URL` 指向本机库。不要把填好的文件提交。

`COOKIE_SECURE=1` 只在 HTTPS 上打开。本地 HTTP 保持关闭，否则浏览器不会保存登录。

`ALLOW_REGISTER=1` 才开放页面注册，供回归脚本创建临时账号。邀请测试不要打开它。

程序启动时不会写入任何演示账号。

## 命令

```bash
npm run db:migrate
npm run db:health
INVITE_USERNAME=teacher INVITE_PASSWORD='从本机环境读取' INVITE_CREDITS=40 npm run db:invite
npm run dev
```

邀请密码只从环境变量读取，不写进命令参数文档，也不出现在源码里。

## 点数

生成开始前，在一个短事务里扣点并写入 `generation_requests` 状态 `reserved`。模型请求发生在事务之外。成功时另一次事务写入生成记录并把预留标成 `completed`，不会再扣一次。失败则把点数加回，并写一条退回账。同一用户和同一幂等键在完成后再次提交，直接返回已保存的结果。

预留超过 10 分钟仍是 `reserved` 时，下一次生成或 `recoverStaleReservations` 会退回。这覆盖进程在模型返回前崩溃的情况。10 分钟长于一次正常生成，避免慢请求被提前退款后又被保存。

## JSON

`npm run db:import -- tests/fixtures/migration/synthetic-store.json` 只校验。加上 `--apply` 才写入。旧会话令牌不导入，因为库里只保存令牌散列，导入后需要重新登录。用户、学生、打卡、账本和生成记录的 id 会保留。不要对真实 `data/store.json` 执行。

备份用 `pg_dump --data-only --inserts`。恢复前先清空表，再把备份导回同一个一次性库。测试用合成数据做这一步。

## 限制

单机 PostgreSQL、本机 Tesseract、没有多机备份演练、没有对外域名。测试通过不等于可以公开部署。部署前还要确认服务器和费用。
