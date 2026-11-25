import { films, sheets, modulo, relative, smoothstep, shelfX, applyCrop } from './data.js';

const $ = (selector) => document.querySelector(selector);
const root = $('#filmography');
const shelf = $('.shelf');
const stage = $('.stage');
const detail = $('.detail');
const cursor = $('.cursor');
const play = $('.play-ring');
const tabs = [...document.querySelectorAll('[data-decade]')];
const captionMasks = [...document.querySelectorAll('.caption-mask')];
const inkCircles = [...document.querySelectorAll('#ink-mask circle')];
const inkDelays = [0, 120, 220, 300, 360, 420, 180];
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const fineQuery = matchMedia('(pointer: fine)');
const ease = 'cubic-bezier(.2,.8,.2,1)';
const paperEase = 'cubic-bezier(.76,0,.18,1)';
const canvas = document.createElement('canvas');
const measureContext = canvas.getContext('2d');
let reduced = reduceQuery.matches;
let ready = false;
let H = 0, ws = 0, d = 0, gap = 0, W = innerWidth, V = innerHeight;
let s = 17, T = 17, active = 5, hover = -1;
let mx = innerWidth / 2, my = 0, cx = mx, cy = my;
let tiltX = 0, tiltY = 0, onCover = false, pointerSeen = false, hoveredButton = false;
let isOpen = false, closing = false, inkStart = null, lastTime = 0;
let drag = null, suppressClick = false, wheelTimer, resizeTimer, frameId;
let returnFocus = null, sheetAnimation = null, openToken = 0;
let detailLines = [];
let previousPlayTransform = '', previousCursorTransform = '';

const tapes = Array.from({ length: 36 }, (_, v) => {
  const film = films[v % 12];
  const element = document.createElement('button');
  element.className = 'tape';
  element.dataset.film = film.id;
  element.dataset.virtual = String(v);
  element.setAttribute('aria-label', `${film.displayTitle || film.title}, ${film.year}`);
  if (film.type === 'book') {
    element.classList.add('book');
    element.lang = film.language;
  }
  const spine = document.createElement('span');
  spine.className = 'face sp';
  spine.setAttribute('aria-hidden', 'true');
  const cover = document.createElement('span');
  cover.className = 'face cv';
  cover.setAttribute('aria-hidden', 'true');
  if (film.type === 'book') {
    const title = document.createElement('span');
    title.className = 'book-spine-title';
    title.textContent = film.spineTitle || film.title;
    const author = document.createElement('span');
    author.className = 'book-spine-author';
    author.textContent = film.author;
    const year = document.createElement('span');
    year.className = 'book-spine-year';
    year.textContent = String(film.year);
    spine.append(title, author, year);
  } else applyCrop(spine, film.spine);
  applyCrop(cover, film.cover);
  element.append(spine, cover);
  stage.append(element);
  element.addEventListener('pointerenter', () => { hover = v; });
  element.addEventListener('pointerleave', () => { if (hover === v) hover = -1; });
  element.addEventListener('click', (event) => {
    if (!ready || isOpen) return;
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    const r = relative(v, s);
    if (Math.abs(r) < .5 && Math.abs(T - s) < .3) openDetail();
    else T = Math.round(s + r);
  });
  return { element, spine, cover, film, v, lift: 0, visible: null, accessible: null };
});

function updateDimensions() {
  W = innerWidth;
  V = innerHeight;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;height:var(--H);width:0;';
  document.body.append(probe);
  H = probe.getBoundingClientRect().height;
  probe.remove();
  ws = H * 142 / 840;
  d = H * (films[active].coverRatio || 474 / 900);
  gap = H * .03;
  stage.style.setProperty('--ws', `${ws}px`);
  stage.style.setProperty('--d', `${d}px`);
  tapes.forEach((tape) => {
    tape.element.style.setProperty('--d', `${H * (tape.film.coverRatio || 474 / 900)}px`);
  });
  play.style.left = `${W / 2 - d * .5 - 6}px`;
  play.style.top = `${V / 2 + H * .36}px`;
  updateTab();
  if (isOpen && !closing) {
    populateDetail(films[active]);
    detailLines.forEach((line) => { line.style.transform = 'translateY(0)'; });
  }
}

