import {decodeRecordsDocument} from './records-codec.mjs';
const recordsCodecVersion='codec-v1-8d966b6cb4b5';
const recordsDataVersion=document.querySelector('meta[name="records-data-version"]')?.content||recordsCodecVersion;
const base=document.querySelector('meta[name="static-base-path"]').content;
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer;function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('visible'),5000);}
const loadCitation=async url=>{const response=await fetch(url);if(!response.ok)throw Error('Published citation is unavailable.');if((response.headers.get('content-type')||'').includes('json'))return response.json();const doc=new DOMParser().parseFromString(await response.text(),'text/html'),field=doc.getElementById('citation-text');if(!field)throw Error('Published quotation is missing.');return{text:field.value};};
const loadJSON=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Published data is unavailable. Please try again.');return r.json();};
document.querySelectorAll('[data-weight]').forEach(el=>el.style.width=Math.max(0,Math.min(100,Number(el.dataset.weight)*100))+'%');
document.addEventListener('click',async event=>{
 const source=event.target.closest('[data-source]');
 if(source&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();try{const data=await loadJSON(base+'sources-data/'+encodeURIComponent(source.dataset.source)+'.json');$('#source-dialog-content').innerHTML=data.html;$('#source-dialog').showModal();}catch{location.assign(source.href);}return;}
 if(event.target.closest('.dialog-close'))$('#source-dialog').close();
 const button=event.target.closest('[data-citation],[data-copy-text]');if(!button)return;
 button.disabled=true;try{const text=button.dataset.citation?(await loadCitation(button.dataset.citation)).text:document.getElementById(button.dataset.copyText).value;try{await navigator.clipboard.writeText(text);toast('Quotation copied, including dates, attribution and sources.');}catch{const field=button.dataset.copyText&&document.getElementById(button.dataset.copyText);if(field){field.focus();field.select();toast('Text selected. Copy it manually.');}else{const fallback=button.parentElement.querySelector('a');if(fallback)location.assign(fallback.href);}}}catch(e){toast(e.message);}finally{button.disabled=false;}
});
$('#source-dialog')?.addEventListener('click',e=>{if(e.target===$('#source-dialog'))$('#source-dialog').close();});
let recordsPromise;
const recordsData=()=>recordsPromise||=(loadJSON(base+'data/records.json?v='+recordsDataVersion).then(decodeRecordsDocument));
if($('#directory-form'))import('./directory.mjs').then(module=>module.initDirectory({base,staticEdition:true})).catch(()=>{
 const status=$('#directory-progress');if(status)status.textContent='Use Load more to open the next page.';
});
const person=document.documentElement.dataset.staticPerson;
function filterHoldings(){const q=(new URLSearchParams(location.search).get('q')||'').toLowerCase();const input=$('.record-filters input[name="q"]');if(input)input.value=q;let count=0;document.querySelectorAll('.holdings-table tbody tr').forEach(row=>{row.hidden=!!q&&!row.textContent.toLowerCase().includes(q);if(!row.hidden)count++;});const label=$('.records-section .section-label span:last-child');if(label)label.textContent=count+' MATCHING RECORDS';}
if(person){filterHoldings();$('.record-filters')?.addEventListener('submit',e=>{e.preventDefault();const p=new URLSearchParams(new FormData(e.target)),period=p.get('period'),q=p.get('q')||'';location.assign(base+'people/'+encodeURIComponent(person)+'/period/'+encodeURIComponent(period)+'/'+(q?'?q='+encodeURIComponent(q):'')+'#holdings');});}
const assetForm=$('main>.depth-filters')?.querySelector('input[name="q"]')?.closest('form');
async function filterAssets(params,limit=200){
 const data=await recordsData(),q=(params.get('q')||'').trim().toLowerCase(),person=params.get('person')||'all',type=params.get('type')||'all',sources=new Map(data.sources.map(s=>[s.id,s]));
 const rows=q?data.records.filter(r=>(person==='all'||r.personId===person)&&(type==='all'||r.recordKind===type)&&[r.asset,r.symbol,r.cusip].filter(Boolean).join(' ').toLowerCase().includes(q)):[];
 const results=$('.asset-results');if(!results)return;assetForm.querySelector('[name="q"]').value=params.get('q')||'';
 $('.depth-scope').textContent=q?rows.length+' matching dated records'+(rows.length>limit?' · showing '+Math.min(rows.length,limit):''):'Enter an asset to search the published coverage.';
 results.innerHTML=rows.slice(0,limit).map(r=>`<article><div><span class="eyebrow">${esc(r.recordKind)} / ${esc(r.date)}</span><h2>${esc(r.symbol||r.asset)}</h2><p>${esc(r.asset)} · ${esc(r.cusip||'')}</p></div><div><a href="${base}people/${esc(r.personSlug)}/">${esc(r.personName)} ↗</a><p>${esc(r.entity)}<br>${esc(r.relationship)}</p><small>${r.quantity==null?'Quantity not disclosed':new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(r.quantity)+' '+esc(r.quantityUnit)}</small><small>Coverage: ${esc(r.coverage)}</small></div><div>${r.sourceIds.map(id=>`<a class="source-link" data-source="${esc(id)}" href="${base}sources/#${esc(id)}">${esc(sources.get(id)?.publisher||'Original source')} ↗</a>`).join('')}<div class="citation-controls"><button class="source-link" data-citation="${base}records/${r.id}/#quotation">Copy citation ↗</button><a class="record-permalink" href="${base}records/${r.id}/#quotation">View quotation / manual copy ↗</a></div></div></article>`).join('')||(q?'<p class="empty-state">No matching published records. This does not establish that nobody holds this asset.</p>':'');
 if(rows.length>limit){const button=document.createElement('button');button.className='button';button.textContent='Show more records ↗';button.addEventListener('click',()=>filterAssets(params,limit+200));results.append(button);}
}
if($('.asset-results')){assetForm?.addEventListener('submit',e=>{e.preventDefault();const p=new URLSearchParams(new FormData(e.target));history.replaceState(null,'','?'+p);filterAssets(p).catch(err=>toast(err.message));});filterAssets(new URLSearchParams(location.search)).catch(e=>toast(e.message));}
$('.source-filters')?.addEventListener('submit',e=>{e.preventDefault();const p=new URLSearchParams(new FormData(e.target)),q=(p.get('q')||'').toLowerCase(),type=p.get('type')||'All';document.querySelectorAll('.sources-list>.reference-card').forEach(card=>card.hidden=!!q&&!card.textContent.toLowerCase().includes(q)||type!=='All'&&!card.textContent.includes(type));history.replaceState(null,'','?'+p);});
