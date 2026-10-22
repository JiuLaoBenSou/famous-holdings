// Progressive enhancement: the configured form also submits without JavaScript.
document.querySelectorAll('[data-feedback-form]').forEach(form=>{
 const page=form.querySelector('[name="pageURL"]');if(page&&!page.value)page.value=location.pathname;
 form.addEventListener('submit',async event=>{
  event.preventDefault();const status=form.querySelector('[role="status"]'),button=form.querySelector('[type="submit"]');
  if(form.dataset.feedbackMode==='unconfigured'){status.textContent='Submissions are not open yet. Your message has not been sent.';return;}
  if(!form.reportValidity())return;
  button.disabled=true;status.textContent='Sending your feedback…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{Accept:'application/json'},signal:controller.signal});const data=await response.json();if(!response.ok||!(data.id||data.ok===true))throw Error('Your message was not confirmed. Please try again.');status.textContent='Thank you. Your feedback has been received and will help us improve HoldingsAtlas.';form.reset();if(page)page.value=location.pathname;}
  catch(error){status.textContent=error.name==='AbortError'?'The request timed out. Your message has been kept here; please try again.':error.message||'Could not send your feedback. Please try again.';}
  finally{clearTimeout(timeout);button.disabled=false;}
 });
});

// Only same-origin frames belonging to this page may resize their own feedback area.
if(window.parent!==window&&document.body.classList.contains('feedback-embed-document')){
 const pageField=document.querySelector('[name="pageURL"]');try{const ref=new URL(document.referrer);if(ref.origin===location.origin&&pageField)pageField.value=ref.pathname;}catch{}
 const reportHeight=()=>parent.postMessage({type:'holdingsatlas-feedback-height',height:Math.ceil(document.body.scrollHeight)},location.origin);
 if('ResizeObserver'in window)new ResizeObserver(reportHeight).observe(document.body);reportHeight();
}else window.addEventListener('message',event=>{if(event.origin!==location.origin||event.data?.type!=='holdingsatlas-feedback-height')return;const frame=[...document.querySelectorAll('iframe.feedback-embed')].find(f=>f.contentWindow===event.source),height=Number(event.data.height);if(frame&&Number.isFinite(height)&&height>=150&&height<=2500)frame.style.height=height+'px';});