function updateTab() {
  const decade = films[active].type === 'book' ? 'books' : String(Math.floor(films[active].year / 10) * 10);
  let selected;
  tabs.forEach((tab) => {
    const current = tab.dataset.decade === decade;
    tab.setAttribute('aria-current', String(current));
    if (current) selected = tab;
  });
  if (!selected) return;
  const indicator = $('.tab-indicator');
  indicator.style.width = `${selected.offsetWidth}px`;
  indicator.style.transform = `translateX(${selected.offsetLeft}px)`;
}

function swapCaption(index, direction) {
  active = index;
  const film = films[index];
  const values = [film.displayTitle || film.title, film.type === 'book' ? film.author : `${film.romaji} / ${film.kanji}`, String(film.year)];
  $('.caption-title').lang = film.language || 'en';
  play.setAttribute('aria-label', film.type === 'book' ? '查看书籍介绍' : 'Open film');
  play.dataset.type = film.type || 'film';
  captionMasks.forEach((mask, i) => {
    if (reduced) { mask.replaceChildren(makeCaptionSpan(values[i], i === 1, film)); return; }
    const next = makeCaptionSpan(values[i], i === 1, film);
    [...mask.children].forEach((old) => {
      if (old.dataset.leaving) return;
      const from = getComputedStyle(old).transform;
      old.getAnimations().forEach((animation) => animation.cancel());
      old.dataset.leaving = 'true';
      old.style.cssText = 'position:absolute;inset:0;width:100%;';
      old.setAttribute('aria-hidden', 'true');
      const animation = old.animate([{ transform: from }, { transform: `translateY(${-direction * 105}%)` }], { duration: 650, easing: ease, fill: 'both' });
      animation.finished.then(() => old.remove()).catch(() => old.remove());
    });
    mask.append(next);
    const animation = next.animate([{ transform: `translateY(${direction * 105}%)` }, { transform: 'translateY(0)' }], { duration: 650, easing: ease, fill: 'both' });
    animation.finished.then(() => { if (!next.dataset.leaving) animation.cancel(); }).catch(() => {});
  });
  updateTab();
}

function makeCaptionSpan(value, japanese, film) {
  const span = document.createElement('span');
  if (japanese && film.type === 'book') {
    span.textContent = `${film.author} / 经典文学`;
  } else if (japanese) {
    const jp = document.createElement('span');
    jp.lang = 'ja';
    jp.textContent = film.kanji;
    span.append(`${film.romaji} / `, jp);
  } else span.textContent = value;
  return span;
}

function goToFilm(index) {
  if (!ready || isOpen) return;
  T = Math.round(T) + relative(index, Math.round(T), 12);
}

