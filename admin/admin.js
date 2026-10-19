import { validateContent, safeUrl, escapeHtml as esc } from '../assets/content-model.js';
import { requireAdminSession } from './access.js';

await requireAdminSession();

const $ = id => document.getElementById(id);
const DRAFT_KEY = 'sahil-portfolio-admin-draft';
const PREVIEW_KEY = 'sahil-portfolio-preview';
const CONTENT_PATH = 'assets/content.json';
const clone = value => JSON.parse(JSON.stringify(value));
let content;
let baseline = '';
let authToken = ''; // Intentionally memory-only. Never serialize authentication.
let connection = null;
let sourceSha = '';
let conflict = false;
let busy = false;
let dirty = false;
let valid = false;
let lastCommit = '';

const definitions = {
  skills: { title: 'skill', fields: [['name','Skill name'],['category','Category']] },
  projects: { title: 'project', fields: [
    ['id','Unique project ID',{ help: 'Lowercase letters, numbers, and hyphens. Keep this stable for existing project links.' }],
    ['title','Project title'],
    ['category','Project category',{ kind:'select', options:[['mobile','Android apps'],['web','Web & utilities'],['ai','AI & vision'],['data','Databases']] }],
    ['type','Project type / subtitle'],
    ['description','Short description',{ kind:'textarea', span:true }],
    ['tags','Technology tags',{ kind:'lines', help:'One technology per line.' }],
    ['image','Screenshot path or HTTPS URL',{ help:'Leave blank for the illustrated project placeholder.' }],
    ['source','Source code URL',{ kind:'url', help:'HTTPS. Leave blank if the source is not public.' }],
    ['download','APK download URL',{ kind:'url', help:'Optional HTTPS link to an Android APK. Use a permanent release URL.' }],
    ['demo','Live demo URL',{ kind:'url', help:'HTTPS. Leave blank when no demo is available.' }],
    ['details','Project details',{ kind:'lines', span:true, help:'One detail or bullet point per line.' }],
  ] },
  education: { title:'education entry', fields:[['degree','Degree or qualification'],['institution','Institution'],['location','Location'],['period','Period'],['score','Score / additional detail']] },
  experience: { title:'experience entry', fields:[['title','Role / title'],['company','Company or organization'],['period','Period'],['description','Description',{ kind:'textarea', span:true }]] },
  certifications: { title:'certification', fields:[['title','Certification title'],['issuer','Issuer'],['url','Certificate path or HTTPS URL',{ span:true, help:'Optional. Use a relative file path or HTTPS URL.' }]] },
};

function field(path, label, options = {}) {
  const value = getPath(content, path);
  const id = path.replaceAll('.', '-');
  const displayed = options.kind === 'lines' ? (value || []).join('\n') : value ?? '';
  const attrs = `id="${esc(id)}" name="${esc(path)}" data-path="${esc(path)}"${options.kind === 'lines' ? ' data-lines="true"' : ''}`;
  let control;
  if (options.kind === 'select') control = `<select ${attrs}>${options.options.map(([key,title]) => `<option value="${esc(key)}"${value === key ? ' selected' : ''}>${esc(title)}</option>`).join('')}</select>`;
  else if (['textarea','lines'].includes(options.kind)) control = `<textarea ${attrs} rows="${options.kind === 'lines' ? '4' : '3'}" maxlength="${options.kind === 'lines' ? '30000' : '5000'}">${esc(displayed)}</textarea>`;
  else control = `<input ${attrs} type="${options.kind === 'url' ? 'url' : options.kind === 'email' ? 'email' : 'text'}" value="${esc(displayed)}" maxlength="${options.max || 500}"${options.kind === 'url' ? ' placeholder="https://…"' : ''}>`;
  return `<div class="field${options.span ? ' span-two' : ''}"><label for="${esc(id)}">${esc(label)}</label>${control}${options.help ? `<small>${esc(options.help)}</small>` : ''}</div>`;
}

