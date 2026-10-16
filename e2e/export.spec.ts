import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function openExport(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await page.locator('.deck').getByRole('link', { name: 'Karten' }).click();
  await page.getByText('Exportieren und drucken').click();
}

test('Deck als JSON und für Anki exportieren', async ({ page }) => {
  await openExport(page);

  let downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Deck-Datei (JSON)' }).click();
  let download = await downloading;
  expect(download.suggestedFilename()).toBe('beispiel-bauphysik-grundlagen.json');
  const jsonPath = (await download.path())!;
  const deck = JSON.parse(await readFile(jsonPath, 'utf8'));
  expect(deck.schema).toBe('lernkarten-deck/v1');
  expect(deck.cards).toHaveLength(16);

  downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Für Anki (TSV)' }).click();
  download = await downloading;
  expect(download.suggestedFilename()).toBe('beispiel-bauphysik-grundlagen.txt');
  const lines = (await readFile((await download.path())!, 'utf8')).trimEnd().split('\n');
  expect(lines.slice(0, 3)).toEqual(['#separator:tab', '#html:true', '#tags column:3']);
  expect(lines).toHaveLength(19);

  // Der eigene JSON-Export lässt sich ohne Rückfrage wieder importieren.
  await page.goto('/');
  await page.locator('input[type=file]').first().setInputFiles(jsonPath);
  await expect(
    page.getByText(/aktualisiert: 16 Karten aktualisiert, 0 neu, 0 entfernt/),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Quizlet-Text einfügen und Anki-Datei importieren', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Text einfügen (Quizlet/Anki)' }).click();
  await page.getByLabel('Titel des Decks').fill('Holzbau Begriffe');
  await page.getByLabel('Fach (optional)').fill('Holzbau');
  await page
    .getByLabel('Karten', { exact: true })
    .fill('BSH\tBrettschichtholz\nKVH\tKonstruktionsvollholz');
  await page.getByRole('dialog').getByRole('button', { name: 'Importieren' }).click();
  await expect(page.getByRole('heading', { name: 'Holzbau Begriffe' })).toBeVisible();
  await expect(page.getByTestId('count-neu')).toHaveText('2');

  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Statik Grundlagen.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('#separator:tab\n#html:true\nLast<br>Einheit?\tkN\nMoment?\tkNm\n'),
    });
  await expect(page.getByRole('heading', { name: 'Statik Grundlagen' })).toBeVisible();
});

test('Druckansicht zeigt alle Karten und druckt hell ohne App-Rahmen', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openExport(page);
  await page.getByRole('link', { name: 'Druckansicht' }).click();
  await expect(page.locator('.print-card')).toHaveCount(16);

  await page.getByLabel(/Antworten drucken/).uncheck();
  await expect(page.locator('.print-a')).toHaveCount(0);

  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await expect(page.locator('.appbar')).toBeHidden();
  await expect(page.getByRole('button', { name: /Drucken/ })).toBeHidden();
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(255, 255, 255)');
});
