import { useCallback, useEffect, useState } from 'preact/hooks';
import example from '../../examples/beispiel-bauphysik.json';
import {
  applyImport,
  createDeck,
  deckSummaries,
  deleteDeck,
  planImport,
  renameDeck,
  type DeckSummary,
} from '../db/repo';
import { imageName, resolveImages } from '../import/images';
import { parseTabular } from '../import/tabular';
import { parseDeckJson, validateDeck, type ValidationResult } from '../import/validation';
import { imageToDataUri, isImageFile } from './files';
import { cardsHref, editHref, quizHref, statsHref, studyHref } from './routes';
import { loadSettings } from './settings';
import { Modal } from './Modal';
import { useToast } from './toast';
import { useLive } from './useLive';

interface Question {
  title: string;
  text: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

interface Problem {
  file: string;
  errors: string[];
}

const MAX_ERRORS_SHOWN = 15;

export function DeckList() {
  const decks = useLive(() => deckSummaries(), []);
  const notify = useToast();
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [renaming, setRenaming] = useState<DeckSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [pasting, setPasting] = useState(false);

  const ask = useCallback(
    (q: Omit<Question, 'resolve'>) =>
      new Promise<boolean>((resolve) => setQuestion({ ...q, resolve })),
    [],
  );

  const importResult = useCallback(
    async (file: string, result: ValidationResult): Promise<Problem | undefined> => {
      if (!result.ok) return { file, errors: result.errors };
      const valid = result.value;
      const plan = await planImport(valid);
      if (plan.removed > 0 || plan.editedLost > 0) {
        const edited =
          plan.editedLost > 0
            ? ` ${plan.editedLost} in der App bearbeitete oder angelegte Karte(n) werden durch den Stand der Datei ersetzt bzw. entfernt.`
            : '';
        const removed =
          plan.removed > 0
            ? ` ${plan.removed} Karte(n) fehlen in der neuen Datei und werden samt Lernfortschritt entfernt.`
            : '';
        const ok = await ask({
          title: 'Deck aktualisieren?',
          text: `„${valid.deck.title}“ ist bereits vorhanden.${removed}${edited} ${plan.updated} Karte(n) werden aktualisiert, ${plan.added} kommen neu dazu.`,
          confirmLabel: 'Aktualisieren',
          danger: true,
        });
        if (!ok) return undefined;
      }
      await applyImport(valid);
      notify(
        plan.deckExists
          ? `„${valid.deck.title}“ aktualisiert: ${plan.updated} Karten aktualisiert, ${plan.added} neu, ${plan.removed} entfernt. Der Lernfortschritt bleibt erhalten.`
          : `„${valid.deck.title}“ importiert: ${plan.added} Karten.`,
      );
      if (valid.warnings.length > 0) {
        setNotes((list) => [...list, ...valid.warnings.map((w) => `${file}: ${w}`)]);
      }
      // Bittet den Browser, die Lerndaten nicht bei Speicherknappheit zu löschen.
      void navigator.storage?.persist?.();
      return undefined;
    },
    [ask, notify],
  );

  // Bilder, die zusammen mit Deck-Dateien gewählt werden, ersetzen relative Pfade wie "bilder/abb1.png".
  const importFiles = useCallback(
    async (files: File[]) => {
      const found: Problem[] = [];
      setNotes([]);
      const images = new Map<string, string>();
      for (const file of files.filter(isImageFile)) {
        try {
          images.set(imageName(file.name), await imageToDataUri(file));
        } catch {
          found.push({ file: file.name, errors: ['Das Bild konnte nicht gelesen werden.'] });
        }
      }
      const decks = files.filter((f) => !isImageFile(f));
      if (decks.length === 0 && images.size > 0) {
        found.push({
          file: 'Bilder',
          errors: [
            'Nur Bilder ausgewählt – wähle die Deck-Datei (.json) zusammen mit den Bildern aus.',
          ],
        });
      }
      for (const file of decks) {
        try {
          const text = await file.text();
          // .txt/.tsv/.csv: Anki- oder Quizlet-Export; der Dateiname wird zum Deck-Titel.
          const parsed = /\.(txt|tsv|csv)$/i.test(file.name)
            ? parseTabular(text, { title: file.name.replace(/\.[^.]+$/, '') })
            : parseDeckJson(text);
          const problem = await importResult(file.name, withImages(parsed, images));
          if (problem) found.push(problem);
        } catch (error) {
          found.push({
            file: file.name,
            errors: [`Die Datei konnte nicht gelesen werden (${String(error)}).`],
          });
        }
      }
      setProblems(found);
    },
    [importResult],
  );

  // Dateien dürfen irgendwo im Fenster fallen gelassen werden.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      void importFiles([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [importFiles]);

  const onPick = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    void importFiles([...(input.files ?? [])]);
    input.value = '';
  };

