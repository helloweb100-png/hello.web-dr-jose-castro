/* ==========================================================================
   Dr. José Castro Jacobo | app.js
   Dependencias (CDN): GSAP 3.12 + ScrollTrigger, Lenis 1.1
   Si alguna librería no carga, el sitio sigue siendo 100% legible y funcional.
   Reglas: sin listeners de scroll crudos (todo vía ScrollTrigger / Lenis /
   IntersectionObserver), todo el movimiento respeta prefers-reduced-motion.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Configuración editable ---------- */
  const CONFIG = {
    phone: '528114704461',          // WhatsApp del consultorio (formato internacional sin +)
    tz: 'America/Monterrey',
    promoEndsAt: '2026-10-31T23:59:59-06:00', // fin de la promoción de octubre
    loaderMin: 1900,                // duración mínima del loader (ms)
    schedule: {                     // 0 = domingo ... 6 = sábado, rangos [inicio, fin) en horas
      0: [],
      1: [[10, 13], [16, 20]],
      2: [[10, 13], [16, 20]],
      3: [[10, 13], [16, 20]],
      4: [[10, 13], [16, 20]],
      5: [[10, 13], [16, 20]],
      6: [[10, 14]],
    },
  };

  /* ---------- Utilidades ---------- */
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const safe = (name, fn) => { try { return fn(); } catch (e) { console.warn('[init:' + name + ']', e); } };
  const reduce = root.classList.contains('rm');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGSAP && !reduce;
  let lenis = null;

  /* ==========================================================================
     1. Funciones base (no dependen de GSAP)
     ========================================================================== */

  /* Enlaces de WhatsApp con mensaje prellenado según el contexto del botón */
  function initWhatsApp() {
    $$('[data-wa]').forEach((a) => {
      a.href = 'https://wa.me/' + CONFIG.phone + '?text=' + encodeURIComponent(a.dataset.wa);
    });
  }

  /* Estado "Abierto ahora" según el horario real en la zona de Monterrey */
  function initSchedule() {
    const status = $('#open-status');
    const hours = $('#hours');
    if (!status) return;
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const keys = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const fmt = (h) => {
      const hh = h % 12 === 0 ? 12 : h % 12;
      return hh + ':00 ' + (h >= 12 ? 'pm' : 'am');
    };
    const now = () => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: CONFIG.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t).value;
      return { day: keys[get('weekday')], min: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10) };
    };
    const render = () => {
      const { day, min } = now();
      const ranges = CONFIG.schedule[day];
      let text = '';
      let open = false;
      const current = ranges.find(([a, b]) => min >= a * 60 && min < b * 60);
      if (current) {
        open = true;
        text = 'Abierto ahora, cierra a las ' + fmt(current[1]);
      } else {
        const later = ranges.find(([a]) => min < a * 60);
        if (later) {
          text = 'Cerrado ahora, abre hoy a las ' + fmt(later[0]);
        } else {
          let d = day;
          for (let i = 1; i <= 7; i++) {
            d = (day + i) % 7;
            if (CONFIG.schedule[d].length) {
              text = 'Cerrado ahora, abre ' + (i === 1 ? 'mañana' : 'el ' + days[d]) + ' a las ' + fmt(CONFIG.schedule[d][0][0]);
              break;
            }
          }
        }
      }
      status.classList.toggle('is-open', open);
      $('span', status).textContent = text;
      if (hours) {
        $$('[data-days]', hours).forEach((row) => {
          row.classList.toggle('is-today', row.dataset.days.split(',').map(Number).includes(day));
        });
      }
    };
    render();
    setInterval(render, 60000);
  }

  /* Promoción de octubre: si ya venció, se retira la etiqueta y se pide confirmar precio */
  function initPromo() {
    if (Date.now() <= Date.parse(CONFIG.promoEndsAt)) return;
    const badge = $('#promo-badge');
    const note = $('#promo-note');
    if (badge) badge.hidden = true;
    if (note) note.textContent = 'Consulta el precio vigente por WhatsApp.';
  }

  /* Menú móvil */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;
    let open = false;
    const set = (v) => {
      open = v;
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', v);
      menu.setAttribute('aria-hidden', String(!v));
      root.classList.toggle('menu-open', v);
      if (v) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
      if (lenis) { v ? lenis.stop() : lenis.start(); } else { root.style.overflow = v ? 'hidden' : ''; }
      if (v) { const first = $('a', menu); if (first) setTimeout(() => first.focus({ preventScroll: true }), 500); }
    };
    burger.addEventListener('click', () => set(!open));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { set(false); burger.focus(); } });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches && open) set(false); });
  }

  /* Precarga anticipada de imágenes diferidas (evita huecos en carruseles y secciones fijadas) */
  function initLazyAhead() {
    const imgs = $$('img[loading="lazy"]');
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.loading = 'eager';
        io.unobserve(en.target);
      });
    }, { rootMargin: '2200px 1800px' });
    imgs.forEach((im) => io.observe(im));
  }

  /* Cinta de especialidades: duplica la lista para un bucle continuo */
  function initTicker() {
    const track = $('#ticker');
    if (!track || reduce) return;
    const list = $('.ticker__list', track);
    const clone = list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  /* Pestañas de etapas con indicador deslizante */
  function initStages() {
    const tabs = $$('.stab');
    const list = $('#stage-tabs');
    if (!tabs.length || !list) return;
    const panels = $$('.spanel');
    const imgs = $$('.stages__media img');
    const glider = document.createElement('span');
    glider.className = 'stab__glider';
    glider.setAttribute('aria-hidden', 'true');
    list.prepend(glider);
    list.classList.add('has-glider');
    let current = 0;

    const place = () => {
      const t = tabs[current];
      glider.style.width = t.offsetWidth + 'px';
      glider.style.transform = 'translateX(' + t.offsetLeft + 'px)';
    };
    const select = (i, focus) => {
      current = i;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p, k) => { p.hidden = k !== i; p.classList.toggle('is-on', k === i); });
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
      place();
      if (focus) tabs[i].focus();
      const t = tabs[i];
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, false));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + n) % n, true); }
        if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        if (e.key === 'End') { e.preventDefault(); select(n - 1, true); }
      });
    });
    select(0, false);
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }

  /* Galería de acordeón con reproducción automática */
  function initGallery() {
    const wrap = $('#acc');
    if (!wrap) return;
    const items = $$('.acc__item', wrap);
    let cur = 0;
    let touched = false;
    let visible = false;
    const activate = (i) => { cur = i; items.forEach((it, k) => it.classList.toggle('is-on', k === i)); };
    items.forEach((it, i) => {
      it.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { touched = true; activate(i); } });
      it.addEventListener('click', () => { touched = true; activate(i); });
      it.addEventListener('focus', () => { touched = true; activate(i); });
    });
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0.35 }).observe(wrap);
    if (!reduce) setInterval(() => { if (visible && !touched) activate((cur + 1) % items.length); }, 4200);
  }

  /* Preguntas frecuentes (acordeón accesible) */
  function initFaq() {
    const items = $$('.acd__item');
    items.forEach((item) => {
      const btn = $('.acd__q', item);
      btn.addEventListener('click', () => {
        const open = item.classList.contains('is-open');
        items.forEach((o) => {
          o.classList.remove('is-open');
          $('.acd__q', o).setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
    if (items[0]) { items[0].classList.add('is-open'); $('.acd__q', items[0]).setAttribute('aria-expanded', 'true'); }
  }

  /* Mapa: se activa con un toque para no secuestrar el scroll */
  function initMap() {
    const map = $('.map');
    if (!map) return;
    map.addEventListener('click', () => map.classList.add('is-live'));
    map.addEventListener('mouseleave', () => map.classList.remove('is-live'));
    map.addEventListener('focusout', () => map.classList.remove('is-live'));
  }

  /* Formulario: valida y abre WhatsApp con el mensaje armado */
  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const name = $('#f-name');
    const motivo = $('#f-motivo');
    const date = $('#f-fecha');
    const submit = $('#form-submit');
    const done = $('#form-done');
    const retry = $('#form-retry');
    const edit = $('#form-edit');

    const today = new Date();
    date.min = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    const setError = (input, msg) => {
      const field = input.closest('.field');
      const err = $('.field__err', field);
      field.classList.toggle('has-error', !!msg);
      err.textContent = msg || '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    const validate = () => {
      let first = null;
      const n = name.value.trim();
      if (n.length < 2) { setError(name, 'Escribe tu nombre para saber cómo llamarte.'); first = first || name; } else setError(name, '');
      if (!motivo.value) { setError(motivo, 'Elige el motivo de tu cita.'); first = first || motivo; } else setError(motivo, '');
      return first;
    };
    name.addEventListener('input', () => { if (name.value.trim().length >= 2) setError(name, ''); });
    motivo.addEventListener('change', () => { if (motivo.value) setError(motivo, ''); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const bad = validate();
      if (bad) { bad.focus(); return; }
      const turno = form.elements.turno.value;
      let text = 'Hola Dr. Castro, soy ' + name.value.trim() + '. Quiero agendar: ' + motivo.value + '.';
      if (turno && turno !== 'Cualquiera') text += '\nTurno preferido: ' + turno + '.';
      if (date.value) {
        const d = new Date(date.value + 'T12:00:00');
        text += '\nFecha tentativa: ' + d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) + '.';
      }
      const msg = $('#f-msg').value.trim();
      if (msg) text += '\n' + msg;
      const url = 'https://wa.me/' + CONFIG.phone + '?text=' + encodeURIComponent(text);
      submit.classList.add('is-loading');
      submit.disabled = true;
      window.open(url, '_blank', 'noopener');
      setTimeout(() => {
        submit.classList.remove('is-loading');
        submit.disabled = false;
        retry.href = url;
        done.hidden = false;
        done.focus();
      }, 700);
    });
    if (edit) edit.addEventListener('click', () => { done.hidden = true; name.focus(); });
  }

  /* WhatsApp flotante y aviso */
  function initFab() {
    const fab = $('#fab');
    const tip = $('#fab-tip');
    const close = $('#fab-tip-x');
    if (!fab || !tip) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('fab-tip') === '1'; } catch (e) { /* sin storage */ }
    const hide = () => {
      tip.classList.remove('is-on');
      try { sessionStorage.setItem('fab-tip', '1'); } catch (e) { /* sin storage */ }
    };
    close.addEventListener('click', hide);
    fab.addEventListener('click', hide);
    if (!dismissed) {
      setTimeout(() => tip.classList.add('is-on'), 6500);
      setTimeout(() => tip.classList.remove('is-on'), 17000);
    }
  }

  /* Efecto de relleno direccional en botones: guarda la posición del puntero */
  function initButtonFill() {
    document.addEventListener('pointerover', (e) => {
      const b = e.target.closest && e.target.closest('.btn');
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    document.addEventListener('pointerout', (e) => {
      const b = e.target.closest && e.target.closest('.btn');
      if (!b || b.contains(e.relatedTarget)) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      b.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ==========================================================================
     2. Texto: separar en palabras
     ========================================================================== */
  function splitWords(el) {
    if (el.dataset.splitDone) return $$('.wi', el);
    el.dataset.splitDone = '1';
    const walk = (node) => {
      const frag = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
        } else {
          if (child.nodeType === 1) walk(child);
          frag.appendChild(child);
        }
      });
      node.replaceChildren(frag);
    };
    walk(el);
    return $$('.wi', el);
  }

  /* Palabras individuales para el texto que se ilumina con el scroll */
  function wrapMotionWords(el) {
    const nodes = [];
    const walk = (node) => {
      const frag = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'mw';
            s.textContent = part;
            nodes.push(s);
            frag.appendChild(s);
          });
        } else {
          if (child.classList && child.classList.contains('pill-img')) nodes.push(child);
          frag.appendChild(child);
        }
      });
      node.replaceChildren(frag);
    };
    walk(el);
    return nodes;
  }

  /* ==========================================================================
     3. Loader
     ========================================================================== */
  function runLoader(extra) {
    const loader = $('#loader');
    const finish = () => { if (loader) loader.classList.add('is-done'); root.classList.remove('is-loading'); };
    if (!loader) { finish(); return Promise.resolve(); }

    const pctEl = $('#loader-pct');
    const arc = $('.loader__arc');
    const heroImg = $('.orb__img');
    const ready = new Promise((resolve) => {
      const pageLoaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
      const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, wait(2500)]) : Promise.resolve();
      const hero = heroImg && heroImg.decode ? heroImg.decode().catch(() => {}) : Promise.resolve();
      Promise.all([pageLoaded, fonts, hero, extra]).then(resolve);
      setTimeout(resolve, 7000);
    });

    if (!motion) {
      return ready.then(() => { if (pctEl) pctEl.textContent = '100'; finish(); });
    }

    return new Promise((resolve) => {
      const state = { p: 0 };
      const render = () => {
        pctEl.textContent = Math.round(state.p);
        arc.style.strokeDashoffset = String(100 - state.p);
      };
      const crawl = gsap.to(state, { p: 88, duration: 2.6, ease: 'power2.out', onUpdate: render });
      const t0 = performance.now();

      const exit = () => {
        gsap.timeline({ onComplete: finish })
          .to('.loader__core', { opacity: 0, scale: 0.92, duration: 0.5, ease: 'power2.in' })
          .to('.loader__panel--top', { yPercent: -101, duration: 1.1, ease: 'expo.inOut' }, 0.3)
          .to('.loader__panel--bottom', { yPercent: 101, duration: 1.1, ease: 'expo.inOut' }, 0.3)
          .call(resolve, null, 0.62);
      };
      ready.then(() => {
        const remaining = Math.max(0, CONFIG.loaderMin - (performance.now() - t0));
        gsap.delayedCall(remaining / 1000, () => {
          crawl.kill();
          gsap.to(state, { p: 100, duration: 0.55, ease: 'power2.inOut', onUpdate: render, onComplete: () => gsap.delayedCall(0.18, exit) });
        });
      });
    });
  }

  /* ==========================================================================
     4. Hero: canvas de latido y partículas
     ========================================================================== */
  function heroFX(onBeat) {
    const canvas = $('#fx');
    const orb = $('.orb');
    const hero = $('.hero');
    if (!canvas || !orb || !hero || !canvas.getContext) return { start() {}, stop() {} };
    const ctx = canvas.getContext('2d');
    const TAU = Math.PI * 2;
    let W = 0; let H = 0; let dpr = 1; let cx = 0; let cy = 0; let R = 100;
    let particles = [];
    const rings = [];
    let raf = 0; let running = false; let visible = true; let armed = false;
    let nextBeat = 0;
    const mouse = { x: -9999, y: -9999 };

    const sprite = (rgb) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(' + rgb + ',0.95)');
      grd.addColorStop(0.35, 'rgba(' + rgb + ',0.35)');
      grd.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return c;
    };
    const sprites = [sprite('108,132,196'), sprite('232,118,90')];

    const centerOf = (el) => {
      let x = el.offsetWidth / 2; let y = el.offsetHeight / 2;
      let n = el;
      while (n && n !== hero) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x, y };
    };

    const seed = () => {
      const count = W < 700 ? 40 : Math.min(104, Math.round(W / 15));
      particles = Array.from({ length: count }, () => ({
        r: R * (1.08 + Math.random() * 1.9),
        a: Math.random() * TAU,
        sp: (0.02 + Math.random() * 0.06) * (Math.random() < 0.5 ? -1 : 1),
        sz: 6 + Math.random() * 16,
        ph: Math.random() * TAU,
        tint: Math.random() < 0.13 ? 1 : 0,
        sq: 0.5 + Math.random() * 0.3,
        tilt: (Math.random() - 0.5) * 1.2,
        ox: 0, oy: 0,
      }));
    };

    const resize = () => {
      const r = hero.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = centerOf(orb);
      cx = c.x; cy = c.y; R = orb.offsetWidth / 2;
      seed();
      if (!running) frame(performance.now(), true);
    };

    const beat = (now) => {
      rings.push({ t0: now, life: 3000, a: 0.34 });
      rings.push({ t0: now + 330, life: 3000, a: 0.22 });
      if (onBeat) { onBeat(1); setTimeout(() => onBeat(0.6), 330); }
    };

    const frame = (now, still) => {
      ctx.clearRect(0, 0, W, H);
      const t = now / 1000;

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const p = (now - ring.t0) / ring.life;
        if (p < 0) continue;
        if (p >= 1) { rings.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - p, 3);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.02 + e * R * 3.2, 0, TAU);
        ctx.strokeStyle = 'rgba(77,102,173,' + (Math.pow(1 - p, 1.7) * ring.a).toFixed(3) + ')';
        ctx.lineWidth = 0.6 + (1 - p) * 2;
        ctx.stroke();
      }

      const pts = [];
      for (const p of particles) {
        const ang = p.a + (still ? 0 : t * p.sp);
        let x = Math.cos(ang) * p.r;
        let y = Math.sin(ang) * p.r * p.sq;
        const cs = Math.cos(p.tilt); const sn = Math.sin(p.tilt);
        const px = cx + x * cs - y * sn;
        const py = cy + x * sn + y * cs;
        let tx = 0; let ty = 0;
        const dx = px - mouse.x; const dy = py - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16900 && d2 > 1) { const d = Math.sqrt(d2); const f = (1 - d / 130) * 34; tx = (dx / d) * f; ty = (dy / d) * f; }
        p.ox += (tx - p.ox) * 0.08; p.oy += (ty - p.oy) * 0.08;
        x = px + p.ox; y = py + p.oy;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.4 + p.ph);
        ctx.globalAlpha = 0.28 + tw * 0.55;
        ctx.drawImage(sprites[p.tint], x - p.sz / 2, y - p.sz / 2, p.sz, p.sz);
        pts.push(x, y);
      }
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i += 2) {
        for (let j = i + 2; j < pts.length; j += 2) {
          const dx = pts[i] - pts[j]; const dy = pts[i + 1] - pts[j + 1];
          const d2 = dx * dx + dy * dy;
          if (d2 < 8100) {
            ctx.strokeStyle = 'rgba(108,132,196,' + ((1 - d2 / 8100) * 0.2).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(pts[i], pts[i + 1]); ctx.lineTo(pts[j], pts[j + 1]); ctx.stroke();
          }
        }
      }
    };

    const loop = (now) => {
      if (!running) return;
      if (now >= nextBeat) { beat(now); nextBeat = now + 3100; }
      frame(now, false);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduce) return;
      running = true;
      nextBeat = performance.now() + 400;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const sync = () => { if (armed && visible && !document.hidden) start(); else stop(); };

    new ResizeObserver(() => resize()).observe(hero);
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync(); }, { threshold: 0 }).observe(hero);
    document.addEventListener('visibilitychange', sync);
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      });
      hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    }
    resize();
    return { start() { armed = true; sync(); }, stop };
  }

  /* ==========================================================================
     5. Movimiento con GSAP (smooth scroll, pines, reveals)
     ========================================================================== */
  function initSmoothScroll() {
    if (!window.Lenis) return;
    lenis = new window.Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });
    lenis.stop(); /* se reactiva cuando termina el loader */
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    root.classList.add('lenis', 'lenis-smooth');

    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  }

  /* Estado inicial del hero: se fija mientras el loader aún cubre la pantalla */
  function heroPrep() {
    gsap.set($$('[data-hero="line"]'), { y: 0, yPercent: 112 });
    gsap.set($$('[data-hero="eyebrow"], [data-hero="lead"], [data-hero="cta"]'), { y: 26, opacity: 0 });
    gsap.set('.orb__inner', { clipPath: 'circle(0% at 50% 50%)' });
    gsap.set('.orbit__ticks', { opacity: 0, scale: 0.7 });
    gsap.set('.orbit__crescent', { opacity: 0, scale: 0.78 });
    gsap.set('.orbit__spin', { opacity: 0 });
  }

  function heroIntro() {
    const lines = $$('[data-hero="line"]');
    const small = $$('[data-hero="eyebrow"], [data-hero="lead"], [data-hero="cta"]');
    const em = $('.hero__title em');

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.orb__inner', { clipPath: 'circle(72% at 50% 50%)', duration: 1.7, onComplete: () => gsap.set('.orb__inner', { clearProps: 'clipPath' }) }, 0)
      .to('.orbit__ticks', { opacity: 1, scale: 1, duration: 1.8 }, 0.1)
      .to('.orbit__crescent', { opacity: 1, scale: 1, duration: 1.8 }, 0.2)
      .to('.orbit__spin', { opacity: 1, duration: 1.2, stagger: 0.15 }, 0.8)
      .to(lines, { yPercent: 0, duration: 1.3, stagger: 0.12 }, 0.15)
      .to(small, { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.5)
      .call(() => em && em.classList.add('is-lit'), null, 1.0);
    return tl;
  }

  function heroMotion(beatTarget) {
    const hero = $('.hero');
    /* Pulso del orbe sincronizado con el latido del canvas */
    const pulse = (k) => {
      if (!beatTarget) return;
      beatTarget.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(' + (1 + 0.016 * k) + ')' }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    };
    /* Parallax con el puntero */
    if (finePointer) {
      const orbit = $('.orbit');
      const orb = $('.orb');
      const copy = $('.hero__copy');
      const rx = gsap.quickTo(orbit, 'rotationY', { duration: 1.2, ease: 'power3.out' });
      const ry = gsap.quickTo(orbit, 'rotationX', { duration: 1.2, ease: 'power3.out' });
      const ox = gsap.quickTo(orb, 'x', { duration: 1.4, ease: 'power3.out' });
      const oy = gsap.quickTo(orb, 'y', { duration: 1.4, ease: 'power3.out' });
      const cx = gsap.quickTo(copy, 'x', { duration: 1.4, ease: 'power3.out' });
      gsap.set(orbit, { transformPerspective: 1200 });
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        rx(nx * 10); ry(-ny * 8); ox(nx * 22); oy(ny * 18); cx(nx * -8);
      });
      hero.addEventListener('pointerleave', () => { rx(0); ry(0); ox(0); oy(0); cx(0); });
    }
    /* Salida del hero al hacer scroll */
    gsap.to('.hero__visual', { yPercent: -10, scale: 1.06, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__copy', { y: -70, opacity: 0.15, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '70% top', scrub: true } });
    return pulse;
  }

  function initNavMotion() {
    const nav = $('#nav');
    const bar = $('#progress i');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: (self) => {
        bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
        const y = self.scroll();
        nav.classList.toggle('is-stuck', y > 24);
        const menuOpen = root.classList.contains('menu-open');
        nav.classList.toggle('is-hidden', !menuOpen && self.direction === 1 && y > 360);
        if (self.direction === -1) nav.classList.remove('is-hidden');
      },
    });
    const map = { servicios: 'servicios', ultrasonido: 'ultrasonido', checkup: 'checkup', doctor: 'doctor', contacto: 'contacto' };
    const links = $$('.nav__links a');
    Object.keys(map).forEach((id) => {
      const sec = $('#' + id);
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: (self) => {
          const link = links.find((l) => l.getAttribute('href') === '#' + id);
          if (link) link.classList.toggle('is-current', self.isActive);
        },
      });
    });
  }

  function initTickerSpeed() {
    const track = $('#ticker');
    if (!track || !lenis) return;
    const anim = track.getAnimations ? track.getAnimations()[0] : null;
    if (!anim) return;
    let rate = 1;
    gsap.ticker.add(() => {
      const target = 1 + Math.min(Math.abs(lenis.velocity) * 0.55, 6);
      rate += (target - rate) * 0.08;
      anim.playbackRate = rate;
    });
  }

  function initManifesto() {
    const text = $('#manifesto-text');
    if (!text) return;
    const nodes = wrapMotionWords(text);
    const tl = gsap.timeline({ scrollTrigger: { trigger: text, start: 'top 82%', end: 'bottom 52%', scrub: true } });
    nodes.forEach((n, i) => {
      if (n.classList.contains('pill-img')) tl.to(n, { clipPath: 'inset(0 0% 0 0 round 999px)', duration: 0.5, ease: 'power2.out' }, i * 0.1);
      else tl.to(n, { color: '#141b3b', duration: 0.35, ease: 'none' }, i * 0.1);
    });
    gsap.fromTo('.manifesto__mark', { yPercent: 12 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* Servicios: el scroll vertical desplaza las tarjetas en horizontal (escritorio) */
  function initServices(mm) {
    const section = $('#servicios');
    if (!section) return;
    mm.add('(min-width: 900px)', () => {
      const pin = $('.services__pin', section);
      const rail = $('.services__rail', section);
      const track = $('#services-track');
      const bar = $('#services-bar');
      section.classList.add('is-pinned');
      const padL = () => parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      const distance = () => Math.max(0, track.scrollWidth + padL() * 2 - rail.clientWidth);
      const tween = gsap.to(track, { x: () => -distance(), ease: 'none' });
      const st = ScrollTrigger.create({
        trigger: section, animation: tween, start: 'top top', end: () => '+=' + Math.round(distance() * 1.05),
        pin: pin, pinSpacing: true, scrub: 0.9, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; },
      });
      $$('.svc__media img', section).forEach((img) => {
        gsap.set(img, { scale: 1.24 });
        gsap.fromTo(img, { xPercent: -7 }, {
          xPercent: 7, ease: 'none',
          scrollTrigger: { trigger: img.closest('.svc'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
      return () => { section.classList.remove('is-pinned'); st.kill(); };
    });
  }

  /* Ultrasonido: la imagen se abre hasta ocupar toda la pantalla */
  function initScan() {
    const section = $('#ultrasonido');
    if (!section) return;
    section.classList.add('is-pinned');
    const mobile = window.innerWidth < 900;
    const frame = $('#scan-frame');
    const img = $('.scan__img', section);
    const content = $$('#scan-content > *');
    const shade = $('.scan__shade', section);
    const fan = $('.scan__fan', section);
    const wl = $('.scan__word--l', section);
    const wr = $('.scan__word--r', section);
    const from = mobile ? 'inset(26% 12% 24% 12% round 28px)' : 'inset(22% 31% 22% 31% round 28px)';
    gsap.set(content, { y: 44, opacity: 0 });
    gsap.set([shade, fan], { opacity: 0 });
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: '+=260%', pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true },
    });
    tl.fromTo(frame, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1, ease: 'power2.inOut' }, 0)
      .fromTo(img, { scale: 1.4 }, { scale: 1.02, duration: 1.1 }, 0)
      .to(wl, mobile ? { yPercent: -160, opacity: 0, duration: 0.6 } : { xPercent: -130, opacity: 0, duration: 0.7 }, 0.08)
      .to(wr, mobile ? { yPercent: 160, opacity: 0, duration: 0.6 } : { xPercent: 130, opacity: 0, duration: 0.7 }, 0.08)
      .to(shade, { opacity: 1, duration: 0.5 }, 0.6)
      .to(fan, { opacity: 0.9, duration: 0.5 }, 0.7)
      .to(content, { y: 0, opacity: 1, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, 0.85)
      .to({}, { duration: 0.5 });
  }

  function initCheckup() {
    const num = $('#price-num');
    if (num) {
      const obj = { v: 0 };
      ScrollTrigger.create({
        trigger: num, start: 'top 88%', once: true,
        onEnter: () => {
          num.textContent = '0';
          gsap.to(obj, {
            v: 1000, duration: 2.4, ease: 'power3.out',
            onUpdate: () => { num.textContent = Math.round(obj.v).toLocaleString('es-MX'); },
            onComplete: () => { num.textContent = (1000).toLocaleString('es-MX'); },
          });
        },
      });
    }
    if (!finePointer) return;
    $$('[data-tilt]').forEach((tile) => {
      const rx = gsap.quickTo(tile, 'rotationX', { duration: 0.7, ease: 'power3.out' });
      const ry = gsap.quickTo(tile, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      gsap.set(tile, { transformPerspective: 1100 });
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        tile.style.setProperty('--mx', (nx * 100).toFixed(1) + '%');
        tile.style.setProperty('--my', (ny * 100).toFixed(1) + '%');
        ry((nx - 0.5) * 6); rx(-(ny - 0.5) * 6);
      });
      tile.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  function initDoctor() {
    const circle = $('#doctor-circle');
    if (!circle) return;
    gsap.fromTo(circle, { clipPath: 'circle(0% at 50% 50%)' }, {
      clipPath: 'circle(72% at 50% 50%)', duration: 1.8, ease: 'expo.out',
      onComplete: () => gsap.set(circle, { clearProps: 'clipPath' }),
      scrollTrigger: { trigger: '.doctor__visual', start: 'top 80%', once: true },
    });
    gsap.fromTo($('img', circle), { scale: 1.4 }, { scale: 1.04, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: '.doctor__visual', start: 'top 80%', once: true } });
    gsap.fromTo('.doctor__visual', { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.doctor', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  function initProcess() {
    const steps = $$('.step');
    const words = $$('.process__word span');
    const fill = $('#steps-fill');
    if (!steps.length) return;
    const setActive = (i) => {
      steps.forEach((s, k) => s.classList.toggle('is-on', k <= i));
      words.forEach((w, k) => { w.classList.toggle('is-on', k === i); w.classList.toggle('is-past', k < i); });
    };
    setActive(0);
    gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#steps', start: 'top 55%', end: 'bottom 60%', scrub: true } });
    steps.forEach((step, i) => {
      ScrollTrigger.create({ trigger: step, start: 'top 58%', end: 'bottom 58%', onToggle: (self) => { if (self.isActive) setActive(i); } });
    });
  }

  function initFooterMotion() {
    gsap.fromTo('.footer__big span', { yPercent: 55, opacity: 0.2 }, {
      yPercent: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: '.footer__big', start: 'top 105%', end: 'top 55%', scrub: true },
    });
  }

  /* Reveals de encabezados y bloques */
  function initReveals() {
    /* 1. escrituras */
    const heads = $$('[data-split]').map((el) => {
      const words = splitWords(el);
      gsap.set(words, { y: 0, yPercent: 108 });
      return { el, words };
    });
    const items = $$('[data-reveal]');
    items.forEach((el) => {
      if (el.dataset.reveal === 'scale') gsap.set(el, { y: 0, scale: 0.92, opacity: 0 });
      else gsap.set(el, { y: 34, opacity: 0 });
    });
    /* 2. lecturas (creación de triggers) */
    heads.forEach(({ el, words }) => {
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.05 }),
      });
    });
    ScrollTrigger.batch(items, {
      start: 'top 91%', once: true,
      onEnter: (batch) => gsap.to(batch, { y: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' }),
    });
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((btn) => {
      const qx = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'power3.out' });
      const qy = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'power3.out' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.22);
        qy((e.clientY - (r.top + r.height / 2)) * 0.32);
      });
      btn.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });
  }

  function initFabMotion() {
    const fab = $('#fab');
    if (fab) gsap.to(fab, { scale: 1, duration: 1.1, ease: 'back.out(1.8)', delay: 0.4 });
  }

  /* ==========================================================================
     6. Arranque
     ========================================================================== */
  async function boot() {
    safe('whatsapp', initWhatsApp);
    safe('schedule', initSchedule);
    safe('promo', initPromo);
    safe('menu', initMenu);
    safe('ticker', initTicker);
    safe('lazy-ahead', initLazyAhead);
    safe('stages', initStages);
    safe('gallery', initGallery);
    safe('faq', initFaq);
    safe('map', initMap);
    safe('form', initForm);
    safe('fab', initFab);
    safe('button-fill', initButtonFill);
    if (!hasGSAP) root.classList.add('no-gsap');

    let pulse = null;
    const fx = safe('hero-fx', () => heroFX((k) => { if (pulse) pulse(k); }));
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    let refreshTimer = 0;
    const refresh = () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 200); };

    /* El movimiento se monta por fases, cediendo el hilo entre cada una, mientras el loader cubre la pantalla */
    let ready = Promise.resolve();
    if (motion) {
      ready = (async () => {
        await frame();
        root.classList.add('anim');
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,resize' });
        safe('lenis', initSmoothScroll);
        safe('hero-prep', heroPrep);
        safe('hero-motion', () => { pulse = heroMotion($('#orb')); });
        await frame();
        /* Orden: primero los bloques fijados (pin), luego el resto, para que ScrollTrigger calcule bien las posiciones */
        const mm = gsap.matchMedia();
        safe('services', () => initServices(mm));
        safe('scan', initScan);
        await frame();
        safe('manifesto', initManifesto);
        safe('checkup', initCheckup);
        safe('doctor', initDoctor);
        safe('process', initProcess);
        safe('footer', initFooterMotion);
        safe('nav', initNavMotion);
        await frame();
        safe('reveals', initReveals);
        safe('magnetic', initMagnetic);
        safe('ticker-speed', initTickerSpeed);
        ScrollTrigger.refresh();
      })();
    }

    runLoader(ready).then(() => {
      if (motion) {
        safe('hero-intro', heroIntro);
        safe('fab-motion', initFabMotion);
        if (lenis) lenis.start();
      }
      if (fx && fx.start) fx.start();
    });

    if (motion && document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
