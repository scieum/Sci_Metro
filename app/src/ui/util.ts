export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 00:37 (진행 중 시계) */
export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** 00:52.34 (시계·기록, 1/100초) */
export function recTime(ms: number) {
  return `${clock(ms)}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;
}
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const lineColor = (token: string) => `var(--${token})`;

export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export const icon = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z"/></svg>',
  lines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.5"/></svg>',
  records: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16M7 16V9M12 16V5M17 16v-4"/></svg>',
  logo: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="var(--primary)" stroke-width="3"/><circle cx="12" cy="12" r="3.5" fill="var(--primary)"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="5" rx="1"/><rect x="16" y="4" width="5" height="5" rx="1"/><rect x="3" y="11" width="5" height="5" rx="1"/><rect x="9.5" y="11" width="5" height="5" rx="1"/><rect x="16" y="11" width="5" height="5" rx="1"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  timer: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  target: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
};
