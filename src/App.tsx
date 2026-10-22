import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { exportProgress, parseProgress } from './backup';
import { ensureBundledPack } from './bundled';
import { answerOptions, selectNext, statistics, type Selection } from './learning';
import { localDay, type Progress, type Settings, type Vocabulary } from './model';
import { createAssetUrls, importFolder } from './packs';
import { Repository, StaleProgressError, type Snapshot } from './storage';

const repository = new Repository();
interface Question { target: Vocabulary; options: Vocabulary[]; selection: Selection }
interface Feedback { selectedId: string; correct: boolean }
function message(error: unknown) {
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'Der Browserspeicher ist voll. Die Änderung wurde nicht gespeichert. Exportiere deinen Lernstand und schaffe Speicherplatz.';
  if (error instanceof Error && error.name === 'ZodError') return 'Die Datei entspricht nicht dem erwarteten Format. Bitte prüfe die Felder anhand der Dokumentation.';
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
}
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Flag({ value }: { value?: string }) { return <span aria-hidden="true">{value ?? '🌐'}</span>; }
function Modal({ children, title, close }: { children: React.ReactNode; title: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); close(); }} aria-label={title}>
    <header><h2>{title}</h2><button className="close" aria-label="Schließen" onClick={close}>×</button></header>{children}
  </dialog>;
}
export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const hashes = useRef<Record<string, string>>({});
  const ownedUrls = useRef<Record<string, string>>({});
  const [question, setQuestion] = useState<Question>();
  const [selection, setSelection] = useState<Selection>({ reason: 'complete' });
  const [feedback, setFeedback] = useState<Feedback>();
  const [practice, setPractice] = useState(false);
  const [ended, setEnded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Settings>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [audioNotice, setAudioNotice] = useState('');
  const [pendingBackup, setPendingBackup] = useState<Progress>();
  const [now, setNow] = useState(new Date());
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const player = useRef<HTMLAudioElement | undefined>(undefined);
  const previousId = useRef<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const initial = useRef(true);
  const lastCheckedDay = useRef(localDay(new Date()));

  const nextQuestion = useCallback((state: Snapshot, freePractice: boolean, previous?: string) => {
    if (!state.pack) return;
    const selected = selectNext({ packId: state.pack.id, vocabulary: state.pack.vocabulary,
      cards: state.cards, settings: state.settings, now: new Date(), previousId: previous, practice: freePractice });
    setSelection(selected); setFeedback(undefined); locked.current = false;
    setQuestion(selected.word ? { target: selected.word,
      options: answerOptions(selected.word, state.pack.vocabulary, Math.random, hashes.current), selection: selected } : undefined);
  }, []);
  const loadAssets = useCallback(async () => {
    const assets = await repository.assets();
    const nextUrls = await createAssetUrls(assets);
    Object.values(ownedUrls.current).forEach(URL.revokeObjectURL);
    ownedUrls.current = nextUrls;
    hashes.current = Object.fromEntries(assets.map(a => [a.path, a.sha256]));
    setUrls(nextUrls);
  }, []);
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        let state = await repository.snapshot(false);
        if (!active) return;
        if (!state.pack) {
          setSnapshot(state); setBusy('Wortschatz laden …');
          await ensureBundledPack(repository, text => { if (active) setBusy(text); });
          state = await repository.snapshot(false);
        }
        if (!active) return;
        setBusy('');
        await loadAssets();
        if (!active) return;
        setSnapshot(state); nextQuestion(state, false); initial.current = false;
      } catch (cause) { if (active) { setError(message(cause)); setBusy(''); initial.current = false; } }
    }
    void start();
    return () => { active = false; clearTimeout(timer.current); player.current?.pause(); };
  }, [loadAssets, nextQuestion]);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!snapshot || question || ended || practice || settingsOpen || busy) return;
    const due = snapshot.cards.some(c => c.language === snapshot.settings.language && c.card.due <= now);
    const dayChanged = lastCheckedDay.current !== localDay(now);
    lastCheckedDay.current = localDay(now);
    if (due || dayChanged) nextQuestion(snapshot, false, previousId.current);
  }, [now, snapshot, question, ended, practice, settingsOpen, busy, nextQuestion]);
  useEffect(() => {
    if (!snapshot?.pack?.font || !urls[snapshot.pack.font]) return;
    let active = true;
    const face = new FontFace('VocabularyPack', `url(${urls[snapshot.pack.font]})`);
    void face.load().then(loaded => { if (active) { document.fonts.add(loaded); document.documentElement.classList.add('pack-font'); } })
      .catch(() => setError('Die importierte Schrift konnte nicht geladen werden.'));
    return () => { active = false; document.fonts.delete(face); document.documentElement.classList.remove('pack-font'); };
  }, [snapshot?.pack?.font, urls]);
  const playAudio = useCallback(async (word: Vocabulary, automatic = false) => {
    player.current?.pause();
    const source = urls[word.audio];
    if (!source) { setAudioNotice('Die Audioaufnahme fehlt. Bitte den Wortschatz erneut importieren.'); return; }
    const audio = new Audio(source); player.current = audio;
    try { await audio.play(); setAudioNotice(''); }
    catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setAudioNotice(automatic ? 'Wort anklicken, um die Aussprache zu hören.' : 'Die Aufnahme konnte nicht abgespielt werden. Bitte prüfe Audioausgabe und Datei.');
    }
  }, [urls]);
  useEffect(() => {
    if (question && !settingsOpen && !ended) void playAudio(question.target, true);
    return () => player.current?.pause();
  }, [question, playAudio, settingsOpen, ended]);
  useEffect(() => {
    const update = () => {
      if (!snapshot || locked.current || busy || document.visibilityState === 'hidden') return;
      void repository.snapshot(false).then(state => {
        if (state.revision !== snapshot.revision) {
          setSnapshot(state); setPendingBackup(undefined); setSettingsDraft(undefined); setSettingsOpen(false);
          void loadAssets().then(() => nextQuestion(state, practice, previousId.current)).catch(cause => setError(message(cause)));
        }
      }).catch(cause => setError(message(cause)));
    };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [snapshot, busy, practice, loadAssets, nextQuestion]);

  async function answer(word: Vocabulary) {
    if (!snapshot?.pack || !question || locked.current || busy || settingsOpen || ended) return;
    locked.current = true; setError(''); player.current?.pause();
    const correct = word.id === question.target.id;
    try {
      let updated = snapshot;
      if (!practice) {
        await repository.answer({ packId: snapshot.pack.id, word: question.target, answerId: word.id,
          now: new Date(), revision: snapshot.revision, reviewId: crypto.randomUUID() });
        updated = await repository.snapshot(false);
        setSnapshot(updated);
      }
      setFeedback({ selectedId: word.id, correct });
      previousId.current = question.target.id;
      timer.current = setTimeout(() => {
        try { nextQuestion(updated, practice, previousId.current); }
        catch (cause) { setError(message(cause)); locked.current = false; }
      }, correct ? 850 : 1700);
    } catch (cause) {
      setError(message(cause)); locked.current = false;
      if (cause instanceof StaleProgressError) {
        const updated = await repository.snapshot(false); setSnapshot(updated); await loadAssets(); nextQuestion(updated, practice, previousId.current);
      }
    }
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (settingsOpen || !question || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index >= 0) { event.preventDefault(); void answer(question.options[index]); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  async function handleFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = '';
    if (!files.length || locked.current) return;
    setBusy('Wortschatz prüfen …'); setError(''); player.current?.pause();
    try {
      const { pack, assets } = await importFolder(files, setBusy);
      const state = snapshot ?? await repository.snapshot(false);
      await repository.installPack(pack, assets, state.revision);
      await loadAssets();
      const updated = await repository.snapshot(false); setSnapshot(updated);
      setPractice(false); setEnded(false); setSettingsOpen(false); nextQuestion(updated, false);
      void navigator.storage?.persist().catch(() => false);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(''); }
  }
  function openSettings() {
    if (!snapshot || locked.current || busy) return;
    setSettingsDraft({ ...snapshot.settings }); setSettingsOpen(true); player.current?.pause(); setError('');
  }
  async function saveSettings() {
    if (!snapshot || !settingsDraft) return;
    setBusy('Einstellungen speichern …'); setError('');
    try {
      await repository.saveSettings(settingsDraft, snapshot.revision);
      const updated = await repository.snapshot(false); setSnapshot(updated); setSettingsOpen(false); setEnded(false);
      nextQuestion(updated, practice, previousId.current);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(''); }
  }
  async function handleBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !snapshot?.pack) return;
    setError('');
    try {
      if (file.size > 100 * 1024 * 1024) throw new Error('Die Sicherung ist größer als 100 MB.');
      setPendingBackup(parseProgress(await file.text(), snapshot.pack));
    } catch (cause) { setError(message(cause)); }
  }
  async function restoreBackup() {
    if (!snapshot || !pendingBackup) return;
    setBusy('Sicherung importieren …'); setError('');
    try {
      await repository.restore(pendingBackup, snapshot.revision);
      const updated = await repository.snapshot(false); setSnapshot(updated); setPendingBackup(undefined);
      setSettingsDraft(updated.settings); setSettingsOpen(false); setEnded(false); setPractice(false); nextQuestion(updated, false);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(''); }
  }
  async function saveBackup() {
    if (!snapshot?.pack) return;
    try { download(`babadum-lernstand-${localDay(new Date())}.json`, exportProgress(snapshot.pack.id, await repository.snapshot())); }
    catch (cause) { setError(message(cause)); }
  }
  const pack = snapshot?.pack;
  const language = pack?.languages.find(l => l.id === snapshot?.settings.language);
  const stats = snapshot && pack ? statistics(pack.id, snapshot.cards, snapshot.settings.language, now) : undefined;
  const totalCorrect = snapshot?.cards.reduce((sum, c) => sum + c.correct, 0) ?? 0;
  const vocabularyCount = pack?.vocabulary.filter(w => w.language === snapshot?.settings.language).length ?? 0;
  const backdrop = ['#bf8824', '#faf082', '#d9ddbc', '#9ccbd0'];

  return <main className="app">
    <input ref={fileInput} type="file" aria-label="Wortschatzordner" className="hidden-input"
      {...{ webkitdirectory: '', directory: '' }} multiple onChange={handleFolder} disabled={!!busy} />
    <div className={`board ${feedback ? 'answered' : ''}`} aria-label="Vier Antwortbilder">
      {[0, 1, 2, 3].map(index => {
        const word = question?.options[index];
        const isCorrect = !!feedback && word?.id === question?.target.id;
        const isWrong = !!feedback && !feedback.correct && word?.id === feedback.selectedId;
        return <button key={word ? `${question!.target.id}-${word.id}` : index}
          className={`tile ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''} ${feedback && !isCorrect && !isWrong ? 'muted' : ''}`}
          style={{ '--tile-color': word?.background ?? backdrop[index] } as CSSProperties}
          disabled={!word || !!feedback || !!busy || settingsOpen || ended}
          aria-label={`Bild ${index + 1}`} data-position={index + 1}
          onClick={() => word && void answer(word)}>
          {word && (word.imageRegion ? <svg className="illustration" role="img" aria-label={`Antwortbild ${index + 1}`}
            viewBox={`${word.imageRegion.x} ${word.imageRegion.y} ${word.imageRegion.width} ${word.imageRegion.height}`}>
            <defs><clipPath id={`crop-${word.id}`}><rect x={word.imageRegion.x} y={word.imageRegion.y}
              width={word.imageRegion.width} height={word.imageRegion.height} /></clipPath></defs>
            <image href={urls[word.image]} width={word.imageRegion.sourceWidth} height={word.imageRegion.sourceHeight}
              clipPath={`url(#crop-${word.id})`} />
          </svg> : <img className="illustration" draggable="false" src={urls[word.image]} alt={`Antwortbild ${index + 1}`} onError={() => setError('Ein Bild fehlt oder konnte nicht geladen werden. Bitte den Wortschatz erneut importieren.')} />)}
          {isCorrect && <span className="answer-mark" aria-label="Richtige Antwort">✓</span>}
          {isWrong && <span className="answer-mark" aria-label="Falsche Antwort">×</span>}
        </button>;
      })}
    </div>
    <div className="mode-icon" title="Ein Wort · vier Bilder" aria-label="Ein Wort, vier Bilder"><span>A</span><i /><i /><i /><i /></div>
    {pack && <>
      <div className="score" aria-label={`${totalCorrect} richtige Antworten insgesamt`}><strong>{totalCorrect}</strong><span><Flag value={language?.flag} /> {stats?.correct}</span></div>
      <button className="settings-trigger" onClick={openSettings} disabled={!!feedback || !!busy} aria-label="Einstellungen öffnen"><span aria-hidden="true">⚙</span> Lokal{practice && <small> · Freies Üben</small>}</button>
      <button className="language-trigger" onClick={openSettings} disabled={!!feedback || !!busy} aria-label="Sprache auswählen"><Flag value={language?.flag} /></button>
    </>}
    {question && !ended && <div className="word-anchor"><button className="word" onClick={() => void playAudio(question.target)} aria-label={`Aussprache: ${question.target.word}`} title="Aussprache wiederholen">{question.target.word}</button>{feedback && question.target.translation && <span className="meaning">{question.target.translation}</span>}</div>}
    {audioNotice && question && !settingsOpen && <div className="audio-notice" role="status">{audioNotice}</div>}
    {feedback && <span className="sr-only" role="status">{feedback.correct ? 'Richtig.' : `Falsch. Das richtige Bild ist markiert: ${question?.target.word}.`}</span>}
    {!pack && <section className="welcome panel">
      <span className="eyebrow">BA BA DUM · LOKAL</span>
      <h1>Vier Bilder.<br />Ein Wort.<br /><em>Im Gedächtnis.</em></h1>
      <p>Dein vertrautes Spiel mit Wiederholungen, die sich nach deinem Lernfortschritt richten.</p>
      <div className="resource-note"><strong>Wortschatz noch nicht vorhanden</strong><p>Importiere einen Ordner mit den Bildern, Audiodateien und einer <code>manifest.json</code>. Die Dateien bleiben auf diesem Gerät.</p></div>
      <button className="primary" disabled={!!busy || !snapshot} onClick={() => fileInput.current?.click()}>Wortschatzordner auswählen <span aria-hidden="true">↗</span></button>
      <small>Format und Zuordnung: <code>docs/WORTSCHATZ.md</code> im Projektordner.</small>
      {initial.current && !snapshot && <p role="status">Lokalen Speicher öffnen …</p>}
    </section>}
    {pack && !question && !ended && <section className="complete panel" aria-label="Lerneinheit abgeschlossen">
      <span className="eyebrow">GUT GELERNT</span><h1>Für jetzt geschafft.</h1>
      <p>{stats?.newToday ?? 0} neue Wörter heute · {stats?.due ?? 0} Wiederholungen fällig</p>
      {selection.nextDue && <p className="next-due">Nächste Wiederholung: {selection.nextDue.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.<br />Wenn du hier bleibst, geht es dann automatisch weiter.</p>}
      <button className="primary" onClick={() => { setPractice(true); nextQuestion(snapshot!, true, previousId.current); }}>Frei weiterüben</button>
      <button className="secondary" onClick={() => setEnded(true)}>Lerneinheit beenden</button>
      <small>Freies Üben verändert deinen Wiederholungsplan nicht.</small>
    </section>}
    {ended && <section className="complete panel"><span className="eyebrow">BIS BALD</span><h1>Dein Fortschritt<br />ist gespeichert.</h1><button className="primary" onClick={() => { setEnded(false); setPractice(false); nextQuestion(snapshot!, false, previousId.current); }}>Lernen fortsetzen</button></section>}
    {practice && question && <button className="practice-exit" onClick={() => { if (locked.current) return; setPractice(false); nextQuestion(snapshot!, false, previousId.current); }}>Freies Üben beenden</button>}
    {busy && <div className="working" role="status">{busy}</div>}
    {error && !settingsOpen && <div className="error-toast" role="alert">{error}<button aria-label="Meldung schließen" onClick={() => setError('')}>×</button></div>}
    {settingsOpen && snapshot && pack && settingsDraft && <Modal title="Einstellungen" close={() => { if (!busy) { setSettingsOpen(false); setPendingBackup(undefined); setError(''); } }}>
      <form onSubmit={event => { event.preventDefault(); void saveSettings(); }}>
        <label>Sprache<select value={settingsDraft.language} onChange={event => setSettingsDraft({ ...settingsDraft, language: event.target.value })} disabled={!!busy}>
          {pack.languages.map(l => <option key={l.id} value={l.id}>{l.flag} {l.name}</option>)}
        </select></label>
        <div className="setting-grid"><label>Neue Wörter pro Tag<input aria-label="Neue Wörter pro Tag" type="number" min="0" max="1000" required value={settingsDraft.newPerDay} disabled={!!busy} onChange={event => setSettingsDraft({ ...settingsDraft, newPerDay: event.target.valueAsNumber })} /></label>
          <label>Zielbehaltensrate (%)<input aria-label="Zielbehaltensrate (%)" type="number" min="70" max="99" required value={Math.round(settingsDraft.retention * 100)} disabled={!!busy} onChange={event => setSettingsDraft({ ...settingsDraft, retention: event.target.valueAsNumber / 100 })} /></label></div>
        <p className="hint">Die Zielbehaltensrate gilt ab der nächsten Bewertung. Bestehende Fälligkeiten bleiben erhalten.</p>
        <section className="statistics" aria-label="Lernstatistik"><div><strong>{stats?.newToday}</strong><span>heute neu</span></div><div><strong>{stats?.due}</strong><span>jetzt fällig</span></div><div><strong>{stats?.learned} <small>/ {vocabularyCount}</small></strong><span>Wörter gelernt</span></div></section>
        <p className="history-summary">{stats?.reviews} Antworten · {stats?.correct} richtig · {stats?.wrong} falsch</p>
        <button className="primary" type="submit" disabled={!!busy}>Einstellungen speichern</button>
      </form>
      <section className="data-section"><h3>Deine Daten</h3><p>Fortschritt lokal in diesem Browser. Die Sicherung enthält Lernstände und Verlauf; bewahre deinen Wortschatzordner separat auf.</p>
        <div className="button-row"><button className="secondary" onClick={() => void saveBackup()} disabled={!!busy}>Lernstand exportieren</button><label className="secondary file-button">Lernstand importieren<input type="file" accept="application/json,.json" aria-label="Lernstand importieren" onChange={handleBackup} disabled={!!busy} /></label></div>
        {pendingBackup && <div className="import-confirm" role="group" aria-label="Import bestätigen"><p>{pendingBackup.cards.length} Karten und {pendingBackup.reviews.length} Antworten. Der aktuelle Lernstand wird vollständig durch diese Sicherung ersetzt.</p><button className="primary" disabled={!!busy} onClick={() => void restoreBackup()}>Lernstand ersetzen</button><button className="secondary" disabled={!!busy} onClick={() => setPendingBackup(undefined)}>Abbrechen</button></div>}
        <button className="text-button" disabled={!!busy} onClick={() => fileInput.current?.click()}>Wortschatzordner aktualisieren</button>
        <small>{pack.title} · {pack.vocabulary.length} Vokabeln · {pack.languages.length} Sprache(n)</small>{pack.id === 'spanish-1500-v1' && <small>Eigene KI-Illustrationen · synthetische spanische Aussprache</small>}
      </section>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {busy && <p role="status">{busy}</p>}
    </Modal>}
  </main>;
}
