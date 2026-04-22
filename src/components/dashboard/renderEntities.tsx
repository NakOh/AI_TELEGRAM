import type React from '../../lib/teact/teact';

import type { ApiMessageEntity } from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

import styles from './Dashboard.module.scss';

function highlightSlice(text: string, query?: string, keyPrefix = ''): React.ReactNode {
  const q = query?.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  if (!lower.includes(qLower)) return text;
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={`${keyPrefix}-${idx}-${i}`} className={styles.highlight}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return parts;
}

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

// UTF-16 units — Telegram entity offsets are in UTF-16 code units so
// plain string slicing matches. Surrogate pairs emojis are handled ok.
export default function renderEntities(
  text: string,
  entities?: ApiMessageEntity[],
  searchQuery?: string,
): React.ReactNode {
  if (!text) return undefined;
  if (!entities?.length) return highlightSlice(text, searchQuery, 'plain');

  // Sort by offset asc
  const sorted = [...entities].sort((a, b) => a.offset - b.offset);

  const out: React.ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((entity, i) => {
    const { offset, length } = entity;
    if (offset < cursor) return; // skip overlapping nested entities for simplicity
    if (offset > cursor) {
      out.push(highlightSlice(text.slice(cursor, offset), searchQuery, `pre-${i}`));
    }
    const slice = text.slice(offset, offset + length);
    const highlighted = highlightSlice(slice, searchQuery, `ent-${i}`);
    out.push(renderEntity(entity, slice, highlighted, i));
    cursor = offset + length;
  });
  if (cursor < text.length) {
    out.push(highlightSlice(text.slice(cursor), searchQuery, 'tail'));
  }
  return out;
}

function renderEntity(
  entity: ApiMessageEntity,
  raw: string,
  content: React.ReactNode,
  index: number,
): React.ReactNode {
  const key = `entity-${index}`;
  switch (entity.type) {
    case ApiMessageEntityTypes.Url:
      return (
        <a
          key={key}
          href={raw}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.entityLink}
          onClick={stopPropagation}
        >
          {content}
        </a>
      );
    case ApiMessageEntityTypes.TextUrl:
      return (
        <a
          key={key}
          href={(entity as { url?: string }).url || raw}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.entityLink}
          onClick={stopPropagation}
        >
          {content}
        </a>
      );
    case ApiMessageEntityTypes.Email:
      return (
        <a key={key} href={`mailto:${raw}`} className={styles.entityLink} onClick={stopPropagation}>
          {content}
        </a>
      );
    case ApiMessageEntityTypes.Phone:
      return (
        <a key={key} href={`tel:${raw}`} className={styles.entityLink} onClick={stopPropagation}>
          {content}
        </a>
      );
    case ApiMessageEntityTypes.Mention: {
      const username = raw.replace(/^@/, '');
      return (
        <a
          key={key}
          href={`https://t.me/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.entityLink}
          onClick={stopPropagation}
        >
          {content}
        </a>
      );
    }
    case ApiMessageEntityTypes.Hashtag:
    case ApiMessageEntityTypes.Cashtag:
      return <span key={key} className={styles.entityTag}>{content}</span>;
    case ApiMessageEntityTypes.Bold:
      return <b key={key}>{content}</b>;
    case ApiMessageEntityTypes.Italic:
      return <i key={key}>{content}</i>;
    case ApiMessageEntityTypes.Underline:
      return <u key={key}>{content}</u>;
    case ApiMessageEntityTypes.Strike:
      return <s key={key}>{content}</s>;
    case ApiMessageEntityTypes.Code:
      return <code key={key} className={styles.entityCode}>{content}</code>;
    case ApiMessageEntityTypes.Pre:
      return <pre key={key} className={styles.entityPre}>{content}</pre>;
    case ApiMessageEntityTypes.Blockquote:
      return <blockquote key={key} className={styles.entityQuote}>{content}</blockquote>;
    case ApiMessageEntityTypes.Spoiler:
      return <span key={key} className={styles.entitySpoiler}>{content}</span>;
    default:
      return <span key={key}>{content}</span>;
  }
}