function getPath(object, path) {
  return path.split('.').reduce((node,key) => node?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  const final = keys.pop();
  const target = keys.reduce((node,key) => node[key], object);
  target[final] = value;
}

function uploadField(path, kind) {
  const id = `upload-${path.replaceAll('.', '-')}`;
  return `<div class="upload-field"><label for="${id}">${kind === 'resume' ? 'Upload a new résumé' : 'Upload an image'} (optional)</label><div class="upload-controls"><input type="file" id="${id}" data-upload-input="${esc(path)}" accept="${kind === 'resume' ? '.pdf,.docx' : '.jpg,.jpeg,.png,.webp,.avif'}"><button class="button subtle" type="button" data-upload="${esc(path)}" data-upload-kind="${kind}" disabled>Upload to GitHub ↗</button></div><p>Up to 5 MB. Uploading commits the file immediately; publish your content afterward to use it. Requires a GitHub connection.</p></div>`;
}

function sectionHeader(number, title, description = '', collection = '') {
  return `<div class="section-header"><div><h3><span class="section-number">${number}</span>${esc(title)}</h3>${description ? `<p class="section-description">${esc(description)}</p>` : ''}</div>${collection ? `<button class="button subtle" type="button" data-add="${collection}">+ Add ${definitions[collection].title}</button>` : ''}</div>`;
}

function recordMarkup(collection, item, index) {
  const definition = definitions[collection];
  const title = item.title || item.degree || item.name || `New ${definition.title}`;
  const fields = definition.fields.map(([key,label,options]) => field(`${collection}.${index}.${key}`,label,options)).join('');
  const actions = `<div class="record-actions"><div class="order-buttons"><button class="small-button" type="button" data-move="${collection}" data-index="${index}" data-direction="-1" aria-label="Move ${esc(title)} up"${index === 0 ? ' disabled' : ''}>↑ Move up</button><button class="small-button" type="button" data-move="${collection}" data-index="${index}" data-direction="1" aria-label="Move ${esc(title)} down"${index === content[collection].length - 1 ? ' disabled' : ''}>↓ Move down</button></div><button class="small-button danger" type="button" data-remove="${collection}" data-index="${index}">Remove ${definition.title}</button></div>`;
  if (collection === 'skills') return `<article class="record" data-record="skills" data-index="${index}" aria-label="${esc(title)} skill"><div class="record-body"><div class="field-grid">${fields}</div>${actions}</div></article>`;
  return `<details class="record" data-record="${collection}" data-index="${index}"${index === 0 ? ' open' : ''}><summary><span class="record-title">${esc(title)}</span><span class="record-meta">${esc(item.period || item.type || item.issuer || definition.title)}</span></summary><div class="record-body"><div class="field-grid">${fields}${collection === 'projects' ? uploadField(`${collection}.${index}.image`, 'image') : ''}</div>${actions}</div></details>`;
}

function listMarkup(collection) {
  return `<div id="list-${collection}"${collection === 'skills' ? ' class="skills-list"' : ''}>${content[collection].length ? content[collection].map((item,index) => recordMarkup(collection,item,index)).join('') : `<div class="empty-list">No ${collection} yet. Add your first entry above.</div>`}</div>`;
}

function renderEditor() {
  $('content-form').innerHTML = `
    <section class="editor-section" id="profile-section">${sectionHeader('01','Profile & introduction','The essentials people see first. Keep it personal and clear.')}<div class="field-grid">
    ${field('profile.name','Your name')}${field('profile.brand','Navigation brand')}${field('profile.initials','Initials',{max:12})}${field('profile.role','Role / professional description')}${field('profile.headline','Hero headline')}${field('profile.headlineAccent','Hero headline — accent line')}${field('profile.intro','Introduction',{kind:'textarea',span:true})}${field('profile.location','Home location')}${field('profile.studyLocation','Study location')}${field('profile.email','Contact email',{kind:'email'})}${field('profile.phone','Phone number')}${field('profile.github','GitHub profile URL',{kind:'url'})}${field('profile.linkedin','LinkedIn profile URL',{kind:'url'})}${field('profile.portrait','Profile photo path or HTTPS URL',{span:true})}${uploadField('profile.portrait','image')}${field('profile.resume','Résumé path or HTTPS URL',{span:true})}${uploadField('profile.resume','resume')}
    </div></section>
    <section class="editor-section" id="about-section">${sectionHeader('02','About','A little more of the story behind your work.')}<div class="field-grid">${field('about.title','About heading')}${field('about.accent','About heading — accent line')}${field('about.paragraphs','Your biography',{kind:'lines',span:true,help:'One paragraph per line. Blank lines are ignored.'})}</div></section>
    <section class="editor-section" id="skills-section">${sectionHeader('03','Skills','Group your skills with categories such as Languages, Web, or Tools.','skills')}${listMarkup('skills')}</section>
    <section class="editor-section" id="projects-section">${sectionHeader('04','Projects','Your work, in your own words. Add only the links you want to share.','projects')}${listMarkup('projects')}</section>
    <section class="editor-section" id="journey-section">${sectionHeader('05','Education & experience','Build a clear timeline of the places you’ve learned and contributed.')}<h4 class="collection-subtitle">Education<button class="button subtle" type="button" data-add="education">+ Add education</button></h4>${listMarkup('education')}<h4 class="collection-subtitle">Experience<button class="button subtle" type="button" data-add="experience">+ Add experience</button></h4>${listMarkup('experience')}</section>
    <section class="editor-section" id="certifications-section">${sectionHeader('06','Certifications','Courses and qualifications that are part of your journey.','certifications')}${listMarkup('certifications')}</section>
    <section class="editor-section" id="settings-section">${sectionHeader('07','Site settings','A few finishing touches for the overall experience.')}<div class="field-grid">${field('settings.defaultTheme','Default website theme',{kind:'select',options:[['light','Light — ivory & burnt orange'],['dark','Dark — warm charcoal']]})}${field('settings.contactHeading','Contact section heading')}${field('settings.contactIntro','Contact section introduction',{kind:'textarea',span:true})}</div></section>`;
  updateState();
}

function status(message, kind = '') {
  $('admin-status').textContent = message;
  $('admin-status').className = `admin-status${kind ? ` ${kind}` : ''}`;
}

function validate() {
  const errors = content ? validateContent(content) : ['Content is not loaded.'];
  valid = errors.length === 0;
  $('validation-summary').hidden = valid || !content;
  $('validation-errors').innerHTML = errors.slice(0,20).map(message => `<li>${esc(message)}</li>`).join('');
  return errors;
}

function updateState() {
  const loaded = Boolean(content);
  dirty = loaded && JSON.stringify(content) !== baseline;
  validate();
  $('draft-state').textContent = !loaded ? 'Content unavailable' : dirty ? 'Unpublished changes' : 'Up to date';
  $('draft-state').classList.toggle('dirty',dirty);
  $('publish-state').textContent = !loaded ? 'The editor is waiting for valid content.' : busy ? 'Working on your request…' : dirty ? 'Your changes are ready for a closer look.' : 'Your content is up to date.';
  $('publish-note').textContent = conflict ? 'GitHub has newer content. Export your draft before loading the latest version.' : connection ? `Publishing commits to ${connection.owner}/${connection.repo} · ${connection.branch}.` : 'Connect GitHub to publish. Preview and local drafts work without signing in.';
  $('save-draft').disabled = !loaded || busy || !valid;
  $('load-draft').disabled = !loaded || busy;
  $('export-button').disabled = !loaded || busy || !valid;
  $('import-file').disabled = busy;
  $('preview-button').disabled = !loaded || busy || !valid;
  $('publish-button').disabled = !loaded || busy || !valid || !connection || conflict || connection.readOnly;
  $('connect-button').disabled = busy || Boolean(connection);
  $('connect-button').textContent = connection ? 'Connected ✓' : busy ? 'Please wait…' : 'Connect GitHub ↗';
  $('logout-button').hidden = !connection;
  $('logout-button').disabled = busy;
  $('reload-button').disabled = busy || !connection;
  for (const id of ['connection-owner','connection-repo','connection-branch','github-token']) $(id).disabled = busy || Boolean(connection);
  for (const control of $('content-form').querySelectorAll('input,textarea,select,button')) {
    control.disabled = busy;
    if (control.hasAttribute('data-upload')) control.disabled = busy || !connection || connection.readOnly;
    if (control.hasAttribute('data-move')) {
      const index = Number(control.dataset.index);
      const target = index + Number(control.dataset.direction);
      control.disabled = busy || target < 0 || target >= content[control.dataset.move].length;
    }
  }
  $('connection-dot').classList.toggle('connected',Boolean(connection));
  $('connection-label').textContent = connection ? connection.readOnly ? 'Connected · read only' : 'GitHub connected' : 'Local editing';
  $('connection-status').textContent = connection ? `${connection.owner}/${connection.repo} · ${connection.branch}${connection.readOnly ? '. Write access is unavailable.' : '. GitHub checks write access when publishing.'}` : 'Connect GitHub when you’re ready to publish.';
}

function setBusy(value) {
  busy = value;
  $('editor').setAttribute('aria-busy',String(value));
  updateState();
}

function useContent(data, { clean = false } = {}) {
  const errors = validateContent(data);
  if (errors.length) throw new Error(`This content file is invalid: ${errors.slice(0,3).join(' ')}`);
  content = clone(data);
  if (clean) baseline = JSON.stringify(content);
  renderEditor();
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i,i + 32768));
  return btoa(binary);
}

