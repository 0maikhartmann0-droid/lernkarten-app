import { expect, test } from '@playwright/test';

// 1×1-Pixel-PNG
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

test('Deck in der App anlegen, Karte schreiben, finden und bearbeiten', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Neues Deck' }).click();
  await page.getByLabel('Titel').fill('Holzbau – Verbindungen');
  await page.getByLabel('Fach (optional)').fill('Holzbau');
  await page.getByRole('button', { name: 'Anlegen und erste Karte schreiben' }).click();

  await expect(page.getByRole('heading', { name: 'Neue Karte' })).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('alert')).toContainText('Feld "front"');

  await page.getByLabel('Frage (Vorderseite)').fill('Was ist ein Stabdübel?');
  await page.getByLabel('Antwort (Rückseite)').fill('Ein glatter, zylindrischer Stift aus Stahl.');
  await page.getByLabel('Tags (mit Komma getrennt)').fill('verbindungsmittel, stahl');
  await expect(page.getByLabel('Vorschau')).toContainText('Stabdübel');
  await page.getByRole('button', { name: 'Speichern' }).click();

  await expect(page.getByRole('heading', { name: 'Holzbau – Verbindungen' })).toBeVisible();
  await page.getByPlaceholder(/Suchen/).fill('stabduebel');
  await expect(page.getByText('Was ist ein Stabdübel?')).toBeVisible();
  await page.getByPlaceholder(/Suchen/).fill('nagel');
  await expect(page.getByText('0 von 1 Karten')).toBeVisible();
  await page.getByPlaceholder(/Suchen/).fill('');
  await page.getByRole('button', { name: /#stahl/ }).click();
  await expect(page.getByText('1 Karten')).toBeVisible();

  await page.getByText('Was ist ein Stabdübel?').click();
  await page.getByLabel('Kartentyp').selectOption('tf');
  await page.getByLabel('Aussage').fill('Stabdübel werden ohne Vorbohren eingeschlagen.');
  await page.getByText('falsch', { exact: true }).click();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('.type-badge')).toHaveText('Richtig/Falsch');
  await expect(page.getByText('Stabdübel werden ohne Vorbohren')).toBeVisible();
});

test('Bilder werden zusammen mit der Deck-Datei importiert', async ({ page }) => {
  const deck = {
    schema: 'lernkarten-deck/v1',
    deck: { id: 'bilder-test', title: 'Bilder-Test', subject: 'Statik' },
    cards: [
      {
        id: 'c1',
        type: 'basic',
        front: 'Welches System?',
        back: 'Einfeldträger',
        image: 'bilder/punkt.png',
      },
      { id: 'c2', type: 'basic', front: 'Ohne Datei', back: 'A', image: 'fehlt.png' },
    ],
  };
  await page.goto('/');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      {
        name: 'deck.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(deck)),
      },
      { name: 'punkt.png', mimeType: 'image/png', buffer: PIXEL },
    ]);
  await expect(page.getByText('Bilder nicht gefunden: „fehlt.png“ (Karte c2)')).toBeVisible();

  await page.getByRole('link', { name: 'Lernen' }).click();
  await expect(page.locator('.card img')).toHaveAttribute('src', /^data:image\/png;base64,/);
});

test('Zugmodus vergrößert die Bedienung und bleibt nach dem Neuladen an', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await page.getByRole('link', { name: 'Lernen' }).click();
  await page.getByRole('button', { name: 'Zugmodus' }).click();
  await expect(page.locator('html')).toHaveClass(/train/);

  // Antippen der Karte deckt auf.
  await page.locator('.card').click();
  const height = await page.getByRole('button', { name: /Gut/ }).evaluate((b) => b.clientHeight);
  expect(height).toBeGreaterThanOrEqual(80);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/train/);
});

test('Backup herunterladen und auf leerem Gerät wiederherstellen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await page.getByRole('link', { name: 'Lernen' }).click();
  await page.getByRole('button', { name: /Antwort zeigen/ }).click();
  await page.getByRole('button', { name: /Gut/ }).click();
  await expect(page.getByText('noch 15')).toBeVisible();

  await page.goto('/#/einstellungen');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup herunterladen' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^lernkarten-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();

  // Gerät "leeren": Deck löschen
  await page.goto('/');
  await page.getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Decks' })).toBeVisible();

  await page.goto('/#/einstellungen');
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByRole('dialog')).toContainText('1 Deck(s), 16 Karten');
  await page.getByRole('button', { name: 'Ersetzen und wiederherstellen' }).click();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bauphysik/ })).toBeVisible();
  await expect(page.getByTestId('count-neu')).toHaveText('15');
});
