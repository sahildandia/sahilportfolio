(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const themeButton = document.querySelector('#theme-toggle');
  const setTheme = theme => {
    document.documentElement.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? '☀' : '☾';
    themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  let savedTheme;
  try { savedTheme = localStorage.getItem('sahil-theme'); } catch (_) { /* Storage can be restricted. */ }
  setTheme(savedTheme === 'dark' ? 'dark' : 'light');
  themeButton.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    try { localStorage.setItem('sahil-theme', theme); } catch (_) { /* Theme still works for this session. */ }
  });

  const menuButton = document.querySelector('#menu-toggle');
  const nav = document.querySelector('#main-nav');
  function closeMenu() { nav.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.textContent = '☰'; menuButton.setAttribute('aria-label', 'Open navigation'); }
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? '×' : '☰';
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menuButton.focus(); } });
  document.addEventListener('click', e => { if (!nav.contains(e.target) && !menuButton.contains(e.target)) closeMenu(); });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    if (!reducedMotion.matches) document.documentElement.classList.add('js-motion');
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.08 });
    reveals.forEach(el => revealObserver.observe(el));
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        nav.querySelectorAll('a').forEach(a => {
          const active = a.hash === `#${entry.target.id}`;
          a.classList.toggle('active', active);
          if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(el => sectionObserver.observe(el));
  }

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(element => {
      element.addEventListener('pointermove', e => {
        if (reducedMotion.matches) return;
        const r = element.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        element.style.transform = `perspective(1100px) rotateX(${-y * 8}deg) rotateY(${x * 9}deg)`;
      });
      element.addEventListener('pointerleave', () => element.style.transform = '');
    });
  }

  const filters = document.querySelectorAll('.filter');
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let count = 0;
    document.querySelectorAll('.project-card').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && !card.dataset.category.split(' ').includes(button.dataset.filter);
      if (!card.hidden) count++;
    });
    document.querySelector('#filter-status').textContent = `${count} project${count === 1 ? '' : 's'} shown`;
  }));

  const projectData = {
    fall: { title: 'Explainable Fall & SOS Screening', type: 'Computer vision · Explainable AI', description: 'A video screening pipeline designed to identify falls and SOS gestures in CCTV clips, with explainable predictions.', points: ['Samples frames at intervals to reduce computation while retaining event coverage.', 'Uses MediaPipe Pose and Hands with OpenCV to extract movement, posture, and gesture features.', 'Classifies segments as FALL, SOS, or NORMAL and uses temporal confirmation to reduce isolated false detections.', 'Uses SHAP to explain which pose and hand features contributed to predictions.'], tags: ['Python', 'MediaPipe', 'OpenCV', 'SHAP'], url: null },
    movie: { title: 'Movie Ticket Booking System', type: 'Relational databases · Application workflows', description: 'A relational database project for managing movies, theatres, showtimes, seats, and customer bookings.', points: ['Designed tables with appropriate primary keys, foreign keys, and constraints.', 'Implemented booking and seat reservation workflows with SQL joins.', 'Retrieves booking history and analyzes occupancy patterns with aggregate queries.'], tags: ['MySQL', 'SQL', 'DBMS'], url: 'https://github.com/sahildandia/Movie-Ticket-Booking-System' },
    currency: { title: 'Currency Exchange Calculator', type: 'Utilities · Web interface', description: 'A practical currency conversion project with a simple HTML and CSS interface.', points: ['Converts between currencies through a focused calculator workflow.', 'Includes user account setup and access permissions.', 'Built as a hands-on project in application logic and interface design.'], tags: ['HTML', 'CSS', 'Currency conversion'], url: 'https://github.com/sahildandia/currency-exchange-rate-calculator-' }
  };
  const dialog = document.querySelector('#project-dialog');
  let dialogTrigger;
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    const data = projectData[button.dataset.project];
    dialogTrigger = button;
    document.querySelector('#dialog-title').textContent = data.title;
    document.querySelector('#dialog-type').textContent = data.type;
    document.querySelector('#dialog-description').textContent = data.description;
    document.querySelector('#dialog-points').replaceChildren(...data.points.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    document.querySelector('#dialog-tags').replaceChildren(...data.tags.map(text => { const span = document.createElement('span'); span.textContent = text; return span; }));
    const source = document.querySelector('#dialog-source');
    source.hidden = !data.url;
    if (data.url) source.href = data.url; else source.removeAttribute('href');
    document.querySelector('#dialog-source-note').hidden = Boolean(data.url);
    dialog.showModal();
  }));
  document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => dialogTrigger?.focus());

  const copyButton = document.querySelector('#copy-email');
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('dandiasahil@gmail.com');
      copyButton.textContent = 'Copied!';
      document.querySelector('#copy-status').textContent = 'Email address copied.';
    } catch (_) {
      copyButton.textContent = 'Select email';
      const range = document.createRange(); range.selectNodeContents(document.querySelector('#email-link'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.querySelector('#copy-status').textContent = 'Select and copy the email address, or use the email link.';
    }
  });
  document.querySelector('#contact-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    if (!name || !message) { document.querySelector('#form-status').textContent = 'Please enter your name and a message.'; return; }
    const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
    const body = encodeURIComponent(`Hi Sahil,\n\n${message}\n\nFrom: ${name}\nEmail: ${email}`);
    document.querySelector('#form-status').textContent = 'Your email draft is ready. Send it from your email app. If it does not open, use the email link beside this form.';
    const draftLink = document.querySelector('#email-draft');
    draftLink.href = `mailto:dandiasahil@gmail.com?subject=${subject}&body=${body}`;
    draftLink.hidden = false;
    draftLink.click();
  });
  document.querySelector('#year').textContent = new Date().getFullYear();
  const route = { 'about.html': 'about', 'projects.html': 'work', 'experience.html': 'experience', 'contact.html': 'contact' }[location.pathname.split('/').pop()];
  if (route && !location.hash) {
    requestAnimationFrame(() => { document.querySelector(`#${route}`).scrollIntoView({ behavior: 'instant' }); history.replaceState(null, '', `#${route}`); });
  }
})();