function wrapText(container, text, tag = 'p') {
  container.replaceChildren();
  const style = getComputedStyle(container);
  measureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = container.getBoundingClientRect().width;
  const spacing = Number.parseFloat(style.letterSpacing) || 0;
  const fits = (value) => measureContext.measureText(value).width + spacing * value.length <= width - 2;
  const lines = [];
  let line = '';
  const chinese = container.lang === 'zh';
  for (const word of chinese ? Array.from(text) : text.split(' ')) {
    const next = line ? `${line}${chinese ? '' : ' '}${word}` : word;
    if (line && !fits(next)) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  for (const textLine of lines) {
    const mask = document.createElement('div');
    mask.className = 'detail-mask';
    const inner = document.createElement(tag);
    inner.className = 'detail-line';
    inner.textContent = textLine;
    mask.append(inner);
    container.append(mask);
  }
}

function populateDetail(film) {
  const book = film.type === 'book';
  detail.dataset.type = book ? 'book' : 'film';
  $('.detail-title-group').lang = film.language || 'en';
  $('.detail-synopsis').lang = film.language || 'en';
  if (book) {
    $('.detail-subtitle').textContent = film.title;
    $('.detail-meta').textContent = `${film.year} / 经典文学 / ${film.author}`;
    $('.detail-credit').textContent = `Written by ${film.author}. Illustrated by ${film.illustrator}.`;
    $('.book-source').textContent = film.sourceNote;
    $('.book-source').href = film.sourceUrl;
  } else {
    const jp = document.createElement('span');
    jp.lang = 'ja';
    jp.textContent = film.kanji;
    $('.detail-subtitle').replaceChildren(`${film.romaji} / `, jp);
    $('.detail-meta').textContent = `${film.year} / ${film.genre.toUpperCase()} / ${film.minutes} MIN`;
    const credit = document.createElement('span');
    credit.lang = 'ja';
    credit.textContent = '監督作品';
    $('.detail-credit').replaceChildren('Written and directed by Leon Vasari. ', credit);
  }
  $('.watch-action').hidden = book;
  $('.book-action').hidden = !book;
  $('.book-source').hidden = !book;
  wrapText($('.detail-title-group'), film.displayTitle || film.title, 'h2');
  wrapText($('.detail-synopsis'), film.synopsis);
  const [id, x, y, w, h] = film.cover;
  const source = sheets[id];
  const image = $('.poster-image');
    const posterWidth = film.coverRatio ? 900 * film.coverRatio : 474;
  $('.poster-svg').setAttribute('viewBox', `0 0 ${posterWidth} 900`);
  $('.poster-svg').style.aspectRatio = `${posterWidth} / 900`;
  $('#poster-crop rect').setAttribute('width', String(posterWidth));
  image.setAttribute('href', source.url);
  image.setAttribute('x', String(-x * posterWidth / w));
  image.setAttribute('y', String(-y * 900 / h));
  image.setAttribute('width', String(source.width * posterWidth / w));
  image.setAttribute('height', String(source.height * 900 / h));
  detailLines = [...detail.querySelectorAll('.detail-line')].filter((line) => !line.closest('[hidden]'));
  $('.watch-note').hidden = true;
}

function coverRect() {
  const tape = tapes.reduce((nearest, current) => Math.abs(relative(current.v, s)) < Math.abs(relative(nearest.v, s)) ? current : nearest);
  return tape.cover.getBoundingClientRect();
}

function rectClip(rect) {
  return `inset(${Math.max(0, rect.top)}px ${Math.max(0, W - rect.right)}px ${Math.max(0, V - rect.bottom)}px ${Math.max(0, rect.left)}px round 3px)`;
}

function openDetail() {
  if (!ready || isOpen || Math.abs(T - s) > .3) return;
  isOpen = true;
  closing = false;
  const token = ++openToken;
  T = Math.round(s);
  returnFocus = document.activeElement;
  clearTimeout(wheelTimer);
  populateDetail(films[active]);
  inkCircles.forEach((circle) => circle.setAttribute('r', '0'));
  const rect = coverRect();
  detail.scrollTop = 0;
  detail.style.visibility = 'visible';
  detail.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
  detail.setAttribute('aria-hidden', 'false');
  root.inert = true;
  $('.close-detail').focus({ preventScroll: true });
  detail.dataset.phase = 'opening';
  sheetAnimation = detail.animate([
    { clipPath: rectClip(rect), transform: 'rotate(-4.5deg)' },
    { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' },
  ], { duration: reduced ? 1 : 1050, easing: paperEase, fill: 'both' });
  sheetAnimation.finished.then(() => {
    if (token !== openToken) return;
    detail.dataset.phase = 'open';
    sheetAnimation.cancel();
    sheetAnimation = null;
  }).catch(() => {});
  detailLines.forEach((line, index) => {
    line.style.transform = 'translateY(0)';
    const animation = line.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], { duration: reduced ? 1 : 900, delay: reduced ? 0 : 620 + index * 75, easing: ease, fill: 'both' });
    animation.finished.then(() => animation.cancel()).catch(() => {});
  });
  inkStart = performance.now() - (reduced ? 5000 : 0);
}

