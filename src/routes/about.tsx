import { useI18n } from '@/lib/i18n'
import { createFileRoute } from '@tanstack/react-router'
import bundledSource from '@/data/source.json'
import { useLearning } from '@/lib/queries'
import { useQuery } from '@tanstack/react-query'
import { request } from '@/lib/api-client'
import { localDate } from '@/lib/learning'
import { bundledTaxonomySummary, taxonomySummary } from '@/lib/taxonomy-summary'
import { z } from 'zod'
import { Panel, PageHeading } from '@/components/shared'

export const Route = createFileRoute('/about')({ component: About })
function About() {
  const { t, locale } = useI18n()
  const { catalog } = useLearning()
  const source = catalog.data?.catalog.source ?? bundledSource
  const summary = catalog.data
    ? taxonomySummary(catalog.data.catalog)
    : bundledTaxonomySummary
  const sync = useQuery({
    queryKey: ['taxonomy-status'],
    queryFn: async () =>
      z
        .object({
          status: z.string(),
          last_attempt: z.string().nullable(),
          last_success: z.string().nullable(),
          error_code: z.string().nullable(),
        })
        .nullable()
        .parse(await request('/api/taxonomy/status')),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const statusLabels: Record<string, string> = {
    pending: t('尚未同步'),
    running: t('同步中'),
    success: t('同步成功'),
    unchanged: t('已是最新版本'),
    failed: t('同步失败，保留上次成功版本'),
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title={t('每条学习路线，都有出处')}
        description={t('了解学径使用的数据，以及它能告诉我们什么。')}
      />
      <Panel className="space-y-6 text-sm leading-8">
        <div>
          <h2 className="text-lg font-semibold">{t('开放的知识地图')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(
              '学径基于 Marble Skill Taxonomy，包含 {{v0}} 个知识点、{{v1}} 条先修关系、{{v2}} 个学科。年龄范围用于参考，不等同于中国小学年级或特定教材。',
              {
                v0: summary.topics.toLocaleString(locale),
                v1: summary.dependencies.toLocaleString(locale),
                v2: summary.subjects,
              },
            )}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('怎样理解掌握记录')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(
              '练习判断依据最近 5 次作答：至少覆盖 3 道不同题目，平均正确率达到 80% 才标记为已掌握。家长也可以记录具体观察作为证据。这是帮助安排学习的规则，不是经过标准化验证的能力测验；一道错题不会自动否定所有前置知识。',
            )}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('原文、翻译与 AI 内容')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(
              '知识点名称、说明、掌握标准和检查问题提供简体中文翻译，可切换英语查看原文。数学、科学共 {{v0}} 个知识点有英文教学研究；其他学科仍可探索和生成练习。翻译由 AI 辅助完成，教学研究由 Agent 编写，活动尚未经实证验证。AI 练习可能存在错误，家长应复核有疑问的答案。',
              { v0: source.research.toLocaleString() },
            )}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('数据与模型配置')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t(
              '学习记录保存在你的账号中。自定义 API 密钥加密后保存在服务端，不会返回给浏览器。AI 讲解会将当前知识点、年龄和本次对话发送到你配置的服务商。最近作答列表显示 100 条，报告总数由全部作答计算。',
            )}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t('知识图谱同步')}</h2>
          <p className="mt-2 text-muted-foreground">
            {t('每日北京时间 00:00 自动同步上游知识图谱')}
          </p>
          <p className="text-muted-foreground">
            {sync.isError
              ? t('同步状态暂时无法加载')
              : sync.data
                ? statusLabels[sync.data.status]
                : t('正在加载…')}
          </p>
          {sync.data?.last_attempt && (
            <p className="text-xs text-muted-foreground">
              {t('上次检查：{{v0}}（北京时间）', {
                v0: localDate(sync.data.last_attempt).format(
                  'YYYY-MM-DD HH:mm',
                ),
              })}
            </p>
          )}
          {sync.data?.last_success && (
            <p className="text-xs text-muted-foreground">
              {t('上次成功：{{v0}}（北京时间）', {
                v0: localDate(sync.data.last_success).format(
                  'YYYY-MM-DD HH:mm',
                ),
              })}
            </p>
          )}
          {sync.data?.error_code && (
            <p className="text-xs text-warning">
              {t('错误代码：{{v0}}', { v0: sync.data.error_code })}
            </p>
          )}
        </div>
        <div className="border-t pt-5">
          <h2 className="text-lg font-semibold">{t('来源与许可')}</h2>
          <p className="mt-2 text-muted-foreground">
            Marble Skill Taxonomy ({source.taxonomyVersion}
            {t(
              ') · © Generative Spark, Inc. (Marble)。数据库依据 ODbL 1.0，原创文本依据 CC BY-SA 4.0。中文名称和练习为学径的新增内容；其中基于原文的翻译同样按 CC BY-SA 4.0 提供。第三方课程标准遵循各自上游条款。',
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-primary">
            <a
              href={source.repository}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {t('上游仓库')}
            </a>
            <a
              href="https://withmarble.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Marble
            </a>
            <a
              href="/api/taxonomy/licenses/LICENSE"
              className="underline underline-offset-4"
            >
              {t('数据库许可')}
            </a>
            <a
              href="/api/taxonomy/licenses/LICENSE-CONTENT"
              className="underline underline-offset-4"
            >
              {t('内容许可')}
            </a>
            <a
              href="/api/taxonomy/licenses/PROVENANCE.md"
              className="underline underline-offset-4"
            >
              {t('第三方来源说明')}
            </a>
          </div>
          <p className="mt-4 text-xs break-all text-muted-foreground">
            {t('当前数据版本：')}
            {source.commit}
          </p>
        </div>
      </Panel>
    </div>
  )
}
