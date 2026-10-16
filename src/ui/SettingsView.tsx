import { useEffect, useState } from 'preact/hooks';
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  type Backup,
} from '../db/backup';
import { canShareFiles, downloadFile, shareFile } from './files';
import { Modal } from './Modal';
import { loadSettings, restoreSettings, saveSettings, type Settings, type Theme } from './settings';
import { useToast } from './toast';
import { useTrainMode } from './TrainToggle';

export function SettingsView() {
  const [settings, setSettings] = useState(loadSettings);
  const [trainMode, setTrainMode] = useTrainMode();
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    void navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => setOfflineReady(Boolean(registration?.active)));
  }, []);

  // Immer vom gespeicherten Stand ausgehen – der Zugmodus-Schalter schreibt auch von anderer Stelle.
  const update = (patch: Partial<Settings>) => {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    setSettings(next);
  };

  const number = (event: Event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  };

  return (
    <section class="page">
      <h1>Einstellungen</h1>

      <h2>Tageslimits</h2>
      <p class="muted">Gelten pro Deck und Tag. Änderungen werden sofort gespeichert.</p>
      <label class="field">
        Neue Karten pro Tag
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={settings.newPerDay}
          onChange={(e) => update({ newPerDay: number(e) })}
        />
      </label>
      <label class="field">
        Wiederholungen pro Tag
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={settings.reviewsPerDay}
          onChange={(e) => update({ reviewsPerDay: number(e) })}
        />
      </label>

      <h2>Darstellung</h2>
      <label class="field">
        Farbschema
        <select
          value={settings.theme}
          onChange={(e) => update({ theme: e.currentTarget.value as Theme })}
        >
          <option value="auto">Wie das Gerät</option>
          <option value="light">Hell</option>
          <option value="dark">Dunkel</option>
        </select>
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={trainMode}
          onChange={(e) => setTrainMode(e.currentTarget.checked)}
        />
        <span>
          Zugmodus
          <small>
            Größere Schrift und Buttons, Bewertung im 2×2-Raster für den Daumen. Beim Lernen und im
            Quiz bleibt der Bildschirm an (wo der Browser das erlaubt). Auch beim Lernen über das
            Zug-Symbol oben umschaltbar.
          </small>
        </span>
      </label>

      <h2>Quiz</h2>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.typoTolerance}
          onChange={(e) => update({ typoTolerance: e.currentTarget.checked })}
        />
        <span>
          Tippfehler tolerieren
          <small>
            Bei Freitext und Lückentext zählt ein vertippter Buchstabe noch als richtig (ab 4
            Zeichen). Groß-/Kleinschreibung, Leerzeichen und ae/oe/ue statt Umlauten zählen nie als
            Fehler.
          </small>
        </span>
      </label>

      <BackupSection onRestored={() => setSettings(loadSettings())} />

      <StorageSection />

      <h2>Offline</h2>
      <p>
        {offlineReady
          ? 'Die App ist auf diesem Gerät gespeichert und läuft ohne Internet.'
          : 'Die App ist noch nicht offline gespeichert. Seite einmal mit Internet laden; im Entwicklungsmodus (npm run dev) ist der Offline-Speicher aus.'}
      </p>
    </section>
  );
}

