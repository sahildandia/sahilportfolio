// Shared validation for public content and the admin publishing workflow.
export function safeUrl(value, { external = false, empty = true } = {}) {
  if (typeof value !== 'string') return false;
  if (!value && empty) return true;
  if (!value || value !== value.trim() || /[\u0000-\u0020\\]/.test(value.replace(/ /g, '')) || value.startsWith('//')) return false;
  if (/^https:\/\//i.test(value)) {
    try { const u = new URL(value); return Boolean(u.hostname) && !u.username && !u.password; } catch { return false; }
  }
  return !external && !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('/') && !value.split('/').includes('..') && !value.includes('#');
}

export function validateContent(data) {
  const errors = [];
  const obj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const text = (v, path, max = 5000, required = false) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) errors.push(`${path}: enter ${required ? 'nonempty ' : ''}text up to ${max} characters.`);
  };
  const arr = (v, path, max = 100) => {
    if (!Array.isArray(v) || v.length > max) { errors.push(`${path}: expected a list of up to ${max} entries.`); return []; } return v;
  };
  const url = (v, path, external = false, empty = true) => { if (!safeUrl(v, { external, empty })) errors.push(`${path}: use ${external ? 'an HTTPS URL' : 'a relative file path or HTTPS URL'}.`); };
  const checkKeys = (value, allowed, path) => { if (obj(value)) for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key}: this field is not part of the public content schema.`); };
  if (!obj(data)) return ['Content must be a JSON object.'];
  checkKeys(data,['version','profile','about','skills','projects','education','experience','certifications','settings'],'content');
  if (data.version !== 1) errors.push('Unsupported content version.');
  if (!obj(data.profile)) errors.push('Profile is required.');
  else {
    checkKeys(data.profile,['name','brand','initials','role','location','studyLocation','email','phone','github','linkedin','portrait','resume','headline','headlineAccent','intro'],'profile');
    for (const key of ['name','brand','initials','role','location','studyLocation','email','phone','headline','headlineAccent','intro']) text(data.profile[key], `profile.${key}`, key === 'intro' ? 5000 : 300, ['name','brand','initials','email','headline'].includes(key));
    if (typeof data.profile.email === 'string' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.profile.email)) errors.push('Enter a valid contact email.');
    if (typeof data.profile.phone === 'string' && !/^\+?[\d ()-]*$/.test(data.profile.phone)) errors.push('Enter a valid phone number.');
    for (const key of ['github','linkedin']) url(data.profile[key], `profile.${key}`, true);
    for (const key of ['portrait','resume']) url(data.profile[key], `profile.${key}`, false, false);
  }
  if (!obj(data.about)) errors.push('About is required.');
  else { checkKeys(data.about,['title','accent','paragraphs'],'about');text(data.about.title,'about.title',300,true); text(data.about.accent,'about.accent',300); arr(data.about.paragraphs,'about.paragraphs',20).forEach((v,i) => text(v,`about.paragraphs.${i}`)); }
  arr(data.skills,'skills').forEach((v,i) => { if (!obj(v)) return errors.push(`skills.${i}: invalid entry.`);checkKeys(v,['name','category'],`skills.${i}`); text(v.name,`skills.${i}.name`,100,true); text(v.category,`skills.${i}.category`,100,true); });
  const ids = new Set();
  arr(data.projects,'projects',50).forEach((v,i) => {
    if (!obj(v)) return errors.push(`projects.${i}: invalid entry.`);
    checkKeys(v,['id','title','category','type','description','tags','image','source','demo','download','details'],`projects.${i}`);
    for (const k of ['id','title','type','description']) text(v[k],`projects.${i}.${k}`,k === 'description' ? 5000 : 300,true);
    if (typeof v.id !== 'string' || !/^[a-z0-9-]+$/.test(v.id) || ids.has(v.id)) errors.push('Project IDs must be unique lowercase letters, numbers, and hyphens.'); ids.add(v.id);
    if (!['ai','web','data','mobile'].includes(v.category)) errors.push(`projects.${i}.category: choose ai, web, data, or mobile.`);
    arr(v.tags,`projects.${i}.tags`,30).forEach((t,j) => text(t,`projects.${i}.tags.${j}`,100));
    arr(v.details,`projects.${i}.details`,30).forEach((t,j) => text(t,`projects.${i}.details.${j}`));
    url(v.image,`projects.${i}.image`); url(v.source,`projects.${i}.source`,true); url(v.demo,`projects.${i}.demo`,true);
    if (v.download !== undefined) url(v.download,`projects.${i}.download`,true);
  });
  for (const [section, keys] of Object.entries({ education:['degree','institution','location','period','score'], experience:['title','company','period','description'], certifications:['title','issuer','url'] })) {
    arr(data[section],section).forEach((v,i) => {
      if (!obj(v)) return errors.push(`${section}.${i}: invalid entry.`);
      checkKeys(v,keys,`${section}.${i}`);
      for (const key of keys) key === 'url' ? url(v[key],`${section}.${i}.${key}`) : text(v[key],`${section}.${i}.${key}`,key === 'description' ? 5000 : 500,['title','degree'].includes(key));
    });
  }
  if (!obj(data.settings)) errors.push('Settings are required.');
  else { checkKeys(data.settings,['defaultTheme','contactHeading','contactIntro'],'settings');if (!['light','dark'].includes(data.settings.defaultTheme)) errors.push('Default theme must be light or dark.'); text(data.settings.contactHeading,'settings.contactHeading',300,true); text(data.settings.contactIntro,'settings.contactIntro'); }
  return errors;
}

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
