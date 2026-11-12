import { KnowledgeBrowser } from "@/components/knowledge-browser";

export const metadata = { title: "知识库" };

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-pine">目录，不是网盘</p>
      <h1 className="mt-2 text-4xl font-semibold">知识库</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">文件夹只用来收大纲：学段怎么走、学科先看什么、家庭里谁操作、错题怎么摘。需要生成内容时，从大纲进到对应工具。</p>
      <KnowledgeBrowser />
    </div>
  );
}
