import { useState } from 'react';
import type { ContentBlock, Entry } from './api';

const labels = { blague: 'Un sourire pour toi', anecdote: 'La petite découverte', activite: 'À toi de jouer', surprise: 'Une petite attention' };

export function GiftContent({ entry, preview, decoration, mediaBasePath }: {
  entry: Entry; preview: boolean; decoration: string; mediaBasePath?: string;
}) {
  return <article className={`surprise-content ${entry.blocks?.length ? 'rich-surprise' : ''}`}>
    <img src={`/stickers/${entry.sticker}.webp`} alt="" className="sticker" width={180} height={180} />
    <span className="content-kind">{labels[entry.kind]}</span>
    <h2 id="surprise-title">{entry.title}</h2>
    {entry.text && <p className="surprise-text">{entry.text}</p>}
    {entry.blocks?.map((block, index) => <ContentPiece key={`${index}-${block.mediaId ?? block.type}`}
      block={block} day={entry.day} preview={preview} mediaBasePath={mediaBasePath} />)}
    <span className="surprise-signature">{decoration} ♡</span>
  </article>;
}

function ContentPiece({ block, day, preview, mediaBasePath }: {
  block: ContentBlock; day: number; preview: boolean; mediaBasePath?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (block.type === 'text') return <p className="surprise-text rich-paragraph">{block.text}</p>;
  if (block.type === 'quote') return <figure className="gift-quotation">
    <span aria-hidden="true">“</span><blockquote>{block.text}</blockquote>
    {block.caption && <figcaption>— {block.caption}</figcaption>}
  </figure>;
  if (!block.mediaId) return <p className="form-error" role="status">Importe un fichier dans ce bloc pour voir son rendu.</p>;
  const src = mediaBasePath
    ? `${mediaBasePath}/${day}/media/${block.mediaId}`
    : `/api/${preview ? 'preview/' : ''}calendar/${day}/media/${block.mediaId}`;
  return <figure className={`gift-media media-${block.type}`}>
    {block.type === 'image' && <img key={attempt} src={src} alt={block.caption} loading="lazy" onError={() => setFailed(true)} />}
    {block.type === 'video' && <video key={attempt} src={src} controls playsInline preload="metadata"
      aria-label={block.caption} onError={() => setFailed(true)} />}
    {block.type === 'audio' && <audio key={attempt} src={src} controls preload="metadata"
      aria-label={block.caption} onError={() => setFailed(true)} />}
    {block.caption && <figcaption>{block.caption}</figcaption>}
    {failed && <div className="form-error" role="alert">
      Ce média ne peut pas être lu. Vérifie la connexion ou le format du fichier.
      <button type="button" className="text-button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Réessayer le média</button>
    </div>}
  </figure>;
}
