import {DIRECTORY_PAGE_SIZE,DIRECTORY_VIEWS,directoryParams,directoryPage,directoryHref,renderDirectoryProfile,DirectoryPager,previousDirectoryPage} from './directory-shared.mjs';
export function initDirectory({base='/',staticEdition=!!document.querySelector('meta[name="static-base-path"]')}={}) {
 const form=document.getElementById('directory-form'),results=document.getElementById('directory-results'),seedElement=document.getElementById('directory-bootstrap');
 if(!form||!results||!seedElement)return;
 const initial=JSON.parse(seedElement.textContent),list=results.querySelector('.directory-items'),progress=document.getElementById('directory-progress'),pagination=results.querySelector('.directory-pagination'),errorBox=results.querySelector('.directory-error'),sentinel=document.getElementById('directory-sentinel');
 if(!/^[a-f0-9]{20}$/.test(initial.version))throw Error('Directory version is unavailable.');
 document.documentElement.classList.add('directory-enhanced');
 let catalogPromise,autoPaused=false,searchTimer,layoutFrame,intersectionObserver,view=initial.params.view;
 const defaultQuery=p=>!p.get('q')&&p.get('category')==='All'&&p.get('asset')==='all'&&p.get('sort')==='featured';
 const cache=new Map(defaultQuery(directoryParams(initial.params))?[[initial.page,initial]]:[]);
 const json=async(url,signal)=>{const response=await fetch(url,{signal});if(!response.ok)throw Error('Could not load more people. Please try again.');return response.json();};
 async function loadPage(params,signal) {
  if(!staticEdition)return json(base+'api/directory?'+params,signal);
  if(defaultQuery(params)){
   const page=Number(params.get('page'));if(cache.has(page))return cache.get(page);
   const payload=await json(base+'directory-data/'+initial.version+'/page-'+page+'.json',signal);cache.set(page,payload);return payload;
  }
  catalogPromise??=json(base+'directory-data/'+initial.version+'/catalog.json').catch(error=>{catalogPromise=null;throw error;});
  const catalog=await catalogPromise;if(catalog.version!==initial.version)throw Error('The directory has changed. Refresh to continue.');
  return directoryPage(catalog.items,params,catalog.version);
 }
 function href(params,changes={}) {
  const target=directoryParams(params);for(const [k,v] of Object.entries(changes))target.set(k,String(v));
  if(!staticEdition)return directoryHref(target);
  const mode=target.get('view'),page=target.get('page');target.delete('view');target.delete('page');
  return base+'people/browse/'+mode+'/'+page+'/?'+target+'#directory';
 }
 function remember(mode){try{localStorage.setItem('holdingsatlas.directoryView',mode);}catch{/* Private browsing can deny storage. */}}
 function updateURL(state){const params=new URLSearchParams(state.params);params.set('page',String(state.startPage||1));history.replaceState(null,'',href(params));}
 function layout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame=requestAnimationFrame(()=>{
   if(view!=='masonry')return;
   const style=getComputedStyle(list),gap=parseFloat(style.rowGap)||20,row=parseFloat(style.gridAutoRows)||8;
   for(const item of list.children){const content=item.querySelector('.person-card-inner');const span=Math.ceil((content.getBoundingClientRect().height+gap)/(row+gap));const next='span '+span;if(item.style.gridRowEnd!==next)item.style.gridRowEnd=next;}
  });
 }
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(layout):null;
 function enhanceMasonry(){
  sizeObserver?.disconnect();list.classList.toggle('masonry-enhanced',view==='masonry'&&!!sizeObserver);
  if(view!=='masonry'){for(const item of list.children)item.style.gridRowEnd='';return;}
  if(sizeObserver){sizeObserver.observe(list);for(const inner of list.querySelectorAll('.person-card-inner'))sizeObserver.observe(inner);layout();}
 }
 function render(state,type) {
  const mode=state.params.get('view');
  if(['append','replace','view'].includes(type)) {
   const canAppend=type==='append'&&view===mode;
   const from=canAppend?list.children.length:0;
   const html=state.items.slice(from).map((p,i)=>renderDirectoryProfile(p,state.offset+from+i,mode,base,state.total)).join('');
   if(canAppend)list.insertAdjacentHTML('beforeend',html);else list.innerHTML=html;
   for(const item of list.children)item.setAttribute('aria-setsize',String(state.total));
   view=mode;results.dataset.view=mode;list.dataset.view=mode;enhanceMasonry();
   if(intersectionObserver){intersectionObserver.unobserve(sentinel);intersectionObserver.observe(sentinel);}
   if(type==='replace'||type==='view')updateURL(state);
  }
  form.elements.view.value=mode;form.elements.category.value=state.params.get('category');
  for(const link of document.querySelectorAll('[data-directory-view]')){const active=link.dataset.directoryView===mode;link.classList.toggle('is-selected',active);link.setAttribute('aria-current',String(active));link.href=href(state.params,{view:link.dataset.directoryView,page:1});}
  for(const button of form.querySelectorAll('.category-tabs button')){const active=button.value===state.params.get('category');button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
  results.querySelector('.people-table-head').hidden=mode==='masonry';results.querySelector('.directory-empty').hidden=state.total!==0;
  results.querySelector('[data-directory-total]').textContent=state.total+' '+(state.total===1?'profile':'profiles');
  list.setAttribute('aria-busy',String(state.busy));
  const shown=state.offset+state.items.length;
  progress.textContent=state.busy?(type==='loading'&&state.page?'Loading people…':'Updating selection…'):state.total?'Showing '+(state.offset+1)+'–'+shown+' of '+state.total+(state.total===1?' person':' people'):'No matching profiles';
  errorBox.hidden=!state.error;errorBox.textContent=state.error||'';
  if(state.error)autoPaused=true;
  // Keep the focused load control while appending, and remove it only at the end.
  let more=pagination.querySelector('[data-directory-more]');
  if(state.hasMore&&!more){more=document.createElement('a');more.className='button outline';more.dataset.directoryMore='';more.setAttribute('aria-controls','directory-items');pagination.append(more);}
  if(more){if(!state.hasMore)more.remove();else{more.href=href(state.params,{page:state.page+1});more.setAttribute('aria-disabled',String(state.busy));more.textContent=state.busy?'Loading…':state.error&&state.errorKind==='append'?'Try loading again ↻':'Load '+Math.min(DIRECTORY_PAGE_SIZE,state.total-shown)+' more ↓';}}
  let previous=pagination.querySelector('[data-directory-previous]');
  if(state.offset>0){if(!previous){previous=document.createElement('a');previous.dataset.directoryPrevious='';previous.className='text-link';previous.textContent='← Previous page';pagination.prepend(previous);}previous.href=href(state.params,{page:previousDirectoryPage(state)});}else previous?.remove();
  results.querySelector('.directory-load-note').textContent=state.hasMore?'More people appear as you scroll. You can also use Load more.':state.total?'You’ve reached the end of this selection.':'';
 }
 const pager=new DirectoryPager({initial,loadPage,onChange:render});
 render(pager.state,'initial');enhanceMasonry();
 const url=new URL(location.href),requested=new URLSearchParams(url.search),path=url.pathname.match(/\/people\/browse\/(compact|detailed|masonry)\/(\d+)\/?$/);
 if(path){requested.set('view',path[1]);requested.set('page',path[2]);}
 if(!requested.has('view')){try{const saved=localStorage.getItem('holdingsatlas.directoryView');if(DIRECTORY_VIEWS.includes(saved))requested.set('view',saved);}catch{}}
 const desired=directoryParams(requested),current=directoryParams(initial.params);
 form.elements.q.value=desired.get('q');form.elements.asset.value=desired.get('asset');form.elements.sort.value=desired.get('sort');
 if(['q','category','asset','sort','page'].some(k=>desired.get(k)!==current.get(k))){pager.setView(desired.get('view'));pager.request(desired,false);}else if(desired.get('view')!==view)pager.setView(desired.get('view'));
 document.querySelector('.directory-view-switch').addEventListener('click',event=>{const link=event.target.closest('[data-directory-view]');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();pager.setView(link.dataset.directoryView);remember(link.dataset.directoryView);});
 async function search(submitter){clearTimeout(searchTimer);autoPaused=false;const params=new URLSearchParams(new FormData(form));if(submitter?.name==='chooseCategory')params.set('category',submitter.value);params.delete('chooseCategory');params.set('view',pager.state.params.get('view'));await pager.search(params);}
 form.addEventListener('submit',event=>{event.preventDefault();search(event.submitter);});
 form.querySelector('input[type="search"]').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(),220);});
 form.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>search()));
 pagination.addEventListener('click',event=>{const more=event.target.closest('[data-directory-more]');if(!more||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();autoPaused=false;pager.more();});
 if(typeof IntersectionObserver==='function'){intersectionObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)&&!autoPaused)pager.more();},{rootMargin:'500px 0px'});intersectionObserver.observe(sentinel);}
 if(staticEdition)window.addEventListener('popstate',()=>location.reload());
 return pager;
}
