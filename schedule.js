/* محبرة | جدول الشعب الثلاث من النسخة المعتمدة في مشروع سعد، للعرض فقط */
(() => {
'use strict';
const data=window.MIHBARA_TIMETABLE;
const PERIODS=[['07:35','08:15'],['08:20','09:00'],['09:05','09:45'],['09:50','10:30'],['10:55','11:35'],['11:40','12:20'],['12:25','13:05'],['13:10','13:50']];
const DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const CLASSES={'5A':'خامس ١','5B':'خامس ٢','5C':'خامس ٣'},groups={'5A':'5/1','5B':'5/2','5C':'5/3'},codes={'5A':'1/5','5B':'2/5','5C':'3/5'};
const ENDPOINT='https://script.google.com/macros/s/AKfycbxaE54AYPy3XPTl7JUUw_nVEjA466BJqwZvwHfwPObBAxUuP_tfSZWgmbbne2xMsnxh/exec';
const min=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),name=n=>n==='خليل عربي'?'الأستاذ خليل البلوشي':n;
const omanClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

function omanNow(date=new Date()){const p=Object.fromEntries(omanClock.formatToParts(date).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,weekday:new Date(p.year+'-'+p.month+'-'+p.day+'T12:00:00Z').getUTCDay()}}
function phase(now){const t=min(now.time);if(now.date<'2026-11-01'||now.date>'2027-03-25')return {kind:'unavailable',label:'خارج فترة التوقيت الشتوي المعتمد'};
if(now.weekday>4)return {kind:'weekend',label:'عطلة نهاية الأسبوع'};
const index=PERIODS.findIndex(([a,b])=>t>=min(a)&&t<min(b));if(index>=0)return {kind:'lesson',label:'الحصة '+MihbaraDate.digits(index+1)+' الآن',index,ends:PERIODS[index][1],remaining:min(PERIODS[index][1])-t};
if(t>=min('10:30')&&t<min('10:55'))return {kind:'recess',label:'الفسحة · '+MihbaraDate.range(['10:30','10:55'])};
if(t<min('07:20'))return {kind:'before',label:'قبل بداية الدوام'};
if(t<min('07:35'))return {kind:'assembly',label:'الطابور الصباحي · '+MihbaraDate.range(['07:20','07:35'])};
if(t>=min('13:50'))return {kind:'finished',label:'انتهى الدوام الدراسي'};
return {kind:'transition',label:'الفترة بين الحصص'};}
function effective(base,changes,group){const rows=base.map(x=>x.slice());for(const ch of changes){if(!ch||ch.type!=='swap'||ch.group!==group)continue;for(const [slot,teacher] of [[ch.first,ch.afterFirst],[ch.second,ch.afterSecond]]){if(Number.isInteger(Number(slot))&&Number(slot)>=1&&Number(slot)<=8&&typeof teacher==='string'&&teacher.trim())rows[Number(slot)-1]=[teacher.trim()]}}return rows}
const root=document.getElementById('mihSchedule');if(!root)return;
const $=id=>root.querySelector('#'+id), el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
if(!data?.classes){$('mhStatus').hidden=false;$('mhStatus').textContent='تعذر تحميل بيانات الجدول الدراسي.';return}
let chosen='all',weekClass='5A',view='day',dayPick='',active=false,changesDate='',changes={},changeState={},subjects={},subjectState='idle',lastSync=0,pending=false,lastSignature='';
const normalizeName=v=>String(v??'').normalize('NFKC').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const normalizeCode=v=>String(v??'').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s+/g,'');
function canonicalSubject(v){const s=String(v??'').trim();return ({'الاسلامية':'التربية الإسلامية','الإسلامية':'التربية الإسلامية','اللغة الانجليزية':'اللغة الإنجليزية','الاجتماعيات':'الدراسات الاجتماعية','موسيقى':'المهارات الموسيقية'})[s]||s;}
function lookup(map,n,key){const record=map[n]||map[Object.keys(map).find(k=>normalizeName(k)===normalizeName(n))]||{};const code=codes[key];return canonicalSubject(record[code]||record[Object.keys(record).find(k=>normalizeCode(k)===code)]||'');}
function material(n,key){if(n==='خليل عربي'||n==='الأستاذ خليل البلوشي')return 'اللغة العربية';return lookup(subjects,n,key)||lookup(data.subjects||{},n,key)||'المادة غير محددة';}
function lessonLabel(teachers,key,cls=''){const wrap=el('div','mh-lesson-pair '+cls);if(!teachers.length){wrap.textContent='لا حصة مسجّلة';return wrap;}for(const n of teachers){const item=el('div','mh-pair');item.append(el('strong','mh-subject',material(n,key)),el('span','mh-teacher-name',name(n)));wrap.append(item)}return wrap;}
function lessonRows(key,day,now){const base=data.classes[key]?.[day]||Array.from({length:8},()=>[]);return day===DAYS[now.weekday]&&changesDate===now.date?effective(base,changes[key]||[],groups[key]):base}
function nextIdx(now,rows){if(now.weekday>4||now.date<'2026-11-01'||now.date>'2027-03-25')return -1;return PERIODS.findIndex(([start],i)=>min(start)>min(now.time)&&rows[i].length)}
function markOwn(node,names){if(names.includes('خليل عربي')||names.includes('الأستاذ خليل البلوشي'))node.classList.add('mh-own')}
function renderCurrent(now,p){const cards=Object.keys(CLASSES).filter(k=>chosen==='all'||k===chosen);const fragment=document.createDocumentFragment();if(['weekend','finished','unavailable'].includes(p.kind)){$('mhLive').replaceChildren(fragment);return}for(const k of cards){const card=el('article','mh-live-card');const day=DAYS[now.weekday],rows=lessonRows(k,day,now);card.append(el('div','mh-class',CLASSES[k]));if(p.kind==='lesson'){const ns=rows[p.index];markOwn(card,ns);card.append(lessonLabel(ns,k,'mh-live-name'),el('div','mh-time',MihbaraDate.range(PERIODS[p.index])),el('small','mh-remaining','متبقٍّ '+MihbaraDate.digits(p.remaining)+' د'));}else{card.append(el('strong','mh-live-name',p.label));}
const next=nextIdx(now,rows);if(next>=0){const upcoming=el('div','mh-next');upcoming.append(el('small','','التالية: الحصة '+MihbaraDate.digits(next+1)+' · '+MihbaraDate.clock(PERIODS[next][0])),lessonLabel(rows[next],k));card.append(upcoming)}fragment.append(card)}$('mhLive').replaceChildren(fragment)}
function row(key,day,now){return lessonRows(key,day,now)}
function renderTable(now,p){const key=weekClass;const target=$('mhTable');target.replaceChildren();$('mhDayWrap').hidden=view==='week';$('mhDay').value=dayPick; $('mhClass').value=key;
if(view==='day'){const day=dayPick||data.days[0],rows=row(key,day,now);const list=el('div','mh-day-list');for(let i=0;i<8;i++){const item=el('div','mh-slot');markOwn(item,rows[i]);if(day===DAYS[now.weekday]&&p.index===i)item.classList.add('mh-current');item.append(el('span','mh-num',MihbaraDate.digits(i+1)),lessonLabel(rows[i],key,'mh-slot-label'),el('bdi','mh-time',MihbaraDate.range(PERIODS[i])));list.append(item);if(i===3)list.append(el('div','mh-break','الفسحة · '+MihbaraDate.range(['10:30','10:55'])))}target.append(list)}
else{target.append(weeklyTable(key,now,p))}
}
function weeklyTable(key,now,p){const table=el('table','mh-week'),head=el('thead'),tr=el('tr');tr.append(el('th','','اليوم'));PERIODS.forEach((times,i)=>{const th=el('th','','الحصة '+MihbaraDate.digits(i+1));th.append(el('bdi','mh-time',MihbaraDate.range(times)));tr.append(th)});head.append(tr);table.append(head);const body=el('tbody');for(const day of data.days){const line=el('tr'),th=el('th','',day);th.scope='row';line.append(th);const rows=row(key,day,now);rows.forEach((ns,i)=>{const cell=el('td');cell.append(lessonLabel(ns,key));markOwn(cell,ns);if(day===DAYS[now.weekday]&&p.index===i)cell.classList.add('mh-current');line.append(cell)});body.append(line)}table.append(body);return table}
function printSchedule(){
 const old=document.getElementById('mhPrintSheet');if(old)old.remove();
 const sheet=el('section','mh-print-sheet');sheet.id='mhPrintSheet';
 const now=omanNow(),p=phase(now),title=el('h1','','الجدول الدراسي الأسبوعي — '+CLASSES[weekClass]);
 sheet.append(el('p','mh-print-brand','المحبرة · الأستاذ خليل البلوشي'),title,weeklyTable(weekClass,now,p),el('p','mh-print-foot','سلطنة عُمان · مدرسة سعد بن معاذ للتعليم الأساسي'));
 const style=el('style');style.textContent='@page { size: A4 landscape; margin: 9mm; }';sheet.append(style);
 document.body.append(sheet);document.body.classList.add('mh-print-schedule');
 const clean=()=>{document.body.classList.remove('mh-print-schedule');sheet.remove();};
 window.addEventListener('afterprint',clean,{once:true});window.print();
}
function render(force=false){if(!active)return;const now=omanNow(),p=phase(now);if(!dayPick)dayPick=now.weekday<5?DAYS[now.weekday]:DAYS[0];$('mhClock').textContent=MihbaraDate.clock(now.time);$('mhDate').textContent=MihbaraDate.dateLabel(now.date,true)+' · توقيت عُمان';$('mhPhase').textContent=p.label;root.dataset.phase=p.kind;
const sig=JSON.stringify([now,chosen,weekClass,view,dayPick,changesDate,changes,changeState,subjectState]);if(!force&&sig===lastSignature)return;lastSignature=sig;renderCurrent(now,p);renderTable(now,p);const keys=chosen==='all'?Object.keys(CLASSES):[chosen];const relevant=[...new Set([...keys,weekClass])];const failed=now.weekday<5&&p.kind!=='unavailable'&&changesDate===now.date&&relevant.some(k=>changeState[k]==='failed');const status=$('mhStatus');status.hidden=!failed;status.textContent=failed?'تعذّر تحديث تغييرات اليوم.':'';status.classList.toggle('mh-warning',failed);
const publicNotes=(changesDate===now.date?relevant.flatMap(k=>(changes[k]||[]).filter(c=>c.type==='note'&&typeof c.text==='string').map(c=>CLASSES[k]+': '+c.text)):[]);$('mhChanges').replaceChildren(...publicNotes.map(n=>el('li','',n)));$('mhChanges').hidden=!publicNotes.length;}
async function get(q){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);try{const response=await fetch(ENDPOINT+'?'+new URLSearchParams(q),{cache:'no-store',signal:ctrl.signal});if(!response.ok)throw Error('http');const d=await response.json();if(d.ok!==true)throw Error('api');return d}finally{clearTimeout(timer)}}
async function refresh(force=false){if(!active||pending)return;const now=omanNow();if(!force&&Date.now()-lastSync<120000&&changesDate===now.date)return;pending=true;lastSync=Date.now();$('mhRefresh').disabled=true;if(changesDate!==now.date){changesDate=now.date;changes={};changeState={}}const jobs=[];if(now.weekday<5&&phase(now).kind!=='unavailable'){const keys=Object.keys(CLASSES);for(const k of keys){jobs.push(get({action:'schoolChangesPublic',date:now.date,group:groups[k]}).then(d=>{if(d.date!==now.date||!Array.isArray(d.changes))throw Error('data');changes[k]=d.changes.filter(c=>c.group===groups[k]);changeState[k]='ok'}).catch(()=>{changeState[k]='failed';delete changes[k]}))}}
if(subjectState!=='ok'||force){jobs.push(get({action:'subjects'}).then(d=>{if(!d.subjects||typeof d.subjects!=='object')throw Error('data');const projected={};for(const [n,r] of Object.entries(d.subjects)){if(!r||typeof r!=='object')continue;for(const [raw,value] of Object.entries(r)){const code=normalizeCode(raw);if(Object.values(codes).includes(code)&&typeof value==='string'&&value.trim()){(projected[n]||={})[code]=value.trim()}}}subjects=projected;subjectState='ok'}).catch(()=>{subjectState='failed'}))}
render(true);await Promise.allSettled(jobs);pending=false;$('mhRefresh').disabled=false;render(true)}
function selectClass(k){chosen=Object.prototype.hasOwnProperty.call(CLASSES,k)?k:'all';if(chosen!=='all')weekClass=chosen;render(true)}
function activate(){if(active)return;active=true;render(true);refresh(true)}
function deactivate(){active=false}
$('mhClass').addEventListener('change',e=>{weekClass=e.target.value;render(true)});$('mhDay').addEventListener('change',e=>{dayPick=e.target.value;render(true)});$('mhView').addEventListener('change',e=>{view=e.target.value;render(true)});$('mhRefresh').addEventListener('click',()=>refresh(true));$('mhPrint')?.addEventListener('click',printSchedule);
window.MihbaraSchedule={selectClass,activate,deactivate,refresh,open(){ $('mhDetails').open=true; }};
setInterval(()=>{if(active&&!document.hidden){render();refresh()}},15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active){render(true);refresh()}});
if(root.dataset.mode==='public')activate();
})();
