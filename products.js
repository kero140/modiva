// Edit this list to add/remove products. (The admin will replace this later.)
window.CATS=[{id:'women',ar:'حريمي',en:'Women'},{id:'men',ar:'رجالي',en:'Men'},{id:'shoes',ar:'أحذية',en:'Shoes'},{id:'acc',ar:'إكسسوارات',en:'Accessories'}];
const L=['XS','S','M','L','XL','XXL'],SH=['40','41','42','43','44'],JN=['28','30','32','34','36'];
window.PRODUCTS=[
{id:1,img:'tee',cat:'men',ar:'تيشيرت قطن أوفر سايز',en:'Oversized Cotton Tee',price:249,old:349,tag:'new',colors:[['#111','أسود','Black','tee'],['#f1ece4','أوف وايت','Off-white','tee_off'],['#3f5a3a','زيتي','Olive','tee_olive']],sizes:L,out:['XXL'],featured:1,pair:[3, 5, 9]},
{id:2,img:'hoodie',cat:'men',ar:'هودي كلاسيك',en:'Classic Hoodie',price:599,old:799,tag:'best',colors:[['#9a9a9a','رمادي','Grey','hoodie'],['#111','أسود','Black','hoodie_black'],['#2f4a66','كحلي','Navy','hoodie_navy']],sizes:L,out:[],featured:1,pair:[3, 5, 11]},
{id:3,img:'jeans',cat:'men',ar:'جينز مستقيم',en:'Straight Jeans',price:449,old:599,tag:'sale',colors:[['#5b86b8','أزرق','Blue','jeans'],['#222','أسود','Black','jeans_black']],sizes:JN,out:['36'],featured:1,pair:[1, 5, 11]},
{id:4,img:'dress',cat:'women',ar:'فستان ساتان طويل',en:'Satin Evening Dress',price:899,old:1199,tag:'new',colors:[['#6d0f1e','عنابي','Burgundy','dress'],['#111','أسود','Black','dress_black']],sizes:['XS','S','M','L'],out:['XS'],featured:1,pair:[6, 10, 8]},
{id:5,img:'sneaker',cat:'shoes',ar:'كوتشي جلد أبيض',en:'White Leather Sneakers',price:749,tag:'',colors:[['#fff','أبيض','White','sneaker']],sizes:SH,out:['40'],featured:1,pair:[3, 1, 9]},
{id:6,img:'bag',cat:'acc',ar:'شنطة كتف جلد',en:'Leather Shoulder Bag',price:799,old:999,tag:'sale',colors:[['#b5793b','جملي','Tan','bag'],['#111','أسود','Black','bag_black']],sizes:['One size'],out:[],featured:1,pair:[4, 10, 12]},
{id:7,img:'watch',cat:'acc',ar:'ساعة كلاسيك',en:'Classic Watch',price:699,tag:'limited',colors:[['#7a4a2a','بني','Brown','watch']],sizes:['One size'],out:[],featured:0,pair:[1, 11, 12]},
{id:8,img:'glasses',cat:'acc',ar:'نظارة شمس دائرية',en:'Round Sunglasses',price:279,tag:'',colors:[['#111','أسود','Black']],sizes:['One size'],out:[],featured:0,pair:[1, 4, 6]},
{id:9,img:'cap',cat:'acc',ar:'كاب قطن',en:'Cotton Cap',price:149,tag:'',colors:[['#d9cbb0','بيج','Beige','cap'],['#444','فحمي','Charcoal','cap_black']],sizes:['One size'],out:[],featured:0,pair:[1, 3, 5]},
{id:10,img:'scarf',cat:'women',ar:'إيشارب صوف',en:'Wool Scarf',price:329,old:429,tag:'sale',colors:[['#c19a6b','كاميل','Camel','scarf'],['#3a332c','داكن','Dark','scarf_black']],sizes:['One size'],out:[],featured:0,pair:[4, 6, 8]},
{id:11,img:'belt',cat:'acc',ar:'حزام جلد',en:'Leather Belt',price:229,tag:'',colors:[['#6b3f23','بني','Brown','belt'],['#111','أسود','Black','belt_black']],sizes:['85','90','95','100'],out:['85'],featured:0,pair:[3, 2, 12]},
{id:12,img:'wallet',cat:'acc',ar:'محفظة جلد',en:'Leather Wallet',price:259,old:329,tag:'sale',colors:[['#4a2f22','بني غامق','Dark brown']],sizes:['One size'],out:[],featured:0,pair:[11, 7, 3]}
];
window.STORE={name:'MODIVA',ar:'موديفا',wa:'201090885192',sampleReviews:true,drop:'2026-12-05T20:00:00+02:00',dropAr:'كابسول الشتا',dropEn:'The Winter Capsule'};
window.REVIEWS=[{n:'محمد',nE:'Mohamed',r:5,ar:'الخامة ممتازة والمقاس مظبوط.',en:'Great fabric, true to size.'},{n:'سارة',nE:'Sara',r:5,ar:'شكلها أحلى من الصور وتوصيل سريع.',en:'Looks even better in person. Fast delivery.'},{n:'أحمد',nE:'Ahmed',r:4,ar:'حلوة جداً، بس المقاس واسع شوية.',en:'Very nice, runs a little big.'},{n:'منى',nE:'Mona',r:5,ar:'جودة تستاهل السعر.',en:'Quality worth the price.'},{n:'يوسف',nE:'Youssef',r:4,ar:'ألوانها هادية وبتلبس مع كل حاجة.',en:'Calm colors, goes with everything.'},{n:'ندى',nE:'Nada',r:5,ar:'اشتريت منها اتنين. هاخد غيرها.',en:'Bought two. Will order more.'}];
