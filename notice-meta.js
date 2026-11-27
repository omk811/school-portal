/* المحبرة — بيانات النشر والتثبيت والمواعيد متوافقة مع أعمدة قاعدة البيانات الحالية */
window.MihbaraMeta=(()=>{
'use strict';
const pattern=/\[\[MIHBARA_META:([^\]]*)\]\]/g, eventNames={homework:'واجب',exam:'اختبار',review:'مراجعة',activity:'نشاط',other:'موعد'};
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}
function read(n){const text=String(n?.det??n??'');let m={publish:0,pin:0,due:'',event:''};for(const hit of text.matchAll(pattern)){const parts=Object.fromEntries(hit[1].split(';').map(x=>x.split('=')));const date=String(parts.due||'');m={publish:Number(parts.publish)||0,pin:Number(parts.pin)||0,due:validDate(date)?date:'',event:Object.prototype.hasOwnProperty.call(eventNames,parts.event)?parts.event:''}}return m;}
const strip=s=>String(s??'').replace(pattern,'').trimEnd();
function marker(m){const fields=[];if(m.publish>0)fields.push('publish='+Math.floor(m.publish));if(m.pin>0)fields.push('pin='+Math.floor(m.pin));if(validDate(m.due||''))fields.push('due='+m.due);if(Object.prototype.hasOwnProperty.call(eventNames,m.event))fields.push('event='+m.event);return fields.length?'[[MIHBARA_META:'+fields.join(';')+']]':''}
const isVisible=(n,now=Date.now())=>read(n).publish<=now;
const pinned=(n,now=Date.now())=>isVisible(n,now)&&read(n).pin>now;
const order=(list,now=Date.now())=>list.slice().sort((a,b)=>Number(pinned(b,now))-Number(pinned(a,now)));
const omanFmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function toInput(ms){if(!ms)return '';const p=Object.fromEntries(omanFmt.formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute}
function timestamp(v){if(!v)return 0;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))return NaN;const time=Date.parse(v+':00+04:00');return Number.isFinite(time)&&toInput(time)===v?time:NaN}
function dateLabel(v){if(!validDate(v))return '';return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',weekday:'short',day:'numeric',month:'long',year:'numeric'}).format(new Date(v+'T12:00:00+04:00'))}
function timeLabel(ms){return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))}
return{read,strip,marker,isVisible,pinned,order,toInput,timestamp,dateLabel,timeLabel,eventNames};
})();