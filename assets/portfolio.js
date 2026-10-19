import { validateContent } from './content-model.js';
import { renderContent } from './content-renderer.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let content;
let preview = false;
let loadError = false;
try {
  const draft = new URLSearchParams(location.search).has('preview') && sessionStorage.getItem('sahil-portfolio-preview');
  if (draft) { content = JSON.parse(draft); preview = true; }
} catch { /* A malformed preview falls back to published content. */ }
try {
  if (!content || validateContent(content).length) {
    preview = false;
    const response = await fetch(new URL('./content.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Content unavailable');
    content = await response.json();
    if (validateContent(content).length) throw new Error('Invalid content');
  }
} catch {
  content = JSON.parse(document.querySelector('#content-snapshot').textContent);
  loadError = true;
}
document.querySelector('#site-root').innerHTML = renderContent(content);
document.body.dataset.ready = 'true';
document.title = `${content.profile.name} — Developer Portfolio`;
document.querySelector('meta[name="description"]').content = content.profile.intro;
const $ = selector => document.querySelector(selector);
if (preview || loadError) {
  $('#preview-banner').hidden = false;
  if (loadError) { $('#preview-banner').innerHTML = '<strong>Updated content could not load.</strong><span>Showing the bundled version.</span><button type="button" id="reload-content">Try again</button>'; $('#reload-content').onclick = () => location.reload(); }
}

const themeButton = $('#theme-toggle');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === 'dark' ? '☀' : '◐';
  themeButton.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  $('meta[name="theme-color"]').content = theme === 'dark' ? '#242823' : '#f1efe6';
}
let savedTheme;
try { savedTheme = localStorage.getItem('sahil-editorial-theme'); } catch { /* Theme remains usable without storage. */ }
setTheme(['light','dark'].includes(savedTheme) ? savedTheme : content.settings.defaultTheme);
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
  try { localStorage.setItem('sahil-editorial-theme', theme); } catch { /* Session-only theme. */ }
});
const nav = $('#main-nav');
const menu = $('#menu-toggle');
const closeMenu = () => { nav.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.setAttribute('aria-label','Open navigation'); menu.textContent = '☰'; };
menu.addEventListener('click', () => {
  const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',`${open?'Close':'Open'} navigation`); menu.textContent = open ? '×' : '☰';
});
nav.querySelectorAll('a').forEach(a => a.addEventListener('click',closeMenu));
document.addEventListener('click', e => { if (!nav.contains(e.target) && !menu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); }
  if (e.key === 'Escape' && !$('#guide-panel').hidden) closeGuide();
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) nav.querySelectorAll('a').forEach(a => {
      const current = a.hash === '#'+entry.target.id; a.classList.toggle('active',current);
      if (current) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');
    });
  }, { rootMargin:'-15% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => observer.observe(s));
}
let scrollQueued = false;
function updateScroll() { const max = document.documentElement.scrollHeight-innerHeight; $('.reading-progress').style.width = `${max > 0 ? scrollY/max*100 : 0}%`; scrollQueued = false; }
addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued=true; requestAnimationFrame(updateScroll); } }, {passive:true});
updateScroll();
if (matchMedia('(hover: hover) and (pointer: fine)').matches) document.querySelectorAll('[data-tilt]').forEach(el => {
  el.addEventListener('pointermove', e => { if (reducedMotion.matches) return; const r=el.getBoundingClientRect(); el.style.transform=`perspective(1100px) rotateX(${-(e.clientY-r.top-r.height/2)/r.height*4}deg) rotateY(${(e.clientX-r.left-r.width/2)/r.width*5}deg)`; });
  el.addEventListener('pointerleave',()=>el.style.transform='');
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) document.querySelectorAll('[data-tilt]').forEach(el=>el.style.transform=''); });

let skillCategory = 'all';
function filterSkills() {
  const query = $('#skill-search').value.trim().toLowerCase(); let count=0;
  document.querySelectorAll('.skill-card').forEach(card=> { card.hidden=(skillCategory!=='all' && card.dataset.category!==skillCategory) || !card.dataset.name.includes(query); if(!card.hidden)count++; });
  $('#skill-status').textContent = count ? `${count} skills shown` : 'No matching skills. Try another search or category.';
}
document.querySelectorAll('[data-skill-filter]').forEach(button=>button.addEventListener('click',()=> {
  skillCategory=button.dataset.skillFilter;
  document.querySelectorAll('[data-skill-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); filterSkills();
}));
$('#skill-search').addEventListener('input',filterSkills);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=> {
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); let count=0;
  document.querySelectorAll('.project-card').forEach(card=>{ card.hidden=button.dataset.filter!=='all' && card.dataset.category!==button.dataset.filter; if(!card.hidden)count++; });
  $('#filter-status').textContent=`${count} project${count===1?'':'s'} shown`;
}));
$('#certificate-search').addEventListener('input',e=>{ let count=0; document.querySelectorAll('.certificate-card').forEach(card=>{card.hidden=!card.dataset.search.includes(e.target.value.trim().toLowerCase()); if(!card.hidden)count++;}); $('#certificate-status').textContent=count?`${count} certifications shown`:'No matching certifications.'; });

