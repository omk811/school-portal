/* المحبرة — تنسيق موحد للتاريخ والوقت بتوقيت سلطنة عُمان */
window.MihbaraDate=(()=>{
'use strict';
const locale='ar-OM-u-ca-gregory-nu-arab',zone='Asia/Muscat';
const digits=v=>String(v??'').replace(/[0-9]/g,c=>'٠١٢٣٤٥٦٧٨٩'[Number(c)]);
const latin=v=>String(v??'').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
const dateFmt=new Intl.DateTimeFormat(locale,{timeZone:zone,day:'numeric',month:'long',year:'numeric'});
const weekFmt=new Intl.DateTimeFormat(locale,{timeZone:zone,weekday:'long',day:'numeric',month:'long',year:'numeric'});
const clockFmt=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function clock(hhmm){const match=latin(hhmm).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);if(!match)return digits(hhmm);const h=Number(match[1]),m=Number(match[2]);if(h>23||m>59)return digits(hhmm);return digits(String(h%12||12)+':'+String(m).padStart(2,'0'))+' '+(h<12?'ص':'م');}
const parseClock=(raw)=>{
 const match=raw.match(/(?:^|\D)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?!\d)/);
 if(!match)return null;let h=+match[1],m=+match[2],s=+(match[3]||0);
 const mer=raw.replace(/[\u064b-\u065f]/g,'').match(/(?:^|\s|[0-9])(صباحا?|ص|مساءا?|م|AM|PM)(?=\s|$|[0-9])/i);
 if(mer){const pm=/^(م|مساء|PM)/i.test(mer[1]);if(h>12){if(!pm)return null;}else{if(h<1)return null;h=h%12+(pm?12:0);}}
 if(h>23||m>59||s>59)return null;return {h,m,s};
};
function makeDate(y,m,d,h=0,min=0,s=0){if(y<1000||m<1||m>12||d<1||d>31)return null;const check=new Date(Date.UTC(y,m-1,d,h,min,s));if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;return new Date(check.getTime()-4*3600000);}
function parse(value){
 if(value instanceof Date||typeof value==='number'){const date=new Date(value);return Number.isFinite(date.getTime())?{date,hasTime:true}:null}
 const raw=latin(value);
 const iso=raw.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
 if(iso){const date=new Date(raw);return Number.isFinite(date.getTime())?{date,hasTime:true}:null;}
 const dm=raw.match(/(?:^|[^\d])(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?!\d)/)||raw.match(/(?:^|[^\d])(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?!\d)/);
 const t=parseClock(raw);
 let named=null;
 if(!dm){const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];const names=raw.match(/(?:^|\s)(\d{1,2})\s+([^\s،]+)\s+(\d{4})(?!\d)/);if(names){const mm=months.indexOf(names[2])+1;if(mm)named=[+names[3],mm,+names[1]];}}
 if(!dm&&!named){const justTime=/^(?:(?:ص|م|AM|PM)\s*)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:ص|م|AM|PM)?$/i.test(raw);return t&&justTime?{timeOnly:clock(String(t.h)+':'+String(t.m).padStart(2,'0'))}:null;}
 let y,m,d;if(named){[y,m,d]=named;}else if(dm[1].length===4){y=+dm[1];m=+dm[2];d=+dm[3];}else{y=+dm[3];d=+dm[1];m=+dm[2];if(m>12&&d<=12){[m,d]=[d,m];}}
 if(!t&&/\d{1,2}:\d{2}/.test(raw))return null;const date=makeDate(y,m,d,t?.h||0,t?.m||0,t?.s||0);return date?{date,hasTime:!!t}:null;
}
function time(value){const d=value instanceof Date?value:new Date(value);return Number.isFinite(d.getTime())?clock(clockFmt.format(d)):''}
function format(value){if(value==null||value==='')return '';const p=parse(value);if(!p)return digits(String(value));if(p.timeOnly)return p.timeOnly;return dateFmt.format(p.date)+(p.hasTime?' · '+time(p.date):'');}
function dateLabel(value,weekday=false){const p=parse(value);if(!p?.date)return '';return (weekday?weekFmt:dateFmt).format(p.date);}
function header(value){return dateLabel(value,true)+' · '+time(value);}
function range(a){return a.map(clock).join(' – ');}
function title(value){return String(value??'').replace(/(^|\s)([0-9٠-٩۰-۹]{4}[\/.-][0-9٠-٩۰-۹]{1,2}[\/.-][0-9٠-٩۰-۹]{1,2}|[0-9٠-٩۰-۹]{1,2}[\/.-][0-9٠-٩۰-۹]{1,2}[\/.-][0-9٠-٩۰-۹]{4})(?=$|\s|[،,.؛)])/g,(all,space,token)=>space+(dateLabel(token)||digits(token)));}
return{digits,latin,clock,time,format,dateLabel,header,range,parse,locale,title};
})();