'use strict';
(() => {
  const KEY = 'privychki.v1';
  const $ = id => document.getElementById(id);
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date = s => new Date(s + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0,10);
  const shift = (s,n) => {const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);};
  const monday = s => shift(s,-((date(s).getUTCDay()+6)%7));
  const pretty = s => new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'}).format(date(s));
  let week=monday(today()), habits=[], editId=null, confirmation=null, storageBroken=false;
  const message = text => {$('status').textContent=text;};
  const validDate = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(date(s)) && iso(date(s))===s;
  function validate(data) {
    if (!data || data.version!==1 || !Array.isArray(data.habits) || data.habits.length>1000) throw Error('Неизвестный формат копии. Выбери JSON, скачанный из этого приложения.');
    const ids=new Set();
    return data.habits.map(h=>{
      if (!h || typeof h.id!=='string' || !h.id || h.id.length>100 || ids.has(h.id) || typeof h.name!=='string' || !h.name.trim() || h.name.length>120 || !validDate(h.createdAt) || h.createdAt>today() || !Array.isArray(h.dates) || h.dates.length>100000 || h.dates.some(d=>!validDate(d)||d<h.createdAt||d>today())) throw Error('В копии есть некорректные привычки или даты. Данные не изменены.');
      ids.add(h.id); return {id:h.id,name:h.name.trim(),createdAt:h.createdAt,dates:[...new Set(h.dates)].sort()};
    });
  }
  function save(next) {
    if(storageBroken){message('Сохранённые данные не удалось прочитать. Скачай копию для проверки или загрузи исправную копию.');return false;}
    try{localStorage.setItem(KEY,JSON.stringify({version:1,habits:next}));habits=next;render();return true;}
    catch{message('Браузер не разрешил сохранить изменения. Освободи место или разреши хранение данных сайта. Изменение не применено.');return false;}
  }
  try{const raw=localStorage.getItem(KEY);if(raw!==null)habits=validate(JSON.parse(raw));}
  catch{storageBroken=true;message('Не удалось прочитать сохранённые данные. Они не перезаписаны. Скачай копию для проверки или загрузи исправную копию.');}
  function confirmAction(title,text,action){$('confirm-title').textContent=title;$('confirm-text').textContent=text;confirmation=action;$('confirm-dialog').showModal();$('confirm-cancel').focus();}
  $('confirm-cancel').onclick=()=>{$('confirm-dialog').close();confirmation=null;};
  $('confirm-dialog').addEventListener('cancel',()=>{confirmation=null;});
  $('confirm-ok').onclick=()=>{const action=confirmation;confirmation=null;$('confirm-dialog').close();if(action)action();};
  function render(){
    const end=shift(week,6);
    $('week-title').textContent=`${pretty(week)} – ${pretty(end)} ${end.slice(0,4)}`;
    $('habits').replaceChildren();
    if(!habits.length){const empty=document.createElement('div');empty.className='empty';const icon=document.createElement('div');icon.className='empty-icon';icon.textContent='✓';icon.setAttribute('aria-hidden','true');const title=document.createElement('h3');title.textContent='Добавьте первую привычку';const p=document.createElement('p');p.textContent='Начни с одного небольшого действия. Введи название выше и нажми «Добавить».';empty.append(icon,title,p);$('habits').append(empty);}
    for(const h of habits){
      const row=document.createElement('article');row.className='habit';row.dataset.id=h.id;
      const info=document.createElement('div'),title=document.createElement('h3'),progress=document.createElement('p'),actions=document.createElement('div');
      title.textContent=h.name;progress.className='progress';progress.textContent=`${h.dates.filter(d=>d>=week&&d<=end).length} из 7 дней`;actions.className='habit-actions';
      const edit=document.createElement('button');edit.textContent='Изменить';edit.setAttribute('aria-label',`Изменить: ${h.name}`);edit.onclick=()=>{editId=h.id;$('edit-name').value=h.name;$('edit-error').textContent='';$('edit-dialog').showModal();$('edit-name').focus();};
      const del=document.createElement('button');del.textContent='Удалить';del.setAttribute('aria-label',`Удалить: ${h.name}`);del.onclick=()=>confirmAction('Удалить привычку?',`«${h.name}» и все её отметки будут удалены.`,()=>{if(save(habits.filter(x=>x.id!==h.id)))message('Привычка удалена.');});
      actions.append(edit,del);info.append(title,progress,actions);
      const days=document.createElement('div');days.className='days';
      for(let i=0;i<7;i++){
        const d=shift(week,i),disabled=d>today()||d<h.createdAt,checked=h.dates.includes(d),cell=document.createElement('div'),label=document.createElement('span'),num=document.createElement('b'),btn=document.createElement('button');
        cell.className='day'+(d===today()?' today':'');label.className='day-label';label.textContent=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i];num.textContent=String(date(d).getUTCDate());label.append(num);
        btn.disabled=disabled;btn.textContent=checked?'✓':disabled?'·':'○';btn.setAttribute('aria-label',`${h.name}, ${pretty(d)}${disabled?', недоступно':''}`);btn.setAttribute('aria-pressed',String(checked));btn.title=disabled?(d>today()?'Этот день ещё не наступил':'Привычка ещё не была создана'):'Поставить или снять отметку';
        btn.onclick=()=>{const t=today();if(d>t||d<h.createdAt){render();return;}if(save(habits.map(x=>x.id===h.id?{...x,dates:checked?x.dates.filter(v=>v!==d):[...x.dates,d].sort()}:x)))message(checked?'Отметка снята.':'Отметка сохранена.');};cell.append(label,btn);days.append(cell);
      }
      row.append(info,days);$('habits').append(row);
    }
  }
  $('add-form').onsubmit=e=>{e.preventDefault();const name=$('habit-name').value.trim();$('add-error').textContent='';if(!name){$('add-error').textContent='Введи название привычки.';$('habit-name').focus();return;}const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;if(save([...habits,{id,name,createdAt:today(),dates:[]}])){$('habit-name').value='';message('Привычка добавлена и сохранена.');$('habit-name').focus();}};
  $('edit-form').onsubmit=e=>{e.preventDefault();const name=$('edit-name').value.trim();if(!name){$('edit-error').textContent='Введи название привычки.';return;}if(save(habits.map(h=>h.id===editId?{...h,name}:h))){$('edit-dialog').close();message('Название сохранено.');}};
  $('edit-cancel').onclick=()=>$('edit-dialog').close();
  $('prev').onclick=()=>{week=shift(week,-7);render();};$('next').onclick=()=>{week=shift(week,7);render();};$('current').onclick=()=>{week=monday(today());render();};
  $('export').onclick=()=>{try{const raw=storageBroken?localStorage.getItem(KEY):JSON.stringify({version:1,habits},null,2);if(raw===null)throw Error();const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`privychki-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);message('Копия подготовлена. Проверь файл в загрузках браузера.');}catch{message('Не удалось скачать копию. Проверь разрешения браузера.');}};
  $('import').onclick=()=>$('file').click();
  $('file').onchange=async()=>{const file=$('file').files[0];$('file').value='';if(!file)return;try{if(file.size>5*1024*1024)throw Error('Файл слишком большой. Максимум 5 МБ.');let data;try{data=JSON.parse(await file.text());}catch{throw Error('Не удалось прочитать JSON. Выбери исправную копию данных.');}const next=validate(data);confirmAction('Загрузить копию?',`В копии привычек: ${next.length}. Текущие привычки и отметки будут заменены. Сначала скачай текущую копию, если она нужна.`,()=>{const broken=storageBroken;storageBroken=false;if(save(next)){week=monday(today());render();message('Копия загружена и сохранена.');}else storageBroken=broken;});}catch(e){message(e.message);}};
  window.addEventListener('storage',e=>{if(e.key===KEY){try{habits=e.newValue===null?[]:validate(JSON.parse(e.newValue));storageBroken=false;render();message('Данные обновлены из другой вкладки.');}catch{storageBroken=true;message('Другая вкладка сохранила некорректные данные. Изменения остановлены.');}}});
  window.addEventListener('focus',()=>render());render();
})();
