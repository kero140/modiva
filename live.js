/* Live data: reads products and site settings from Firestore (public read, REST, no SDK).
   Falls back to products.js when Firebase is not configured, empty or unreachable. */
(function(){
var C=window.FIREBASE_CONFIG;if(!C){return}
var BASE='https://firestore.googleapis.com/v1/projects/'+C.projectId+'/databases/(default)/documents',K='?key='+C.apiKey;
var FALLBACK={products:window.PRODUCTS,cats:window.CATS,store:JSON.parse(JSON.stringify(window.STORE))};
var CK='modiva_live_v1',TTL=3*60*1000,applied='';
function dec(v){if('stringValue'in v)return v.stringValue;if('integerValue'in v)return +v.integerValue;if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(dec);if('mapValue'in v){var o={},f=v.mapValue.fields||{};for(var k in f)o[k]=dec(f[k]);return o}return null}
function doc(d){var o={},f=d.fields||{};for(var k in f)o[k]=dec(f[k]);return o}
function getJSON(u){return fetch(u).then(function(r){if(r.status===404)return null;if(!r.ok)throw new Error(r.status);return r.json()})}
function fetchAll(){
  return Promise.all([getJSON(BASE+'/products'+K+'&pageSize=300'),getJSON(BASE+'/settings/site'+K)]).then(function(a){
    var ps=((a[0]&&a[0].documents)||[]).map(doc),site=a[1]?doc(a[1]):null;
    return{products:ps,site:site,t:Date.now()}
  })}
function effPrice(p){var base=+p.price||0;if(p.disc&&p.disc.pct>0&&(!p.disc.end||new Date(p.disc.end)>new Date())){return{price:Math.round(base*(1-p.disc.pct/100)),old:base}}return{price:base,old:p.old||undefined}}
function build(raw){
  var site=raw.site;
  if(!site||!site.seeded){return null}
  var ps=raw.products.filter(function(p){return !p.hidden&&!p.draft&&!p.trash}).sort(function(a,b){return(a.order||0)-(b.order||0)});
  ps=ps.map(function(p){var e=effPrice(p),q=Object.assign({},p);q.price=e.price;if(e.old)q.old=e.old;else delete q.old;
    if(!q.en)q.en=q.ar;if(!q.ar)q.ar=q.en;q.sizes=q.sizes&&q.sizes.length?q.sizes:['One size'];q.out=q.out||[];
    q.colors=q.colors&&q.colors.length?q.colors.map(function(c){return Array.isArray(c)?c:(c.i?[c.h,c.a,c.e||c.a,c.i]:[c.h,c.a,c.e||c.a])}):[['#111','أساسي','Basic']];q.tag=q.tag||(e.old?'sale':'');
    if(q.disc&&e.old)q.tag='sale';return q});
  ps.forEach(function(p,i){if(!p.pair||!p.pair.length){var o=ps.filter(function(x){return x.id!==p.id&&x.cat!==p.cat});if(o.length<3)o=ps.filter(function(x){return x.id!==p.id});p.pair=o.slice((i*2)%Math.max(o.length,1)).concat(o).slice(0,3).map(function(x){return x.id})}});
  var cats=(site.cats||FALLBACK.cats).filter(function(c){return ps.some(function(p){return p.cat===c.id})});
  var st=Object.assign({},FALLBACK.store);
  if(site.wa)st.wa=String(site.wa);
  ['dropAr','dropEn','dropOn','msgAr','msgEn','sampleReviews'].forEach(function(k){if(site[k]!==undefined&&site[k]!==null)st[k]=site[k]});
  if(site.drop)st.drop=site.drop;
  if(site.heroImg)st.hero={img:site.heroImg};
  if(site.tx)st.tx=site.tx;
  return{products:ps,cats:cats,store:st}
}
function apply(b){
  var key=JSON.stringify(b?[b.products.length,b.cats,b.store,b.products.map(function(p){return[p.id,p.price,p.img&&p.img.length,p.out,p.sizes,p.ar,p.en,p.old,p.tag,p.colors&&p.colors.length]})]:0);
  if(key===applied)return false;applied=key;
  if(b){window.PRODUCTS=b.products;window.CATS=b.cats;window.STORE=b.store}
  else{window.PRODUCTS=FALLBACK.products;window.CATS=FALLBACK.cats;window.STORE=FALLBACK.store}
  var s=window.STORE;if(s.tx&&s.tx.ar&&s.tx.ar.h1)s.tx.ar.h1=esc(s.tx.ar.h1).replace(/\n/g,'<br>');if(s.tx&&s.tx.en&&s.tx.en.h1)s.tx.en.h1=esc(s.tx.en.h1).replace(/\n/g,'<br>');
  return true}
function esc(x){return String(x).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
window.loadGal=function(p){return getJSON(BASE+'/gal/'+p.id+K).then(function(d){p.gal=d?(doc(d).imgs||[]):[]}).catch(function(){p.gal=[]})};
var cached=null;try{cached=JSON.parse(localStorage.getItem(CK)||'null')}catch(e){}
window.LIVE_READY=new Promise(function(resolve){
  var resolved=false;function go(){if(!resolved){resolved=true;resolve()}}
  var usedCache=false,pend=!(cached&&cached.site);
  if(cached&&cached.site){apply(build(cached));usedCache=true;go()}
  else{window.PRODUCTS=[];window.LIVE_PENDING=1;go()}
  function fin(){window.LIVE_PENDING=0}
  function fail(){if(pend&&window.LIVE_PENDING){apply(null);fin();if(window.__rerender)window.__rerender()}}
  if(usedCache&&Date.now()-cached.t<TTL)return;
  var to=setTimeout(fail,12000);
  fetchAll().then(function(raw){
    clearTimeout(to);
    try{localStorage.setItem(CK,JSON.stringify(raw))}catch(e){try{localStorage.removeItem(CK)}catch(_){}}
    var ch=apply(build(raw));fin();
    if((ch||pend)&&window.__rerender)window.__rerender()
  }).catch(function(){clearTimeout(to);fail()});
});
})();
