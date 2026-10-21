// Progressive enhancement: the configured form also submits without JavaScript.
document.querySelectorAll('[data-feedback-form]').forEach(form=>{
 const page=form.querySelector('[name="pageURL"]');if(page&&!page.value)page.value=location.pathname;
 form.addEventListener('submit',async event=>{
  event.preventDefault();const status=form.querySelector('[role="status"]'),button=form.querySelector('[type="submit"]');
  if(form.dataset.feedbackMode==='unconfigured'){status.textContent='Submissions are not open yet. Your message has not been sent.';return;}
  if(!form.reportValidity())return;
  button.disabled=true;status.textContent='Sending your feedback…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{Accept:'application/json'},signal:controller.signal});const data=await response.json();if(!response.ok||!(data.id||data.ok===true))throw Error('Your message was not confirmed. Please try again.');status.textContent='Thank you. Your feedback has been received and will help us improve HoldAtlas.';form.reset();if(page)page.value=location.pathname;}
  catch(error){status.textContent=error.name==='AbortError'?'The request timed out. Your message has been kept here; please try again.':error.message||'Could not send your feedback. Please try again.';}
  finally{clearTimeout(timeout);button.disabled=false;}
 });
});