function closeDetail() {
  if (!isOpen || closing) return;
  closing = true;
  ++openToken;
  detail.dataset.phase = 'closing';
  const from = { clipPath: getComputedStyle(detail).clipPath, transform: getComputedStyle(detail).transform };
  const rect = coverRect();
  if (sheetAnimation) sheetAnimation.cancel();
  sheetAnimation = detail.animate([from, { clipPath: rectClip(rect), transform: 'rotate(-4.5deg)' }], { duration: reduced ? 1 : 850, easing: paperEase, fill: 'both' });
  sheetAnimation.finished.then(() => {
    detail.style.visibility = 'hidden';
    detail.setAttribute('aria-hidden', 'true');
    detail.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    detailLines.forEach((line) => { line.style.transform = ''; });
    detail.dataset.phase = 'closed';
    sheetAnimation = null;
    isOpen = false;
    closing = false;
    inkStart = null;
    root.inert = false;
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
    else play.focus({ preventScroll: true });
  }).catch(() => {});
}

function render(time) {
  const dt = Math.min((time - lastTime) / 1000 || 1 / 60, .05);
  lastTime = time;
  if (ready) {
    if (!isOpen) {
      s += (T - s) * (reduced ? 1 : 1 - Math.exp(-(drag?.moved ? 18 : 5.2) * dt));
      if (Math.abs(T - s) < 1e-4) s = T;
      if (Math.abs(s) > 48) { const shift = Math.floor(s / 12) * 12; s -= shift; T -= shift; if (drag) drag.startTarget -= shift; }
      const index = modulo(Math.round(s), 12);
      if (index !== active) swapCaption(index, Math.sign(T - s) || 1);
    }
    const from = Math.floor(s);
    const mix = smoothstep(s - from);
    const fromRatio = films[modulo(from, films.length)].coverRatio || 474 / 900;
    const toRatio = films[modulo(from + 1, films.length)].coverRatio || 474 / 900;
    d = H * (fromRatio + (toRatio - fromRatio) * mix);
    const playLeft = `${W / 2 - d * .5 - 6}px`;
    if (play.style.left !== playLeft) play.style.left = playLeft;
    onCover = !isOpen && !drag?.moved && pointerSeen && Math.abs(T - s) < .3 && Math.abs(mx - W / 2) < .55 * d && Math.abs(my - V / 2) < .55 * H;
    const targetY = onCover ? (mx - W / 2) / (.55 * d) * 9 : (mx - W / 2) / W * 5;
    const targetX = onCover ? -(my - V / 2) / (H / 2) * 6 : 0;
    const tiltEase = reduced ? 1 : 1 - Math.exp(-7 * dt);
    tiltY += ((isOpen || reduced ? 0 : targetY) - tiltY) * tiltEase;
    tiltX += ((isOpen || reduced ? 0 : targetX) - tiltX) * tiltEase;
    if (Math.abs(tiltY - (isOpen || reduced ? 0 : targetY)) < .001) tiltY = isOpen || reduced ? 0 : targetY;
    if (Math.abs(tiltX - (isOpen || reduced ? 0 : targetX)) < .001) tiltX = isOpen || reduced ? 0 : targetX;
    tapes.forEach((tape) => {
      const r = relative(tape.v, s);
      const x = shelfX(r, ws, d, gap);
      const visible = Math.abs(x) <= W / 2 + 1.5 * d;
      const accessible = visible && r >= -6 && r < 6;
      if (tape.visible !== visible) { tape.element.style.visibility = visible ? 'visible' : 'hidden'; tape.visible = visible; }
      if (tape.accessible !== accessible) { tape.element.tabIndex = accessible ? 0 : -1; tape.element.setAttribute('aria-hidden', String(!accessible)); tape.accessible = accessible; }
      if (!visible) return;
      const o = smoothstep(Math.max(0, 1 - Math.abs(r)));
      const liftTarget = !isOpen && tape.v === hover && Math.abs(r) > .5 ? 1 : 0;
      tape.lift += (liftTarget - tape.lift) * (reduced ? 1 : 1 - Math.exp(-12 * dt));
      if (Math.abs(tape.lift - liftTarget) < .001) tape.lift = liftTarget;
      const transform = `translate3d(${x.toFixed(3)}px,${(-o * .025 * H - tape.lift * .045 * H).toFixed(3)}px,${(o * .2 * H).toFixed(3)}px) rotateZ(${(-4.5 * o).toFixed(3)}deg) rotateX(${(tiltX * o).toFixed(3)}deg) rotateY(${(-90 * o + tiltY * o).toFixed(3)}deg)`;
      if (tape.transform !== transform) { tape.element.style.transform = transform; tape.transform = transform; }
      const zIndex = String(Math.round(100 - Math.abs(r) * 2 + o * 30));
      if (tape.zIndex !== zIndex) { tape.element.style.zIndex = zIndex; tape.zIndex = zIndex; }
      const shade = (o * .55).toFixed(4);
      if (tape.shade !== shade) {
        tape.spine.style.setProperty('--shade', shade);
        tape.cover.style.setProperty('--shade', ((1 - o) * .5).toFixed(4));
        tape.shade = shade;
      }
      const selected = String(Math.abs(r) < .5);
      if (tape.element.dataset.active !== selected) tape.element.dataset.active = selected;
    });
    const playScale = isOpen ? 0 : smoothstep(Math.max(0, 1 - Math.abs(T - s) * 3));
    const playTransform = `scale(${playScale.toFixed(4)})`;
    if (previousPlayTransform !== playTransform) { play.style.transform = playTransform; previousPlayTransform = playTransform; }
    const playEvents = playScale > .9 && !isOpen ? 'auto' : 'none';
    if (play.style.pointerEvents !== playEvents) play.style.pointerEvents = playEvents;
    const playTabIndex = playEvents === 'auto' ? 0 : -1;
    if (play.tabIndex !== playTabIndex) play.tabIndex = playTabIndex;
    if (inkStart !== null && isOpen && !closing) {
      inkCircles.forEach((circle, i) => {
        const p = Math.max(0, Math.min(1, (time - inkStart - 520 - inkDelays[i]) / 1250));
        circle.setAttribute('r', String(720 * (1 - (1 - p) ** 3)));
      });
      if (time - inkStart > 2400) inkStart = null;
    }
  }
  if (pointerSeen && fineQuery.matches && !reduced) {
    const cursorEase = 1 - Math.exp(-16 * dt);
    cx += (mx - cx) * cursorEase;
    cy += (my - cy) * cursorEase;
    const cursorTransform = `translate3d(${cx.toFixed(3)}px,${cy.toFixed(3)}px,0)`;
    if (previousCursorTransform !== cursorTransform) { cursor.style.transform = cursorTransform; previousCursorTransform = cursorTransform; }
    const cursorState = onCover ? 'open' : hoveredButton ? 'btn' : !isOpen && hover >= 0 ? 'spine' : 'default';
    if (cursor.dataset.state !== cursorState) cursor.dataset.state = cursorState;
  }
  frameId = requestAnimationFrame(render);
}