function decodeContent(base64) {
  try {
    const binary = atob(base64.replace(/\s/g,''));
    const bytes = Uint8Array.from(binary,char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch {
    throw new Error('GitHub returned a content file that could not be read as UTF-8 JSON. Check assets/content.json in your repository.');
  }
}

function errorForResponse(response) {
  let message;
  if (response.status === 401) message = 'GitHub rejected this token. Check that it is correct and has not expired, then connect again.';
  else if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') message = 'GitHub’s API rate limit has been reached. Wait for the limit to reset, then try again. Your edits are safe in this tab.';
  else if (response.status === 403) message = 'GitHub denied this action. Give the token access to this repository with Contents: Read and write; organization approval or branch rules may also be required.';
  else if (response.status === 404) message = 'GitHub could not find this repository, branch, or content file. Check the connection details and token repository access.';
  else if ([409,422].includes(response.status)) message = 'GitHub could not save this version. The file may have changed, or branch rules may prevent direct commits. Export your draft, load the latest content, and retry.';
  else if (response.status >= 500) message = 'GitHub is temporarily unavailable. Your edits are safe; try again shortly.';
  else message = `GitHub could not complete this action (HTTP ${response.status}). Your edits have been retained.`;
  const error = new Error(message);
  error.status = response.status;
  return error;
}

async function githubRequest(path, options = {}, token = authToken) {
  await requireAdminSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),20000);
  try {
    const response = await fetch(`https://api.github.com${path}`,{
      ...options,
      headers:{ Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', ...(options.body ? {'Content-Type':'application/json'} : {}) },
      redirect:'error', referrerPolicy:'no-referrer', cache:'no-store', signal:controller.signal,
    });
    if (!response.ok) throw errorForResponse(response);
    try { return await response.json(); }
    catch { throw new Error('GitHub returned an unexpected response. Your edits have been retained; try again.'); }
  } catch (error) {
    if (error.status || error.message.startsWith('GitHub')) throw error;
    throw new Error(error.name === 'AbortError' ? 'The GitHub request timed out. Your edits have been retained; check your connection and try again.' : 'Could not reach GitHub. Check your internet connection or network policy, then try again. Your edits are still here.');
  } finally {
    clearTimeout(timeout);
  }
}

function repositoryPath(details = connection) {
  return `/repos/${encodeURIComponent(details.owner)}/${encodeURIComponent(details.repo)}`;
}

function contentPath(details = connection) {
  return `${repositoryPath(details)}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(details.branch)}`;
}

async function remoteContent(details = connection, token = authToken) {
  const file = await githubRequest(contentPath(details),{},token);
  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || typeof file.sha !== 'string') throw new Error('GitHub did not return a readable assets/content.json file. Check that this branch contains the portfolio content file.');
  const data = decodeContent(file.content);
  const errors = validateContent(data);
  if (errors.length) throw new Error(`The content on GitHub needs attention: ${errors.slice(0,3).join(' ')}`);
  return { data, sha:file.sha };
}

