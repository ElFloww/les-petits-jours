import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Refresh } from './Icons';
import { api, ApiError, errorMessage, type ManagedUser, type PreviewEntry } from './api';
import { GiftEditor } from './GiftEditor';
import { GiftGarland } from './GiftGarland';
import { GiftContent } from './GiftContent';
import { Close } from './Icons';

type Slot =
  | { status: 'loading' }
  | { status: 'empty'; entry: PreviewEntry }
  | { status: 'draft' | 'published'; entry: PreviewEntry }
  | { status: 'error'; message: string };
type Overview = Record<number, Slot>;

const days = Array.from({ length: 24 }, (_, index) => index + 1);
const emptyEntry = (day: number): PreviewEntry => ({ day, kind: 'surprise', title: '', text: '', sticker: 'sourire', isPublished: false });
const statusLabel = { loading: 'Chargement…', empty: 'À composer', draft: 'Brouillon', published: 'Publié', error: 'Erreur' } as const;

function toSlot(entry: PreviewEntry): Slot {
  return { status: entry.isPublished ? 'published' : 'draft', entry };
}

function count(overview: Overview | undefined, status: Slot['status']) {
  return overview ? days.filter(day => overview[day]?.status === status).length : 0;
}

/** Runs the async jobs with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

export function AdminGiftManager({ users, onExpired }: { users: ManagedUser[]; onExpired: () => void }) {
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [day, setDay] = useState(1);
  const [overviews, setOverviews] = useState<Record<string, Overview>>({});
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<'grid' | 'calendar'>('grid');
  const [inspected, setInspected] = useState<number | null>(null);
  const detail = useRef<HTMLDivElement>(null);
  const user = users.find(item => item.id === userId);
  const overview = overviews[userId];
  const slot: Slot | undefined = overview?.[day];

  useEffect(() => {
    if (users.length > 0 && !users.some(item => item.id === userId)) {
      setUserId(users[0].id);
      setEditing(false);
      setDirty(false);
    }
  }, [users, userId]);

  const setSlot = useCallback((id: string, dayNumber: number, value: Slot) => {
    setOverviews(current => ({ ...current, [id]: { ...current[id], [dayNumber]: value } }));
  }, []);

  // Loads the 24 gifts of every person (the selected one first). A 404 simply means "nothing prepared yet".
  const known = useRef<Record<string, Overview>>({});
  known.current = overviews;
  useEffect(() => {
    const controller = new AbortController();
    const order = [...users].sort((a, b) => Number(b.id === userId) - Number(a.id === userId));
    const jobs: { id: string; day: number }[] = [];
    for (const person of order)
      for (const dayNumber of days) if (!known.current[person.id]?.[dayNumber]) jobs.push({ id: person.id, day: dayNumber });
    if (jobs.length === 0) return;
    void pool(jobs, 6, async job => {
      if (controller.signal.aborted) return;
      try {
        const value = await api.adminGift(job.id, job.day, controller.signal);
        if (!controller.signal.aborted) setSlot(job.id, job.day, toSlot(value));
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) onExpired();
        else if (cause instanceof ApiError && cause.status === 404) setSlot(job.id, job.day, { status: 'empty', entry: emptyEntry(job.day) });
        else setSlot(job.id, job.day, { status: 'error', message: errorMessage(cause) });
      }
    });
    return () => controller.abort();
  }, [users, userId, reload, onExpired, setSlot]);

  function canDiscard(): boolean {
    if (editorBusy) return false;
    return !dirty || window.confirm('Quitter sans enregistrer les modifications de ce cadeau ?');
  }
  function leaveEditor() { setEditing(false); setDirty(false); }
  function selectUser(nextUserId: string) {
    if (nextUserId === userId || !canDiscard()) return;
    leaveEditor();
    setUserId(nextUserId);
  }
  function selectDay(nextDay: number) {
    if (nextDay < 1 || nextDay > 24 || !canDiscard()) return;
    leaveEditor();
    setDay(nextDay);
    requestAnimationFrame(() => detail.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }));
  }
  function refresh() {
    setOverviews(current => ({ ...current, [userId]: {} }));
    setError('');
    setReload(value => value + 1);
  }

  const totals = useMemo(() => users.map(person => {
    const data = overviews[person.id];
    const loaded = data ? days.filter(item => data[item] && data[item].status !== 'loading').length : 0;
    return { person, published: count(data, 'published'), drafts: count(data, 'draft'), loaded };
  }), [users, overviews]);

  if (users.length === 0) return <section className="admin-gifts" aria-label="Gestion des cadeaux"><p role="status">Aucun compte à gérer.</p></section>;

  const entry = slot && slot.status !== 'loading' && slot.status !== 'error' ? slot.entry : null;
  const title = entry?.title || (slot?.status === 'empty' ? 'Aucun cadeau préparé' : 'Cadeau sans titre');

  return <section className="admin-gifts" aria-label="Gestion des cadeaux">
    <p className="admin-gifts-intro">Choisissez une personne : ses 24 cadeaux apparaissent d’un coup d’œil. Cliquez sur un jour pour le préparer, le modifier ou le publier.</p>
    <div className="admin-gifts-layout">
      <nav className="admin-people" aria-label="Personnes">
        {totals.map(({ person, published, drafts, loaded }) => <button type="button" key={person.id}
          className="admin-person" aria-pressed={person.id === userId} disabled={editorBusy && person.id !== userId}
          onClick={() => selectUser(person.id)}>
          <span className="admin-person-avatar" aria-hidden="true">{person.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="admin-person-body">
            <strong>{person.displayName}</strong>
            <small>{person.isAdmin ? 'Administrateur' : 'Utilisateur'}{person.isActive ? '' : ' · désactivé'}</small>
            <span className="admin-person-bar" aria-hidden="true">
              <i className="bar-published" style={{ width: `${(published / 24) * 100}%` }} />
              <i className="bar-draft" style={{ width: `${(drafts / 24) * 100}%` }} />
            </span>
            <small>{loaded < 24 ? 'Chargement…' : `${published} publiés · ${drafts} brouillons · ${24 - published - drafts} vides`}</small>
          </span>
        </button>)}
      </nav>

      <div className="admin-workspace">
        <div className="admin-workspace-head">
          <h2>{user?.displayName}</h2>
          <div className="admin-view-switch" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => { if (view !== 'grid' && canDiscard()) { setView('grid'); setInspected(null); } }}>Grille</button>
            <button type="button" aria-pressed={view === 'calendar'} onClick={() => { if (view !== 'calendar' && canDiscard()) { leaveEditor(); setView('calendar'); } }}>Calendrier de {user?.displayName}</button>
          </div>
          <button type="button" className="text-button" onClick={refresh} disabled={editorBusy}><Refresh /> Actualiser</button>
        </div>
        {view === 'calendar' ? <AdminCalendarView name={user?.displayName ?? ''} overview={overview} userId={userId} inspected={inspected}
          onInspect={setInspected} onEdit={value => { setDay(value); setView('grid'); setInspected(null); setEditing(true); }} /> : <>
        <ol className="admin-day-grid" aria-label={`Cadeaux de ${user?.displayName ?? ''}`}>
          {days.map(value => {
            const item = overview?.[value] ?? { status: 'loading' } as Slot;
            const text = item.status === 'draft' || item.status === 'published' ? item.entry.title || 'Sans titre' : statusLabel[item.status];
            return <li key={value}>
              <button type="button" className={`admin-day admin-day-${item.status}`} aria-pressed={value === day}
                aria-label={`${value} décembre — ${statusLabel[item.status]}`} onClick={() => selectDay(value)}>
                <span className="admin-day-number">{value}</span>
                <span className="admin-day-title">{text}</span>
                <span className="admin-day-state">{item.status === 'published' ? <Check /> : item.status === 'draft' ? 'Brouillon' : item.status === 'empty' ? '＋' : ''}</span>
              </button>
            </li>;
          })}
        </ol>
        <ul className="admin-legend" aria-hidden="true">
          <li><i className="admin-day-published" /> Publié</li><li><i className="admin-day-draft" /> Brouillon</li><li><i className="admin-day-empty" /> À composer</li>
        </ul>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="admin-detail" ref={detail}>
          <div className="admin-day-nav">
            <button type="button" className="text-button" disabled={day <= 1 || editorBusy} onClick={() => selectDay(day - 1)}><ArrowLeft /> {day - 1 || ''} précédent</button>
            <span className="eyebrow">{day} DÉCEMBRE</span>
            <button type="button" className="text-button" disabled={day >= 24 || editorBusy} onClick={() => selectDay(day + 1)}>suivant <ArrowRight /></button>
          </div>
          {!slot || slot.status === 'loading' ? <p role="status">Chargement du cadeau…</p>
            : slot.status === 'error' ? <p className="form-error" role="alert">{slot.message}</p>
            : user && entry && (!editing ? <article className="admin-gift-summary">
              <div>
                <span className="eyebrow">{user.displayName} · {day} DÉCEMBRE</span>
                <h3>{title}</h3>
                <p>{slot.status === 'empty' ? 'Ce jour n’a pas encore de contenu.' : entry.isPublished ? 'Cadeau publié.' : 'Brouillon non publié.'}</p>
                {entry.text && <blockquote className="admin-excerpt">{entry.text.length > 220 ? `${entry.text.slice(0, 220)}…` : entry.text}</blockquote>}
                {!!entry.blocks?.length && <p className="admin-blocks">{entry.blocks.length} bloc{entry.blocks.length > 1 ? 's' : ''} : {entry.blocks.map(block => block.type).join(', ')}</p>}
              </div>
              <button className="primary-button" onClick={() => setEditing(true)}>
                {slot.status === 'empty' ? 'Composer ce cadeau' : 'Modifier ce cadeau'} <ArrowUpRight />
              </button>
            </article> : <GiftEditor key={`${userId}-${day}`} day={day} initial={entry}
              decoration={`Pour ${user.displayName}`} mediaBasePath={`/api/admin/gifts/${userId}`}
              onSave={(content, publish) => api.saveAdminGift(userId, content, publish)}
              onUpload={file => api.uploadAdminGiftMedia(userId, day, file)}
              onSaved={value => setSlot(userId, day, toSlot(value))}
              onDirtyChange={setDirty} onBusyChange={setEditorBusy} onExpired={onExpired}
              onCancel={() => { if (canDiscard()) leaveEditor(); }} />)}
        </div>
        </>}
      </div>
    </div>
  </section>;
}

const adminLabels = { published: 'Publié', draft: 'Brouillon', empty: 'Vide', loading: '…', error: 'Erreur' } as const;

/** The person's calendar exactly as they see it, with every gift openable (read-only: nothing is marked as opened). */
function AdminCalendarView({ name, overview, userId, inspected, onInspect, onEdit }: {
  name: string; overview: Overview | undefined; userId: string; inspected: number | null;
  onInspect: (day: number | null) => void; onEdit: (day: number) => void;
}) {
  const calendarDays = useMemo(() => days.map(value => ({
    day: value, unlocksAt: '', state: overview?.[value]?.status === 'published' ? 'available' as const : 'locked' as const,
  })), [overview]);
  const labels = useMemo(() => Object.fromEntries(days.map(value => [value, `${value} déc. · ${adminLabels[overview?.[value]?.status ?? 'loading']}`])), [overview]);
  const slot = inspected ? overview?.[inspected] : undefined;
  return <div className="admin-calendar-view">
    <p className="admin-gifts-intro">Voici le calendrier de {name}. Les cadeaux publiés brillent ; les brouillons et les jours vides restent emballés. Clique sur n’importe quel cadeau pour voir son contenu, sans rien ouvrir pour la personne.</p>
    <section className="gift-landscape garland-landscape night-landscape admin-garland" aria-label={`Calendrier de ${name}`}>
      <GiftGarland days={calendarDays} preview={false} interactive labels={labels} onSelect={onInspect} />
    </section>
    {inspected !== null && <AdminGiftDialog day={inspected} name={name} userId={userId} status={slot?.status ?? 'loading'}
      entry={slot && 'entry' in slot ? slot.entry : null} onClose={() => onInspect(null)}
      onPrev={inspected > 1 ? () => onInspect(inspected - 1) : undefined} onNext={inspected < 24 ? () => onInspect(inspected + 1) : undefined}
      onEdit={() => onEdit(inspected)} />}
  </div>;
}

