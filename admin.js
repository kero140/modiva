import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {getFirestore,collection,getDocs,getDoc,doc,setDoc,deleteDoc} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

const CFG=window.FIREBASE_CONFIG,OWNER=window.OWNER_EMAIL;
const app=initializeApp(CFG),auth=getAuth(app),db=getFirestore(app);
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const im=x=>!x?'':/^(data:|https?:|\/)/.test(x)?x:x+'.jpg';
const fmt=n=>Number(n||0).toLocaleString('en-US');
const S={user:null,tab:'list',products:[],site:null,f:{q:'',cat:'',st:''},sel:new Set(),ed:null,step:1,busy:false};
const DEF_CATS=(window.CATS||[]).map(c=>({id:c.id,ar:c.ar,en:c.en}));
const PRESETS=[['ملابس XS-XXL',['XS','S','M','L','XL','XXL']],['ملابس S-XL',['S','M','L','XL']],['أحذية 38-45',['38','39','40','41','42','43','44','45']],['أحذية 36-41 (حريمي)',['36','37','38','39','40','41']],['بنطلون 28-38',['28','30','32','34','36','38']],['حزام 85-100',['85','90','95','100']],['مقاس واحد',['One size']]];
const SWATCH=['#111111','#ffffff','#f1ece4','#9a9a9a','#2f4a66','#3f5a3a','#6d0f1e','#b5793b','#d9cbb0','#e8a2b4'];
const TAGS=[['','بدون'],['new','جديد'],['best','الأكثر مبيعاً'],['limited','محدود']];

function toast(m,bad){const e=$('#ts');e.textContent=m;e.className='toast on'+(bad?' bad':'');clearTimeout(toast.t);toast.t=setTimeout(()=>e.className='toast',2600)}
function modal(html){const o=document.createElement('div');o.className='ov';o.innerHTML='<div class="box">'+html+'</div>';document.body.appendChild(o);return o}
function ask(msg,ok='تأكيد',danger){return new Promise(r=>{const o=modal(`<p style="margin:0 0 18px;font-size:16px">${msg}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-n>إلغاء</button><button class="btn ${danger?'r':'d'}" data-y>${ok}</button></div>`);o.onclick=e=>{if(e.target.dataset.y!==undefined){o.remove();r(true)}else if(e.target.dataset.n!==undefined||e.target===o){o.remove();r(false)}}})}
function busy(on,msg){let b=$('#busy');if(on){if(!b){b=document.createElement('div');b.id='busy';b.className='ov';b.style.zIndex=99;document.body.appendChild(b)}b.innerHTML=`<div class="box" style="text-align:center">${esc(msg||'جاري الحفظ...')}</div>`}else if(b)b.remove()}

/* ---------- image helpers ---------- */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function shrink(file,max,q){const url=URL.createObjectURL(file);try{const i=await loadImg(url);const k=Math.min(1,max/Math.max(i.width,i.height)),w=Math.round(i.width*k),h=Math.round(i.height*k),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(i,0,0,w,h);return c.toDataURL('image/jpeg',q)}finally{URL.revokeObjectURL(url)}}
async function shrinkData(d,max,q){const i=await loadImg(d),k=Math.min(1,max/Math.max(i.width,i.height)),w=Math.round(i.width*k),h=Math.round(i.height*k),c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(i,0,0,w,h);return c.toDataURL('image/jpeg',q)}
const kb=d=>Math.round(d.length*.75/1024);

/* ---------- data ---------- */
const colToMap=c=>Array.isArray(c)?{h:c[0],a:c[1]||'',e:c[2]||'',i:c[3]||''}:c;
async function loadAll(){
  const [ps,sd]=await Promise.all([getDocs(collection(db,'products')),getDoc(doc(db,'settings','site'))]);
  S.products=ps.docs.map(d=>d.data()).sort((a,b)=>(a.order||0)-(b.order||0));
  S.site=sd.exists()?sd.data():null;
}
const live=()=>S.products.filter(p=>!p.trash);
const trashed=()=>S.products.filter(p=>p.trash);
const cats=()=>(S.site&&S.site.cats)||DEF_CATS;
const catName=id=>(cats().find(c=>c.id===id)||{}).ar||id;
const nextId=()=>S.products.reduce((m,p)=>Math.max(m,+p.id||0),0)+1;
const clean=o=>JSON.parse(JSON.stringify(o,(k,v)=>v===undefined?null:v));
const saveProduct=p=>setDoc(doc(db,'products',String(p.id)),clean(p));
const saveSite=async patch=>{S.site=Object.assign({},S.site||{},patch);await setDoc(doc(db,'settings','site'),clean(S.site))};
function dispPrice(p){if(p.disc&&p.disc.pct>0&&(!p.disc.end||new Date(p.disc.end)>new Date()))return{price:Math.round(p.price*(1-p.disc.pct/100)),old:p.price,tmp:true};return{price:p.price,old:p.old}}

async function seed(){
  busy(true,'جاري نسخ منتجات العرض...');
  try{
    const st=window.STORE,ps=window.PRODUCTS;
    for(let i=0;i<ps.length;i++){const p=ps[i],o={id:p.id,ar:p.ar,en:p.en,cat:p.cat,tag:p.tag||'',featured:p.featured||0,price:p.price,sizes:p.sizes,out:p.out||[],img:p.img,colors:p.colors.map(colToMap),pair:p.pair||[],order:(i+1)*10,sample:true,hidden:false,draft:false,trash:false,ng:0};if(p.old)o.old=p.old;await saveProduct(o)}
    await saveSite({seeded:true,cats:DEF_CATS,wa:st.wa,drop:st.drop,dropAr:st.dropAr,dropEn:st.dropEn,dropOn:true,sampleReviews:true,msgAr:'طلب جديد من موديفا:',msgEn:'New MODIVA order:',tx:{ar:{},en:{}}});
    await loadAll();toast('تم. منتجات العرض اتنسخت.');
  }catch(e){console.error(e);toast('حصل خطأ: '+e.message,true)}
  busy(false);render();
}

