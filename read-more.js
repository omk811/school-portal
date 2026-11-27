/* المحبرة — اختصار النصوص الطويلة مع الاحتفاظ بالنص الأصلي */
window.MihbaraReadMore=(()=>{
'use strict';
const expanded=new Set();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function preview(value){
  const text=String(value??'').trim(),chars=Array.from(text),lines=text.split(/\r?\n/);
  if(chars.length<=210&&lines.length<=4)return null;
  let short=Array.from(lines.slice(0,4).join('\n')).slice(0,210).join('');
  if(short.length<text.length&&!/\s$/.test(short)){
    const cut=short.search(/\s+\S*$/);
    if(cut>short.length*.65)short=short.slice(0,cut);
  }
  return short.trimEnd()+'…';
}
function render(value,key,cls,format){
  const text=String(value??'').trim();if(!text)return '';
  const short=preview(text),full=format(text);
  if(short===null)return '<div class="'+escape(cls)+'">'+full+'</div>';
  const id='mhtext-'+String(key).replace(/[^a-zA-Z0-9_-]/g,'_');
  const open=expanded.has(id);
  return '<div class="mh-readmore" data-readmore-key="'+id+'"><div class="'+escape(cls)+' mh-text-preview"'+(open?' hidden':'')+'>'+escape(short)+'</div><div class="'+escape(cls)+' mh-text-full" id="'+id+'"'+(open?'':' hidden')+'>'+full+'</div><button type="button" class="mh-readmore-btn" aria-controls="'+id+'" aria-expanded="'+open+'">'+(open?'عرض أقل ↑':'قراءة النص كاملًا ↓')+'</button></div>';
}
document.addEventListener('click',event=>{
  const b=event.target.closest('.mh-readmore-btn');if(!b)return;
  const wrap=b.closest('.mh-readmore'),full=wrap?.querySelector('.mh-text-full'),short=wrap?.querySelector('.mh-text-preview');
  if(!full||!short)return;
  const open=b.getAttribute('aria-expanded')!=='true',key=wrap.dataset.readmoreKey;
  full.hidden=!open;short.hidden=open;b.setAttribute('aria-expanded',String(open));b.textContent=open?'عرض أقل ↑':'قراءة النص كاملًا ↓';
  if(open)expanded.add(key);else{expanded.delete(key);if(b.getBoundingClientRect().top<0)b.scrollIntoView({block:'nearest',behavior:'instant'});}
});
return {render,preview};
})();