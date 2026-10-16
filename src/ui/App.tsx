import { useEffect, useState } from 'preact/hooks';
import { CardEditor } from './CardEditor';
import { Cards } from './Cards';
import { DeckList } from './DeckList';
import { Quiz } from './Quiz';
import { PrintView } from './PrintView';
import { parseHash } from './routes';
import { SettingsView } from './SettingsView';
import { Stats } from './Stats';
import { Study } from './Study';
import { ToastProvider, useToast } from './toast';

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  const notify = useToast();

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    const onOffline = () => notify('Offline bereit – die App läuft jetzt auch ohne Internet.');
    window.addEventListener('hashchange', onHash);
    window.addEventListener('lernkarten-offline-bereit', onOffline);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('lernkarten-offline-bereit', onOffline);
    };
  }, [notify]);

  return (
    <>
      <header class="appbar">
        <a class="brand" href="#/">
          Lernkarten
        </a>
        <nav aria-label="Hauptnavigation">
          <a href="#/" aria-current={route.name === 'decks' ? 'page' : undefined}>
            Decks
          </a>
          <a href="#/quiz" aria-current={route.name === 'quiz' ? 'page' : undefined}>
            Quiz
          </a>
          <a href="#/einstellungen" aria-current={route.name === 'settings' ? 'page' : undefined}>
            Einstellungen
          </a>
        </nav>
      </header>
      <main>
        {route.name === 'decks' && <DeckList />}
        {route.name === 'study' && <Study key={route.deckId} deckId={route.deckId} />}
        {route.name === 'stats' && <Stats deckId={route.deckId} />}
        {route.name === 'quiz' && <Quiz key={route.deckId ?? ''} deckId={route.deckId} />}
        {route.name === 'cards' && <Cards key={route.deckId ?? ''} deckId={route.deckId} />}
        {route.name === 'edit' && (
          <CardEditor
            key={`${route.deckId}/${route.cardId ?? ''}`}
            deckId={route.deckId}
            cardId={route.cardId}
          />
        )}
        {route.name === 'print' && <PrintView deckId={route.deckId} />}
        {route.name === 'settings' && <SettingsView />}
      </main>
    </>
  );
}