let dialogTrigger;
const dialog=$('#project-dialog');
document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=> {
  const project=content.projects.find(p=>p.id===button.dataset.project); if(!project)return; dialogTrigger=button;
  $('#dialog-title').textContent=project.title; $('#dialog-type').textContent=project.type; $('#dialog-description').textContent=project.description;
  $('#dialog-points').replaceChildren(...project.details.map(text=>{ const li=document.createElement('li');li.textContent=text;return li;}));
  $('#dialog-tags').replaceChildren(...project.tags.map(text=>{ const span=document.createElement('span');span.textContent=text;return span;}));
  for (const key of ['source','demo','download']) { const link=$('#dialog-'+key); link.hidden=!project[key]; if(project[key])link.href=project[key];else link.removeAttribute('href'); }
  $('#dialog-source-note').hidden=Boolean(project.source); dialog.showModal();
}));
$('#dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>dialogTrigger?.focus());
dialog.addEventListener('click',e=>{ if(e.target===dialog){ const r=dialog.getBoundingClientRect();if(e.clientX<r.left ||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();} });

$('#copy-email').addEventListener('click',async()=>{
  try { if(!navigator.clipboard)throw new Error(); await navigator.clipboard.writeText(content.profile.email);$('#copy-email').textContent='Copied';$('#copy-status').textContent='Email address copied.'; }
  catch { const range=document.createRange();range.selectNodeContents($('#email-link')); const s=getSelection();s.removeAllRanges();s.addRange(range);$('#copy-status').textContent='Select and copy the email address, or use the email link.'; }
});
$('#contact-message').addEventListener('input',e=>$('#message-count').textContent=`${e.target.value.length} / 5000`);
$('#contact-form').addEventListener('submit',e=>{
  e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
  const name=f.elements.name.value.trim(),email=f.elements.email.value.trim(),message=f.elements.message.value.trim();
  if(!name || !message){$('#form-status').textContent='Please enter your name and a message.';return;}
  const subject=f.elements.subject.value.trim() || `Portfolio enquiry from ${name}`;
  const body=`Hi ${content.profile.name.split(' ')[0]},\n\n${message}\n\nFrom: ${name}\nEmail: ${email}`;
  const draft=$('#email-draft'); draft.href=`mailto:${content.profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;draft.hidden=false;
  $('#form-status').textContent='Your email draft is ready. Send it from your email app. If it does not open, use the draft link below.';draft.click();
});

const guide=$('#guide-panel'); const guideToggle=$('#guide-toggle');
function closeGuide(){guide.hidden=true;guideToggle.setAttribute('aria-expanded','false');guideToggle.focus();}
guideToggle.addEventListener('click',()=>{ guide.hidden=!guide.hidden;guideToggle.setAttribute('aria-expanded',String(!guide.hidden));if(!guide.hidden)$('#guide-close').focus(); });
$('#guide-close').addEventListener('click',closeGuide);
document.querySelectorAll('[data-guide]').forEach(button=>button.addEventListener('click',()=>{
  const text={skills:`${content.profile.name} works with ${content.skills.map(s=>s.name).join(', ')}.`,projects:content.projects.map(p=>p.title).join(' · '),contact:`Email ${content.profile.email} or call ${content.profile.phone}. The contact form prepares an email draft for you to send.`}[button.dataset.guide];
  $('#guide-answer').textContent=text;
}));
const route={'about.html':'about','projects.html':'work','experience.html':'experience','contact.html':'contact'}[location.pathname.split('/').pop()];
const target=location.hash.slice(1) || route;
if(target && document.getElementById(target))requestAnimationFrame(()=> {document.getElementById(target).scrollIntoView({behavior:'instant'});if(!location.hash)history.replaceState(null,'','#'+target);});
// The existing 3D study stays optional and transfers its library only on opening.
let sceneLoaded=false;
$('.scene-study').addEventListener('toggle',()=>{if($('.scene-study').open&&!sceneLoaded){sceneLoaded=true;import('./hero-scene.js').catch(()=>{});}});
