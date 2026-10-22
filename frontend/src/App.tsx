import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, errorMessage, type Account, type Calendar, type Entry, type ManagedUser, type PreviewEntry } from './api';
import { ChristmasSprig, Lock, Sleigh, Star, Village } from './Illustrations';
import { Confetti, HeaderLights, MiniLights, Snowfall } from './Festive';
import { GiftBox } from './GiftBox';
import { ArrowLeft, ArrowRight, ArrowUpRight, Close, Refresh, Snowflake, Sparkle } from './Icons';
import { Tree3D } from './Tree3D';
import { GiftGarland } from './GiftGarland';
import { GiftContent } from './GiftContent';
import { GiftEditor } from './GiftEditor';
import { AdminGiftManager } from './AdminGiftManager';


export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('resetToken'));
  const [showAdmin, setShowAdmin] = useState(false);

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
    setShowAdmin(false);
    setNotice('Votre session a expiré. Reconnectez-vous pour retrouver vos cadeaux.');
  }, []);

  return <div className="app-shell">
    <a className="skip-link" href="#main">Aller au contenu</a>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Les petits jours, accueil">
        <span className="brand-icon" aria-hidden="true"><Snowflake /></span>
        <span>les petits jours<span className="brand-caption">LE CALENDRIER DES GENS QU’ON AIME</span></span>
      </a>
      <span className="edition"><span className="edition-dot" /> NOËL 2026</span>
      <div className="header-sky" aria-hidden="true"><Sleigh /></div>
      <HeaderLights />
    </header>
    {resetToken ? <ResetPasswordPage token={resetToken} onComplete={() => {
      window.history.replaceState({}, '', window.location.pathname);
      setResetToken(null);
      setNotice('Votre mot de passe a été modifié. Vous pouvez vous connecter.');
    }} />
      : checking ? <main id="main" className="center-state"><Spinner /><p>On retrouve votre petit coin de Noël…</p></main>
      : startupError ? <main id="main" className="center-state"><ErrorBox message={startupError} retry={() => void check()} /></main>
        : account ? showAdmin && account.isAdmin
          ? <AdminPage account={account} onBack={() => setShowAdmin(false)} onExpired={expired} />
          : <CalendarPage account={account} onAdmin={() => setShowAdmin(true)} onExpired={expired}
            onLogout={() => { setAccount(null); setShowAdmin(false); setNotice('À bientôt ! Vos cadeaux vous attendront ici.'); }} />
          : <LoginPage notice={notice} onLogin={value => { setAccount(value); setNotice(''); }} />}
    <footer className="site-footer"><Star /><span>Fait avec un peu de magie et beaucoup d’amitié.</span><span className="footer-year">DÉCEMBRE · 2026</span></footer>
  </div>;
}