function clearAuthentication() {
  authToken = '';
  connection = null;
  sourceSha = '';
  conflict = false;
  $('github-token').value = '';
}

function handleError(error) {
  if (error.status === 401) clearAuthentication();
  status(error.message || 'The action could not be completed. Your edits have been retained.','error');
}

$('connection-form').addEventListener('submit',async event => {
  event.preventDefault();
  if (busy || connection) return;
  const token = $('github-token').value.trim();
  const details = {
    owner:$('connection-owner').value.trim(),
    repo:$('connection-repo').value.trim(),
    branch:$('connection-branch').value.trim(),
  };
  $('github-token').value = '';
  if (!token || /\s/.test(token)) { status('Enter a valid GitHub personal access token.','error'); return; }
  if (!/^[A-Za-z0-9-]+$/.test(details.owner) || !/^[A-Za-z0-9_.-]+$/.test(details.repo) || !/^[A-Za-z0-9_./-]+$/.test(details.branch) || details.branch.includes('..') || details.branch.includes('//') || details.branch.endsWith('/') || details.branch.startsWith('/')) { status('Check the GitHub owner, repository, and branch names.','error'); return; }
  setBusy(true);
  status('Checking your repository and loading its current content…');
  try {
    const metadata = await githubRequest(repositoryPath(details),{},token);
    const remote = await remoteContent(details,token);
    details.readOnly = metadata.permissions?.push === false;
    authToken = token;
    connection = details;
    sourceSha = remote.sha;
    conflict = dirty && JSON.stringify(remote.data) !== baseline;
    if (!dirty) useContent(remote.data,{clean:true});
    if (conflict) status('Connected. GitHub contains a newer version than your starting content. Your edits are retained. Export or save your draft, then choose “Load latest from GitHub” before publishing.','error');
    else if (details.readOnly) status('Connected with read-only repository access. You can load content, but publishing requires a token and account with write access.','error');
    else status('Connected to GitHub. Your edits remain local until you choose Publish to GitHub. GitHub will verify write permission when publishing.','success');
  } catch (error) {
    clearAuthentication();
    handleError(error);
  } finally {
    setBusy(false);
  }
});

