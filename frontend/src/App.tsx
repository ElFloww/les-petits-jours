import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, errorMessage, type Account, type Calendar, type Entry, type PreviewEntry } from './api';
import { ChristmasSprig, Lock, Star, Village } from './Illustrations';
import { GiftGarland } from './GiftGarland';
import { GiftContent } from './GiftContent';
import { GiftEditor } from './GiftEditor';


export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [notice, setNotice] = useState('');

  const check = useCallback(async () => {
    setChecking(true);
    setStartupError('');
    try { setAccount(await api.me()); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setStartupError(errorMessage(error));
    } finally { setChecking(false); }
  }, []);
  useEffect(() => { void check(); }, [check]);
  const expired = useCallback(() => {
    setAccount(null);
    setNotice('Votre session a expiré. Reconnectez-vous pour retrouver vos cadeaux.');
  }, []);

  return <div className="app-shell">
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Les petits jours, accueil">
        <span className="brand-icon" aria-hidden="true">✳</span>
        <span>les petits jours<span className="brand-caption">LE CALENDRIER DES GENS QU’ON AIME</span></span>
      </a>
      <span className="edition"><span className="edition-dot" /> NOËL 2026</span>
    </header>
    {checking ? <main id="main" className="center-state"><Spinner /><p>On retrouve votre petit coin de Noël…</p></main>
      : startupError ? <main id="main" className="center-state"><ErrorBox message={startupError} retry={() => void check()} /></main>
        : account ? <CalendarPage account={account} onExpired={expired} onLogout={() => { setAccount(null); setNotice('À bientôt ! Vos cadeaux vous attendront ici.'); }} />
          : <LoginPage notice={notice} onLogin={value => { setAccount(value); setNotice(''); }} />}
    <footer className="site-footer"><Star /><span>Fait avec un peu de magie et beaucoup d’amitié.</span><span className="footer-year">DÉCEMBRE · 2026</span></footer>
  </div>;
}

function LoginPage({ notice, onLogin }: { notice: string; onLogin: (account: Account) => void }) {
  const [decoration] = useState(() => [
    'un peu de nous, pour vous ↗',
    'à ouvrir avec le sourire ↗',
    'les petits bonheurs arrivent ↗',
  ][Math.floor(Math.random() * 3)]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { onLogin(await api.login(username, password)); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <main id="main" className="login-layout">
    <section className="login-story">
      <span className="eyebrow"><span /> 24 JOURS POUR SE FAIRE SOURIRE</span>
      <h1>Les plus beaux cadeaux<br />sont parfois les<br /><em>plus petites attentions.</em></h1>
      <p>Une blague, un souvenir, un petit défi…<br />En décembre, une surprise vous attend chaque jour.<br />Et celle-ci n’a été préparée que pour vous.</p>
      <div className="login-gifts" aria-hidden="true">
        <Star className="spark spark-one" /><Star className="spark spark-two" />
        <span className="decor-gift decor-gift-one"><span>01</span></span>
        <span className="decor-gift decor-gift-two"><span>24</span></span>
        <span className="decor-gift decor-gift-three"><span>12</span></span>
        <span className="handwritten">{decoration}</span>
      </div>
    </section>
    <section className="login-card" aria-labelledby="welcome">
      <span className="card-star" aria-hidden="true">✧</span>
      <span className="eyebrow">VOTRE PETIT COIN DE NOËL</span>
      <h2 id="welcome">Entrez, il fait bon ici.</h2>
      <p>Connectez-vous pour retrouver<br />votre calendrier personnel.</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="username">Votre identifiant</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={40}
          placeholder="louisa, orleane ou thomas" value={username} onChange={event => setUsername(event.target.value)} disabled={busy} />
        <label htmlFor="password">Votre mot de passe</label>
        <div className="password-field">
          <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256}
            placeholder="Votre petit secret" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          <button type="button" className="show-password" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Masquer' : 'Voir'}</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Un petit instant…' : 'Découvrir mon calendrier'}<span aria-hidden="true">↗</span></button>
      </form>
      <div className="private-note"><Lock /><span>Un calendrier privé. Juste entre nous.</span></div>
    </section>
    <Village />
  </main>;
}