function BackupSection({ onRestored }: { onRestored: () => void }) {
  const notify = useToast();
  const [lastBackup, setLastBackup] = useState(() => loadSettings().lastBackup);
  const [pending, setPending] = useState<{ backup: Backup; warnings: string[] } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const share = canShareFiles();

  const build = async () => {
    const now = new Date();
    const settings = { ...loadSettings(), lastBackup: now.getTime() };
    const text = JSON.stringify(await createBackup(settings, now));
    return { name: backupFileName(now), text, now };
  };
  const remember = (now: Date) => {
    saveSettings({ ...loadSettings(), lastBackup: now.getTime() });
    setLastBackup(now.getTime());
  };

  const download = async () => {
    const { name, text, now } = await build();
    downloadFile(name, text);
    remember(now);
    notify(`Backup gespeichert: ${name}`);
  };

  const shareBackup = async () => {
    const { name, text, now } = await build();
    if (await shareFile(name, text)) remember(now);
  };

  const pick = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPending({ backup: result.backup, warnings: result.warnings });
  };

  const restore = async () => {
    if (!pending) return;
    await restoreBackup(pending.backup);
    restoreSettings(pending.backup.settings);
    setPending(null);
    setLastBackup(loadSettings().lastBackup);
    onRestored();
    notify('Backup wiederhergestellt.');
  };

  const exported = pending?.backup.exported ? new Date(pending.backup.exported) : null;

  return (
    <>
      <h2>Sicherung</h2>
      <p class="muted">
        Ein Backup enthält alle Decks, Karten mit Bildern, Lernstände, das Lernprotokoll und die
        Einstellungen. Damit ziehst du auf ein anderes Gerät um oder holst nach dem Löschen der
        Browserdaten alles zurück. Laptop und Handy werden dabei nicht zusammengeführt – ein
        Wiederherstellen ersetzt den Stand des Geräts.
      </p>
      <p>
        {lastBackup > 0
          ? `Letztes Backup: ${new Date(lastBackup).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}`
          : 'Noch kein Backup angelegt.'}
      </p>
      <div class="toolbar">
        <button class="btn primary" type="button" onClick={download}>
          Backup herunterladen
        </button>
        {share && (
          <button class="btn" type="button" onClick={shareBackup}>
            Backup teilen …
          </button>
        )}
        <label class="btn">
          Backup wiederherstellen
          <input
            class="visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={pick}
          />
        </label>
      </div>

      {errors.length > 0 && (
        <div class="notice error" role="alert">
          <strong>Diese Datei lässt sich nicht wiederherstellen</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {pending && (
        <Modal title="Backup wiederherstellen?" onClose={() => setPending(null)}>
          <p>
            Backup
            {exported && !Number.isNaN(exported.getTime())
              ? ` vom ${exported.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}`
              : ''}
            : {pending.backup.decks.length} Deck(s), {pending.backup.cards.length} Karten.
          </p>
          <p>
            <strong>
              Alle Decks und Lernstände auf diesem Gerät werden durch das Backup ersetzt.
            </strong>
          </p>
          {pending.warnings.map((w) => (
            <p key={w} class="muted">
              {w}
            </p>
          ))}
          <div class="modal-actions">
            <button class="btn" type="button" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button class="btn danger-solid" type="button" onClick={restore}>
              Ersetzen und wiederherstellen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function StorageSection() {
  const notify = useToast();
  // null = Browser kann das nicht melden
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted);
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null));
  }, []);

  const request = async () => {
    const granted = await navigator.storage.persist();
    setPersisted(granted);
    notify(
      granted
        ? 'Dauerhafter Speicher ist jetzt aktiv.'
        : 'Der Browser hat abgelehnt. Meist klappt es, nachdem die App installiert wurde.',
      granted ? 'ok' : 'info',
    );
  };

  if (persisted === null && usage === null) return null;

  return (
    <>
      <h2>Speicher</h2>
      {persisted === true && (
        <p>Dauerhafter Speicher ist aktiv – der Browser löscht die Lerndaten nicht von sich aus.</p>
      )}
      {persisted === false && (
        <>
          <p>
            Der Browser darf die Lerndaten löschen, wenn das Gerät knapp an Speicher ist. Mit
            dauerhaftem Speicher passiert das nicht.
          </p>
          <div class="toolbar">
            <button class="btn" type="button" onClick={request}>
              Dauerhaft speichern anfragen
            </button>
          </div>
          <p class="muted">
            Chrome erlaubt das meist erst, wenn die App installiert ist (Menü → App installieren)
            oder regelmäßig genutzt wird. Ein Backup schützt in jedem Fall.
          </p>
        </>
      )}
      {usage !== null && (
        <p class="muted">
          Belegt: {(usage / 1_048_576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB
        </p>
      )}
    </>
  );
}