$('logout-button').addEventListener('click',() => {
  clearAuthentication();
  status('Signed out. The access token has been cleared from this tab. Your content edits remain available locally.','success');
  updateState();
});

$('content-form').addEventListener('submit',event => event.preventDefault());
$('content-form').addEventListener('input',event => {
  const input = event.target.closest('[data-path]');
  if (!input || busy || !content) return;
  const value = input.dataset.lines ? input.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean) : input.value;
  setPath(content,input.dataset.path,value);
  const record = input.closest('[data-record]');
  if (record && /\.(title|degree|name)$/.test(input.dataset.path)) {
    const heading = record.querySelector('.record-title');
    if (heading) heading.textContent = input.value || `New ${definitions[record.dataset.record].title}`;
  }
  updateState();
});

function newEntry(collection) {
  if (collection === 'skills') return {name:'New skill',category:'Tools'};
  if (collection === 'projects') return {id:`project-${Date.now().toString(36)}`,title:'New project',category:'web',type:'Web development',description:'Describe the project you built.',tags:[],image:'',source:'',demo:'',details:[]};
  if (collection === 'education') return {degree:'New qualification',institution:'',location:'',period:'',score:''};
  if (collection === 'experience') return {title:'New role',company:'',period:'',description:''};
  return {title:'New certification',issuer:'',url:''};
}

function renderCollection(collection, { focusIndex = -1 } = {}) {
  const current = $(`list-${collection}`);
  const template = document.createElement('template');
  template.innerHTML = listMarkup(collection);
  current.replaceWith(template.content.firstElementChild);
  updateState();
  if (focusIndex >= 0) {
    const record = $(`list-${collection}`).querySelector(`[data-index="${focusIndex}"][data-record]`);
    if (record?.tagName === 'DETAILS') record.open = true;
    record?.querySelector('input,textarea,select')?.focus();
  }
}

$('content-form').addEventListener('click',event => {
  if (busy || !content) return;
  const add = event.target.closest('[data-add]');
  const remove = event.target.closest('[data-remove]');
  const move = event.target.closest('[data-move]');
  const upload = event.target.closest('[data-upload]');
  if (add) {
    const collection = add.dataset.add;
    const limit = collection === 'projects' ? 50 : 100;
    if (content[collection].length >= limit) { status(`You can add up to ${limit} ${collection}.`,'error'); return; }
    content[collection].push(newEntry(collection));
    renderCollection(collection,{focusIndex:content[collection].length - 1});
    status(`Added a new ${definitions[collection].title}. Fill in the details below.`,'success');
  } else if (remove) {
    const collection = remove.dataset.remove;
    content[collection].splice(Number(remove.dataset.index),1);
    renderCollection(collection);
    status(`Removed the ${definitions[collection].title} from your draft. Published content has not changed.`);
  } else if (move) {
    const collection = move.dataset.move;
    const index = Number(move.dataset.index);
    const destination = index + Number(move.dataset.direction);
    if (destination < 0 || destination >= content[collection].length) return;
    [content[collection][index],content[collection][destination]] = [content[collection][destination],content[collection][index]];
    renderCollection(collection,{focusIndex:destination});
    status('Updated the order in your draft.');
  } else if (upload) uploadAsset(upload);
});