function step(direction) {
  if (!ready || isOpen) return;
  T = Math.round(T) + direction;
  if (document.activeElement?.classList.contains('tape')) play.focus({ preventScroll: true });
}
$('.arrow-prev').addEventListener('click', () => step(-1));
$('.arrow-next').addEventListener('click', () => step(1));
play.addEventListener('click', openDetail);
$('.close-detail').addEventListener('click', closeDetail);
$('.watch-film').addEventListener('click', () => { $('.watch-note').hidden = false; });
tabs.forEach((tab) => tab.addEventListener('click', () => {
  const index = tab.dataset.decade === 'all' ? 0 : films.findIndex((film) => tab.dataset.decade === 'books' ? film.type === 'book' : film.type !== 'book' && Math.floor(film.year / 10) * 10 === Number(tab.dataset.decade));
  if (index >= 0) goToFilm(index);
}));

document.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  mx = event.clientX;
  my = event.clientY;
  hoveredButton = Boolean(event.target.closest('button:not(.tape),a'));
  if (!pointerSeen) { cx = mx; cy = my; }
  pointerSeen = true;
  cursor.style.visibility = 'visible';
  if (fineQuery.matches && !reduced) document.documentElement.classList.add('cursor-ready');
});
document.addEventListener('pointerout', (event) => {
  if (event.relatedTarget === null) { pointerSeen = false; cursor.style.visibility = 'hidden'; document.documentElement.classList.remove('cursor-ready'); }
});
shelf.addEventListener('pointerdown', (event) => {
  if (!ready || isOpen || !event.isPrimary || event.button !== 0) return;
  clearTimeout(wheelTimer);
  suppressClick = false;
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startTarget: T, moved: false };
});
shelf.addEventListener('pointermove', (event) => {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.startX;
  const dy = event.clientY - drag.startY;
  if (!drag.moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = null; return; }
  if (!drag.moved && Math.abs(dx) > 5) { drag.moved = true; shelf.setPointerCapture(event.pointerId); }
  if (drag.moved) { T = drag.startTarget - dx / (ws + gap); event.preventDefault(); }
});
function endDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  suppressClick = drag.moved;
  T = Math.round(T);
  if (shelf.hasPointerCapture(event.pointerId)) shelf.releasePointerCapture(event.pointerId);
  drag = null;
}
shelf.addEventListener('pointerup', endDrag);
shelf.addEventListener('pointercancel', endDrag);
shelf.addEventListener('lostpointercapture', () => { if (drag) { suppressClick = drag.moved; drag = null; T = Math.round(T); } });
window.addEventListener('pointerup', endDrag);
window.addEventListener('blur', () => { drag = null; T = Math.round(T); pointerSeen = false; cursor.style.visibility = 'hidden'; document.documentElement.classList.remove('cursor-ready'); });
window.addEventListener('wheel', (event) => {
  if (!ready || isOpen || event.ctrlKey || drag) return;
  event.preventDefault();
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? V : 1;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  T += delta * multiplier / (ws + gap) * .5;
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { T = Math.round(T); }, 160);
}, { passive: false });
window.addEventListener('keydown', (event) => {
  if (!ready) return;
  if (event.key === 'Escape' && isOpen) { event.preventDefault(); closeDetail(); return; }
  if (isOpen) {
    if (event.key === 'Tab') {
      const focusable = [...detail.querySelectorAll('button,a[href]')].filter((element) => !element.closest('[hidden]'));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === detail)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1); }
  if (event.key === 'Enter' && document.activeElement === document.body) { event.preventDefault(); openDetail(); }
});
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(updateDimensions, 80); });
reduceQuery.addEventListener('change', () => { reduced = reduceQuery.matches; if (reduced) { document.documentElement.classList.remove('cursor-ready'); inkCircles.forEach((circle) => circle.setAttribute('r', '720')); inkStart = null; } });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelAnimationFrame(frameId);
  else { lastTime = performance.now(); frameId = requestAnimationFrame(render); }
});

