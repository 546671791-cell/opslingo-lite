import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  await page.getByRole('button', { name: '⌁ 沟通', exact: true }).click();
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
  await page.getByRole('button', { name: '⌁ 沟通', exact: true }).click();
  const lesson = page.getByText('数字与时间', { exact: true });
  expect(await lesson.count()).toBe(1);
  await lesson.click();
  await expect(page.getByText('💡 文化小贴士')).toBeVisible();
  const header = page.locator('section > header');
  expect(await header.count()).toBe(1);
  expect(await header.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
});
test('shows update controls, word details and bilingual playable dialogue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '⌁ 沟通', exact: true }).click();
  await expect(page.getByRole('button', { name: '↻ 刷新词汇' })).toBeVisible();
  await page.getByText('日常交流', { exact: true }).click();
  await expect(page.getByRole('button', { name: '↻ 检查更新并刷新本主题词汇' })).toBeVisible();
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