function saveDraft({ quiet = false } = {}) {
  if (!content || validateContent(content).length) return false;
  try {
    const savedAt = new Date().toISOString();
    localStorage.setItem(DRAFT_KEY,JSON.stringify({ savedAt, content }));
    $('draft-saved-at').textContent = `Last local save: ${new Date(savedAt).toLocaleString()}. Stored in this browser only.`;
    if (!quiet) status('Draft saved in this browser. It contains public portfolio content only; your token is never saved.','success');
    return true;
  } catch {
    if (!quiet) status('This browser could not save a local draft. Use Export JSON to keep a backup instead.','error');
    return false;
  }
}

$('save-draft').addEventListener('click',() => saveDraft());
$('load-draft').addEventListener('click',() => {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) { status('There is no saved local draft in this browser yet.'); return; }
    const data = JSON.parse(saved);
    useContent(data.content);
    status('Restored your saved local draft. Review or preview it before publishing.','success');
  } catch {
    status('The saved local draft could not be read. You can import a valid JSON backup instead.','error');
  }
});

$('export-button').addEventListener('click',() => {
  if (!content || validateContent(content).length) return;
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(content,null,2)}\n`],{type:'application/json;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `portfolio-content-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  status('Exported a JSON backup of your public portfolio content. No access token is included.','success');
});

$('import-file').addEventListener('change',async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a content JSON file smaller than 1 MB.');
    const imported = JSON.parse(await file.text());
    const data = imported.content && imported.savedAt ? imported.content : imported;
    const errors = validateContent(data);
    if (errors.length) throw new Error(`The backup is invalid: ${errors.slice(0,3).join(' ')}`);
    if (dirty) saveDraft({quiet:true});
    useContent(data);
    status('Imported the content into your local editor. Nothing has been published.','success');
  } catch (error) {
    status(error instanceof SyntaxError ? 'This file is not valid JSON. Choose an exported portfolio content backup.' : error.message,'error');
  } finally {
    event.target.value = '';
  }
});

$('preview-button').addEventListener('click',() => {
  if (!content || validateContent(content).length) return;
  try {
    sessionStorage.setItem(PREVIEW_KEY,JSON.stringify(content));
    // A fresh same-origin tab inherits this tab’s public preview data. Never
    // store the token here, or include it in any URL/window message.
    const preview = window.open('../index.html?preview=1','_blank');
    if (preview) {
      preview.opener = null;
      status('Opened a local preview in a new tab. Your public site has not changed.','success');
    } else status('The preview was blocked by your browser. Allow popups for this site, then choose Preview again.','error');
  } catch {
    status('This browser could not store preview content. Allow site storage, or export your JSON draft as a backup.','error');
  }
});

$('reload-button').addEventListener('click',async () => {
  if (!connection || busy) return;
  setBusy(true);
  status('Loading the latest content from GitHub…');
  try {
    const remote = await remoteContent();
    if (dirty && !saveDraft({quiet:true})) throw new Error('Could not back up your current edits locally. Export JSON before loading the latest GitHub content.');
    useContent(remote.data,{clean:true});
    sourceSha = remote.sha;
    conflict = false;
    status('Loaded the latest content from GitHub. Any previous unpublished edits were saved as your local draft.','success');
  } catch (error) { handleError(error); }
  finally { setBusy(false); }
});

$('publish-button').addEventListener('click',async () => {
  if (!connection || !authToken || busy || conflict || connection.readOnly || validateContent(content).length) return;
  const publication = clone(content);
  setBusy(true);
  status('Checking for changes on GitHub before publishing…');
  try {
    const latest = await remoteContent();
    if (latest.sha !== sourceSha) {
      conflict = true;
      throw new Error('Someone has changed this content on GitHub since you connected. Your edits are safe and nothing was overwritten. Export or save your draft, then load the latest GitHub content before publishing.');
    }
    status('Publishing your content as a commit to GitHub…');
    const encoded = bytesToBase64(new TextEncoder().encode(`${JSON.stringify(publication,null,2)}\n`));
    const result = await githubRequest(`${repositoryPath()}/contents/${CONTENT_PATH}`,{
      method:'PUT', body:JSON.stringify({ message:'Update portfolio content', content:encoded, sha:sourceSha, branch:connection.branch }),
    });
    if (!result.content?.sha) throw new Error('GitHub accepted the request but did not return a file revision. Load the latest content to confirm its state before publishing again.');
    sourceSha = result.content.sha;
    baseline = JSON.stringify(publication);
    conflict = false;
    lastCommit = safeUrl(result.commit?.html_url,{external:true,empty:false}) ? result.commit.html_url : '';
    status('Published to GitHub successfully. Your website will update when its configured deployment finishes.','success');
    if (lastCommit) {
      const link = document.createElement('a');
      link.href = lastCommit;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'commit-link';
      link.textContent = 'View commit ↗';
      $('admin-status').append(link);
    }
    saveDraft({quiet:true});
  } catch (error) {
    if ([409,422].includes(error.status)) conflict = true;
    handleError(error);
  } finally {
    setBusy(false);
  }
});

