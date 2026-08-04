import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('show-onboarding-test'))
      localStorage.setItem('opslite-onboarding-v2', 'complete');
  });
});

test('installs a chosen offline pack and changes to a different vocabulary batch', async ({
  page
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('show-onboarding-test', 'true');
    localStorage.removeItem('opslite-onboarding-v2');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '选择你的英语词汇包' })).toBeVisible();
  await page.getByRole('checkbox', { name: /核心基础 3000/ }).uncheck();
  await page.getByRole('checkbox', { name: /能力进阶 5000/ }).uncheck();
  await page.getByRole('button', { name: /安装所选 1 个词汇包并开始/ }).click();
  await expect(page.getByRole('button', { name: '⌁ 课程', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  await page.getByText('日常交流', { exact: true }).click();
  const firstWord = page.locator('.expression-card strong').first();
  const before = await firstWord.textContent();
  await page.getByRole('button', { name: /换一批新词/ }).click();
  await expect(firstWord).not.toHaveText(before ?? '');
});

test('loads 48 scenarios, filters, trains and persists', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('OpsLingo Lite')).toBeVisible();
  await page.getByRole('button', { name: '▦ 场景', exact: true }).click();
  await expect(page.getByText('48 个场景')).toBeVisible();
  await page.getByLabel('业务').selectOption('hotel');
  await page.getByLabel('沟通方式').selectOption('email');
  await expect(page.getByText('12 个场景')).toBeVisible();
  await page.getByText('找不到订单').first().click();
  await page.getByRole('button', { name: '开始训练' }).click();
  await page.getByLabel('邮件主题').fill('Please confirm booking');
  await page
    .getByLabel('邮件正文')
    .fill('Dear hotel team, could you please confirm booking ABCDE? Thank you. Best regards.');
  await page.getByRole('button', { name: '提交本地规则评分' }).click();
  await expect(page.getByRole('heading', { name: /本地规则评分/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '▥ 进度', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学习进度' })).toBeVisible();
});
test('supports vocabulary and baseline accessibility', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  await page.getByRole('button', { name: '+ 添加词句' }).click();
  await page.getByPlaceholder('英文词句').fill('Please confirm in writing.');
  await page.getByPlaceholder('中文解释').fill('请书面确认。');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('Please confirm in writing.')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((x) => ['critical', 'serious'].includes(x.impact ?? ''))
  ).toEqual([]);
});
test('has no horizontal overflow on mobile', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
test('keeps the header fixed and shows communication tips', async ({ page }) => {
  await page.goto('/');
  const homeHeader = page.locator('section > header');
  const hero = page.locator('.hero');
  const positions = await Promise.all([homeHeader.boundingBox(), hero.boundingBox()]);
  expect(positions[0]).not.toBeNull();
  expect(positions[1]).not.toBeNull();
  expect(positions[1]!.y).toBeGreaterThanOrEqual(positions[0]!.y + positions[0]!.height + 10);
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  const lesson = page.getByText('数字与时间', { exact: true });
  expect(await lesson.count()).toBe(1);
  await lesson.click();
  await expect(page.getByText('💡 文化小贴士')).toBeVisible();
  const header = page.locator('section > header');
  expect(await header.count()).toBe(1);
  expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
});
test('writes live English speech recognition into the reply box', async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        window.setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'Could I get the check please?' }]] });
          this.onend?.();
        }, 20);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '继续训练' })).toBeVisible();
  await page.getByRole('button', { name: '◌ 对话', exact: true }).click();
  await page.getByRole('button', { name: /用英语说出回复/ }).click();
  await expect(page.getByPlaceholder('输入英文回复…')).toHaveValue('Could I get the check please?');
});
test('offers offline voice setup and local shadowing feedback', async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        window.setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: 'Could I get the check please' }]] });
          this.onend?.();
        }, 20);
      }
      stop() {
        this.onend?.();
      }
    }
    (window as any).SpeechRecognition = MockSpeechRecognition;
    (window as any).webkitSpeechRecognition = MockSpeechRecognition;
  });
  await page.goto('/');
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  await page.getByRole('button', { name: /在美国餐厅点餐/ }).click();
  await page
    .getByRole('button', { name: /影子跟读/ })
    .first()
    .click();
  await expect(page.getByText(/核心发音包已随应用内置/)).toBeVisible();
  await page.getByRole('button', { name: '🎙 开始本地跟读判断' }).click();
  await expect(page.getByText('本地跟读匹配分')).toBeVisible();
  await expect(page.getByLabel('逐词匹配结果')).toBeVisible();
});
test('shows update controls, word details and bilingual playable dialogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  await expect(page.getByRole('button', { name: '管理离线词汇包' })).toBeVisible();
  await page.getByText('日常交流', { exact: true }).click();
  await expect(page.getByRole('button', { name: /换一批新词/ })).toBeVisible();
  await page
    .getByRole('button', { name: /conversation/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: /conversation 词汇详情/ })).toContainText('拼读：');
  await page.getByRole('button', { name: '关闭词汇详情' }).click();
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '◌ 对话', exact: true }).click();
  await expect(page.locator('.bubble.partner small')).toBeVisible();
  await expect(page.locator('.bubble.partner .speak-button')).toBeVisible();
  await expect(page.locator('.choice-card small').first()).toBeVisible();
  await expect(page.locator('.choice-card .speak-button').first()).toBeVisible();
});
test('switches CEFR levels and study methods in the US life curriculum', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌁ 课程', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今天想把英语练到哪一级？' })).toBeVisible();
  await page.getByRole('button', { name: /C2 精通/ }).click();
  await expect(page.locator('.level-badge')).toHaveText('C2');
  await page.getByRole('button', { name: /在美国餐厅点餐/ }).click();
  await expect(page.getByText('用自然语气协商特殊需求')).toBeVisible();
  await expect(page.getByText(/I know it is a bit specific/)).toBeVisible();
  await page
    .getByRole('button', { name: /五遍精听/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: '朗读 慢速示范' })).toBeVisible();
  await expect(page.getByText('复述：脱离文字说出来')).toBeVisible();
  await page
    .getByRole('button', { name: /任务对话/ })
    .first()
    .click();
  await expect(page.locator('.course-dialogue .bubble')).toHaveCount(2);
  await expect(page.locator('.course-dialogue small').first()).toContainText('你好');
});