function AdminGiftDialog({ day, name, userId, status, entry, onClose, onPrev, onNext, onEdit }: {
  day: number; name: string; userId: string; status: Slot['status']; entry: PreviewEntry | null;
  onClose: () => void; onPrev?: () => void; onNext?: () => void; onEdit: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [day]);
  const hasContent = entry && (status === 'published' || status === 'draft');
  return <dialog ref={ref} className={`surprise-dialog admin-gift-dialog ${entry?.blocks?.length ? 'wide-dialog' : ''}`} aria-labelledby="surprise-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <button className="close-dialog" onClick={onClose} aria-label="Fermer l’aperçu" autoFocus><Close /></button>
    <span className="eyebrow">{String(day).padStart(2, '0')} DÉCEMBRE · {name.toUpperCase()}</span>
    <div className="preview-note" role="status">
      <strong>Vue administrateur — {adminLabels[status]}</strong>
      <p>{status === 'published' ? 'C’est exactement ce que voit la personne.' : status === 'draft' ? 'Brouillon : la personne ne le voit pas encore.' : status === 'empty' ? 'Rien n’est encore préparé pour ce jour.' : 'Chargement…'}</p>
      <button className="secondary-button" onClick={onEdit}>{hasContent ? 'Modifier ce cadeau' : 'Composer ce cadeau'}</button>
    </div>
    {hasContent ? <GiftContent entry={entry} preview decoration={`Pour ${name}`} mediaBasePath={`/api/admin/gifts/${userId}`} />
      : <h2 id="surprise-title">Le cadeau du {day} décembre</h2>}
    <nav className="surprise-navigation" aria-label="Parcourir les cadeaux">
      <button className="text-button" disabled={!onPrev} onClick={onPrev}><ArrowLeft /> Précédent</button>
      <span>{day} / 24</span>
      <button className="text-button" disabled={!onNext} onClick={onNext}>Suivant <ArrowRight /></button>
    </nav>
  </dialog>;
}
