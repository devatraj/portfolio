// Small page-wide interactions: scroll progress, count-up numbers, hover tilt,
// the scroll-drawn timeline and the live request counter. All respect reduced motion.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll progress bar under the header.
const bar = document.querySelector('[data-progress]');
const timeline = document.querySelector('[data-timeline]');
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  if (timeline) {
    const r = timeline.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
    timeline.style.setProperty('--fill', p);
    timeline.querySelectorAll('li').forEach((li) => {
      li.classList.toggle('passed', li.getBoundingClientRect().top < innerHeight * 0.7);
    });
  }
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Count-up: "~$45K", "5,000+", "99.9%" animate from zero when they scroll into view.
const counters = document.querySelectorAll('[data-count]');
if (!reduce && counters.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      io.unobserve(target);
      const m = target.textContent.match(/^([^\d]*)([\d,]*\.?\d+)(.*)$/);
      if (!m) return;
      const [, pre, raw, post] = m;
      const end = parseFloat(raw.replace(/,/g, ''));
      const dec = (raw.split('.')[1] || '').length;
      const comma = raw.includes(',');
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / 1100);
        const v = end * (1 - (1 - p) ** 3);
        let s = v.toFixed(dec);
        if (comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: dec });
        target.textContent = pre + s + post;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => io.observe(c));
}

// Hover tilt on product mockups (pointer devices only).
if (!reduce && matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}

// Live counter: requests the config platform serves at its 10M+/day average, since this page opened.
document.querySelectorAll('[data-live-rate]').forEach((el) => {
  const perSec = +el.dataset.liveRate;
  const t0 = performance.now();
  const paint = () => {
    el.textContent = Math.floor(((performance.now() - t0) / 1000) * perSec).toLocaleString('en-US');
  };
  paint();
  setInterval(paint, reduce ? 1000 : 80);
});

// Mobile menu.
const menuBtn = document.querySelector('[data-menu]');
const sheet = document.querySelector('[data-sheet]');
menuBtn?.addEventListener('click', () => {
  const open = sheet.hidden;
  sheet.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.textContent = open ? 'Close' : 'Menu';
});
// Close the sheet when a link inside it is followed (same-page anchors don't reload).
sheet?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
  sheet.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.textContent = 'Menu';
}));

// Passport: one stamp per capability page visited. Kept in this browser only.
const STORE = 'passport-v1';
const stamps = [...document.querySelectorAll('[data-stamp]')];
let visited = [];
try { visited = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch {}
const current = document.body.dataset.cap;
const isNew = current && !visited.includes(current);
if (isNew) {
  visited.push(current);
  try { localStorage.setItem(STORE, JSON.stringify(visited)); } catch {}
}
stamps.forEach((s) => {
  s.classList.toggle('lit', visited.includes(s.dataset.stamp));
  if (isNew && s.dataset.stamp === current) {
    s.classList.add('new');
    setTimeout(() => s.classList.remove('new'), 700);
  }
});
const countEl = document.querySelector('[data-passport-count]');
if (countEl) countEl.textContent = `${visited.length} of ${stamps.length}`;
document.querySelectorAll('[data-visited]').forEach((el) => {
  el.classList.toggle('visited', visited.includes(el.dataset.visited));
});

const toast = document.querySelector('[data-toast]');
if (isNew && visited.length === stamps.length && stamps.length) {
  setTimeout(() => (toast.hidden = false), 900);
}
document.querySelector('[data-toast-close]')?.addEventListener('click', () => (toast.hidden = true));

// Spotlight that follows the pointer across cards.
document.querySelectorAll('[data-spot]').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});