function LoginPage({ notice, onLogin }: { notice: string; onLogin: (account: Account) => void }) {
  const [decoration] = useState(() => [
    'un peu de nous, pour vous',
    'à ouvrir avec le sourire',
    'les petits bonheurs arrivent',
  ][Math.floor(Math.random() * 3)]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try { onLogin(await api.login(email, password)); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <main id="main" className="login-layout">
    <section className="login-story">
      <span className="eyebrow"><span /> 24 JOURS POUR SE FAIRE SOURIRE</span>
      <h1>Les plus beaux cadeaux<br />sont parfois les<br /><em>plus petites attentions.</em></h1>
      <p>Une blague, un souvenir, un petit défi…<br />En décembre, une surprise vous attend chaque jour.<br />Et celle-ci n’a été préparée que pour vous.</p>
      <div className="login-gifts" aria-hidden="true">
        <Star className="spark spark-one" /><Star className="spark spark-two" />
        <div className="login-tree"><Tree3D /></div>
        <span className="decor-3d decor-3d-one"><GiftBox variant={0} label="01" state="available" /></span>
        <span className="decor-3d decor-3d-two"><GiftBox variant={3} label="24" state="locked" /></span>
        <span className="decor-3d decor-3d-three"><GiftBox variant={5} label="12" state="opened" /></span>
        <span className="handwritten">{decoration}<ArrowUpRight /></span>
      </div>
    </section>
    <section className="login-card" aria-labelledby="welcome">
      <span className="card-star" aria-hidden="true"><Sparkle /></span>
      <span className="eyebrow">VOTRE PETIT COIN DE NOËL</span>
      <h2 id="welcome">{forgot ? 'Un nouveau mot de passe ?' : 'Entrez, il fait bon ici.'}</h2>
      <p>{forgot ? 'Indiquez votre email pour recevoir un lien sécurisé.' : <>Connectez-vous pour retrouver<br />votre calendrier personnel.</>}</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      {sent ? <p className="notice" role="status">Si cette adresse correspond à un compte actif, un email de réinitialisation va être envoyé.</p>
        : <form onSubmit={event => void (forgot ? submitForgot(event) : submit(event))}>
          <label htmlFor="email">Votre adresse email</label>
          <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
            placeholder="vous@exemple.fr" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          {!forgot && <>
            <label htmlFor="password">Votre mot de passe</label>
            <div className="password-field">
              <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256}
                placeholder="Votre petit secret" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
              <button type="button" className="show-password" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Masquer' : 'Voir'}</button>
            </div>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Un petit instant…' : forgot ? 'Envoyer le lien' : 'Découvrir mon calendrier'}<ArrowUpRight />
          </button>
        </form>}
      <button className="text-button" type="button" onClick={() => { setForgot(!forgot); setSent(false); setError(''); }}>
        {forgot ? <><ArrowLeft /> Retour à la connexion</> : 'Mot de passe oublié ?'}
      </button>
      <div className="private-note"><Lock /><span>Un calendrier privé. Juste entre nous.</span></div>
    </section>
    <Village />
  </main>;
}

function ResetPasswordPage({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setBusy(true);
    setError('');
    try { await api.resetPassword(token, password); onComplete(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <main id="main" className="login-layout">
    <section className="login-card" aria-labelledby="reset-title">
      <span className="eyebrow">VOTRE PETIT COIN DE NOËL</span>
      <h2 id="reset-title">Choisissez un nouveau mot de passe.</h2>
      <p>Votre mot de passe doit contenir au moins 14 caractères.</p>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="new-password">Nouveau mot de passe</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={14} maxLength={256}
          value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        <label htmlFor="confirm-password">Confirmer le mot de passe</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required minLength={14} maxLength={256}
          value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Un petit instant…' : 'Enregistrer le mot de passe'}<ArrowUpRight /></button>
      </form>
    </section>
  </main>;
}

function AdminPage({ account, onBack, onExpired }: { account: Account; onBack: () => void; onExpired: () => void }) {
  const [section, setSection] = useState<'accounts' | 'gifts'>('accounts');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void api.managedUsers().then(value => { if (active) setUsers(value); }).catch(cause => {
      if (active) {
        if (cause instanceof ApiError && cause.status === 401) onExpired();
        else setError(errorMessage(cause));
      }
    });
    return () => { active = false; };
  }, [reload, onExpired]);
  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); setNotice(success); setReload(value => value + 1); return true; }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(errorMessage(cause));
      return false;
    } finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const created = await run(() => api.createManagedUser({
      email: String(form.get('email')), displayName: String(form.get('displayName')), password: String(form.get('password'))
    }), 'Le compte a été créé.');
    if (created) formElement.reset();
  }
  async function update(event: FormEvent<HTMLFormElement>, user: ManagedUser) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(() => api.updateManagedUser({
      id: user.id, email: String(form.get('email')), displayName: String(form.get('displayName'))
    }), 'Les informations du compte ont été mises à jour.');
  }
  async function setPassword(event: FormEvent<HTMLFormElement>, user: ManagedUser) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const updated = await run(() => api.setManagedUserPassword(user.id, String(form.get('password'))), 'Le mot de passe a été modifié et les sessions révoquées.');
    if (updated) formElement.reset();
  }
  return <main id="main" className="admin-page">
    <div className="account-bar">
      <span>Administration de <strong>{account.displayName}</strong></span>
      <button className="text-button" onClick={onBack}><ArrowLeft /> Retour au calendrier</button>
    </div>
    <section className="calendar-intro">
      <span className="eyebrow"><span /> ESPACE PRIVÉ</span>
      <h1>{section === 'accounts' ? 'Gestion des comptes' : 'Gestion des cadeaux'}</h1>
      <p>{section === 'accounts' ? 'Créez, modifiez et désactivez les accès au calendrier.'
        : 'Préparez et publiez les cadeaux de toutes les personnes.'}</p>
    </section>
    <nav className="admin-navigation" aria-label="Sections d’administration">
      <button type="button" aria-pressed={section === 'accounts'} onClick={() => setSection('accounts')}>Comptes</button>
      <button type="button" aria-pressed={section === 'gifts'} onClick={() => setSection('gifts')}>Cadeaux</button>
    </nav>
    {section === 'accounts' ? <>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <p className="notice" role="status">{notice}</p>}
    <section className="admin-create">
      <h2>Créer un compte</h2>
      <form onSubmit={event => void create(event)}>
        <label>Adresse email<input type="email" name="email" required maxLength={254} autoComplete="email" /></label>
        <label>Nom affiché<input name="displayName" required maxLength={80} /></label>
        <label>Mot de passe initial<input type="password" name="password" required minLength={14} maxLength={256} autoComplete="new-password" /></label>
        <button className="primary-button" type="submit" disabled={busy}>Créer le compte <ArrowUpRight /></button>
      </form>
    </section>
    <section className="admin-users" aria-label="Comptes existants">
      <h2>Comptes existants</h2>
      {users.map(user => <article className="admin-user" key={user.id}>
        <div className="admin-user-heading"><strong>{user.displayName}</strong><span>{user.isAdmin ? 'Administrateur' : 'Utilisateur'} · {user.isActive ? 'Actif' : 'Désactivé'}</span></div>
        <form onSubmit={event => void update(event, user)}>
          <label>Email<input type="email" name="email" defaultValue={user.email ?? ''} required maxLength={254} /></label>
          <label>Nom affiché<input name="displayName" defaultValue={user.displayName} required maxLength={80} /></label>
          <button className="secondary-button" type="submit" disabled={busy}>Enregistrer</button>
        </form>
        <form className="admin-password" onSubmit={event => void setPassword(event, user)}>
          <label>Nouveau mot de passe<input type="password" name="password" required minLength={14} maxLength={256} autoComplete="new-password" /></label>
          <button className="secondary-button" type="submit" disabled={busy}>Définir le mot de passe</button>
        </form>
        <button className="secondary-button" type="button" disabled={busy || !user.isActive || !user.email}
          onClick={() => void run(
            () => api.sendCalendarInvitation(user.id),
            `L’invitation a été envoyée à ${user.email}.`
          )}>Envoyer l’invitation par e-mail</button>
        <button className="text-button" disabled={busy} onClick={() => void run(
          () => api.setManagedUserActive(user.id, !user.isActive),
          user.isActive ? 'Le compte a été désactivé.' : 'Le compte a été activé.'
        )}>{user.isActive ? 'Désactiver ce compte' : 'Activer ce compte'}</button>
        <button className="text-button danger-button"
          disabled={busy || user.id === account.id || (user.isAdmin && user.isActive && users.filter(item => item.isAdmin && item.isActive).length <= 1)}
          onClick={() => {
            if (!window.confirm(`Supprimer définitivement le compte de ${user.displayName} ? Ses cadeaux, médias et historique seront aussi supprimés. Cette action est irréversible.`))
              return;
            void run(() => api.deleteManagedUser(user.id), 'Le compte et ses données associées ont été supprimés.');
          }}>Supprimer définitivement</button>
      </article>)}
    </section>
    </> : <AdminGiftManager users={users} onExpired={onExpired} />}
  </main>;
}