async function preload() {
  const panel = $('.loading-paper');
  const label = $('.loading-label');
  const progress = $('.loading-rule > span');
  const retry = $('.retry-assets');
  let count = 0;
  retry.hidden = true;
  label.textContent = 'LOADING THE ARCHIVE';
  progress.style.transform = 'scaleX(0)';
  const loading = Object.values(sheets).map((source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        await image.decode();
        if (image.naturalWidth !== source.width || image.naturalHeight !== source.height) throw new Error('Unexpected sheet dimensions');
        progress.style.transform = `scaleX(${++count / Object.keys(sheets).length})`;
        resolve(image);
      } catch (error) { reject(error); }
    };
    image.onerror = () => reject(new Error('Asset could not be loaded'));
    image.src = source.url;
  }));
  try {
    await Promise.all([...loading, document.fonts.ready]);
    updateDimensions();
    ready = true;
    document.body.dataset.ready = 'true';
    const animation = panel.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: reduced ? 1 : 650, easing: ease, fill: 'both' });
    animation.finished.then(() => { panel.hidden = true; animation.cancel(); }).catch(() => {});
  } catch {
    label.textContent = 'ARCHIVE COULD NOT LOAD';
    retry.hidden = false;
  }
}
$('.retry-assets').addEventListener('click', preload);
swapCaption(active, 1);
updateDimensions();
frameId = requestAnimationFrame(render);
preload();
