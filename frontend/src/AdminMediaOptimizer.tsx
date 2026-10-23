import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, errorMessage, type ManagedUser, type MediaInfo, type OptimizeResult } from './api';

// En dessous de ces poids, un média est déjà léger : on ne le retraite pas.
const MIN_IMAGE_BYTES = 400 * 1024;
const MIN_VIDEO_BYTES = 3 * 1024 * 1024;

type Outcome = { item: MediaInfo; result?: OptimizeResult; error?: string };

function size(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function isCandidate(item: MediaInfo): boolean {
  if (item.contentType.startsWith('video/')) return item.bytes >= MIN_VIDEO_BYTES;
  if (item.contentType.startsWith('image/')) return !['image/gif', 'image/avif'].includes(item.contentType) && item.bytes >= MIN_IMAGE_BYTES;
  return false;
}

export function AdminMediaOptimizer({ users, onExpired }: { users: ManagedUser[]; onExpired: () => void }) {
  const [items, setItems] = useState<MediaInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [current, setCurrent] = useState<{ item: MediaInfo; index: number; total: number } | null>(null);
  const stop = useRef(false);

  const names = useMemo(() => new Map(users.map((user): [string, string] => [user.id, user.displayName])), [users]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setItems(await api.adminMedia()); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onExpired();
      else setError(errorMessage(cause));
    } finally { setLoading(false); }
  }, [onExpired]);
  useEffect(() => { void load(); }, [load]);

  const targets = useMemo(() => (items ?? []).filter(isCandidate).sort((a, b) => b.bytes - a.bytes), [items]);
  const total = (items ?? []).reduce((sum, item) => sum + item.bytes, 0);
  const targetBytes = targets.reduce((sum, item) => sum + item.bytes, 0);
  const saved = outcomes.reduce((sum, outcome) => sum + (outcome.result ? outcome.result.before - outcome.result.after : 0), 0);
  const changed = outcomes.filter(outcome => outcome.result?.changed).length;
  const failed = outcomes.filter(outcome => outcome.error).length;

  async function run() {
    stop.current = false;
    setRunning(true);
    setError('');
    setOutcomes([]);
    for (let index = 0; index < targets.length && !stop.current; index += 1) {
      const item = targets[index];
      setCurrent({ item, index, total: targets.length });
      try {
        const result = await api.optimizeMedia(item.id);
        setOutcomes(previous => [...previous, { item, result }]);
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) { onExpired(); return; }
        setOutcomes(previous => [...previous, { item, error: errorMessage(cause) }]);
      }
    }
    setCurrent(null);
    setRunning(false);
    await load();
  }

  const label = (item: MediaInfo) => `${names.get(item.userId) ?? 'Compte supprimé'} · jour ${item.day}`;
  return <section className="media-optimizer" aria-label="Optimisation des médias">
    {error && <div className="form-error" role="alert">{error}</div>}
    {loading && !items ? <p role="status">Analyse des médias…</p> : items && <>
      <div className="media-optimizer-stats">
        <div><strong>{items.length}</strong><span>média{items.length > 1 ? 's' : ''} en base</span></div>
        <div><strong>{size(total)}</strong><span>espace occupé</span></div>
        <div><strong>{targets.length}</strong><span>à alléger ({size(targetBytes)})</span></div>
      </div>
      <p className="media-optimizer-help">
        Les photos sont réduites à 1600 px et les vidéos à 540 px de petit côté (MP4 H.264), comme pour les nouveaux imports.
        Chaque média garde le même identifiant : les cadeaux déjà publiés continuent de fonctionner. Un média n’est remplacé que
        s’il gagne au moins 15 %. Les GIF, AVIF et fichiers audio ne sont pas touchés. L’opération peut durer plusieurs minutes
        par vidéo : laissez cette page ouverte.
      </p>
      <div className="media-optimizer-actions">
        {!running
          ? <button className="primary-button" type="button" disabled={targets.length === 0} onClick={() => void run()}>
            {targets.length === 0 ? 'Tout est déjà léger' : `Recompresser ${targets.length} média${targets.length > 1 ? 's' : ''}`}
          </button>
          : <button className="secondary-button" type="button" onClick={() => { stop.current = true; }}>Arrêter après le média en cours</button>}
        <button className="text-button" type="button" disabled={running || loading} onClick={() => void load()}>Actualiser</button>
      </div>
      {current && <div className="media-optimizer-progress" role="status">
        <progress max={current.total} value={current.index} />
        <p>Média {current.index + 1} sur {current.total} : {label(current.item)} ({size(current.item.bytes)})…</p>
      </div>}
      {outcomes.length > 0 && <div className="media-optimizer-results">
        <p className="notice" role="status">
          {changed} média{changed > 1 ? 's' : ''} allégé{changed > 1 ? 's' : ''} sur {outcomes.length} traité{outcomes.length > 1 ? 's' : ''}
          {' '}— <strong>{size(saved)} économisés</strong>{failed > 0 ? ` — ${failed} en erreur` : ''}.
        </p>
        <ul>
          {outcomes.map(({ item, result, error: failure }) => <li key={item.id} className={failure ? 'is-error' : result?.changed ? 'is-changed' : ''}>
            <span>{label(item)}</span>
            <span>{failure ? failure : result?.changed ? `${size(result.before)} → ${size(result.after)}` : result?.reason ?? 'Inchangé'}</span>
          </li>)}
        </ul>
      </div>}
    </>}
  </section>;
}