  const loadExample = async () => {
    const problem = await importResult('Beispieldeck', validateDeck(example));
    setProblems(problem ? [problem] : []);
  };

  const remove = async ({ deck, total }: DeckSummary) => {
    const ok = await ask({
      title: 'Deck löschen?',
      text: `„${deck.title}“ mit ${total} Karten und dem gesamten Lernfortschritt wird von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    await deleteDeck(deck.id);
    notify(`„${deck.title}“ gelöscht.`, 'info');
  };

  const answer = (ok: boolean) => {
    question?.resolve(ok);
    setQuestion(null);
  };

  return (
    <section class="page">
      <div class="page-head">
        <h1>Meine Decks</h1>
        <label class="btn primary">
          Deck importieren
          <input
            class="visually-hidden"
            type="file"
            accept=".json,application/json,.txt,.tsv,.csv,text/plain,text/tab-separated-values,image/*"
            multiple
            onChange={onPick}
          />
        </label>
      </div>
      <div class="toolbar">
        <button class="btn" type="button" onClick={() => setCreating(true)}>
          Neues Deck
        </button>
        <button class="btn" type="button" onClick={() => setPasting(true)}>
          Text einfügen (Quizlet/Anki)
        </button>
        {decks && decks.length > 0 && (
          <a class="btn" href={cardsHref()}>
            Karten durchsuchen
          </a>
        )}
      </div>

      {decks && decks.length > 0 && <BackupReminder />}

      {problems.map((problem) => (
        <div key={problem.file} class="notice error" role="alert">
          <strong>{problem.file} wurde nicht importiert</strong>
          <ul>
            {problem.errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {problem.errors.length > MAX_ERRORS_SHOWN && (
            <p>… und {problem.errors.length - MAX_ERRORS_SHOWN} weitere Fehler.</p>
          )}
        </div>
      ))}
      {notes.length > 0 && (
        <div class="notice">
          <strong>Hinweise zum Import</strong>
          <ul>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {decks?.length === 0 && (
        <div class="empty">
          <h2>Noch keine Decks</h2>
          <p>
            Importiere eine Deck-Datei (<code>.json</code>) über den Button oben oder ziehe sie in
            dieses Fenster. Alles bleibt auf diesem Gerät – ohne Konto, ohne Internet.
          </p>
          <button class="btn" type="button" onClick={loadExample}>
            Beispieldeck laden
          </button>
        </div>
      )}

      <ul class="decks">
        {decks?.map((summary) => (
          <li key={summary.deck.id} class="deck">
            <div class="deck-head">
              <h2>{summary.deck.title}</h2>
              {summary.deck.subject && <span class="chip">{summary.deck.subject}</span>}
            </div>
            <dl class="counts">
              <div class={summary.due > 0 ? 'hot' : ''}>
                <dt>Fällig</dt>
                <dd data-testid="count-faellig">{summary.due}</dd>
              </div>
              <div>
                <dt>Neu</dt>
                <dd data-testid="count-neu">{summary.fresh}</dd>
              </div>
              <div>
                <dt>Karten</dt>
                <dd>{summary.total}</dd>
              </div>
            </dl>
            <div class="deck-actions">
              <a class="btn primary" href={studyHref(summary.deck.id)}>
                Lernen
              </a>
              <a class="btn" href={cardsHref(summary.deck.id)}>
                Karten
              </a>
              <a class="btn" href={quizHref(summary.deck.id)}>
                Quiz
              </a>
              <a class="btn" href={statsHref(summary.deck.id)}>
                Statistik
              </a>
              <button class="btn quiet" type="button" onClick={() => setRenaming(summary)}>
                Umbenennen
              </button>
              <button class="btn quiet danger" type="button" onClick={() => remove(summary)}>
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>

      {dragging && (
        <div class="dropzone" aria-hidden="true">
          Deck-Datei hier ablegen
        </div>
      )}

      {question && (
        <Modal title={question.title} onClose={() => answer(false)}>
          <p>{question.text}</p>
          <div class="modal-actions">
            <button class="btn" type="button" onClick={() => answer(false)}>
              Abbrechen
            </button>
            <button
              class={`btn ${question.danger ? 'danger-solid' : 'primary'}`}
              type="button"
              onClick={() => answer(true)}
            >
              {question.confirmLabel}
            </button>
          </div>
        </Modal>
      )}

      {renaming && <RenameDialog summary={renaming} onClose={() => setRenaming(null)} />}
      {creating && <NewDeckDialog onClose={() => setCreating(false)} />}
      {pasting && (
        <PasteDialog
          onClose={() => setPasting(false)}
          onImport={async (result) => {
            setNotes([]);
            const problem = await importResult('Eingefügter Text', result);
            if (!problem) setProblems([]);
            return problem?.errors;
          }}
        />
      )}
    </section>
  );
}

function RenameDialog({ summary, onClose }: { summary: DeckSummary; onClose: () => void }) {
  const [title, setTitle] = useState(summary.deck.title);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (title.trim() === '') return;
    await renameDeck(summary.deck.id, title);
    onClose();
  };

  return (
    <Modal title="Deck umbenennen" onClose={onClose}>
      <form onSubmit={submit}>
        <label class="field">
          Titel
          <input
            type="text"
            value={title}
            required
            maxLength={120}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <div class="modal-actions">
          <button class="btn" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button class="btn primary" type="submit">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function withImages(
  result: ValidationResult,
  images: ReadonlyMap<string, string>,
): ValidationResult {
  if (!result.ok) return result;
  const { cards, missing } = resolveImages(result.value.cards, images);
  const warnings = [...result.value.warnings];
  if (missing.length > 0) {
    const list = missing.map((m) => `„${m.path}“ (Karte ${m.cardId})`).join(', ');
    warnings.push(
      `Bilder nicht gefunden: ${list}. Wähle die Bilddateien zusammen mit der Deck-Datei aus, dann werden sie mitimportiert.`,
    );
  }
  return { ok: true, value: { ...result.value, cards, warnings } };
}

const BACKUP_REMINDER_DAYS = 14;

function BackupReminder() {
  const { lastBackup } = loadSettings();
  const days = Math.floor((Date.now() - lastBackup) / 86_400_000);
  if (lastBackup > 0 && days < BACKUP_REMINDER_DAYS) return null;
  return (
    <p class="notice">
      {lastBackup === 0 ? 'Noch kein Backup angelegt. ' : `Letztes Backup vor ${days} Tagen. `}
      Lernstände gibt es nur auf diesem Gerät – <a href="#/einstellungen">jetzt sichern</a>.
    </p>
  );
}

function NewDeckDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');

  const submit = async (event: Event) => {
    event.preventDefault();
    if (title.trim() === '') return;
    const deck = await createDeck(title, subject);
    onClose();
    location.hash = editHref(deck.id);
  };

  return (
    <Modal title="Neues Deck" onClose={onClose}>
      <form onSubmit={submit}>
        <label class="field">
          Titel
          <input
            type="text"
            value={title}
            required
            maxLength={120}
            placeholder="z. B. Holzbau – Verbindungsmittel"
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          Fach (optional)
          <input
            type="text"
            value={subject}
            maxLength={60}
            placeholder="z. B. Holzbaukonstruktion"
            onInput={(e) => setSubject(e.currentTarget.value)}
          />
        </label>
        <div class="modal-actions">
          <button class="btn" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button class="btn primary" type="submit">
            Anlegen und erste Karte schreiben
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface PasteProps {
  onClose: () => void;
  /** Gibt Fehler zurück oder undefined, wenn importiert wurde */
  onImport: (result: ValidationResult) => Promise<string[] | undefined>;
}

/** Quizlet liefert den Export als Text zum Kopieren – deshalb Einfügen statt Datei. */
function PasteDialog({ onClose, onImport }: PasteProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (title.trim() === '') return;
    const result = parseTabular(text, {
      title,
      subject,
      source: 'Eingefügter Text (Quizlet/Anki)',
    });
    const problems = await onImport(result);
    if (problems) setErrors(problems);
    else onClose();
  };

  return (
    <Modal title="Karten aus Text einfügen" onClose={onClose}>
      <form onSubmit={submit}>
        <p class="muted small">
          Eine Karte pro Zeile, Begriff und Definition durch Tab getrennt (Semikolon geht auch).
          Quizlet: Set öffnen → ··· → Exportieren, Voreinstellung „Tab“ und „Neue Zeile“ lassen,
          Text kopieren und hier einfügen.
        </p>
        <label class="field">
          Titel des Decks
          <input
            type="text"
            required
            maxLength={120}
            value={title}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          Fach (optional)
          <input
            type="text"
            maxLength={60}
            value={subject}
            onInput={(e) => setSubject(e.currentTarget.value)}
          />
        </label>
        <label class="field wide">
          Karten
          <textarea
            rows={8}
            required
            spellcheck={false}
            placeholder={'BSH\tBrettschichtholz\nKVH\tKonstruktionsvollholz'}
            value={text}
            onInput={(e) => {
              setText(e.currentTarget.value);
              setErrors([]);
            }}
          />
        </label>
        {errors.length > 0 && (
          <div class="notice error" role="alert">
            <ul>
              {errors.slice(0, MAX_ERRORS_SHOWN).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        <div class="modal-actions">
          <button class="btn" type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button class="btn primary" type="submit">
            Importieren
          </button>
        </div>
      </form>
    </Modal>
  );
}