function CalendarPage({ account, onExpired, onLogout }: { account: Account; onExpired: () => void; onLogout: () => void }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!calendar?.canPreview) { setPreview(false); setSelected(null); }
  }, [calendar?.canPreview]);
  const refresh = useCallback(async () => {
    try { setCalendar(await api.calendar()); setError(''); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(errorMessage(cause));
    }
  }, [onExpired]);
  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [refresh]);
  async function logout() {
    setLoggingOut(true);
    try { await api.logout(); onLogout(); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onLogout();
      else setError(errorMessage(cause));
    } finally { setLoggingOut(false); }
  }
  const opened = calendar?.days.filter(day => day.state === 'opened').length ?? 0;
  const available = calendar?.days.filter(day => day.state === 'available').length ?? 0;
  const beforeDecember = calendar ? calendar.today < '2026-12-01' : false;
  return <main id="main" className="calendar-page">
    <div className="account-bar"><span><span className="avatar">{account.displayName[0]}</span>Le calendrier de <strong>{account.displayName}</strong></span>
      <button className="text-button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'} <span aria-hidden="true">↗</span></button>
    </div>
    <section className="calendar-intro">
      <ChristmasSprig className="christmas-sprig sprig-left" /><ChristmasSprig className="christmas-sprig sprig-right" />
      <div className="christmas-ornaments" aria-hidden="true"><span /><span /><span /></div>
      <span className="eyebrow"><span /> DU 1ER AU 24 DÉCEMBRE</span>
      <h1>Un peu de magie,<br /><em>rien que pour toi, {account.displayName}.</em></h1>
      <p>{beforeDecember ? 'Les cadeaux se préparent tout doucement. Rendez-vous le 1er décembre !'
        : 'Chaque jour, un cadeau à déballer. Et autant de raisons de sourire.'}<br />
        <span className="muted">Les jours manqués t’attendent sagement. Ici, rien ne se perd.</span></p>
      <Star className="intro-star left" /><Star className="intro-star right" />
    </section>
    {error && <ErrorBox message={error} retry={() => void refresh()} />}
    {!calendar && !error && <div className="center-state"><Spinner /><p>Les cadeaux prennent place…</p></div>}
    {calendar && <>
      {calendar.canPreview && <section className={`preview-controls ${preview ? 'preview-active' : ''}`} aria-label="Atelier local">
        <div>
          <strong>{preview ? 'Mode atelier — lecture seule' : 'Atelier local'}</strong>
          <p>{preview ? 'Ouvre un cadeau pour le prévisualiser ou le composer. La lecture seule ne change ni les ouvertures ni la publication.'
            : 'Compose tes cadeaux : photos, vidéos, grands textes et petites citations.'}</p>
        </div>
        <button className="text-button" aria-pressed={preview} onClick={() => { setSelected(null); setPreview(!preview); }}>
          {preview ? 'Revenir au calendrier réel' : 'Prévisualiser les 24 cases'}
        </button>
      </section>}
      <section className="calendar-toolbar" aria-label="Progression et légende">
        <div className="progress-block"><span><strong>{opened.toString().padStart(2, '0')}</strong> / 24 {preview ? 'ouvertures réelles (inchangées)' : 'petits bonheurs découverts'}</span>
          <progress value={opened} max={24} aria-label={`${opened} cadeaux ouverts sur 24`} /></div>
        {preview ? <span className="eyebrow">24 CASES À PRÉVISUALISER</span>
          : <div className="legend"><span><i className="legend-available" />À découvrir{available > 0 ? ` (${available})` : ''}</span><span><i className="legend-opened" />Déjà ouvert</span><span><Lock />À patienter</span></div>}
      </section>
      <section className="gift-landscape garland-landscape" aria-label="Les 24 cadeaux de décembre">
        <div className="garland-heading"><span className="eyebrow">UNE GUIRLANDE DE PETITS BONHEURS</span><p>Suis le fil de la magie.</p><Star /></div>
        <span className="landscape-star star-a" aria-hidden="true">✧</span><span className="landscape-star star-b" aria-hidden="true">✳</span>
        <GiftGarland days={calendar.days} preview={preview} onSelect={setSelected} />
        <Village />
      </section>
      <div className="daily-note"><Star /><p>{calendar.decoration}</p><Star /></div>
      {selected !== null && (!preview || calendar.canPreview) && <SurpriseDialog day={selected} calendar={calendar} preview={preview} onSelect={setSelected}
        onClose={() => setSelected(null)} onExpired={onExpired} onOpened={day =>
          setCalendar(current => current && ({ ...current, days: current.days.map(item => item.day === day ? { ...item, state: 'opened' } : item) }))} />}
    </>}
  </main>;
}

