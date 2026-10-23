import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, Check, Close } from './Icons';
import { ApiError, errorMessage, type ContentBlock, type Entry, type GiftDraft, type PreviewEntry } from './api';
import { GiftContent } from './GiftContent';
import { compressImage } from './compressImage';
import { acceptAttribute, resolveMediaType, withMediaType } from './mediaTypes';

const formatsHelp = {
  image: 'JPG, PNG, WebP, GIF, AVIF, HEIC (iPhone), BMP, TIFF',
  video: 'MP4, MOV (iPhone), WebM, MKV, AVI, 3GP',
  audio: 'MP3, M4A, AAC, WAV, OGG, FLAC',
};
const blockNames = { text: 'Texte', quote: 'Citation', image: 'Image', video: 'Vidéo', audio: 'Audio' };

export function GiftEditor({
  day, initial, decoration, mediaBasePath, onSave, onUpload, onSaved, onPublished, onDirtyChange, onBusyChange, onExpired, onCancel,
}: {
  day: number; initial: Entry | null; decoration: string; onSaved: (entry: PreviewEntry) => void; onPublished?: (entry: PreviewEntry) => void;
  mediaBasePath?: string;
  onSave: (content: GiftDraft, publish: boolean) => Promise<PreviewEntry>;
  onUpload: (file: File) => Promise<{ mediaId: string; type: 'image' | 'video' | 'audio' }>;
  onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void; onExpired: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<GiftDraft>(() => ({
    day, kind: initial?.kind ?? 'surprise', title: initial?.title ?? '', text: initial?.text ?? '',
    sticker: initial?.sticker ?? 'sourire', reviewed: false, blocks: initial?.blocks ?? [],
  }));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const preventExit = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', preventExit);
    return () => window.removeEventListener('beforeunload', preventExit);
  }, [dirty, busy]);

  function update(next: GiftDraft) {
    setDraft({ ...next, reviewed: false });
    setDirty(true);
    setNotice('');
  }
  function updateBlock(index: number, block: ContentBlock) {
    update({ ...draft, blocks: draft.blocks.map((item, position) => position === index ? block : item) });
  }
  function addBlock(type: ContentBlock['type']) {
    const block: ContentBlock = type === 'text' || type === 'quote'
      ? { type, text: '', caption: '' } : { type, mediaId: '', caption: '' };
    update({ ...draft, blocks: [...draft.blocks, block] });
  }
  function moveBlock(index: number, offset: number) {
    const blocks = [...draft.blocks];
    [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]];
    update({ ...draft, blocks });
  }
  function failure(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) onExpired();
    else setError(errorMessage(cause));
  }
  async function upload(index: number, file: File) {
    const block = draft.blocks[index];
    if (block.type === 'text' || block.type === 'quote') return;
    setError('');
    const limit = block.type === 'image' ? 40 : 300;
    const sourceLimit = block.type === 'image' ? 120 : 300;
    const type = resolveMediaType(file, block.type);
    if (!type || file.size > sourceLimit * 1024 * 1024 || file.size === 0) {
      setError(type ? `Choisis un fichier non vide, de ${sourceLimit} Mo maximum.`
        : `Format non pris en charge pour ce bloc (${blockNames[block.type].toLowerCase()}). Formats acceptés : ${formatsHelp[block.type]}.`);
      return;
    }
    setBusy(true);
    try {
      let toSend = withMediaType(file, type);
      if (block.type === 'image') {
        setNotice('Optimisation de l’image…');
        toSend = await compressImage(toSend);
        if (toSend.size > limit * 1024 * 1024) {
          setNotice('');
          setError(`Cette image reste trop lourde (${limit} Mo maximum après optimisation).`);
          return;
        }
      }
      setNotice(block.type === 'video' ? 'Import de la vidéo en cours… (elle est allégée pendant l’import, cela peut prendre quelques minutes)' : 'Import du média en cours…');
      const media = await onUpload(toSend);
      updateBlock(index, { type: block.type, mediaId: media.mediaId, caption: block.caption || file.name.replace(/\.[^.]+$/, '') });
      setNotice('Média importé. Enregistre le brouillon pour le conserver dans ce cadeau.');
    } catch (cause) { setNotice(''); failure(cause); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish';
    setError('');
    setNotice('');
    if (draft.blocks.some(block => block.type !== 'text' && block.type !== 'quote' && !block.mediaId)) {
      setError('Importe un fichier pour chaque bloc média, ou retire le bloc vide.');
      return;
    }
    if (!draft.text.trim() && draft.blocks.length === 0) {
      setError('Ajoute un texte ou un bloc pour composer ton cadeau.');
      return;
    }
    if (publish && !draft.reviewed) {
      setError('Confirme la relecture du cadeau avant de le publier.');
      return;
    }
    setBusy(true);
    try {
      const result = await onSave(draft, publish);
      onSaved(result);
      setDirty(false);
      if (publish && onPublished) { onPublished(result); return; }
      setNotice(publish ? 'Cadeau publié ! Il sera accessible à sa date de décembre.'
        : 'Brouillon enregistré. La version publiée et les ouvertures restent inchangées.');
    } catch (cause) { failure(cause); }
    finally { setBusy(false); }
  }

  return <div className="gift-editor">
    <div className="editor-heading">
      <div><span className="eyebrow">L’ATELIER DES PETITES ATTENTIONS</span><h2 id={previewing ? undefined : 'surprise-title'}>Compose ton cadeau.</h2></div>
      <span className="editor-state">{dirty ? 'Modifications non enregistrées' : 'Brouillon & publication séparés'}</span>
    </div>
    <p className="editor-intro">Une photo, quelques mots, un film… Assemble les petites choses qui lui feront plaisir.</p>
    <div className="editor-tabs" aria-label="Affichage de l’éditeur">
      <button type="button" aria-pressed={!previewing} onClick={() => setPreviewing(false)}>Composer</button>
      <button type="button" aria-pressed={previewing} onClick={() => setPreviewing(true)}>Voir le rendu</button>
    </div>
    {previewing && <GiftContent entry={draft} preview decoration={decoration} mediaBasePath={mediaBasePath} />}
    <form onSubmit={event => void save(event)} hidden={previewing}>
      <fieldset disabled={busy}>
        <label htmlFor="gift-title">Titre du cadeau</label>
        <input id="gift-title" value={draft.title} required maxLength={120} placeholder="Une petite surprise, rien que pour toi"
          onChange={event => update({ ...draft, title: event.target.value })} />
        <label htmlFor="gift-text">Ton message <span>(facultatif avec des blocs)</span></label>
        <textarea id="gift-text" value={draft.text} maxLength={50000} rows={5} placeholder="Prends toute la place pour raconter, remercier, faire sourire…"
          onChange={event => update({ ...draft, text: event.target.value })} />
        <span className="field-hint">{draft.text.length.toLocaleString('fr-FR')} / 50 000 caractères · Les paragraphes sont conservés.</span>
        <div className="editor-blocks">
          {draft.blocks.map((block, index) => <section className="editor-block" key={index} aria-label={`Bloc ${index + 1} — ${blockNames[block.type]}`}>
            <div className="block-toolbar"><strong><span>{String(index + 1).padStart(2, '0')}</span> {blockNames[block.type]}</strong>
              <div>
                <button type="button" aria-label={`Monter le bloc ${index + 1}`} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp /></button>
                <button type="button" aria-label={`Descendre le bloc ${index + 1}`} disabled={index === draft.blocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown /></button>
                <button type="button" aria-label={`Retirer le bloc ${index + 1}`} onClick={() => update({ ...draft, blocks: draft.blocks.filter((_, position) => position !== index) })}><Close /></button>
              </div>
            </div>
            {block.type === 'text' || block.type === 'quote' ? <>
              <label htmlFor={`block-text-${index}`}>{block.type === 'quote' ? 'La citation' : 'Le texte'}</label>
              <textarea id={`block-text-${index}`} value={block.text} required rows={block.type === 'quote' ? 3 : 6} maxLength={20000}
                onChange={event => updateBlock(index, { ...block, text: event.target.value })} />
              {block.type === 'quote' && <><label htmlFor={`block-caption-${index}`}>Signature ou auteur <span>(facultatif)</span></label>
                <input id={`block-caption-${index}`} value={block.caption ?? ''} maxLength={500}
                  onChange={event => updateBlock(index, { ...block, caption: event.target.value })} /></>}
            </> : <>
              <label className="upload-zone" htmlFor={`block-file-${index}`}>
                <ArrowUp /><strong>{block.mediaId ? 'Remplacer le fichier' : `Importer ${block.type === 'image' ? 'une image' : block.type === 'video' ? 'une vidéo' : 'un audio'}`}</strong>
                <span>{block.type === 'image' ? 'JPG, PNG, HEIC, WebP, GIF, AVIF… · 40 Mo max.' : block.type === 'video' ? 'MP4, MOV, WebM, MKV, AVI… · 300 Mo max.' : 'MP3, M4A, WAV, OGG, FLAC… · 300 Mo max.'}</span>
                <input id={`block-file-${index}`} type="file" accept={acceptAttribute[block.type]} onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void upload(index, file);
                  event.target.value = '';
                }} />
              </label>
              {block.mediaId && <p className="media-ready"><Check /> Fichier importé et privé</p>}
              <label htmlFor={`block-caption-${index}`}>Description / légende</label>
              <input id={`block-caption-${index}`} required maxLength={500} value={block.caption ?? ''}
                onChange={event => updateBlock(index, { ...block, caption: event.target.value })} />
              <span className="field-hint">Décris ce que l’on voit ou entend pour rendre le cadeau accessible.</span>
            </>}
          </section>)}
        </div>
        <div className="add-block">
          <span className="eyebrow">AJOUTER UNE PETITE ATTENTION</span>
          <div>{(Object.keys(blockNames) as ContentBlock['type'][]).map(type =>
            <button type="button" key={type} disabled={draft.blocks.length >= 20} onClick={() => addBlock(type)}>+ {blockNames[type]}</button>)}</div>
          <span className="field-hint">Jusqu’à 20 blocs, dans l’ordre de ton choix. Aucun média ne démarre automatiquement.</span>
        </div>
        <label className="review-checkbox"><input type="checkbox" checked={draft.reviewed}
          onChange={event => setDraft({ ...draft, reviewed: event.target.checked })} />J’ai relu ce cadeau et vérifié ses médias avant publication.</label>
        <div className="editor-actions">
          <button type="submit" value="draft" className="secondary-button">Enregistrer le brouillon</button>
          <button type="submit" value="publish" className="primary-button" disabled={!draft.reviewed}>Publier ce cadeau <ArrowUpRight /></button>
        </div>
      </fieldset>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="editor-notice" role="status">{notice}</p>}
    <button type="button" className="text-button editor-back" disabled={busy} onClick={onCancel}><ArrowLeft /> Revenir au cadeau</button>
  </div>;
}
