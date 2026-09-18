/** 記事用スクリーンショット撮影：デモデータをIndexedDBへ投入して主要画面を撮る */
import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const EDGE =
  'C:/Users/user/.cache/puppeteer/chrome-headless-shell/win64-153.0.8010.52/chrome-headless-shell-win64/chrome-headless-shell.exe';
const BASE = 'http://localhost:5173';
const OUT = 'article';
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  userDataDir: `${process.env.TEMP}/cc-shot-profile2`,
});
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// デモデータ投入（アプリと同じスキーマ）
await page.evaluate(async () => {
  const STORES = ['beanBatches', 'groups', 'brews', 'comparisons', 'drafts', 'baselineChanges', 'settings'];
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('coffee-compare', 1);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const params1 = { doseG: 15, waterMl: 240, grind: 'C40 24クリック', tempC: 92, totalTimeSec: 165, bloomTimeSec: 30, pourNote: null };
  const params2 = { ...params1, tempC: 90, totalTimeSec: 180 };
  const tx = db.transaction(STORES, 'readwrite');
  tx.objectStore('settings').put({ key: 'settings', schemaVersion: 1, lastBackupAt: null, activeGroupId: 'g1', storageNoticeAcknowledged: true });
  tx.objectStore('beanBatches').put({ id: 'bean1', name: 'エチオピア イルガチェフェ', roastLevel: 'light', purchasedAt: '2026-09-12', roastedAt: '2026-09-05' });
  tx.objectStore('groups').put({ id: 'g1', beanBatchId: 'bean1', brewerName: 'V60 02', grinderName: 'C40', baselineBrewId: 'b2', archivedAt: null, createdAt: '2026-09-17T08:00:00.000Z' });
  tx.objectStore('brews').put({ id: 'b1', groupId: 'g1', brewedAt: '2026-09-17T08:30:00.000Z', params: params1, note: '酸味が華やかで好み', revisionOf: null });
  tx.objectStore('brews').put({ id: 'b2', groupId: 'g1', brewedAt: '2026-09-19T08:30:00.000Z', params: params2, note: 'まろやかで甘さが出た', revisionOf: null });
  tx.objectStore('comparisons').put({
    id: 'c1', groupId: 'g1', baselineBrewId: 'b1', trialBrewId: 'b2', plannedChanges: ['tempC'],
    preference: 'trial', relativeTaste: { acidity: 'weaker', bitterness: 'same', body: 'same' },
    comparisonMode: 'remembered', evaluatedAt: '2026-09-19T08:45:00.000Z', createdAt: '2026-09-19T08:40:00.000Z',
  });
  tx.objectStore('baselineChanges').put({ id: 'bc1', groupId: 'g1', fromBrewId: null, toBrewId: 'b1', changedAt: '2026-09-17T08:35:00.000Z' });
  tx.objectStore('baselineChanges').put({ id: 'bc2', groupId: 'g1', fromBrewId: 'b1', toBrewId: 'b2', changedAt: '2026-09-19T08:46:00.000Z' });
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickByText = (text) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

await page.reload({ waitUntil: 'networkidle0' });
await sleep(800);
await page.screenshot({ path: `${OUT}/01-home.png` });
console.log('01-home.png');

await clickByText('くらべる');
await sleep(500);
await page.screenshot({ path: `${OUT}/02-history.png` });
console.log('02-history.png');

await page.evaluate(() => document.querySelector('.history-card')?.click());
await sleep(600);
// fullPage撮影ではfixedのタブバーが中央に写り込むため一時的に隠す
await page.evaluate(() => {
  document.querySelector('.tabbar')?.setAttribute('style', 'display:none');
});
await page.screenshot({ path: `${OUT}/03-compare.png`, fullPage: true });
await page.evaluate(() => {
  document.querySelector('.tabbar')?.removeAttribute('style');
});
console.log('03-compare.png');

await clickByText('設定');
await sleep(500);
await page.screenshot({ path: `${OUT}/04-settings.png` });
console.log('04-settings.png');

await browser.close();
console.log('done');
