// Codex, 2026-10-25. Shared server/static/browser directory contract.
export const DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_VIEWS = ['compact', 'detailed', 'masonry'];
export const previousDirectoryPage = state => Math.max(1, (state.page || 1) - 1);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function directoryParams(input = new URLSearchParams()) {
  const source = input instanceof URLSearchParams ? input : new URLSearchParams(input);
  const params = new URLSearchParams();
  params.set('q', (source.get('q') || '').trim().slice(0, 200));
  const category = source.get('chooseCategory') || source.get('category') || 'All';
  params.set('category', ['All','Investor','Creator','Entertainer','Athlete','Entrepreneur','Politician'].includes(category) ? category : 'All');
  params.set('asset', ['stocks','crypto','private-investment'].includes(source.get('asset')) ? source.get('asset') : 'all');
  params.set('sort', ['name','date'].includes(source.get('sort')) ? source.get('sort') : 'featured');
  params.set('view', DIRECTORY_VIEWS.includes(source.get('view')) ? source.get('view') : 'compact');
  const page = Number(source.get('page'));
  params.set('page', String(Number.isSafeInteger(page) && page > 0 && page <= 1000000 ? page : 1));
  return params;
}
export function selectDirectoryProfiles(profiles, input) {
  const params = directoryParams(input), q = params.get('q').toLowerCase();
  const rows = profiles.filter(p => (!q || p.search.includes(q)) && (params.get('category') === 'All' || p.category === params.get('category')) && (params.get('asset') === 'all' || p.assets.includes(params.get('asset'))));
  const sort = params.get('sort');
  return rows.sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'date' ? (b.latest || '').localeCompare(a.latest || '') || a.priority-b.priority : a.priority-b.priority);
}
export function directoryPage(profiles, input, version) {
  const params = directoryParams(input), rows = selectDirectoryProfiles(profiles, params);
  const page = Math.min(Number(params.get('page')), Math.max(1, Math.ceil(rows.length / DIRECTORY_PAGE_SIZE)));
  params.set('page', String(page));
  const offset = (page-1)*DIRECTORY_PAGE_SIZE, items = rows.slice(offset, offset+DIRECTORY_PAGE_SIZE).map(({search,...profile})=>profile);
  return {version, page, pageSize:DIRECTORY_PAGE_SIZE, total:rows.length, offset, items, hasMore:offset+items.length<rows.length, params:Object.fromEntries(params)};
}
export function directoryHref(input, changes = {}) {
  const params = directoryParams(input);
  for (const [key,value] of Object.entries(changes)) params.set(key,String(value));
  return '/people?' + params + '#directory';
}
export function directoryPortrait(profile, base = '/') {
  const p = profile.photo;
  if (p && /^\/portraits\/[a-z0-9-]+\.(jpg|jpeg|png|webp|avif)$/.test(p.path)) {
    const src = base + p.path.slice(1);
    const image = `<img class="${p.cropStyle ? 'portrait-crop-image' : 'portrait'}"${p.cropStyle ? ` style="${escapeHTML(p.cropStyle)}"` : ''} src="${escapeHTML(src)}" alt="${escapeHTML(profile.name)}" width="320" height="384" loading="lazy" decoding="async">`;
    return p.cropStyle ? `<span class="portrait portrait-cropped">${image}</span>` : image;
  }
  return `<span class="portrait portrait-missing" aria-label="Portrait pending">${escapeHTML(profile.name.split(' ').map(s=>s[0]).slice(0,2).join(''))}<small>PHOTO PENDING</small></span>`;
}
export function renderDirectoryProfile(p, index, view = 'compact', base = '/', total) {
  const href = base+'people/'+encodeURIComponent(p.slug)+(base==='/'?'':'/');
  const date = p.latest ? new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(p.latest+'T00:00:00Z')) : 'Not disclosed';
  return `<article class="person-row" data-profile-id="${escapeHTML(p.id)}" role="listitem" aria-posinset="${index+1}"${total!=null?` aria-setsize="${total}"`:''}><div class="person-card-inner"><span class="row-number">${String(index+1).padStart(2,'0')}</span><a class="person-identity" href="${escapeHTML(href)}">${view==='compact'?'':directoryPortrait(p,base)}<span><span class="eyebrow">${escapeHTML(p.category)}</span><h3>${escapeHTML(p.name)}</h3>${view==='compact'?'':`<span class="bio-short">${escapeHTML(p.bio)}</span>`}</span></a><div class="person-coverage"><strong>${escapeHTML(p.entity)}</strong><span>${p.recordCount} sourced ${p.recordCount===1?'record':'records'} · ${escapeHTML(p.assetLabel)}</span><small>${escapeHTML(p.scope)}</small></div><div class="person-date"><time${p.latest?` datetime="${escapeHTML(p.latest)}"`:''}>${date}</time><small>Latest record date</small></div><a class="source-count" href="${escapeHTML(href)}#references">${p.sourceCount} source${p.sourceCount===1?'':'s'} <span aria-hidden="true">↗</span></a><span class="person-arrow" aria-hidden="true">↗</span></div></article>`;
}

// A single in-flight append; filter changes cancel and invalidate older responses.
export class DirectoryPager {
  constructor({initial,loadPage,onChange=()=>{}}) {
    this.state={...initial,startPage:initial.page,params:directoryParams(initial.params),items:[...initial.items],busy:false,error:null,errorKind:null};
    this.loadPage=loadPage;this.onChange=onChange;this.sequence=0;
  }
  setView(view) {
    if (!DIRECTORY_VIEWS.includes(view)) return;
    this.state.params.set('view',view);this.emit('view');
  }
  emit(type) { this.onChange(this.state,type); }
  async more() {
    if (this.state.busy || !this.state.hasMore) return;
    const params=new URLSearchParams(this.state.params);params.set('page',String(this.state.page+1));
    return this.request(params,true);
  }
  async search(input) { const params=directoryParams(input);params.set('page','1');return this.request(params,false); }
  async request(params,append) {
    this.controller?.abort();const controller=new AbortController();this.controller=controller;const sequence=++this.sequence;
    const viewAtStart=this.state.params.get('view');
    this.state.busy=true;this.state.error=null;this.state.errorKind=null;this.emit('loading');
    try {
      const result=await this.loadPage(params,controller.signal);
      if (sequence!==this.sequence) return;
      if (!Array.isArray(result.items) || result.items.length>DIRECTORY_PAGE_SIZE || !Number.isInteger(result.total) || result.total<0 || typeof result.version!=='string') throw Error('Directory data is unavailable. Please try again.');
      if (append && (result.version!==this.state.version || result.page!==this.state.page+1)) throw Error('The directory has changed. Refresh this page to continue.');
      const ids=new Set(append?this.state.items.map(p=>p.id):[]);
      for (const item of result.items) {if(ids.has(item.id))throw Error('Directory data is inconsistent. Please refresh.');ids.add(item.id);}
      // A view switch made while a request is pending remains selected.
      if(this.state.params.get('view')!==viewAtStart)params.set('view',this.state.params.get('view'));
      this.state={...this.state,...result,startPage:append?this.state.startPage:result.page,offset:append?this.state.offset:result.offset,params:directoryParams({...Object.fromEntries(params),page:result.page}),items:append?[...this.state.items,...result.items]:result.items,busy:false,error:null};
      this.emit(append?'append':'replace');
    } catch(error) {
      if(sequence!==this.sequence)return;
      this.state.busy=false;this.state.error=error.name==='AbortError'?null:append?error.message:'Could not update this selection. Press Search to try again.';this.state.errorKind=this.state.error?(append?'append':'search'):null;this.emit('error');
    }
  }
}