async function uploadAsset(button) {
  if (!connection || !authToken || busy || connection.readOnly) return;
  const path = button.dataset.upload;
  const input = $('content-form').querySelector(`[data-upload-input="${path}"]`);
  const file = input?.files[0];
  if (!file) { status('Choose a file to upload first.','error'); return; }
  const extension = file.name.split('.').pop().toLowerCase();
  const allowed = button.dataset.uploadKind === 'resume' ? ['pdf','docx'] : ['jpg','jpeg','png','webp','avif'];
  if (!allowed.includes(extension)) { status(`Choose one of these file types: ${allowed.join(', ')}.`,'error'); return; }
  if (file.size > 5 * 1024 * 1024 || file.size === 0) { status('Choose a nonempty file up to 5 MB.','error'); return; }
  setBusy(true);
  status('Uploading the file to GitHub. This creates an asset commit; content is published separately…');
  try {
    const stem = file.name.replace(/\.[^.]+$/,'').normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'portfolio';
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    const destination = `assets/uploads/${stem}-${Date.now().toString(36)}-${suffix}.${extension}`;
    const encoded = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    const result = await githubRequest(`${repositoryPath()}/contents/${destination}`,{
      method:'PUT',body:JSON.stringify({message:`Add portfolio ${button.dataset.uploadKind === 'resume' ? 'resume' : 'image'}`,content:encoded,branch:connection.branch}),
    });
    if (!result.content?.sha) throw new Error('GitHub did not confirm the asset upload. Check your repository before trying again.');
    setPath(content,path,destination);
    const fieldInput = $('content-form').querySelector(`[data-path="${path}"]`);
    if (fieldInput) fieldInput.value = destination;
    input.value = '';
    status('File uploaded to GitHub and added to your draft. Choose Publish to GitHub to make the portfolio use this new file.','success');
  } catch (error) { handleError(error); }
  finally { setBusy(false); }
}

window.addEventListener('beforeunload',event => {
  if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
});

$('lock-admin').addEventListener('click', async () => {
  if (busy) return;
  if (dirty && !saveDraft({quiet:true}) && !window.confirm('Your draft could not be saved. Lock admin and discard unsaved edits?')) return;
  clearAuthentication();
  setBusy(true);
  try {
    const response = await fetch('/api/admin-auth', { method:'POST', credentials:'same-origin', redirect:'error', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'}) });
    if (!response.ok) throw new Error('The admin session could not be locked. Try again.');
    dirty = false;
    busy = false;
    location.replace('/admin/');
  } catch (error) { status(error.message,'error'); setBusy(false); }
});
window.addEventListener('pageshow', event => { if (event.persisted) requireAdminSession().catch(() => { clearAuthentication(); }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) requireAdminSession().catch(() => { clearAuthentication(); }); });

async function initialize() {
  try {
    const response = await fetch('../assets/content.json',{cache:'no-store',redirect:'error'});
    if (!response.ok) throw new Error('Your current content file could not be loaded. Import a valid JSON backup to begin, or check assets/content.json.');
    const data = await response.json();
    useContent(data,{clean:true});
    status('Your current content is ready. Edit locally, preview, then connect GitHub when you want to publish.','success');
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (saved?.savedAt) $('draft-saved-at').textContent = `Saved local draft available from ${new Date(saved.savedAt).toLocaleString()}. Choose Restore local draft to load it.`;
    } catch { /* Corrupt or blocked storage never prevents editing. */ }
  } catch (error) {
    $('content-form').innerHTML = '<p class="loading-note">Import a valid content JSON backup or connect GitHub to load your portfolio.</p>';
    status(error.message || 'Your content could not be loaded. Import a valid JSON backup or connect GitHub.','error');
    updateState();
  }
}

initialize();