function CalendarPage({ account, onAdmin, onExpired, onLogout }: { account: Account; onAdmin: () => void; onExpired: () => void; onLogout: () => void }) {
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
      <span className="account-actions">
        {account.isAdmin && <button className="text-button" onClick={onAdmin}>Administration</button>}
        <button className="text-button" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'} <ArrowUpRight /></button>
      </span>
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
      <section className="gift-landscape garland-landscape night-landscape" aria-label="Les 24 cadeaux de décembre">
        <Snowfall layer="back" count={40} />
        <div className="garland-heading"><span className="eyebrow">UNE GUIRLANDE DE PETITS BONHEURS</span><p>Suis le fil de la magie.</p><Star /></div>
        <GiftGarland days={calendar.days} preview={preview} onSelect={setSelected} />
        <Snowfall layer="front" count={14} />
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
    <MiniLights />
    {entry && !editing && <Confetti key={`${day}-${attempt}`} />}
    <button className="close-dialog" onClick={close} disabled={editorBusy} aria-label="Fermer la surprise" autoFocus><Close /></button>
    <span className="eyebrow">{String(day).padStart(2, '0')} DÉCEMBRE 2026</span>
    {preview && !editing && <div className="preview-note" role="status">
      <strong>Prévisualisation locale — {entry && 'isPublished' in entry ? (entry.isPublished ? 'Publié' : 'Brouillon non publié') : 'Lecture seule'}</strong>
      <p>Un petit atelier privé pour préparer les cadeaux à ton rythme.</p>
      <button className="text-button" disabled={!entry && !error} onClick={() => setAttempt(value => value + 1)}>Actualiser le contenu</button>
      <button className="secondary-button" disabled={!entry && !missingEntry} onClick={() => setEditing(true)}>Composer ce cadeau</button>
    </div>}
    {editing ? <GiftEditor key={day} day={day} initial={entry} decoration={calendar.decoration}
      onSave={api.saveGift} onUpload={file => api.uploadMedia(day, file)}
      onSaved={value => { setEntry(value); setError(''); }}
      onPublished={() => { onClose(); requestAnimationFrame(() => document.querySelector('.garland-landscape')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}
      onDirtyChange={setDirty} onBusyChange={setEditorBusy} onExpired={onExpired}
      onCancel={() => { if (confirmExit()) { setEditing(false); setDirty(false); } }} />
      : <>
    {!entry && <h2 id="surprise-title">Le cadeau du {day} décembre</h2>}
    {error ? <ErrorBox message={error} retry={() => setAttempt(value => value + 1)} />
      : !entry ? <div className="center-state" role="status"><Spinner /><p>On défait le ruban…</p></div>
        : <GiftContent key={`${entry.day}-${attempt}`} entry={entry} preview={preview} decoration={calendar.decoration} />}
    <nav className="surprise-navigation" aria-label={preview ? 'Prévisualiser les 24 cadeaux' : 'Parcourir les cadeaux disponibles'}>
      <button className="text-button" disabled={index <= 0} onClick={() => onSelect(days[index - 1])}><ArrowLeft /> Précédent</button>
      <span>{day} / 24</span>
      <button className="text-button" disabled={index < 0 || index >= days.length - 1} onClick={() => onSelect(days[index + 1])}>Suivant <ArrowRight /></button>
    </nav>
    </>}
  </dialog>;
}

function Spinner() { return <span className="spinner" aria-hidden="true" />; }
function ErrorBox({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-box" role="alert"><p>{message}</p><button className="text-button" onClick={retry}>Réessayer <Refresh /></button></div>;
}
