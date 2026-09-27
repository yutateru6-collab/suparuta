import React from 'react';

type Mood = 'ready' | 'reading' | 'thinking' | 'happy';
export const QuestMascot: React.FC<{ mood?: Mood; size?: 'small' | 'large' }> = ({ mood = 'ready', size = 'small' }) => (
  <div className={`quest-mascot quest-mascot--${size} quest-mascot--${mood}`} aria-hidden="true">
    <svg viewBox="0 0 160 158" role="presentation" focusable="false">
      <ellipse cx="81" cy="147" rx="45" ry="7" fill="#1e2753" opacity=".14" />
      <path d="M35 69c-15-12-20-6-16 7 3 10 11 16 23 13M124 69c15-12 20-6 16 7-3 10-11 16-23 13" fill="#ffcd56" stroke="#24305e" strokeWidth="6" strokeLinejoin="round" />
      <path d="M54 117l-5 19 22 2 6-18M104 117l7 19-22 2-6-18" fill="#6655db" stroke="#24305e" strokeWidth="6" strokeLinejoin="round" />
      <path d="M30 68c0-32 20-52 50-52s50 20 50 52v38c0 20-22 29-50 29s-50-9-50-29Z" fill="#8a71f1" stroke="#24305e" strokeWidth="6" />
      <path d="M41 66c0-26 15-39 39-39s39 13 39 39v27c0 20-17 30-39 30s-39-10-39-30Z" fill="#fff8ea" stroke="#24305e" strokeWidth="5" />
      <path d="M55 24 81 4l24 20" fill="#ffd453" stroke="#24305e" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="80" cy="18" r="6" fill="#ff6f83" />
      {mood === 'happy' ? <><path d="M56 71q10-13 20 0M88 71q10-13 20 0" fill="none" stroke="#24305e" strokeWidth="6" strokeLinecap="round" /><path d="M68 93q12 18 25 0" fill="none" stroke="#24305e" strokeWidth="5" strokeLinecap="round" /></> :
        mood === 'thinking' ? <><circle cx="65" cy="70" r="5" fill="#24305e" /><circle cx="98" cy="70" r="5" fill="#24305e" /><path d="M76 95q8-5 15 0" fill="none" stroke="#24305e" strokeWidth="4" strokeLinecap="round" /></> :
          <><ellipse cx="65" cy="70" rx="5" ry="8" fill="#24305e" /><ellipse cx="98" cy="70" rx="5" ry="8" fill="#24305e" /><path d="M73 93q9 9 18 0" fill="none" stroke="#24305e" strokeWidth="4" strokeLinecap="round" /></>}
      <circle cx="52" cy="89" r="7" fill="#ffa8a6" opacity=".75" /><circle cx="110" cy="89" r="7" fill="#ffa8a6" opacity=".75" />
      <path d="M45 111q35 14 69 0" fill="none" stroke="#ffffff" strokeWidth="4" opacity=".65" />
    </svg>
  </div>
);
