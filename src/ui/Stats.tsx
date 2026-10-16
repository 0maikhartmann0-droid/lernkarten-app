import { deckStats } from '../db/repo';
import { studyHref } from './routes';
import { useLive } from './useLive';

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value * 100)} %`);

export function Stats({ deckId }: { deckId: string }) {
  // null = Deck nicht gefunden (undefined bedeutet bei useLive "lädt noch")
  const stats = useLive(async () => (await deckStats(deckId)) ?? null, [deckId]);

  if (stats === undefined) return <p class="page muted">Lädt …</p>;
  if (stats === null) {
    return (
      <section class="page">
        <h1>Deck nicht gefunden</h1>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </section>
    );
  }

  const tiles: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Heute fällig', value: stats.due },
    { label: 'Neu', value: stats.fresh, hint: 'noch nie gelernt' },
    { label: 'Gelernt', value: `${stats.learned} / ${stats.total}`, hint: 'mind. einmal bewertet' },
    { label: 'Gefestigt', value: stats.mature, hint: 'Abstand ab 21 Tagen' },
    { label: 'Trefferquote', value: percent(stats.accuracyAll), hint: 'alle Bewertungen' },
    { label: 'Trefferquote 7 Tage', value: percent(stats.accuracy7) },
    {
      label: 'Streak',
      value: stats.streak === 1 ? '1 Tag' : `${stats.streak} Tage`,
      hint: 'Lerntage in Folge',
    },
    { label: 'Bewertungen', value: stats.reviewsTotal, hint: `heute: ${stats.reviewsToday}` },
  ];

  return (
    <section class="page">
      <p class="eyebrow">Statistik</p>
      <h1>{stats.deck.title}</h1>
      <dl class="tiles">
        {tiles.map((tile) => (
          <div key={tile.label} class="tile">
            <dt>{tile.label}</dt>
            <dd data-testid={`stat-${tile.label}`}>{tile.value}</dd>
            {tile.hint && <small class="muted">{tile.hint}</small>}
          </div>
        ))}
      </dl>
      <p class="muted">
        Trefferquote = Anteil der Bewertungen „Schwer“, „Gut“ oder „Leicht“.
        {stats.lastReview !== null &&
          ` Zuletzt gelernt: ${new Date(stats.lastReview).toLocaleDateString('de-DE')}.`}
      </p>
      <div class="stack">
        <a class="btn primary" href={studyHref(deckId)}>
          Lernen
        </a>
        <a class="btn" href="#/">
          Zur Deckliste
        </a>
      </div>
    </section>
  );
}
