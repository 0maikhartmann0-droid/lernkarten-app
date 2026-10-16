import { describe, expect, it } from 'vitest';
import type { CardContent } from '../db/types';
import { imageName, resolveImages } from './images';

describe('Bilder beim Import', () => {
  it('vergleicht nur den Dateinamen', () => {
    expect(imageName('bilder/Abb%201.PNG?v=2')).toBe('abb 1.png');
    expect(imageName('C:\\Lernen\\folie12.jpg')).toBe('folie12.jpg');
  });

  it('ersetzt gefundene Bilder und meldet fehlende', () => {
    const base = { type: 'basic' as const, front: 'F', back: 'A', tags: [] };
    const cards: CardContent[] = [
      { ...base, id: 'a', image: 'bilder/stoss.png' },
      { ...base, id: 'b', image: 'fehlt.png' },
      { ...base, id: 'c', image: 'data:image/png;base64,AAA' },
      { ...base, id: 'd', tags: [] },
    ];
    const result = resolveImages(cards, new Map([['stoss.png', 'data:image/png;base64,XYZ']]));
    expect(result.cards.map((c) => c.image)).toEqual([
      'data:image/png;base64,XYZ',
      'fehlt.png',
      'data:image/png;base64,AAA',
      undefined,
    ]);
    expect(result.missing).toEqual([{ cardId: 'b', path: 'fehlt.png' }]);
  });
});
