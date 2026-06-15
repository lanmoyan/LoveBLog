'use client';

import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import type { EmojiPack } from '@/lib/settings';
import { emojiToken } from '@/lib/rich-text';

export function EmojiPicker({ packs, onPick }: { packs: EmojiPack[]; onPick: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = packs[active] || packs[0];

  return (
    <div className="emoji-wrap">
      <button className="tool-btn" type="button" onClick={() => setOpen((v) => !v)}>
        <SmilePlus size={16} />
        表情
      </button>
      {open && current && (
        <div className="emoji-pop">
          <div className="emoji-tabs">
            {packs.map((pack, index) => (
              <button key={pack.name} className={index === active ? 'active' : ''} type="button" onClick={() => setActive(index)}>
                {pack.name}
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {current.items.map((item, index) => {
              const objectItem = typeof item === 'object' ? item : null;
              const value = objectItem ? (objectItem.text || emojiToken(objectItem.label, objectItem.url)) : String(item);
              return (
                <button key={index} type="button" onClick={() => onPick(value)}>
                  {objectItem ? <img src={objectItem.url} alt={objectItem.label} /> : String(item)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