function SurpriseDialog({ day, calendar, preview, onSelect, onClose, onExpired, onOpened }: {
  day: number; calendar: Calendar; onSelect: (day: number) => void; onClose: () => void;
  onExpired: () => void; onOpened: (day: number) => void; preview: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef(document.activeElement);
  const [entry, setEntry] = useState<Entry | PreviewEntry | null>(null);
  const [error, setError] = useState('');
  const [missingEntry, setMissingEntry] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  function confirmExit() {
    return !editorBusy && (!dirty || window.confirm('Quitter sans enregistrer les modifications de ce cadeau ?'));
  }
  function close() { if (confirmExit()) onClose(); }
  const callbacks = useRef({ onOpened, onExpired });
  callbacks.current = { onOpened, onExpired };
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [day, editing]);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        if (!dialog.open && opener.current instanceof HTMLElement && opener.current.isConnected)
          opener.current.focus();
      });
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setEntry(null);
    setError('');
    setMissingEntry(false);
    const load = preview ? api.preview : api.open;
    void load(day, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setEntry(result);
        if (!preview) callbacks.current.onOpened(day);
      }
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) callbacks.current.onExpired();
      else {
        setMissingEntry(cause instanceof ApiError && cause.status === 404);
        setError(errorMessage(cause));
      }
    });
    return () => controller.abort();
  }, [day, attempt, preview]);
  const days = calendar.days.filter(item => preview || item.state !== 'locked').map(item => item.day);
  const index = days.indexOf(day);
  return <dialog className={`surprise-dialog ${editing || entry?.blocks?.length ? 'wide-dialog' : ''}`} ref={ref} onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target === event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
  }} aria-labelledby="surprise-title">
    <button className="close-dialog" onClick={close} disabled={editorBusy} aria-label="Fermer la surprise" autoFocus>×</button>
    <span className="eyebrow">{String(day).padStart(2, '0')} DÉCEMBRE 2026</span>
    {preview && !editing && <div className="preview-note" role="status">
      <strong>Prévisualisation locale — {entry && 'isPublished' in entry ? (entry.isPublished ? 'Publié' : 'Brouillon non publié') : 'Lecture seule'}</strong>
      <p>Un petit atelier privé pour préparer les cadeaux à ton rythme.</p>
      <button className="text-button" disabled={!entry && !error} onClick={() => setAttempt(value => value + 1)}>Actualiser le contenu</button>
      <button className="secondary-button" disabled={!entry && !missingEntry} onClick={() => setEditing(true)}>Composer ce cadeau</button>
    </div>}
    {editing ? <GiftEditor key={day} day={day} initial={entry} decoration={calendar.decoration} onSaved={value => { setEntry(value); setError(''); }}
      onDirtyChange={setDirty} onBusyChange={setEditorBusy} onExpired={onExpired}
      onCancel={() => { if (confirmExit()) { setEditing(false); setDirty(false); } }} />
      : <>
    {!entry && <h2 id="surprise-title">Le cadeau du {day} décembre</h2>}
    {error ? <ErrorBox message={error} retry={() => setAttempt(value => value + 1)} />
      : !entry ? <div className="center-state" role="status"><Spinner /><p>On défait le ruban…</p></div>
        : <GiftContent key={`${entry.day}-${attempt}`} entry={entry} preview={preview} decoration={calendar.decoration} />}
    <nav className="surprise-navigation" aria-label={preview ? 'Prévisualiser les 24 cadeaux' : 'Parcourir les cadeaux disponibles'}>
      <button className="text-button" disabled={index <= 0} onClick={() => onSelect(days[index - 1])}>← Précédent</button>
      <span>{day} / 24</span>
      <button className="text-button" disabled={index < 0 || index >= days.length - 1} onClick={() => onSelect(days[index + 1])}>Suivant →</button>
    </nav>
    </>}
  </dialog>;
}

function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-box" role="alert"><p>{message}</p><button className="text-button" onClick={retry}>Réessayer ↻</button></div>;
}
