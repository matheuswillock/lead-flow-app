/* shared.jsx — Corretor Studio UI Kit primitives
 * Logo, Button, Badge, Card, Avatar, Input, Icons
 */

const { useState, useMemo, useEffect, useRef } = React;

const cn = (...xs) => xs.filter(Boolean).join(' ');

// ---------- Logo ---------------------------------------------------------
function Logo({ size = 28, withWord = true }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <img src="../../assets/corretor-studio-icon.svg" alt="Corretor Studio"
        style={{ width: size, height: size, borderRadius: size * 0.18, display: 'block' }} />
      {withWord && (
        <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 15, letterSpacing: '-0.005em' }}>
          Corretor Studio
        </span>
      )}
    </div>
  );
}

// ---------- Button -------------------------------------------------------
function Button({ variant = 'primary', size = 'md', children, className, leadingIcon, trailingIcon, ...rest }) {
  const base = 'cs-btn';
  return (
    <button className={cn(base, `cs-btn--${variant}`, `cs-btn--${size}`, className)} {...rest}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}

// ---------- Badge --------------------------------------------------------
function Badge({ tone = 'neutral', solid = false, dot = false, children }) {
  return (
    <span className={cn('cs-badge', `cs-badge--${tone}`, solid && 'cs-badge--solid')}>
      {dot && <span className="cs-badge__dot" />}
      {children}
    </span>
  );
}

// ---------- Card ---------------------------------------------------------
function Card({ variant = 'app', className, children, ...rest }) {
  return <div className={cn('cs-card', `cs-card--${variant}`, className)} {...rest}>{children}</div>;
}

// ---------- Avatar -------------------------------------------------------
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #ff6900, #cd6cdd)',
  'linear-gradient(135deg, #62b6ff, #7f7bff)',
  'linear-gradient(135deg, #22c08a, #62b6ff)',
  'linear-gradient(135deg, #f2a236, #f06572)',
  'linear-gradient(135deg, #7f7bff, #f06572)',
  'linear-gradient(135deg, #22c08a, #f2a236)',
];
function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}
function Avatar({ name, size = 28, idx = 0 }) {
  return (
    <span className="cs-avatar" style={{
      width: size, height: size, fontSize: size * 0.36,
      background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
    }}>{initials(name)}</span>
  );
}

// ---------- Input --------------------------------------------------------
function Input({ label, error, ...rest }) {
  return (
    <div className="cs-field">
      {label && <label>{label}</label>}
      <input className={cn('cs-input', error && 'is-error')} {...rest} />
      {error && <span className="cs-help-err">{error}</span>}
    </div>
  );
}

// ---------- Icon (Lucide subset, inline SVG) -----------------------------
const I = {
  arrowRight:  <path d="M5 12h14M12 5l7 7-7 7"/>,
  arrowUpRight:<path d="M7 17 17 7M7 7h10v10"/>,
  layout:      <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
  users:       <><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>,
  calendar:    <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  barchart:    <><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></>,
  calculator:  <><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="12" y1="11" x2="12.01" y2="11"/><line x1="16" y1="11" x2="16.01" y2="11"/><line x1="8" y1="15" x2="8.01" y2="15"/><line x1="12" y1="15" x2="12.01" y2="15"/><line x1="16" y1="15" x2="16.01" y2="15"/><line x1="8" y1="19" x2="8.01" y2="19"/></>,
  briefcase:   <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  mail:        <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  send:        <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>,
  history:     <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></>,
  fileText:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  bookUser:    <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="8" r="2"/><path d="M15 13a3 3 0 1 0-6 0"/></>,
  plug:        <><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/></>,
  lifebuoy:    <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></>,
  search:      <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  plus:        <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  bell:        <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  chevDown:    <polyline points="6 9 12 15 18 9"/>,
  chevRight:   <polyline points="9 18 15 12 9 6"/>,
  chevLeft:    <polyline points="15 18 9 12 15 6"/>,
  filter:      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>,
  more:        <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  kanban:      <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="10" rx="1"/></>,
  paperclip:   <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>,
  check:       <polyline points="20 6 9 17 4 12"/>,
  checkCircle: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
  video:       <><path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/></>,
  trendUp:     <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  trendDown:   <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
  clock:       <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  copy:        <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  scroll:      <><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M22 17H8a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v0"/><path d="M2 7v10a4 4 0 0 0 4 4"/></>,
  settings:    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
};

function Icon({ name, size = 16, stroke = 1.75, className }) {
  const path = I[name];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {path}
    </svg>
  );
}

Object.assign(window, { cn, Logo, Button, Badge, Card, Avatar, Input, Icon, AVATAR_GRADIENTS, initials });
