import { expect, test } from '@playwright/test';

test('läuft nach einmaligem Laden offline und behält den Lernfortschritt', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Meine Decks' })).toBeVisible();

  // Der Service Worker muss installiert sein und die Seite kontrollieren.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await expect(page.getByRole('heading', { name: /Bauphysik/ })).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Meine Decks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Bauphysik/ })).toBeVisible();

  await page.getByRole('link', { name: 'Lernen' }).click();
  await page.getByRole('button', { name: /Antwort zeigen/ }).click();
  await page.getByRole('button', { name: /Gut/ }).click();
  await expect(page.getByRole('button', { name: /Antwort zeigen/ })).toBeVisible();

  // Neustart ohne Netz: die bewertete Karte gilt nicht mehr als neu.
  await page.goto('/');
  await expect(page.getByTestId('count-neu')).toHaveText('15');
});

test('bewertet eine Karte auch bei doppeltem Tastendruck nur einmal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await page.getByRole('link', { name: 'Lernen' }).click();
  await page.getByRole('button', { name: /Antwort zeigen/ }).click();
  await expect(page.getByRole('button', { name: /Gut/ })).toBeVisible();

  // Zwei Tastendrücke im selben Augenblick, bevor die Oberfläche neu zeichnen kann.
  await page.evaluate(() => {
    for (let i = 0; i < 2; i++) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
    }
  });

  await expect(page.getByText('noch 15')).toBeVisible();
  await page.goto('/#/statistik/beispiel-bauphysik-grundlagen');
  await expect(page.getByTestId('stat-Bewertungen')).toHaveText('1');
});

test('Quiz: Richtig/Falsch auswerten, Falsche wiederholen, Ergebnis fließt in die Planung', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispieldeck laden' }).click();
  await page.locator('.deck').getByRole('link', { name: 'Quiz' }).click();

  await page.getByLabel(/Richtig\/Falsch/).check();
  await page.getByText('Alle', { exact: true }).click();
  await page.getByRole('button', { name: /Quiz starten \(3 Fragen\)/ }).click();

  // Im Beispieldeck sind zwei der drei Aussagen richtig.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Richtig', exact: true }).click();
    await page.getByRole('button', { name: /Weiter|Zur Auswertung/ }).click();
  }
  await expect(page.getByRole('heading', { name: '2 von 3 richtig' })).toBeVisible();

  await page.getByRole('button', { name: 'Falsche nochmal üben (1)' }).click();
  await page.getByRole('button', { name: 'Falsch', exact: true }).click();
  await expect(page.getByText('Richtig!')).toBeVisible();
  await page.getByRole('button', { name: 'Zur Auswertung' }).click();
  await expect(page.getByRole('heading', { name: '1 von 1 richtig' })).toBeVisible();

  await page.getByRole('link', { name: 'Zur Deckliste' }).click();
  await expect(page.getByTestId('count-neu')).toHaveText('13');
  await expect(page.getByTestId('count-faellig')).toHaveText('0');
});
