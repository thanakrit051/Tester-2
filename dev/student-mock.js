/* ข้อมูลจำลองของหน้านักเรียน — tools/build-pages.mjs ใส่ไฟล์นี้แทน config.js
 * แล้วสร้าง dev/demo-student.html ให้เอง (แก้หน้านักเรียนแล้วไม่ต้องคัดลอกมือ)
 * แทน fetch ด้วยคำตอบปลอม เปิดดูทุกหน้าจอได้โดยไม่ต่อชีตจริง · ต่อท้าย ?lock=1 = ครูปิดคะแนนปลายภาค */
window.AC_API='https://example.invalid/exec';
window.fetch=function(){
  var items=[
    {label:'ใบงานที่ 2',desc:'ทำข้อ 1–10 หน้า 42 ส่งท้ายคาบวันศุกร์',kind:'WORK',exam:false,phase:1,bucket:'work1',max:10,status:'miss',score:null},
    {label:'ใบงานที่ 4',desc:'ทำข้อ 1–12 ในเอกสาร เขียนวิธีทำทุกข้อ ส่งเป็นสมุดหรือรูปถ่ายในไดรฟ์',kind:'WORK',exam:false,phase:1,bucket:'work1',max:10,status:'none',score:null},
    {label:'แบบฝึกหัด 2.1',desc:'',kind:'WORK',exam:false,phase:1,bucket:'work1',max:5,status:'ok',score:5},
    {label:'ใบงานที่ 3',desc:'',kind:'WORK',exam:false,phase:1,bucket:'work1',max:10,status:'late',score:8},
    {label:'สอบเก็บคะแนน ครั้งที่ 1',desc:'',kind:'QUIZ',exam:true,phase:1,bucket:'quiz1',max:10,status:'ok',score:9},
    {label:'สอบเก็บคะแนน ครั้งที่ 2',desc:'',kind:'QUIZ',exam:true,phase:1,bucket:'quiz1',max:10,status:'ok',score:8.5},
    {label:'สอบกลางภาค',desc:'',kind:'MID',exam:true,phase:1,bucket:'mid',max:20,status:'ok',score:17},
    {label:'สอบปลายภาค',desc:'',kind:'FIN',exam:true,phase:2,bucket:'fin',max:30,status:'none',score:null}
  ];
  var buckets=[
    {id:'work1',label:'ส่งงาน',phase:1,sgs:1,score:9,max:10,has:true},
    {id:'quiz1',label:'สอบเก็บ',phase:1,sgs:2,score:8.8,max:10,has:true},
    {id:'att1',label:'เข้าเรียน',phase:1,sgs:3,score:4.6,max:5,has:true},
    {id:'mid',label:'กลางภาค',phase:1,sgs:0,score:17,max:20,has:true},
    {id:'work2',label:'ส่งงาน',phase:2,sgs:10,score:9,max:10,has:true},
    {id:'quiz2',label:'สอบเก็บ',phase:2,sgs:11,score:8.7,max:10,has:true},
    {id:'att2',label:'เข้าเรียน',phase:2,sgs:12,score:4.2,max:5,has:true},
    {id:'fin',label:'ปลายภาค',phase:2,sgs:0,score:0,max:30,has:false}
  ];
  var cls={subject:'คณิตศาสตร์พื้นฐาน',subjectCode:'ค21101',grade:'ม.1',room:'1',no:'1',
    buckets:buckets,earned:61.3,outOf:70,fullTotal:100,
    att:{present:20,late:2,leave:1,absent:1,checked:24,pct:75,minPct:80,risk:true},
    items:items,pending:1,total:61.3,letter:'2',termDone:false};
  var cls2=JSON.parse(JSON.stringify(cls)); cls2.subject='วิทยาการคำนวณ'; cls2.subjectCode='ว23103'; cls2.grade='ม.1'; cls2.room='1'; cls2.total=78.5; cls2.letter='3.5'; cls2.termDone=true; cls2.pending=0; cls2.outOf=100; cls2.att.risk=false; cls2.buckets[7].has=true; cls2.buckets[7].score=24; var cls3=JSON.parse(JSON.stringify(cls)); cls3.subject='ภาษาอังกฤษ'; cls3.subjectCode='อ21101'; delete cls3.total; delete cls3.letter; delete cls3.termDone; cls3.att.risk=false;
  var classes=[cls,cls2,cls3];
  // ?lock=1 = ครูปิดคะแนนปลายภาค — ทำแบบเดียวกับ hideExams_ ใน 05_Student.gs
  var hidden=/[?&]lock=1/.test(location.search)?['fin']:[];
  classes.forEach(function(c){ if(!hidden.length) return; var e=0,o=0;
    c.buckets.forEach(function(b){ if(hidden.indexOf(b.id)>=0){b.score=null;b.has=false;b.hidden=true;} if(b.has){e+=b.score;o+=b.max;} });
    c.earned=Math.round(e*100)/100; c.outOf=o;
    c.items.forEach(function(it){ if(hidden.indexOf(it.bucket)>=0){it.hidden=true;it.status='none';it.score=null;it.passed=null;} });
    delete c.total; delete c.letter; delete c.termDone; });
  return Promise.resolve({text:function(){return Promise.resolve(JSON.stringify(
    {ok:true,data:{name:'กฤตภาส คงพลอย',sid:'61475',summary:true,hidden:hidden,classes:classes},version:'2.17.0'}));}});
};
