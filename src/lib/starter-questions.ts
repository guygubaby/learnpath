import { translateText } from './i18n-core'
import type { Locale } from './locale'
import type { QuestionContent } from './contracts'

function choices(
  question: string,
  correct: string,
  wrong: string[],
  explanation: string,
): QuestionContent {
  const options = [correct, ...wrong].sort(() => Math.random() - 0.5)
  return {
    question,
    options,
    correctIndex: options.indexOf(correct),
    explanation,
  }
}
function numberChoices(question: string, answer: number, explanation: string) {
  return choices(
    question,
    String(answer),
    [answer + 1, answer + 2, Math.max(0, answer - 1)].map(String),
    explanation,
  )
}

export function starterQuestion(
  topicId: string,
  locale: Locale = 'zh-CN',
): QuestionContent | null {
  const t = (key: string, variables?: Record<string, unknown>) =>
    translateText(key, locale, variables)
  const a = 2 + Math.floor(Math.random() * 5)
  const b = 1 + Math.floor(Math.random() * 3)
  if (
    [
      'mt_yJmvUCCym7',
      'mt_OvyoRo47K-',
      'mt_PgsHGYJMH-',
      'mt_PpWSHA-0kv',
      'mt_m1W6nTQJ2b',
    ].includes(topicId)
  ) {
    return numberChoices(
      t('篮子里有 {{v0}} 个苹果，又放入 {{v1}} 个。现在一共有几个苹果？', {
        v0: a,
        v1: b,
      }),
      a + b,
      t(
        '可以先数 {{v0}} 个，再接着数 {{v1}} 个，也可以算 {{v2}} + {{v3}} = {{v4}}。',
        { v0: a, v1: b, v2: a, v3: b, v4: a + b },
      ),
    )
  }
  if (topicId === 'mt_nvdpxAJTBG') {
    const step = [2, 5, 10][Math.floor(Math.random() * 3)]
    return numberChoices(
      t(
        '按每次增加 {{v0}} 的规律数数：{{v1}}、{{v2}}、{{v3}}，下一个数是多少？',
        { v0: step, v1: step, v2: step * 2, v3: step * 3 },
      ),
      step * 4,
      t('每次加 {{v0}}，所以 {{v1}} + {{v2}} = {{v3}}。', {
        v0: step,
        v1: step * 3,
        v2: step,
        v3: step * 4,
      }),
    )
  }
  if (
    [
      'mt_GRWwTDZ3wD',
      'mt_PZ909yPrEC',
      'mt_wh3UqnWsa7',
      'mt_B1zj1RwQ3a',
    ].includes(topicId)
  ) {
    return numberChoices(
      t('有 {{v0}} 排小树，每排 {{v1}} 棵，一共有多少棵？', {
        v0: a,
        v1: b + 1,
      }),
      a * (b + 1),
      t('{{v0}} 个 {{v1}} 相加就是 {{v2}} × {{v3}} = {{v4}}，每排数量相等。', {
        v0: a,
        v1: b + 1,
        v2: a,
        v3: b + 1,
        v4: a * (b + 1),
      }),
    )
  }
  if (['mt_cFltwUQi-d', 'mt_MyGblah2yY'].includes(topicId)) {
    const total = (a + 1) * 4
    return numberChoices(
      t('把 {{v0}} 颗葡萄平均分成 4 份，其中 1 份有几颗？', { v0: total }),
      total / 4,
      t(
        '四分之一表示平均分成 4 份后取其中 1 份：{{v0}} ÷ 4 = {{v1}}。平均分是关键。',
        { v0: total, v1: total / 4 },
      ),
    )
  }
  if (['mt_FbDKeLfBCo', 'mt_FP-mjXaq3B'].includes(topicId)) {
    return choices(
      t(
        '把一张纸平均分成 {{v0}} 份，涂色 {{v1}} 份。涂色部分等于下面哪个分数？',
        { v0: a * 2, v1: a },
      ),
      '1/2',
      ['1/3', '1/4', '2/3'],
      t(
        '{{v0}}/{{v1}} 的分子和分母同时除以 {{v2}}，得到 1/2。它们表示同样大的部分。',
        { v0: a, v1: a * 2, v2: a },
      ),
    )
  }
  if (['mt_CBHwluE6Lp', 'mt_a1FdAsRKOF'].includes(topicId)) {
    const denominator = 8 + a
    return choices(
      t('计算：{{v0}}/{{v1}} + {{v2}}/{{v3}} = ？（保留原来的分母）', {
        v0: a,
        v1: denominator,
        v2: b,
        v3: denominator,
      }),
      `${a + b}/${denominator}`,
      [
        `${a + b}/${denominator * 2}`,
        `${a + b - 1}/${denominator}`,
        `${a}/${denominator + b}`,
      ],
      t(
        '每一份的大小都是 1/{{v0}}，只需要把份数相加：{{v1}} + {{v2}} = {{v3}}，分母保持不变。',
        { v0: denominator, v1: a, v2: b, v3: a + b },
      ),
    )
  }
  if (['mt_Qkewo5M3_c', 'mt_fhqVdj4BYr', 'mt_V2lNzEex_a'].includes(topicId)) {
    const bank: QuestionContent[] = [
      choices(
        t('晴天过后，地面上的小水洼变小了。水主要发生了什么变化？'),
        t('液态水蒸发成水蒸气，进入空气'),
        [
          t('水被阳光变成了石头'),
          t('水完全消失，不再存在'),
          t('水变成了看不见的沙子'),
        ],
        t(
          '水受到太阳加热会蒸发，变成气态的水蒸气进入空气。水仍然存在，只是状态和位置改变了。',
        ),
      ),
      choices(
        t('水蒸气冷却，变成许多小水滴，这个过程叫什么？'),
        t('凝结'),
        [t('蒸发'), t('融化'), t('燃烧')],
        t(
          '气态的水蒸气冷却后变成液态小水滴，这叫凝结。云中的小水滴可由这个过程形成。',
        ),
      ),
      choices(
        t('水循环中，海洋表面大量水蒸发的主要能量来自哪里？'),
        t('太阳'),
        [t('月亮的颜色'), t('海底的沙子'), t('鱼的游动')],
        t('太阳为地表提供能量，使海洋、湖泊中的水蒸发，推动水循环。'),
      ),
    ]
    return bank[Math.floor(Math.random() * bank.length)]
  }
  if (topicId === 'mt_jgNB2752b9')
    return choices(
      t('两根磁铁的北极面对北极，通常会发生什么？'),
      t('互相排斥'),
      [t('互相吸引'), t('马上融化'), t('磁极消失')],
      t('同名磁极相互排斥，异名磁极相互吸引。北极和北极是同名磁极。'),
    )
  if (topicId === 'mt_9NvuqZKNiV')
    return choices(
      t('下面哪种物品通常能被普通磁铁吸引？'),
      t('铁钉'),
      [t('木头积木'), t('塑料尺'), t('铜片')],
      t(
        '铁是常见的磁性材料，普通磁铁通常能吸引铁钉。并不是所有金属都能被磁铁吸引。',
      ),
    )
  if (topicId === 'mt_YQkUdIHO8L')
    return choices(
      t('把水从杯子倒进碗里，水会流动并适应碗的形状。这体现了什么性质？'),
      t('液体能流动，形状随容器改变'),
      [t('液体永远保持杯子的形状'), t('液体会立即变成固体'), t('液体没有体积')],
      t(
        '液体能流动，通常保持一定体积，但没有固定形状。它会适应所处容器的形状。',
      ),
    )
  if (['mt_EygMHKs8Ed', 'mt_QH-Fs97twT'].includes(topicId))
    return choices(
      t('在“叶子 → 毛毛虫 → 小鸟”的食物链中，箭头表示什么？'),
      t('食物中的能量传递方向'),
      [t('动物移动的方向'), t('动物体型从大到小'), t('生物出生的先后顺序')],
      t('箭头从被吃的生物指向吃它的生物，表示食物中的能量传递方向。'),
    )
  return null
}
