import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';
import { services } from './data';
import { icon, navigate } from './ui/util';
import { renderHome } from './ui/home';
import { renderLines } from './ui/lines';
import { renderPlay } from './ui/play';
import { renderRecords } from './ui/records';

const app = document.getElementById('app')!;
let cleanup: (() => void) | void;

const FOOTER = '© 2026 사이음(sci_eum). 과학의 사이, 사람을 잇다.';

function shell(active: 'home' | 'lines' | 'records'): HTMLElement {
  const svc = services.filter((s) => s.status === 'open');
  app.innerHTML = `<div class="shell">
    <nav class="nav" aria-label="주 메뉴">
      <a class="brand" href="/" data-link>${icon.logo}<span class="sr-wide">Science_Metro</span></a>
      <a href="/" data-link ${active === 'home' ? 'aria-current="page"' : ''}>${icon.home}<span>홈</span></a>
      <a href="/element" data-link ${active === 'lines' ? 'aria-current="page"' : ''}>${icon.lines}<span>노선</span></a>
      <a href="/records" data-link ${active === 'records' ? 'aria-current="page"' : ''}>${icon.records}<span>내 기록</span></a>
      <div class="svc"><span class="caption-strong">서비스</span>${svc.map((s) => `<a href="/${s.id}" data-link><span class="dot" style="border:3px solid var(--primary);background:var(--bg)"></span>${s.name}<span class="live">운행 중</span></a>`).join('')}</div>
    </nav>
    <div class="col"><main id="main"></main><footer class="footer">${FOOTER}</footer></div>
  </div>`;
  return document.getElementById('main')!;
}

function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  const url = new URL(location.href);
  const parts = url.pathname.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  if (parts[0] === 'element' || parts[0] === 'lines') {
    const lineId = parts[1];
    const mode = url.searchParams.get('mode');
    if (lineId && mode) { cleanup = renderPlay(app, lineId, mode, url.searchParams); return; }
    cleanup = renderLines(shell('lines'), lineId, url.searchParams.get('preview') === '1');
    return;
  }
  if (parts[0] === 'records') { renderRecords(shell('records')); return; }
  renderHome(shell('home'));
}

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[data-link]') as HTMLAnchorElement | null;
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
  e.preventDefault();
  navigate(a.getAttribute('href')!);
});
window.addEventListener('popstate', render);
render();
