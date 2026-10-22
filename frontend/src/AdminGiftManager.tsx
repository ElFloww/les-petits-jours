import { ArrowUpRight } from './Icons';
import { useEffect, useState } from 'react';
import { api, ApiError, errorMessage, type ManagedUser, type PreviewEntry } from './api';
import { GiftEditor } from './GiftEditor';

export function AdminGiftManager({ users, onExpired }: { users: ManagedUser[]; onExpired: () => void }) {
  const [userId, setUserId] = useState(users[0]?.id ?? '');
  const [day, setDay] = useState(1);
  const [entry, setEntry] = useState<PreviewEntry | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const user = users.find(item => item.id === userId);

  useEffect(() => {
    if (users.length > 0 && !users.some(item => item.id === userId)) {
      setUserId(users[0].id);
      setEditing(false);
      setDirty(false);
    }
  }, [users, userId]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    setEntry(null);
    setError('');
    setMissing(false);
    void api.adminGift(userId, day, controller.signal).then(value => {
      if (!controller.signal.aborted) setEntry(value);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else if (cause instanceof ApiError && cause.status === 404) {
        setEntry({ day, kind: 'surprise', title: '', text: '', sticker: 'sourire', isPublished: false });
        setMissing(true);
      } else setError(errorMessage(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [userId, day, reload, onExpired]);

  function canDiscard(): boolean {
    if (editorBusy) return false;
    return !dirty || window.confirm('Quitter sans enregistrer les modifications de ce cadeau ?');
  }

  function selectUser(nextUserId: string) {
    if (!canDiscard()) return;
    setEditing(false);
    setDirty(false);
    setUserId(nextUserId);
  }

  function selectDay(nextDay: number) {
    if (!canDiscard()) return;
    setEditing(false);
    setDirty(false);
    setDay(nextDay);
  }

  const title = entry?.title || (missing ? 'Aucun cadeau préparé' : 'Cadeau sans titre');

  return <section className="admin-gifts" aria-label="Gestion des cadeaux">
    <p>Choisissez une personne et un jour pour préparer, modifier ou publier son cadeau.</p>
    {users.length === 0 ? <p role="status">Aucun compte à gérer.</p> : <>
      <div className="admin-gift-selectors">
        <label htmlFor="admin-gift-user">Personne
          <select id="admin-gift-user" value={userId} disabled={editorBusy} onChange={event => selectUser(event.target.value)}>
            {users.map(item => <option key={item.id} value={item.id}>
              {item.displayName}{item.isAdmin ? ' — administrateur' : ''}{item.isActive ? '' : ' — désactivé'}
            </option>)}
          </select>
        </label>
        <label htmlFor="admin-gift-day">Jour
          <select id="admin-gift-day" value={day} disabled={editorBusy}
            onChange={event => selectDay(Number(event.target.value))}>
            {Array.from({ length: 24 }, (_, index) => index + 1).map(value =>
              <option key={value} value={value}>{value} décembre</option>)}
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p role="status">Chargement du cadeau…</p>
        : entry && user && <>
          {!editing ? <article className="admin-gift-summary">
            <div>
              <span className="eyebrow">{user.displayName} · {day} DÉCEMBRE</span>
              <h2>{title}</h2>
              <p>{missing ? 'Ce jour n’a pas encore de contenu.' : entry.isPublished ? 'Cadeau publié.' : 'Brouillon non publié.'}</p>
            </div>
            <button className="primary-button" onClick={() => setEditing(true)}>
              {missing ? 'Composer ce cadeau' : 'Modifier ce cadeau'} <ArrowUpRight />
            </button>
          </article> : <GiftEditor key={`${userId}-${day}`} day={day} initial={entry}
            decoration={`Pour ${user.displayName}`} mediaBasePath={`/api/admin/gifts/${userId}`}
            onSave={(content, publish) => api.saveAdminGift(userId, content, publish)}
            onUpload={file => api.uploadAdminGiftMedia(userId, day, file)}
            onSaved={value => { setEntry(value); setMissing(false); }}
            onDirtyChange={setDirty} onBusyChange={setEditorBusy} onExpired={onExpired}
            onCancel={() => {
              if (!canDiscard()) return;
              setEditing(false);
              setDirty(false);
            }} />}
          {!editing && <button className="text-button" disabled={loading}
            onClick={() => setReload(value => value + 1)}>Actualiser le cadeau</button>}
        </>}
    </>}
  </section>;
}