/* ---------- shell ---------- */
function render(){
  const a=$('#app');
  if(!S.user){a.innerHTML=`<div class="login"><div class="card"><h1>MODIVA</h1><p style="color:var(--mut);margin:0 0 22px">لوحة إدارة المتجر</p><button class="btn d" id="gl" style="width:100%">الدخول بحساب جوجل</button><p class="hint" style="margin-top:16px">الدخول للمالك فقط. مفيش كلمة سر تتكتب هنا.</p><p class="hint" id="lerr" style="color:var(--bad)">${esc(S.err||'')}</p></div></div>`;return}
  if(!S.site||!S.site.seeded){a.innerHTML=shell(`<div class="card" style="text-align:center;padding:34px 20px"><h3>أهلاً بيك في لوحة موديفا</h3><p class="hint">المتجر دلوقتي شغال بمنتجات العرض. اضغط الزر لنقلها للوحة، وتقدر تعدّل عليها أو تمسحها وتضيف منتجاتك.</p><button class="btn d" id="seed">انقل منتجات العرض (${(window.PRODUCTS||[]).length})</button></div>`);return}
  a.innerHTML=shell(S.tab==='list'?vList():S.tab==='set'?vSettings():S.tab==='trash'?vTrash():vBackup());
  if(S.ed)drawEditor();
}
function shell(body){
  const tr=trashed().length;
  return `<div class="top"><b class="lg">MODIVA</b><span class="sp"></span><small>${esc(S.user.email)}</small><a class="btn s" href="./" target="_blank" rel="noopener">عرض المتجر</a><button class="btn s" id="out">خروج</button></div>
<div class="nav">${[['list','المنتجات'],['add','+ منتج جديد'],['set','الإعدادات'],['trash','المحذوفات'+(tr?' ('+tr+')':'')],['bk','النسخ الاحتياطي']].map(t=>`<button data-tab="${t[0]}" class="${S.tab===t[0]?'on':''}">${t[1]}</button>`).join('')}</div><main>${body}</main>`;
}

/* ---------- product list ---------- */
function filtered(){
  const f=S.f,q=f.q.trim().toLowerCase();
  return live().filter(p=>(!q||((p.ar||'')+(p.en||'')).toLowerCase().includes(q))&&(!f.cat||p.cat===f.cat)&&(!f.st||(f.st==='shown'&&!p.hidden&&!p.draft)||(f.st==='hidden'&&p.hidden)||(f.st==='draft'&&p.draft)||(f.st==='out'&&(p.out||[]).length)||(f.st==='sale'&&((p.disc&&p.disc.pct)||p.old))||(f.st==='sample'&&p.sample)));
}
function vList(){
  const all=live(),l=filtered(),smp=all.filter(p=>p.sample).length;
  const stat=`<div class="stats"><div><b>${all.length}</b><span>كل المنتجات</span></div><div><b>${all.filter(p=>!p.hidden&&!p.draft).length}</b><span>ظاهرة في المتجر</span></div><div><b>${all.filter(p=>p.hidden).length}</b><span>مخفية</span></div><div><b>${all.filter(p=>p.draft).length}</b><span>مسودات</span></div></div>`;
  const sm=smp?`<div class="warn">في ${smp} منتج عرض (تجريبي) لسه موجود. هيفضلوا ظاهرين لحد ما تمسحهم. <button class="btn s r" id="delsample" style="margin-inline-start:8px">امسح كل منتجات العرض</button></div>`:'';
  const tool=`<div class="tool"><input id="fq" type="search" placeholder="ابحث بالاسم..." value="${esc(S.f.q)}"><select id="fc"><option value="">كل الأقسام</option>${cats().map(c=>`<option value="${c.id}" ${S.f.cat===c.id?'selected':''}>${esc(c.ar)}</option>`).join('')}</select><select id="fs">${[['','كل الحالات'],['shown','ظاهر'],['hidden','مخفي'],['draft','مسودة'],['out','فيه مقاس خلصان'],['sale','عليه خصم'],['sample','منتج عرض']].map(o=>`<option value="${o[0]}" ${S.f.st===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>`;
  const bulk=S.sel.size?`<div class="bulk"><b>${S.sel.size} محدد</b><button class="btn s" data-b="price">تعديل الأسعار</button><button class="btn s" data-b="hide">إخفاء</button><button class="btn s" data-b="show">إظهار</button><button class="btn s" data-b="del">حذف</button><button class="btn s" data-b="clr">إلغاء التحديد</button></div>`:`<div class="hint" style="display:flex;gap:10px;align-items:center"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="selall"> تحديد الكل</label><span>اسحب ⋮⋮ أو استخدم الأسهم لترتيب المنتجات${S.f.q||S.f.cat||S.f.st?' (الترتيب بالسحب بيشتغل بدون فلتر)':''}</span></div>`;
  const rows=l.map(p=>{const d=dispPrice(p),th=im(p.img),flt=!!(S.f.q||S.f.cat||S.f.st);
    return `<div class="row ${p.hidden||p.draft?'off':''}" data-id="${p.id}" ${flt?'':'draggable="true"'}><span class="hd" title="اسحب للترتيب">⋮⋮</span><input type="checkbox" data-sel="${p.id}" ${S.sel.has(p.id)?'checked':''}><img class="th" src="${esc(th)}" alt="" loading="lazy"><div><h4>${esc(p.ar||p.en)}</h4><div class="m">${esc(catName(p.cat))} · ${(p.sizes||[]).length} مقاس · ${(p.colors||[]).length} لون</div><div class="pr"><b>${fmt(d.price)} ج.م</b>${d.old?`<s>${fmt(d.old)}</s>`:''}</div><div>${p.draft?'<span class="ch dr">مسودة</span>':''}${p.hidden?'<span class="ch hd2">مخفي</span>':''}${(p.out||[]).length?`<span class="ch sl">خلصان: ${esc(p.out.join(' ،'))}</span>`:''}${p.sample?'<span class="ch sm">عرض</span>':''}${d.tmp?'<span class="ch ok">خصم مؤقت</span>':''}</div></div><div class="acts"><button class="btn s" data-a="edit" data-id="${p.id}">تعديل</button><button class="btn s" data-a="dup" data-id="${p.id}">نسخ</button><button class="btn s" data-a="vis" data-id="${p.id}">${p.hidden?'إظهار':'إخفاء'}</button><button class="ib" title="فوق" data-a="up" data-id="${p.id}">↑</button><button class="ib" title="تحت" data-a="dn" data-id="${p.id}">↓</button><button class="btn s r" data-a="del" data-id="${p.id}">حذف</button></div></div>`}).join('');
  return stat+sm+tool+bulk+(rows||`<div class="empty">${all.length?'مفيش نتائج':'لسه مفيش منتجات. اضغط "+ منتج جديد".'}</div>`);
}

/* ---------- editor ---------- */
function blank(){return{id:nextId(),isNew:true,ar:'',en:'',cat:(cats()[0]||{}).id||'',tag:'',featured:0,price:'',old:'',discPct:'',discEnd:'',sizes:[],out:[],colors:[{h:'#111111',a:'أسود',e:'Black',i:''}],imgs:[],hidden:false,draft:false,sample:false,order:(S.products.reduce((m,p)=>Math.min(m,p.order||0),0))-10,pair:[]}}
async function openEditor(id,dup){
  let E;
  if(!id){E=blank()}
  else{
    const p=S.products.find(x=>x.id===id);
    E={...p,isNew:false,price:p.price,old:p.old||'',discPct:(p.disc&&p.disc.pct)||'',discEnd:(p.disc&&p.disc.end)?toLocal(p.disc.end):'',sizes:[...(p.sizes||[])],out:[...(p.out||[])],colors:(p.colors||[]).map(c=>({...colToMap(c)})),imgs:[]};
    let gal=[];
    if(p.ng>0){busy(true,'جاري تحميل الصور...');try{const g=await getDoc(doc(db,'gal',String(p.id)));if(g.exists())gal=g.data().imgs||[]}catch(e){}busy(false)}
    if(gal.length)E.imgs=gal.map(g=>mkImg(g,p));else if(p.img)E.imgs=[mkImg(p.img,p)];
    if(dup){E.id=nextId();E.isNew=true;E.ar=(p.ar||'')+' (نسخة)';E.en=p.en?p.en+' (copy)':'';E.draft=true;E.sample=false;E.order=(p.order||0)+1;E.pair=[]}
  }
  S.ed=E;S.step=1;drawEditor();
}
function mkImg(v,p){
  if(/^data:/.test(v))return{k:'file',full:v};
  if(/^https?:/.test(v))return{k:'url',url:v};
  return{k:'repo',name:v.replace(/\.jpg$/,'')}
}
const imgSrc=i=>i.k==='file'?i.full:i.k==='url'?i.url:i.name+'.jpg';
const toLocal=iso=>{const d=new Date(iso);if(isNaN(d))return '';const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes())};
const STEPS=['الأساسيات','السعر','المقاسات والألوان','الصور','المعاينة والنشر'];
function drawEditor(){
  let ed=$('#ed');if(!ed){ed=document.createElement('div');ed.id='ed';ed.className='ed';document.body.appendChild(ed);document.body.style.overflow='hidden'}
  const E=S.ed,st=S.step,keep=ed.scrollTop;
  ed.innerHTML=`<div class="in"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><button class="ib" id="edx" aria-label="إغلاق">✕</button><h2 style="margin:0;font-size:19px">${E.isNew?'منتج جديد':'تعديل: '+esc(E.ar)}</h2></div><div class="steps">${STEPS.map((s,i)=>`<button data-step="${i+1}" class="${st===i+1?'on':st>i+1?'dn':''}">${i+1}. ${s}</button>`).join('')}</div>${[0,s1,s2,s3,s4,s5][st](E)}</div><div class="foot"><div class="w">${st>1?'<button class="btn" id="eb">رجوع</button>':''}<span class="sp"></span>${st<5?'<button class="btn" id="sd">حفظ كمسودة</button><button class="btn d" id="en">التالي</button>':`<button class="btn" id="sd">حفظ كمسودة</button><button class="btn d" id="sp">نشر في المتجر</button>`}</div></div>`;
  ed.scrollTop=keep;
}
const s1=E=>`<div class="card"><label class="f"><span>اسم المنتج بالعربي *</span><input id="f_ar" value="${esc(E.ar)}" placeholder="مثال: تيشيرت قطن أوفر سايز"></label><label class="f"><span>الاسم بالإنجليزي (اختياري، لو سبته فاضي هيستخدم العربي)</span><input id="f_en" dir="ltr" value="${esc(E.en)}"></label><div class="g2"><label class="f"><span>القسم *</span><select id="f_cat">${cats().map(c=>`<option value="${c.id}" ${E.cat===c.id?'selected':''}>${esc(c.ar)}</option>`).join('')}</select></label><label class="f"><span>شارة على الصورة</span><select id="f_tag">${TAGS.map(t=>`<option value="${t[0]}" ${E.tag===t[0]?'selected':''}>${t[1]}</option>`).join('')}</select></label></div><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="f_feat" ${E.featured?'checked':''}> منتج مميز</label></div>`;
function priceCalc(E){const p=+E.price||0,pc=+E.discPct||0;return pc>0&&p?Math.round(p*(1-pc/100)):0}
const s2=E=>`<div class="card"><div class="g2"><label class="f"><span>السعر (ج.م) *</span><input id="f_price" type="number" inputmode="numeric" min="0" value="${esc(E.price)}"></label><label class="f"><span>السعر القديم (اختياري، بيظهر مشطوب)</span><input id="f_old" type="number" inputmode="numeric" min="0" value="${esc(E.old)}"></label></div></div><div class="card"><h3>خصم مؤقت بنسبة (اختياري)</h3><p class="hint">السعر اللي فوق هو السعر قبل الخصم. الخصم بيشتغل لحد التاريخ، وبعدها السعر بيرجع لوحده.</p><div class="g2"><label class="f"><span>نسبة الخصم %</span><input id="f_dp" type="number" inputmode="numeric" min="0" max="90" value="${esc(E.discPct)}"></label><label class="f"><span>ينتهي في (اختياري)</span><input id="f_de" type="datetime-local" value="${esc(E.discEnd)}"></label></div><div id="dcalc" class="hint" style="font-size:15px">${priceCalc(E)?`السعر بعد الخصم: <b>${fmt(priceCalc(E))} ج.م</b>`:''}</div></div>`;
const s3=E=>`<div class="card"><h3>المقاسات</h3><p class="hint">اختار مجموعة جاهزة أو أضف مقاس. اضغط على المقاس لو خلصان (بيتشطب)، واضغط ✕ لحذفه.</p><div class="chips" style="margin-bottom:12px">${PRESETS.map((p,i)=>`<button class="chip" data-preset="${i}">${p[0]}</button>`).join('')}</div><div class="chips" id="szs" style="margin-bottom:12px">${E.sizes.length?E.sizes.map((s,i)=>`<span class="sz ${E.out.includes(s)?'x':''}" data-tog="${i}">${esc(s)} <i data-rm="${i}">✕</i></span>`).join(''):'<span class="hint">لسه مفيش مقاسات</span>'}</div><div style="display:flex;gap:8px"><input id="newsz" placeholder="مقاس جديد (مثال: XXXL)" style="flex:1"><button class="btn" id="addsz">إضافة</button></div></div>
<div class="card"><h3>الألوان</h3><p class="hint">اختار اللون من المربع أو من الألوان الجاهزة، واكتب اسمه. لو عندك صورة مخصوصة للون اضغط المربع المنقّط.</p>${E.colors.map((c,i)=>`<div class="cl"><input type="color" data-ch="${i}" value="${esc(c.h)}"><input data-ca="${i}" placeholder="اسم اللون" value="${esc(c.a)}"><input class="en" dir="ltr" data-ce="${i}" placeholder="English (اختياري)" value="${esc(c.e)}"><button class="ph" data-cp="${i}" title="صورة اللون">${c.i?`<img src="${esc(im(c.i))}" style="width:100%;height:100%;object-fit:cover">`:'+'}</button><button class="ib" data-cr="${i}">✕</button></div><div class="chips" style="margin:-2px 0 10px">${SWATCH.map(h=>`<button class="sw" style="background:${h}" data-cs="${i}|${h}" aria-label="${h}"></button>`).join('')}</div>`).join('')}<button class="btn" id="addcol">+ لون جديد</button><input type="file" id="cfile" accept="image/*" hidden></div>`;
const s4=E=>`<div class="card"><h3>صور المنتج</h3><p class="hint">أول صورة هي الصورة الرئيسية. تقدر ترفع لحد 5 صور. الصور بتتصغّر تلقائياً وبتتحفظ في قاعدة البيانات المجانية (Firebase Storage مش مجاني، عشان كده مش مستخدمينه).</p><div class="imgs">${E.imgs.map((m,i)=>`<div class="im">${i===0?'<span class="mk">رئيسية</span>':''}<img src="${esc(imgSrc(m))}" alt=""><div class="b"><button data-il="${i}" title="قدّم">→</button><button data-ir="${i}" title="أخّر">←</button><button data-ix="${i}" title="حذف">✕</button></div></div>`).join('')}</div><div class="dz" id="dz" style="margin-top:12px">اضغط لاختيار صور من الموبايل أو الجهاز<br><small style="color:var(--mut)">أو اسحب الصور هنا</small></div><input type="file" id="ifile" accept="image/*" multiple hidden><div style="display:flex;gap:8px;margin-top:12px"><input id="iurl" dir="ltr" placeholder="أو الصق رابط صورة https://..." style="flex:1"><button class="btn" id="addurl">إضافة</button></div></div>`;
function s5(E){
  const d=priceCalc(E),pr=d||+E.price||0,old=d?+E.price:(+E.old||0),im0=E.imgs[0]?imgSrc(E.imgs[0]):'';
  const miss=check(E);
  return `<div class="card"><h3>معاينة الكارت</h3><div class="pv"><div style="position:relative"><img src="${esc(im0)}" alt="">${(E.tag||d||+E.old)?`<span class="bd">${d||+E.old?'خصم':esc((TAGS.find(t=>t[0]===E.tag)||[])[1])}</span>`:''}</div><div class="t"><div style="font-weight:600">${esc(E.ar||'اسم المنتج')}</div><div><b>${fmt(pr)} ج.م</b>${old?` <s style="color:var(--mut)">${fmt(old)}</s>`:''}</div><div class="chips" style="margin-top:8px">${E.colors.map(c=>`<span class="sw" style="background:${esc(c.h)}"></span>`).join('')}</div><div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">${E.sizes.map(s=>`<span class="sz ${E.out.includes(s)?'x':''}" style="min-height:28px;font-size:12px;padding:0 8px">${esc(s)}</span>`).join('')}</div></div></div></div>${miss.length?`<div class="warn"><b>ناقص قبل النشر:</b><br>${miss.map(esc).join('<br>')}</div>`:'<div class="warn" style="background:#e9f6ee;border-color:#b7dfc4">كل حاجة جاهزة. اضغط "نشر في المتجر" وهيظهر للزوار خلال دقائق.</div>'}<p class="hint">"حفظ كمسودة" بيحفظ المنتج من غير ما يظهر في المتجر.</p>`;
}
function check(E){const m=[];if(!E.ar.trim())m.push('اسم المنتج بالعربي');if(!(+E.price>0))m.push('السعر');if(!E.sizes.length)m.push('مقاس واحد على الأقل (أو "مقاس واحد")');if(!E.colors.length||E.colors.some(c=>!c.a.trim()))m.push('اسم لكل لون');if(!E.imgs.length)m.push('صورة واحدة على الأقل');return m}
function syncEditor(){
  const E=S.ed;if(!E)return;const g=id=>document.getElementById(id);
  if(S.step===1&&g('f_ar')){E.ar=g('f_ar').value;E.en=g('f_en').value;E.cat=g('f_cat').value;E.tag=g('f_tag').value;E.featured=g('f_feat').checked?1:0}
  if(S.step===2&&g('f_price')){E.price=g('f_price').value;E.old=g('f_old').value;E.discPct=g('f_dp').value;E.discEnd=g('f_de').value}
  if(S.step===3){document.querySelectorAll('[data-ch]').forEach(e=>E.colors[+e.dataset.ch].h=e.value);document.querySelectorAll('[data-ca]').forEach(e=>E.colors[+e.dataset.ca].a=e.value);document.querySelectorAll('[data-ce]').forEach(e=>E.colors[+e.dataset.ce].e=e.value)}
}
async function persist(E,draft){
  const miss=check(E);
  if(!draft&&miss.length){S.step=5;drawEditor();toast('ناقص: '+miss[0],true);return}
  if(draft&&!E.ar.trim()){S.step=1;drawEditor();toast('اكتب اسم المنتج الأول',true);return}
  busy(true,'جاري الحفظ...');
  try{
    const files=E.imgs.map(m=>m.k==='file'?m:null);
    let gal=E.imgs.map(m=>m.k==='file'?m.full:m.k==='url'?m.url:m.name+'.jpg');
    let main;const f0=E.imgs[0];
    if(!f0)main='';else if(f0.k==='file')main=await shrinkData(f0.full,600,.72);else if(f0.k==='url')main=f0.url;else main=f0.name;
    let tot=gal.filter(x=>/^data:/.test(x)).reduce((a,x)=>a+x.length,0);
    for(let q=.7;tot>880000&&q>.35;q-=.1){gal=await Promise.all(gal.map(x=>/^data:/.test(x)?shrinkData(x,900,q):x));tot=gal.filter(x=>/^data:/.test(x)).reduce((a,x)=>a+x.length,0)}
    if(tot>900000)throw new Error('الصور كبيرة. قلّل عددها.');
    const colors=await Promise.all(E.colors.map(async c=>{const o={h:c.h,a:c.a.trim(),e:(c.e||'').trim()||c.a.trim()};if(c.i)o.i=/^data:/.test(c.i)?await shrinkData(c.i,480,.7):c.i;return o}));
    const p={id:E.id,ar:E.ar.trim(),en:(E.en||'').trim()||E.ar.trim(),cat:E.cat,tag:E.tag||'',featured:E.featured?1:0,price:+E.price||0,sizes:E.sizes,out:E.out.filter(s=>E.sizes.includes(s)),img:main,colors,pair:E.pair||[],order:E.order||0,sample:!!E.sample,hidden:!!E.hidden,draft:!!draft,trash:false,ng:gal.length>1?gal.length:0};
    if(+E.old>0)p.old=+E.old;
    if(+E.discPct>0)p.disc={pct:Math.min(90,+E.discPct),end:E.discEnd?new Date(E.discEnd).toISOString():''};
    if(draft)p.hidden=!!E.hidden;
    await saveProduct(p);
    if(p.ng>0)await setDoc(doc(db,'gal',String(p.id)),{imgs:gal});else{try{await deleteDoc(doc(db,'gal',String(p.id)))}catch(e){}}
    await loadAll();
    S.tab='list';closeEditor();toast(draft?'اتحفظ كمسودة':'اتنشر. هيظهر في المتجر خلال دقائق.');
  }catch(e){console.error(e);toast('حصل خطأ: '+e.message,true)}
  busy(false);render();
}
function closeEditor(){S.ed=null;const e=$('#ed');if(e)e.remove();document.body.style.overflow=''}

/* ---------- settings ---------- */
function vSettings(){
  const s=S.site,tx=s.tx||{ar:{},en:{}},a=tx.ar||{},e=tx.en||{};
  const v=(o,k)=>esc((o&&o[k])||'');
  return `<div class="card"><h3>واتساب الطلبات</h3><label class="f"><span>رقم واتساب المتجر (الطلبات بتوصل عليه)</span><input id="s_wa" inputmode="tel" dir="ltr" value="${esc(s.wa||'')}" placeholder="01090885192"></label><p class="hint">اكتب الرقم زي ما هو (01xxxxxxxxx) وأنا هحوّله للصيغة الدولية تلقائياً. الحالي: ${esc(s.wa||'')}</p><div class="g2"><label class="f"><span>أول سطر في رسالة الطلب (عربي)</span><input id="s_ma" value="${esc(s.msgAr||'')}"></label><label class="f"><span>أول سطر (English)</span><input id="s_me" dir="ltr" value="${esc(s.msgEn||'')}"></label></div></div>
<div class="card"><h3>الشريط العلوي والبانر الرئيسي</h3><p class="hint">سيب أي خانة فاضية وهيستخدم الكلام الأصلي.</p><label class="f"><span>الشريط العلوي (عربي)</span><input id="t_aa" value="${v(a,'ann')}"></label><label class="f"><span>الشريط العلوي (English)</span><input id="t_ae" dir="ltr" value="${v(e,'ann')}"></label><div class="g2"><label class="f"><span>سطر صغير فوق العنوان (عربي)</span><input id="t_ea" value="${v(a,'eye')}"></label><label class="f"><span>Small line (English)</span><input id="t_ee" dir="ltr" value="${v(e,'eye')}"></label></div><div class="g2"><label class="f"><span>العنوان الكبير (عربي) - سطرين بـ Enter</span><textarea id="t_ha" rows="2">${v(a,'h1')}</textarea></label><label class="f"><span>Headline (English)</span><textarea id="t_he" dir="ltr" rows="2">${v(e,'h1')}</textarea></label></div><div class="g2"><label class="f"><span>الوصف (عربي)</span><textarea id="t_pa" rows="2">${v(a,'hp')}</textarea></label><label class="f"><span>Description (English)</span><textarea id="t_pe" dir="ltr" rows="2">${v(e,'hp')}</textarea></label></div>
<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><img id="heroprev" src="${esc(im(s.heroImg||'hero'))}" style="width:140px;height:88px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><button class="btn" id="heropick">تغيير صورة البانر</button><button class="btn" id="herorst">الصورة الأصلية</button><input type="file" id="herofile" accept="image/*" hidden></div></div>
<div class="card"><h3>الدروب (العد التنازلي)</h3><label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="d_on" ${s.dropOn===false?'':'checked'}> اعرض الدروب في الصفحة الرئيسية</label><div class="g2"><label class="f"><span>اسم الدروب (عربي)</span><input id="d_a" value="${esc(s.dropAr||'')}"></label><label class="f"><span>Drop name (English)</span><input id="d_e" dir="ltr" value="${esc(s.dropEn||'')}"></label></div><label class="f"><span>تاريخ ووقت النزول</span><input id="d_t" type="datetime-local" value="${esc(s.drop?toLocal(s.drop):'')}"></label></div>
<div class="card cats"><h3>الأقسام</h3><p class="hint">القسم الفاضي (من غير منتجات) مش بيظهر في المتجر. مينفعش تمسح قسم فيه منتجات.</p>${cats().map((c,i)=>`<div class="r"><input data-ka="${i}" value="${esc(c.ar)}" placeholder="الاسم بالعربي"><input data-ke="${i}" dir="ltr" value="${esc(c.en)}" placeholder="English"><button class="ib" data-ku="${i}">↑</button><button class="ib" data-kd="${i}">↓</button><button class="ib" data-kx="${i}" title="${live().filter(p=>p.cat===c.id).length} منتج">✕</button></div>`).join('')}<button class="btn" id="addcat">+ قسم جديد</button></div>
<div class="card"><h3>التقييمات التجريبية</h3><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="s_rv" ${s.sampleReviews===false?'':'checked'}> اعرض التقييمات التجريبية (عليها علامة "عينة")</label><p class="hint">قبل ما تفتح المتجر للناس، الأفضل تقفل ده عشان مفيش آراء مش حقيقية تظهر.</p></div>
<button class="btn d" id="saveset" style="width:100%">حفظ الإعدادات</button>`;
}
function normWa(x){let d=String(x||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length===11&&d.startsWith('01'))d='20'+d.slice(1);return d}
async function saveSettings(){
  const g=id=>document.getElementById(id),wa=normWa(g('s_wa').value);
  if(wa.length<11){toast('رقم واتساب مش مظبوط',true);return}
  const old=S.site,sc=document.querySelectorAll('[data-ka]'),cs=[];
  sc.forEach(el=>{const i=+el.dataset.ka,c=cats()[i];cs.push({id:c.id,ar:el.value.trim()||c.ar,en:document.querySelector(`[data-ke="${i}"]`).value.trim()||el.value.trim()||c.en})});
  const tx={ar:{},en:{}};[['ann','aa','ae'],['eye','ea','ee'],['h1','ha','he'],['hp','pa','pe']].forEach(([k,a,e])=>{if(g('t_'+a).value.trim())tx.ar[k]=g('t_'+a).value.trim();if(g('t_'+e).value.trim())tx.en[k]=g('t_'+e).value.trim()});
  const patch={wa,msgAr:g('s_ma').value.trim(),msgEn:g('s_me').value.trim(),tx,dropOn:g('d_on').checked,dropAr:g('d_a').value.trim(),dropEn:g('d_e').value.trim(),cats:cs,sampleReviews:g('s_rv').checked};
  if(g('d_t').value)patch.drop=new Date(g('d_t').value).toISOString();
  if(S.heroNew!==undefined)patch.heroImg=S.heroNew;
  busy(true);try{await saveSite(patch);S.heroNew=undefined;toast('اتحفظت الإعدادات')}catch(e){toast('حصل خطأ: '+e.message,true)}busy(false);render();
}
function syncCats(){document.querySelectorAll('[data-ka]').forEach(el=>{const i=+el.dataset.ka;S.site.cats=cats().map((c,j)=>j===i?{...c,ar:el.value,en:document.querySelector(`[data-ke="${i}"]`).value}:c)})}

/* ---------- trash / backup ---------- */
function vTrash(){const l=trashed();return `<div class="card"><h3>المحذوفات</h3><p class="hint">المنتج المحذوف بيفضل هنا وتقدر ترجّعه.</p>${l.length?l.map(p=>`<div class="row" style="grid-template-columns:64px 1fr auto"><img class="th" src="${esc(im(p.img))}" alt=""><div><h4>${esc(p.ar)}</h4><div class="m">${fmt(p.price)} ج.م</div></div><div class="acts"><button class="btn s" data-a="restore" data-id="${p.id}">استرجاع</button><button class="btn s r" data-a="purge" data-id="${p.id}">حذف نهائي</button></div></div>`).join('')+`<button class="btn r" id="emptytrash">تفريغ المحذوفات</button>`:'<div class="empty">المحذوفات فاضية</div>'}</div>`}
function vBackup(){return `<div class="card"><h3>نسخة احتياطية</h3><p class="hint">بتنزّل ملف فيه كل المنتجات والصور والإعدادات. احتفظ بيه في مكان آمن. (النسخ التلقائي من Firebase مش مجاني.)</p><button class="btn d" id="export">تنزيل نسخة احتياطية</button></div><div class="card"><h3>نسخة الطوارئ للمتجر (products.js)</h3><p class="hint">لو قاعدة البيانات وقفت (مثلاً عدّت الحد المجاني اليومي)، الزائر الجديد بيشوف منتجات الملف ده. حدّثه بعد أي تغيير كبير في منتجاتك: نزّل الملف، وبعدين ارفعه مكان products.js في مستودع GitHub (kero140/modiva ← Add file ← Upload files ← Commit). الزائر اللي زار المتجر قبل كده بيشوف آخر نسخة شافها حتى لو القاعدة وقفت.</p><div class="warn">النسخة بتشمل المنتجات الظاهرة بس، بالسعر الحالي، وصورة واحدة لكل منتج.</div><button class="btn d" id="snap">تنزيل نسخة الطوارئ products.js</button></div><div class="card"><h3>استرجاع من نسخة</h3><p class="hint">هيستبدل المنتجات اللي ليها نفس الرقم، ومش هيمسح الباقي.</p><button class="btn" id="import">اختيار ملف النسخة</button><input type="file" id="impfile" accept=".json,application/json" hidden></div>`}
async function doExport(){
  busy(true,'جاري تجهيز النسخة...');
  try{const gs=await getDocs(collection(db,'gal')),gal={};gs.forEach(d=>gal[d.id]=d.data().imgs||[]);
  const blob=new Blob([JSON.stringify({app:'modiva',version:1,at:new Date().toISOString(),site:S.site,products:S.products,gal})],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modiva-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();toast('تم تنزيل النسخة')}catch(e){toast('حصل خطأ: '+e.message,true)}busy(false)
}
function doSnapshot(){
  const st=S.site,now=new Date();
  const ps=live().filter(p=>!p.hidden&&!p.draft).sort((a,b)=>(a.order||0)-(b.order||0)).map(p=>{const d=dispPrice(p),q={id:p.id,cat:p.cat,ar:p.ar,en:p.en||p.ar,price:d.price,img:p.img,colors:(p.colors||[]).map(c=>{const m=colToMap(c),r=[m.h,m.a,m.e||m.a];if(m.i)r.push(m.i);return r}),sizes:(p.sizes&&p.sizes.length)?p.sizes:['One size'],out:p.out||[],featured:p.featured||0,tag:p.tag||(d.old?'sale':'')};if(d.old)q.old=d.old;return q});
  ps.forEach((p,i)=>{let o=ps.filter(x=>x.id!==p.id&&x.cat!==p.cat);if(o.length<3)o=ps.filter(x=>x.id!==p.id);p.pair=o.slice((i*2)%Math.max(o.length,1)).concat(o).slice(0,3).map(x=>x.id)});
  const cs=cats().filter(c=>ps.some(p=>p.cat===c.id)).map(c=>({id:c.id,ar:c.ar,en:c.en}));
  const store={name:'MODIVA',ar:'موديفا',wa:st.wa,sampleReviews:st.sampleReviews!==false,drop:st.drop,dropAr:st.dropAr,dropEn:st.dropEn,dropOn:st.dropOn!==false,msgAr:st.msgAr||'',msgEn:st.msgEn||'',tx:st.tx||{ar:{},en:{}}};
  if(st.heroImg)store.hero={img:st.heroImg};
  if(!ps.length){toast('مفيش منتجات ظاهرة لسه',true);return}
  const txt='// MODIVA emergency snapshot, made '+now.toISOString()+'. Used only if the live database is unreachable.\nwindow.CATS='+JSON.stringify(cs)+';\nwindow.PRODUCTS='+JSON.stringify(ps)+';\nwindow.STORE='+JSON.stringify(store)+';\nwindow.REVIEWS='+JSON.stringify(window.REVIEWS||[])+';\n';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/javascript'}));a.download='products.js';document.body.appendChild(a);a.click();a.remove();toast('تم تنزيل products.js ('+Math.round(txt.length/1024)+' KB). ارفعه على GitHub.');
}
async function doImport(file){
  try{const j=JSON.parse(await file.text());if(j.app!=='modiva')throw new Error('الملف ده مش نسخة موديفا');
  if(!await ask(`هترجّع ${j.products.length} منتج والإعدادات من النسخة. متأكد؟`,'استرجاع'))return;
  busy(true,'جاري الاسترجاع...');
  for(const p of j.products){await saveProduct(p);const g=j.gal&&j.gal[p.id];if(g&&g.length)await setDoc(doc(db,'gal',String(p.id)),{imgs:g})}
  if(j.site)await saveSite(j.site);await loadAll();toast('تم الاسترجاع')}catch(e){toast('حصل خطأ: '+e.message,true)}busy(false);render()
}

/* ---------- bulk price ---------- */
function bulkPrice(){
  const ids=[...S.sel],o=modal(`<h3 style="margin:0 0 12px">تعديل الأسعار (${ids.length} منتج)</h3><label class="f"><span>نوع التعديل</span><select id="bp_m"><option value="pup">زيادة بنسبة %</option><option value="pdn">تخفيض بنسبة %</option><option value="aup">زيادة مبلغ</option><option value="adn">تخفيض مبلغ</option><option value="set">سعر ثابت للكل</option></select></label><label class="f"><span>القيمة</span><input id="bp_v" type="number" inputmode="decimal" min="0"></label><div id="bp_p" class="hint"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-n>إلغاء</button><button class="btn d" data-y>تطبيق</button></div>`);
  const calc=p=>{const m=o.querySelector('#bp_m').value,v=+o.querySelector('#bp_v').value||0,b=+p.price;return Math.max(0,Math.round(m==='pup'?b*(1+v/100):m==='pdn'?b*(1-v/100):m==='aup'?b+v:m==='adn'?b-v:v))};
  const prev=()=>{o.querySelector('#bp_p').innerHTML=ids.slice(0,4).map(i=>{const p=S.products.find(x=>x.id===i);return `${esc(p.ar)}: ${fmt(p.price)} ← <b>${fmt(calc(p))}</b>`}).join('<br>')};
  o.oninput=prev;prev();
  o.onclick=async e=>{if(e.target.dataset.n!==undefined||e.target===o){o.remove()}else if(e.target.dataset.y!==undefined){const v=+o.querySelector('#bp_v').value;if(!(v>=0)||o.querySelector('#bp_v').value===''){toast('اكتب القيمة',true);return}o.remove();busy(true);try{for(const i of ids){const p=S.products.find(x=>x.id===i);await saveProduct({...p,price:calc(p)})}await loadAll();S.sel.clear();toast('اتعدلت الأسعار')}catch(er){toast('حصل خطأ: '+er.message,true)}busy(false);render()}}
}

/* ---------- actions ---------- */
async function setFields(id,patch){const p=S.products.find(x=>x.id===id);await saveProduct({...p,...patch})}
async function reorder(ids){
  const all=live(),m=new Map(all.map(p=>[p.id,p]));busy(true);
  try{let i=0;for(const id of ids){const p=m.get(id);i++;if(p&&p.order!==i*10)await saveProduct({...p,order:i*10})}await loadAll()}catch(e){toast('حصل خطأ: '+e.message,true)}busy(false);render()
}
document.addEventListener('click',async e=>{
  const t=e.target,c=s=>t.closest(s);let x;
  if(c('#gl')){try{S.err='';await signInWithPopup(auth,new GoogleAuthProvider())}catch(er){S.err='تعذّر الدخول: '+(er.code||er.message);render()}return}
  if(c('#out')){await signOut(auth);return}
  if(c('#seed')){seed();return}
  if(x=c('[data-tab]')){const k=x.dataset.tab;if(k==='add'){openEditor();return}S.tab=k;S.sel.clear();render();return}
  if(x=c('[data-a]')){
    const a=x.dataset.a,id=+x.dataset.id,p=S.products.find(q=>q.id===id);
    if(a==='edit'){openEditor(id);return}
    if(a==='dup'){openEditor(id,true);return}
    if(a==='vis'){await setFields(id,{hidden:!p.hidden});await loadAll();toast(p.hidden?'اتخفى':'ظهر');render();return}
    if(a==='up'||a==='dn'){const ids=live().map(q=>q.id),i=ids.indexOf(id),j=a==='up'?i-1:i+1;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];reorder(ids);return}
    if(a==='del'){if(await ask(`تمسح "${esc(p.ar)}"؟ هيروح للمحذوفات وتقدر ترجّعه.`,'احذف',true)){await setFields(id,{trash:true});await loadAll();S.sel.delete(id);toast('اتحذف');render()}return}
    if(a==='restore'){await setFields(id,{trash:false});await loadAll();toast('اترجّع');render();return}
    if(a==='purge'){if(await ask('حذف نهائي ومفيش رجوع. متأكد؟','احذف نهائياً',true)){await deleteDoc(doc(db,'products',String(id)));try{await deleteDoc(doc(db,'gal',String(id)))}catch(_){}await loadAll();toast('اتحذف نهائياً');render()}return}
  }
  if(c('#emptytrash')){if(await ask('تفريغ كل المحذوفات نهائياً؟','تفريغ',true)){busy(true);for(const p of trashed()){await deleteDoc(doc(db,'products',String(p.id)));try{await deleteDoc(doc(db,'gal',String(p.id)))}catch(_){}}await loadAll();busy(false);toast('اتفرغت');render()}return}
  if(c('#delsample')){const l=live().filter(p=>p.sample);if(await ask(`تمسح كل منتجات العرض (${l.length})؟ هتروح للمحذوفات.`,'امسحهم',true)){busy(true);for(const p of l)await saveProduct({...p,trash:true});await loadAll();busy(false);toast('اتمسحت منتجات العرض');render()}return}
  if(x=c('[data-b]')){const b=x.dataset.b,ids=[...S.sel];
    if(b==='clr'){S.sel.clear();render();return}
    if(b==='price'){bulkPrice();return}
    if(b==='del'){if(!await ask(`تمسح ${ids.length} منتج؟ هيروحوا للمحذوفات.`,'احذف',true))return}
    busy(true);try{for(const id of ids)await setFields(id,b==='hide'?{hidden:true}:b==='show'?{hidden:false}:{trash:true});await loadAll();S.sel.clear();toast('تم')}catch(er){toast('حصل خطأ: '+er.message,true)}busy(false);render();return}
  if(c('#export')){doExport();return}
  if(c('#snap')){doSnapshot();return}
  if(c('#import')){$('#impfile').click();return}
  if(c('#saveset')){saveSettings();return}
  if(c('#heropick')){$('#herofile').click();return}
  if(c('#herorst')){S.heroNew='';$('#heroprev').src='hero.jpg';toast('اضغط حفظ الإعدادات');return}
  if(c('#addcat')){syncCats();S.site.cats=[...cats(),{id:'c'+Date.now().toString(36),ar:'قسم جديد',en:'New'}];render();return}
  if(x=c('[data-ku],[data-kd],[data-kx]')){syncCats();const cs=[...cats()];const i=+(x.dataset.ku??x.dataset.kd??x.dataset.kx);
    if(x.dataset.kx!==undefined){if(live().some(p=>p.cat===cs[i].id)){toast('في منتجات في القسم ده. انقلها الأول.',true);return}cs.splice(i,1)}
    else{const j=x.dataset.ku!==undefined?i-1:i+1;if(j<0||j>=cs.length)return;[cs[i],cs[j]]=[cs[j],cs[i]]}
    S.site.cats=cs;render();return}
  /* editor */
  if(c('#edx')){if(await ask('تقفل من غير حفظ؟','اقفل',true)){closeEditor()}return}
  if(x=c('[data-step]')){syncEditor();S.step=+x.dataset.step;drawEditor();return}
  if(c('#eb')){syncEditor();S.step--;drawEditor();return}
  if(c('#en')){syncEditor();S.step++;drawEditor();return}
  if(c('#sd')){syncEditor();persist(S.ed,true);return}
  if(c('#sp')){syncEditor();persist(S.ed,false);return}
  const E=S.ed;if(!E)return;
  if(x=c('[data-preset]')){syncEditor();const p=PRESETS[+x.dataset.preset][1];E.sizes=[...p];E.out=[];drawEditor();return}
  if(x=c('[data-rm]')){syncEditor();const i=+x.dataset.rm,s=E.sizes[i];E.sizes.splice(i,1);E.out=E.out.filter(q=>q!==s);drawEditor();return}
  if(x=c('[data-tog]')){syncEditor();const s=E.sizes[+x.dataset.tog];E.out=E.out.includes(s)?E.out.filter(q=>q!==s):[...E.out,s];drawEditor();return}
  if(c('#addsz')){syncEditor();const v=$('#newsz').value.trim();if(v&&!E.sizes.includes(v))E.sizes.push(v);drawEditor();return}
  if(c('#addcol')){syncEditor();E.colors.push({h:'#d9cbb0',a:'',e:'',i:''});drawEditor();return}
  if(x=c('[data-cr]')){syncEditor();E.colors.splice(+x.dataset.cr,1);drawEditor();return}
  if(x=c('[data-cs]')){syncEditor();const [i,h]=x.dataset.cs.split('|');E.colors[+i].h=h;drawEditor();return}
  if(x=c('[data-cp]')){S.cpick=+x.dataset.cp;if(E.colors[S.cpick].i&&await ask('تشيل صورة اللون؟','شيل')){E.colors[S.cpick].i='';drawEditor();return}$('#cfile').click();return}
  if(c('#dz')){$('#ifile').click();return}
  if(x=c('[data-il],[data-ir],[data-ix]')){const i=+(x.dataset.il??x.dataset.ir??x.dataset.ix),a=E.imgs;
    if(x.dataset.ix!==undefined)a.splice(i,1);else{const j=x.dataset.il!==undefined?i-1:i+1;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]]}
    drawEditor();return}
  if(c('#addurl')){const v=$('#iurl').value.trim();if(!/^https:\/\//.test(v)){toast('الرابط لازم يبدأ بـ https://',true);return}if(E.imgs.length>=5){toast('أقصى حاجة 5 صور',true);return}E.imgs.push({k:'url',url:v});drawEditor();return}
});
async function addFiles(files){
  const E=S.ed;if(!E)return;busy(true,'جاري تجهيز الصور...');
  try{for(const f of files){if(E.imgs.length>=5){toast('أقصى حاجة 5 صور',true);break}if(!/^image\//.test(f.type))continue;E.imgs.push({k:'file',full:await shrink(f,1000,.78)})}}catch(e){toast('الصورة دي مش مقبولة',true)}
  busy(false);drawEditor();
}
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.id==='ifile'){await addFiles([...t.files]);t.value='';return}
  if(t.id==='cfile'){const f=t.files[0];if(f&&S.ed){syncEditor();S.ed.colors[S.cpick].i=await shrink(f,480,.7);drawEditor()}t.value='';return}
  if(t.id==='herofile'){const f=t.files[0];if(f){busy(true,'جاري تجهيز الصورة...');S.heroNew=await shrink(f,1600,.7);$('#heroprev').src=S.heroNew;busy(false);toast('اضغط حفظ الإعدادات')}t.value='';return}
  if(t.id==='impfile'){if(t.files[0])doImport(t.files[0]);t.value='';return}
  if(t.id==='fc'){S.f.cat=t.value;render();return}
  if(t.id==='fs'){S.f.st=t.value;render();return}
  if(t.dataset.sel){const id=+t.dataset.sel;t.checked?S.sel.add(id):S.sel.delete(id);render();return}
  if(t.id==='selall'){filtered().forEach(p=>S.sel.add(p.id));render();return}
});
let ft;document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='fq'){S.f.q=t.value;clearTimeout(ft);ft=setTimeout(()=>{render();const q=$('#fq');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}},250);return}
  if(t.id==='f_price'||t.id==='f_dp'){const E=S.ed;E.price=$('#f_price').value;E.discPct=$('#f_dp').value;const d=priceCalc(E);$('#dcalc').innerHTML=d?`السعر بعد الخصم: <b>${fmt(d)} ج.م</b>`:''}
});
/* drag & drop reorder + image drop */
let dragId=null;
document.addEventListener('dragstart',e=>{const r=e.target.closest&&e.target.closest('.row[draggable]');if(!r)return;dragId=+r.dataset.id;r.classList.add('drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(dragId))}catch(_){}});
document.addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.row').forEach(r=>r.classList.remove('drag','over'))});
document.addEventListener('dragover',e=>{const dz=e.target.closest&&e.target.closest('#dz');if(dz){e.preventDefault();dz.classList.add('o');return}const r=e.target.closest&&e.target.closest('.row[draggable]');if(!r||dragId==null)return;e.preventDefault();document.querySelectorAll('.row.over').forEach(x=>x.classList.remove('over'));r.classList.add('over')});
document.addEventListener('dragleave',e=>{const dz=e.target.closest&&e.target.closest('#dz');if(dz)dz.classList.remove('o')});
document.addEventListener('drop',e=>{
  const dz=e.target.closest&&e.target.closest('#dz');if(dz){e.preventDefault();dz.classList.remove('o');addFiles([...e.dataTransfer.files]);return}
  const r=e.target.closest&&e.target.closest('.row[draggable]');if(!r||dragId==null)return;e.preventDefault();
  const to=+r.dataset.id;if(to===dragId)return;const ids=live().map(p=>p.id).filter(i=>i!==dragId),k=ids.indexOf(to);ids.splice(k,0,dragId);reorder(ids)});

onAuthStateChanged(auth,async u=>{
  if(u&&u.email===OWNER&&u.emailVerified){S.user=u;S.err='';busy(true,'جاري التحميل...');try{await loadAll()}catch(e){S.err='تعذّر تحميل البيانات: '+e.message}busy(false)}
  else if(u){S.err='الحساب '+u.email+' مش مصرح له. الدخول لحساب المالك فقط.';S.user=null;await signOut(auth);return}
  else S.user=null;
  render();
});
render();
window.__admin={S,openEditor};
