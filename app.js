// ===== 祝一一的奥特曼学习站 - 主应用逻辑 =====

// --- 存储工具 ---
const Store={
  get(k,def){try{let v=localStorage.getItem('yy_'+k);return v?JSON.parse(v):def}catch(e){return def}},
  set(k,v){localStorage.setItem('yy_'+k,JSON.stringify(v))},
  del(k){localStorage.removeItem('yy_'+k)}
};

// --- 日期工具 ---
function today(){return new Date().toISOString().slice(0,10)}
function dayIdx(){let d=new Date().getDate()+new Date().getMonth()*31;return d}
function dateSeed(){return parseInt(today().replace(/-/g,''))}

// 随机选取n个元素
function pickN(arr,n){let a=[...arr];for(let i=a.length-1;i>0;i--){let j=Math.floor((Math.random()*(i+1)));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}

// ===== 智能出题系统：半年不重复 + 错题优先 =====
const SmartSchedule={
  // 获取已出题记录 {subject: {qid: lastShownDate}}
  _getLog(){return Store.get('scheduleLog',{})},
  _saveLog(log){Store.set('scheduleLog',log)},
  // 获取某科目已出题的ID集合（180天内）
  _getShown(subject){
    let log=this._getLog();
    let subLog=log[subject]||{};
    let cutoff=new Date(Date.now()-180*86400000).toISOString().slice(0,10);
    return Object.entries(subLog).filter(([qid,date])=>date>=cutoff).map(([qid])=>parseInt(qid));
  },
  // 智能选取n道题：优先错题，排除180天内已出过的
  pick(subject,arr,n){
    if(!arr||arr.length===0)return[];
    if(arr.length<=n)return pickN(arr,n); // 题库不够直接随机
    let shown=this._getShown(subject);
    let wrongQs=WrongBook.getWrongIds(subject);
    // 优先错题(最多占一半)
    let wrongAvail=arr.filter((_,i)=>wrongQs.includes(i)&&!shown.includes(i));
    let wrongPick=pickN(wrongAvail,Math.min(Math.floor(n/2),wrongAvail.length));
    // 剩余从未出过的题中选
    let remaining=n-wrongPick.length;
    let freshAvail=arr.filter((_,i)=>!shown.includes(i)&&!wrongPick.includes(i));
    let freshPick=[];
    if(freshAvail.length>=remaining){
      freshPick=pickN(freshAvail,remaining);
    } else {
      // 不够就全选fresh，再从已出过的补
      freshPick=pickN(freshAvail,freshAvail.length);
      let need=remaining-freshPick.length;
      if(need>0){
        let oldAvail=arr.filter((_,i)=>!shown.includes(i)||true).filter((_,i)=>!wrongPick.includes(i)&&!freshPick.includes(i));
        freshPick=freshPick.concat(pickN(oldAvail,need));
      }
    }
    let result=wrongPick.concat(freshPick);
    // 记录已出
    let log=this._getLog();
    if(!log[subject])log[subject]={};
    let todayStr=today();
    // 用原始数组的index作为qid
    result.forEach(item=>{
      let idx=arr.indexOf(item);
      if(idx>=0)log[subject][idx]=todayStr;
    });
    this._saveLog(log);
    return result;
  },
  // 获取某科目已出题数/总题数
  getProgress(subject,total){
    let shown=this._getShown(subject);
    let log=this._getLog()[subject]||{};
    let count=Object.keys(log).length;
    return{shown:count,total:total,pct:total>0?Math.round(count/total*100):0};
  }
};

// ===== 错题本系统 =====
const WrongBook={
  _get(){return Store.get('wrongBook',{})},
  _save(wb){Store.set('wrongBook',wb)},
  // 记录错题
  add(subject,qid,qData){
    let wb=this._get();
    if(!wb[subject])wb[subject]={};
    let key='q'+qid;
    if(!wb[subject][key]){
      wb[subject][key]={data:qData,count:1,firstWrong:today(),lastWrong:today(),reviewed:0};
    } else {
      wb[subject][key].count++;
      wb[subject][key].lastWrong=today();
    }
    this._save(wb);
  },
  // 标记错题已掌握（答对后移除）
  master(subject,qid){
    let wb=this._get();
    if(wb[subject]){
      delete wb[subject]['q'+qid];
      if(Object.keys(wb[subject]).length===0)delete wb[subject];
      this._save(wb);
    }
  },
  // 获取某科目错题ID列表
  getWrongIds(subject){
    let wb=this._get();
    if(!wb[subject])return[];
    return Object.keys(wb[subject]).map(k=>parseInt(k.replace('q','')));
  },
  // 获取某科目所有错题
  getWrongItems(subject){
    let wb=this._get();
    if(!wb[subject])return[];
    return Object.entries(wb[subject]).map(([k,v])=>({qid:parseInt(k.replace('q','')),...v}));
  },
  // 获取总错题数
  getTotalCount(){
    let wb=this._get();
    return Object.values(wb).reduce((sum,sub)=>sum+Object.keys(sub).length,0);
  },
  // 获取科目错题数
  getSubjectCount(subject){
    let wb=this._get();
    return wb[subject]?Object.keys(wb[subject]).length:0;
  }
};

// --- 状态 ---
let state={
  section:'home',
  pts:Store.get('totalPts',0),
  todayPts:Store.get('todayPts_'+today(),0),
  checkins:Store.get('checkins_'+today(),{}),
  streak:Store.get('streak',0),
  lastCheckin:Store.get('lastCheckin',''),
  masteredPoems:Store.get('masteredPoems',{}),
  ultraExp:Store.get('ultraExp',0),
  voiceOn:false,
  currentVoiceText:'',
  engBook:Store.get('engBook',1), // 1=PU1, 2=PU2
  cnReadCat:Store.get('cnReadCat','all'), // 阅读理解分类
  cnReadIdx:Store.get('cnReadIdx',0), // 阅读理解索引
  cnReadDone:Store.get('cnReadDone',{}), // 阅读理解完成记录
  cnPicCat:Store.get('cnPicCat','all'), // 看图写话分类
  cnPicIdx:Store.get('cnPicIdx',0), // 看图写话索引
  cnPicDone:Store.get('cnPicDone',{}), // 看图写话完成记录
  ropeGoal:Store.get('ropeGoal',200), // 跳绳目标
  ropeStreak:Store.get('ropeStreak',0), // 连续打卡天数
  ropeHistory:Store.get('ropeHistory',{}) // 每日跳绳历史
};

// 奥特曼等级
const ULTRA_LEVELS=[
{lv:1,name:"光之幼崽",exp:0,emoji:"🥚"},
{lv:2,name:"光之少年",exp:50,emoji:"🐣"},
{lv:3,name:"光之战士",exp:150,emoji:"👦"},
{lv:4,name:"奥特学徒",exp:300,emoji:"🦸"},
{lv:5,name:"奥特战士",exp:500,emoji:"🦸‍♂️"},
{lv:6,name:"奥特精英",exp:800,emoji:"⭐"},
{lv:7,name:"奥特英雄",exp:1200,emoji:"🌟"},
{lv:8,name:"光之巨人",exp:1800,emoji:"✨"},
{lv:9,name:"传奇英雄",exp:2500,emoji:"🏆"},
{lv:10,name:"宇宙守护者",exp:3500,emoji:"🌌"}
];

function getUltraLevel(exp){
  for(let i=ULTRA_LEVELS.length-1;i>=0;i--){if(exp>=ULTRA_LEVELS[i].exp)return ULTRA_LEVELS[i]}
  return ULTRA_LEVELS[0];
}
function getNextLevel(exp){
  for(let l of ULTRA_LEVELS){if(exp<l.exp)return l}
  return null;
}

// --- 积分 ---
function addPts(n,task){
  state.todayPts+=n;
  state.pts+=n;
  state.ultraExp+=n;
  Store.set('totalPts',state.pts);
  Store.set('todayPts_'+today(),state.todayPts);
  Store.set('ultraExp',state.ultraExp);
  updatePtsDisplay();
  if(n>0)showToast(`+${n}分！${task||''} 🎉`);
}

// --- 打卡 ---
function checkin(task){
  if(state.checkins[task])return false;
  state.checkins[task]=true;
  Store.set('checkins_'+today(),state.checkins);
  // 更新连续打卡
  let y=new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(state.lastCheckin===y||state.lastCheckin===today()){
    if(state.lastCheckin!==today()){
      state.streak++;Store.set('streak',state.streak);
    }
  } else {state.streak=1;Store.set('streak',1)}
  state.lastCheckin=today();Store.set('lastCheckin',state.lastCheckin);
  return true;
}

// --- 语音 ---
let speechSyn=window.speechSynthesis||null;
let _voicesLoaded=false;
let _cnVoice=null,_enVoice=null;

// 初始化语音引擎（移动端需要用户交互后才能播放）
function initSpeech(){
  if(!speechSyn)return;
  if(!window.speechSynthesis.getVoices)return;
  let voices=window.speechSynthesis.getVoices();
  if(voices.length>0){
    _voicesLoaded=true;
    _cnVoice=voices.find(v=>v.lang.startsWith('zh'))||voices[0];
    _enVoice=voices.find(v=>v.lang.startsWith('en'))||voices[0];
  }
}

// 监听voices变化（Chrome需要异步加载）
if('speechSynthesis'in window){
  window.speechSynthesis.onvoiceschanged=()=>{
    initSpeech();
  };
}

// 语音始终可播放，不需要toggle开关
function speak(text,lang){
  if(!speechSyn){
    console.warn('Speech synthesis not supported');
    return;
  }
  // 取消之前的播放
  try{speechSyn.cancel()}catch(e){}
  
  let u=new SpeechSynthesisUtterance(text);
  u.lang=lang||'zh-CN';
  u.rate=0.85;u.pitch=1.1;u.volume=1.0;
  
  // 选择合适的语音
  if(lang&&lang.startsWith('en')&&_enVoice){u.voice=_enVoice}
  else if(_cnVoice&&!lang){u.voice=_cnVoice}
  
  // 确保在用户交互上下文中调用
  try{
    speechSyn.speak(u);
  }catch(e){
    // 如果失败，尝试在setTimeout中重试
    setTimeout(()=>{try{speechSyn.speak(u)}catch(e2){console.warn('Speak failed:',e2)}},100);
  }
  
  let btn=document.getElementById('voiceBtn');
  if(btn){btn.classList.add('playing');u.onend=()=>btn.classList.remove('playing')}
}
function toggleVoice(){
  state.voiceOn=!state.voiceOn;
  let btn=document.getElementById('voiceBtn');
  if(state.voiceOn){
    btn.textContent='🔇';
    // 初始化并播放
    initSpeech();
    speak('语音讲解已开启，点击各个板块的语音按钮即可播放');
  } else {
    btn.textContent='🔊';
    try{speechSyn.cancel()}catch(e){}
    btn.classList.remove('playing');
  }
}

// 首次用户交互时初始化语音
function _firstInteractionInit(){
  initSpeech();
  document.removeEventListener('click',_firstInteractionInit);
  document.removeEventListener('touchstart',_firstInteractionInit);
}
document.addEventListener('click',_firstInteractionInit,{once:true});
document.addEventListener('touchstart',_firstInteractionInit,{once:true});

// --- Toast ---
function showToast(msg){
  let t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}

// --- 更新积分显示 ---
function updatePtsDisplay(){
  document.getElementById('todayPts').textContent=state.todayPts;
  document.getElementById('totalPts').textContent=state.pts;
}

// --- 导航 ---
function navigate(section){
  state.section=section;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.section===section));
  document.querySelectorAll('.mbn-item').forEach(n=>n.classList.toggle('active',n.dataset.section===section));
  render();
  let btn=document.getElementById('voiceBtn');
  btn.style.display='flex'; // 始终显示语音按钮
}

// --- 主渲染 ---
function render(){
  let c=document.getElementById('content');
  c.className='content';
  c.innerHTML='';
  switch(state.section){
    case 'home':renderHome(c);break;
    case 'chinese':renderChinese(c);break;
    case 'math':renderMath(c);break;
    case 'english':renderEnglish(c);break;
    case 'sport':renderSport(c);break;
    case 'weiqi':renderWeiqi(c);break;
    case 'ultraman':renderUltraman(c);break;
    case 'wrong':renderWrong(c);break;
  }
}

// ===== 首页 =====
function renderHome(c){
  let ultra=getUltraLevel(state.ultraExp);
  let nextLv=getNextLevel(state.ultraExp);
  let expInLv=state.ultraExp-ultra.exp;
  let expNeed=nextLv?nextLv.exp-ultra.exp:1;
  let expPct=nextLv?Math.round(expInLv/expNeed*100):100;
  
  let date=new Date();
  let weekDay=['日','一','二','三','四','五','六'][date.getDay()];
  
  // 每日任务
  let tasks=[
    {id:'chinese_idiom',name:'成语学习',icon:'📚',pts:5},
    {id:'chinese_poem',name:'古诗背诵',icon:'📜',pts:10},
    {id:'chinese_fill',name:'好句填空',icon:'✏️',pts:5},
    {id:'chinese_quiz',name:'语文小测',icon:'📝',pts:10},
    {id:'chinese_read',name:'阅读打卡',icon:'📖',pts:5},
    {id:'chinese_pic',name:'看图写话',icon:'🎨',pts:8},
    {id:'chinese_comp',name:'阅读理解',icon:'🤔',pts:8},
    {id:'math_calc',name:'数学计算',icon:'🔢',pts:10},
    {id:'math_mul',name:'乘法口诀',icon:'✖️',pts:5},
    {id:'math_think',name:'思维挑战',icon:'🧩',pts:15},
    {id:'eng_word',name:'英语单词',icon:'🔤',pts:10},
    {id:'eng_read',name:'英语阅读',icon:'📰',pts:5},
    {id:'eng_gram',name:'语法练习',icon:'📐',pts:10},
    {id:'eng_listen',name:'英语听力',icon:'👂',pts:10},
    {id:'sport_rope',name:'跳绳打卡',icon:'🏃',pts:15},
    {id:'sport_posture',name:'体态练习',icon:'🧘',pts:10},
    {id:'weiqi_practice',name:'围棋练习',icon:'⚫',pts:10},
    {id:'weiqi_rhyme',name:'围棋口诀',icon:'📜',pts:5},
    {id:'weiqi_quiz',name:'围棋答题',icon:'📝',pts:3}
  ];
  let doneCount=tasks.filter(t=>state.checkins[t.id]).length;
  
  c.innerHTML=`
    <div class="fade-in">
      <div class="card" style="background:linear-gradient(135deg,#4caf7d,#2e7d57);color:#fff;text-align:center">
        <div style="font-size:20px;font-weight:700">今天是 ${date.getMonth()+1}月${date.getDate()}日 星期${weekDay}</div>
        <div style="margin-top:8px;font-size:14px;opacity:0.9">祝一一同学，欢迎回来！加油哦～💪</div>
      </div>
      
      <div class="card">
        <h3>🦸 奥特曼养成</h3>
        <div class="ultra-stage">
          <div class="ultra-avatar">${ultra.emoji}</div>
          <div class="ultra-level">Lv.${ultra.lv} ${ultra.name}</div>
          <div class="exp-bar"><div class="exp-fill" style="width:${expPct}%"></div></div>
          <div style="font-size:13px;opacity:0.8">${nextLv?`距离升级还差 ${nextLv.exp-state.ultraExp} 分`:'已满级！宇宙守护者！🏆'}</div>
        </div>
      </div>

      <div class="card">
        <h3>📋 今日任务 (${doneCount}/${tasks.length})</h3>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(doneCount/tasks.length*100)}%"></div></div>
        <div style="text-align:center;margin:8px 0;font-size:14px;color:var(--text-light)">完成率 ${Math.round(doneCount/tasks.length*100)}%</div>
        <div class="checkin-grid" style="margin-top:12px">
          ${tasks.map(t=>`
            <div class="checkin-item ${state.checkins[t.id]?'done':''}" onclick="navToTask('${t.id}')">
              <div class="icon">${t.icon}</div>
              <div class="name">${t.name}</div>
              <div class="status">${state.checkins[t.id]?'✅ 已完成':`+${t.pts}分`}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h3>📊 今日统计</h3>
          <div style="font-size:16px;line-height:2">
            <div>今日积分：<span class="badge badge-gold">⭐ ${state.todayPts}</span></div>
            <div>累计积分：<span class="badge badge-green">🏆 ${state.pts}</span></div>
            <div>连续打卡：<span class="badge badge-orange">🔥 ${state.streak}天</span></div>
            <div>完成古诗：<span class="badge badge-green">📜 ${Object.keys(state.masteredPoems).filter(k=>state.masteredPoems[k]).length}/${POEMS.length}</span></div>
            <div>错题待攻克：<span class="badge ${WrongBook.getTotalCount()>0?'badge-red':'badge-green'}">📕 ${WrongBook.getTotalCount()}题</span></div>
          </div>
          ${WrongBook.getTotalCount()>0?`<button class="btn btn-sm btn-accent" style="margin-top:8px" onclick="navigate('wrong')">📖 去复习错题</button>`:''}
        </div>
        <div class="card">
          <h3>⚙️ 设置</h3>
          <div style="font-size:15px;line-height:2.2">
            <button class="btn btn-sm btn-outline" onclick="exportData()">📤 导出数据</button>
            <button class="btn btn-sm btn-outline" onclick="document.getElementById('importInput').click()">📥 导入数据</button>
            <input type="file" id="importInput" accept=".json" style="display:none" onchange="importData(event)">
            <button class="btn btn-sm btn-outline" onclick="getShareCode()">🔗 获取分享码</button>
            <div style="margin-top:8px;font-size:13px;color:var(--text-light)">
              💡 导出/导入可在不同设备间同步数据<br>
              💡 语音按钮在右下角，点击开启
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function navToTask(taskId){
  let section=taskId.split('_')[0];
  if(section==='chinese')navigate('chinese');
  else if(section==='math')navigate('math');
  else if(section==='eng')navigate('english');
  else if(section==='sport')navigate('sport');
  else if(section==='weiqi')navigate('weiqi');
}

// ===== 语文板块 =====
function renderChinese(c){
  c.innerHTML=`<div class="fade-in"><div class="section-title">📖 语文学习</div>
  <div class="tabs" id="cnTabs">
    <div class="tab active" data-tab="idiom">📚 成语</div>
    <div class="tab" data-tab="poem">📜 古诗</div>
    <div class="tab" data-tab="fill">✏️ 填空</div>
    <div class="tab" data-tab="quiz">📝 小测</div>
    <div class="tab" data-tab="read">📖 阅读</div>
    <div class="tab" data-tab="comp">🤔 阅读理解</div>
    <div class="tab" data-tab="pic">🎨 看图写话</div>
  </div>
  <div id="cnContent"></div></div>`;
  
  c.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    c.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    renderCnTab(t.dataset.tab);
  });
  renderCnTab('idiom');
}

function renderCnTab(tab){
  let el=document.getElementById('cnContent');
  el.innerHTML='';
  if(tab==='idiom')renderIdiom(el);
  else if(tab==='poem')renderPoem(el);
  else if(tab==='fill')renderFill(el);
  else if(tab==='quiz')renderQuiz(el);
  else if(tab==='read')renderRead(el);
  else if(tab==='pic')renderPic(el);
  else if(tab==='comp')renderComp(el);
}

function renderIdiom(el){
  let dayI=dayIdx()%Math.ceil(IDIOMS.length/5);
  let items=IDIOMS.slice(dayI*5,dayI*5+5);
  if(items.length<5)items=IDIOMS.slice(0,5);
  el.innerHTML=`<div class="card"><h3>📚 今日成语 (每日5个)</h3>
  ${items.map(i=>`<div class="idiom-card"><div class="word">${i.w}</div><div class="meaning">${i.m}</div></div>`).join('')}
  <button class="btn" style="margin-top:10px" onclick="speak('${items.map(i=>i.w+'.'+i.m).join(' ')}')">🔊 语音讲解</button>
  <button class="btn btn-accent" style="margin-top:10px;margin-left:8px" onclick="doCheckin('chinese_idiom',5)">✅ 完成打卡 +5分</button>
  </div>`;
}

function renderPoem(el){
  let masteredCount=Object.keys(state.masteredPoems).filter(k=>state.masteredPoems[k]).length;
  let todayIdx=dayIdx()%POEMS.length;
  let poem=POEMS[todayIdx];
  let isMastered=state.masteredPoems[todayIdx];
  el.innerHTML=`
  <div class="card">
    <h3>📜 今日古诗 (${todayIdx+1}/${POEMS.length})</h3>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="badge badge-green">已掌握 ${masteredCount}/${POEMS.length}</span>
      <button class="btn btn-sm ${isMastered?'btn-accent':'btn-outline'}" onclick="togglePoemMaster(${todayIdx})">${isMastered?'✅ 已掌握':'⬜ 标记掌握'}</button>
    </div>
    <div class="poem-card">
      <div class="title">${poem.t}</div>
      <div class="author">【${poem.a}】</div>
      <div class="pinyin">${poem.p}</div>
      <div class="content">${poem.c}</div>
      <div class="analysis">💡 ${poem.n}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" onclick="speak('${poem.t}。${poem.c}。${poem.n}')">🔊 朗读讲解</button>
      <button class="btn btn-accent" onclick="doCheckin('chinese_poem',10)">✅ 完成打卡 +10分</button>
      <button class="btn btn-outline btn-sm" onclick="prevPoem()">⬅️ 上一首</button>
      <button class="btn btn-outline btn-sm" onclick="nextPoem()">➡️ 下一首</button>
    </div>
  </div>
  <div class="card">
    <h3>📜 古诗列表</h3>
    <div style="max-height:300px;overflow-y:auto">
      ${POEMS.map((p,i)=>`<div style="padding:8px 12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="goPoem(${i})">
        <span>${i+1}. ${p.t} <span style="font-size:13px;color:#999">- ${p.a}</span></span>
        ${state.masteredPoems[i]?'<span class="badge badge-green">✅</span>':''}
      </div>`).join('')}
    </div>
  </div>`;
}
function togglePoemMaster(idx){
  state.masteredPoems[idx]=!state.masteredPoems[idx];
  Store.set('masteredPoems',state.masteredPoems);
  renderCnTab('poem');
}
function goPoem(idx){window._poemIdx=idx;renderPoemWithIdx(idx)}
function prevPoem(){let i=(window._poemIdx!==undefined?window._poemIdx:dayIdx()%POEMS.length)-1;if(i<0)i=POEMS.length-1;renderPoemWithIdx(i)}
function nextPoem(){let i=(window._poemIdx!==undefined?window._poemIdx:dayIdx()%POEMS.length)+1;if(i>=POEMS.length)i=0;renderPoemWithIdx(i)}
function renderPoemWithIdx(idx){
  window._poemIdx=idx;
  let poem=POEMS[idx];
  let isMastered=state.masteredPoems[idx];
  let el=document.getElementById('cnContent');
  let masteredCount=Object.keys(state.masteredPoems).filter(k=>state.masteredPoems[k]).length;
  el.innerHTML=`
  <div class="card">
    <h3>📜 古诗 (${idx+1}/${POEMS.length})</h3>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="badge badge-green">已掌握 ${masteredCount}/${POEMS.length}</span>
      <button class="btn btn-sm ${isMastered?'btn-accent':'btn-outline'}" onclick="togglePoemMaster(${idx})">${isMastered?'✅ 已掌握':'⬜ 标记掌握'}</button>
    </div>
    <div class="poem-card">
      <div class="title">${poem.t}</div>
      <div class="author">【${poem.a}】</div>
      <div class="pinyin">${poem.p}</div>
      <div class="content">${poem.c}</div>
      <div class="analysis">💡 ${poem.n}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" onclick="speak('${poem.t}。${poem.c}。${poem.n}')">🔊 朗读讲解</button>
      <button class="btn btn-accent" onclick="doCheckin('chinese_poem',10)">✅ 完成打卡 +10分</button>
      <button class="btn btn-outline btn-sm" onclick="prevPoem()">⬅️ 上一首</button>
      <button class="btn btn-outline btn-sm" onclick="nextPoem()">➡️ 下一首</button>
    </div>
  </div>
  <div class="card">
    <h3>📜 古诗列表</h3>
    <div style="max-height:300px;overflow-y:auto">
      ${POEMS.map((p,i)=>`<div style="padding:8px 12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between;align-items:center" onclick="goPoem(${i})">
        <span>${i+1}. ${p.t} <span style="font-size:13px;color:#999">- ${p.a}</span></span>
        ${state.masteredPoems[i]?'<span class="badge badge-green">✅</span>':''}
      </div>`).join('')}
    </div>
  </div>`;
}

function renderFill(el){
  let progress=SmartSchedule.getProgress('cn_fill',FILL_BLANKS.length);
  let items=SmartSchedule.pick('cn_fill',FILL_BLANKS,2);
  el.innerHTML=`<div class="card"><h3>✏️ 每日好句填空 (智能2题)</h3>
  <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">📚 题库${FILL_BLANKS.length}题 · 已出${progress.shown}题(${progress.pct}%)</div>
  <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" style="width:${progress.pct}%"></div></div>
  <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">填空答案不唯一，写出合理答案即可。填写后点击"查看答案"核对！</div>
  ${items.map((item,i)=>`
    <div class="math-problem" id="fillCard${i}">
      <div class="q">第${i+1}题</div>
      <div style="font-size:18px;line-height:2;margin:10px 0">${renderFillText(item,i)}</div>
      <div style="margin-top:8px"><span class="tag tag-blue">💡 ${item.hint}</span></div>
      <button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="showFillAnswer(${i})" id="fillAnsBtn${i}">📋 查看答案</button>
      <div id="fillExp${i}" class="hidden" style="margin-top:8px;padding:10px;background:#e3f2fd;border-radius:8px;font-size:14px;line-height:1.7">
        <div style="font-weight:600;margin-bottom:4px">📖 参考答案：</div>
        <div>每个空的参考答案（其他合理答案也算对）：</div>
        ${item.a.map((ans,j)=>`<div style="margin:4px 0">空${j+1}：<b style="color:#1565c0">${ans}</b>${item.alt&&item.alt[j]?`<span style="color:#666;font-size:13px">（也可填：${item.alt[j].join('、')}等）</span>`:''}</div>`).join('')}
        <div style="margin-top:6px">${item.e||''}</div>
      </div>
    </div>`).join('')}
  <button class="btn btn-accent" onclick="doCheckin('chinese_fill',5)">✅ 完成打卡 +5分</button>
  <button class="btn" style="margin-left:8px" onclick="renderCnTab('fill')">🔄 换新题</button>
  </div>`;
}
function renderFillText(item,cardIdx){
  let parts=item.s.split('____');
  let html='';
  for(let i=0;i<parts.length-1;i++){
    html+=parts[i];
    let alts=item.alt&&item.alt[i]?item.alt[i].join('|'):'';
    html+=`<input class="math-input" style="width:100px;font-size:16px" placeholder="填空${i+1}" onblur="checkFill(this,'${item.a[i]}','${alts}')" data-card="${cardIdx}" data-idx="${i}">`;
  }
  html+=parts[parts.length-1];
  return html;
}
function checkFill(inp,answer,altStr){
  let val=inp.value.trim();
  if(!val)return;
  let alts=altStr?altStr.split('|'):[];
  let allAns=[answer,...alts];
  let isCorrect=allAns.some(a=>val===a||val.includes(a)||a.includes(val));
  if(isCorrect){
    inp.style.borderColor='#4caf50';inp.style.background='#c8e6c9';
  } else {
    inp.style.borderColor='#ef5350';inp.style.background='#ffebee';
  }
}
function showFillAnswer(cardIdx){
  let exp=document.getElementById('fillExp'+cardIdx);
  let btn=document.getElementById('fillAnsBtn'+cardIdx);
  if(exp.classList.contains('hidden')){
    exp.classList.remove('hidden');
    btn.textContent='📋 收起答案';
  } else {
    exp.classList.add('hidden');
    btn.textContent='📋 查看答案';
  }
}

function renderQuiz(el){
  let allQuiz=typeof CHINESE_QUIZ!=='undefined'?CHINESE_QUIZ:getChineseQuiz();
  let progress=SmartSchedule.getProgress('cn_quiz',allQuiz.length);
  let items=SmartSchedule.pick('cn_quiz',allQuiz,5);
  let html=`<div class="card"><h3>📝 每日小测试 (智能出题5题)</h3>
  <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">📚 题库${allQuiz.length}题 · 已出${progress.shown}题(${progress.pct}%) · 错题${WrongBook.getSubjectCount('cn_quiz')}题</div>
  <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" style="width:${progress.pct}%"></div></div>
  <div id="quizArea">`;
  items.forEach((q,i)=>{
    let origIdx=allQuiz.indexOf(q);
    q._origIdx=origIdx;
    let opts=q.o2||q.o;
    let ans=q.a2!==undefined?q.a2:q.a;
    html+=`<div class="math-problem" id="q${i}">
      <div class="q">${i+1}. ${q.q}</div>
      ${opts.map((o,j)=>`<div class="quiz-option" onclick="answerCnQuiz(${i},${j},${ans})">${String.fromCharCode(65+j)}. ${o}</div>`).join('')}
      <div id="qExp${i}" class="hidden" style="margin-top:8px;padding:10px;border-radius:8px;font-size:14px;line-height:1.7"></div>
    </div>`;
  });
  html+=`</div><button class="btn btn-accent" onclick="doCheckin('chinese_quiz',10)">✅ 完成打卡 +10分</button>
  <button class="btn" style="margin-left:8px" onclick="renderCnTab('quiz')">🔄 换新题</button></div>`;
  el.innerHTML=html;
  window._cnQuizItems=items;
}
function getChineseQuiz(){
  return[
  {q:"'白日依山尽'的下一句是？",o:["黄河入海流","千里江陵一日还","两岸猿声啼不住"],a:0},
  {q:"'春眠不觉晓'的作者是？",o:["李白","孟浩然","杜甫"],a:1},
  {q:"'锄禾日当午'描写的是什么季节？",o:["春天","夏天","秋天"],a:1},
  {q:"'两个黄鹂鸣翠柳'描写的是什么季节？",o:["春天","夏天","秋天"],a:0},
  {q:"'千山鸟飞绝'描写的是什么天气？",o:["晴天","雪天","雨天"],a:1},
  {q:"'谁知盘中餐'的下一句是？",o:["粒粒皆辛苦","汗滴禾下土","锄禾日当午"],a:0},
  {q:"'飞流直下三千尺'描写的是哪个瀑布？",o:["庐山瀑布","黄果树瀑布","壶口瀑布"],a:0},
  {q:"'孤帆远影碧空尽'描写的是哪条江？",o:["长江","黄河","珠江"],a:0},
  {q:"'儿童散学归来早'下一句是？",o:["忙趁东风放纸鸢","忙趁春风放风筝","忙趁东风放纸鸢"],a:0},
  {q:"'草长莺飞二月天'描写的是哪个季节？",o:["春天","夏天","秋天"],a:0},
  {q:"'小荷才露尖尖角'下一句是？",o:["早有蜻蜓立上头","映日荷花别样红","接天莲叶无穷碧"],a:0},
  {q:"'鹅毛大雪'中的'鹅毛'是比喻什么？",o:["雪花","大雪","冬天"],a:0},
  {q:"'停车坐爱枫林晚'中的'坐'是什么意思？",o:["坐下","因为","坐车"],a:1},
  {q:"'窗含西岭千秋雪'中'含'的意思是？",o:["包含","嘴里含着","含有"],a:0}
  ];
}
function answerCnQuiz(qIdx,optIdx,ansIdx){
  let q=document.getElementById('q'+qIdx);
  let opts=q.querySelectorAll('.quiz-option');
  let isCorrect=optIdx===ansIdx;
  let items=window._cnQuizItems||[];
  let exp=items[qIdx]?(items[qIdx].e||''):'';
  let qData=items[qIdx];
  let origIdx=qData?qData._origIdx:qIdx;
  opts.forEach((o,i)=>{
    o.onclick=null;
    if(i===ansIdx)o.classList.add('correct');
    if(i===optIdx&&i!==ansIdx)o.classList.add('wrong');
  });
  let expEl=document.getElementById('qExp'+qIdx);
  if(expEl){
    expEl.classList.remove('hidden');
    expEl.style.background=isCorrect?'#e8f5e9':'#fff3e0';
    expEl.style.borderLeft='4px solid '+(isCorrect?'#4caf50':'#ff9800');
    expEl.innerHTML=`<div style="font-weight:600;margin-bottom:4px">${isCorrect?'🎉 回答正确！':'📖 正确答案是 '+String.fromCharCode(65+ansIdx)+'.'}</div>`+
      (exp?`<div>${exp}</div>`:'');
  }
  // 错题追踪
  if(!isCorrect&&qData){
    WrongBook.add('cn_quiz',origIdx,{q:qData.q,o:qData.o2||qData.o,a:qData.a2!==undefined?qData.a2:qData.a,e:qData.e||''});
  } else if(isCorrect&&qData){
    WrongBook.master('cn_quiz',origIdx);
  }
}

function renderRead(el){
  el.innerHTML=`<div class="card"><h3>📖 语文阅读打卡</h3>
  <div style="font-size:16px;line-height:1.8;color:var(--text-light);margin-bottom:12px">每天坚持阅读15分钟，记录你的阅读足迹！</div>
  <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:12px">
    <div style="font-weight:600;margin-bottom:8px">今天读了什么书？</div>
    <input class="math-input" style="width:100%;text-align:left" placeholder="书名" id="readBook">
    <div style="font-weight:600;margin:10px 0 8px">阅读了多少分钟？</div>
    <input class="math-input" style="width:100px" type="number" placeholder="分钟" id="readMin">
    <div style="font-weight:600;margin:10px 0 8px">一句话感想</div>
    <textarea class="write-area" placeholder="写下你的感想..." id="readNote" style="min-height:60px"></textarea>
  </div>
  <button class="btn btn-accent" onclick="saveRead()">✅ 提交打卡 +5分</button>
  </div>
  <div class="card"><h3>📊 阅读记录</h3>
  <div id="readHistory">${renderReadHistory()}</div></div>`;
}
function saveRead(){
  let book=document.getElementById('readBook').value;
  let min=document.getElementById('readMin').value;
  let note=document.getElementById('readNote').value;
  if(!book){showToast('请输入书名');return}
  let reads=Store.get('readHistory',[]);
  reads.push({date:today(),book,min,note});
  Store.set('readHistory',reads);
  doCheckin('chinese_read',5);
  renderCnTab('read');
}
function renderReadHistory(){
  let reads=Store.get('readHistory',[]);
  if(!reads.length)return'<div style="color:var(--text-light)">还没有阅读记录，快开始阅读吧！</div>';
  return reads.slice(-10).reverse().map(r=>
    `<div style="padding:10px;border-bottom:1px solid #eee">
      <div style="font-weight:600">${r.book} <span class="tag tag-green">${r.min||0}分钟</span></div>
      <div style="font-size:13px;color:#999">${r.date}</div>
      ${r.note?`<div style="font-size:14px;margin-top:4px">${r.note}</div>`:''}
    </div>`).join('');
}

function renderPic(el){
  let cats=[...new Set(CN_PIC_WRITINGS.map(w=>w.u))];
  let filtered=state.cnPicCat==='all'?CN_PIC_WRITINGS:CN_PIC_WRITINGS.filter(w=>w.u===state.cnPicCat);
  let idx=state.cnPicIdx%filtered.length;
  let item=filtered[idx];
  let doneCount=Object.keys(state.cnPicDone).filter(k=>state.cnPicDone[k]).length;
  el.innerHTML=`<div class="card"><h3>🎨 看图写话 (${idx+1}/${filtered.length})</h3>
  <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
    <button class="btn btn-sm ${state.cnPicCat==='all'?'btn-accent':'btn-outline'}" onclick="switchPicCat('all')">全部</button>
    ${cats.map(c=>`<button class="btn btn-sm ${state.cnPicCat===c?'btn-accent':'btn-outline'}" onclick="switchPicCat('${c}')">${c}</button>`).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span class="badge badge-green">已完成 ${doneCount}/${CN_PIC_WRITINGS.length}</span>
    <span class="badge ${state.cnPicDone[item.t]?'badge-green':'badge-orange'}">${state.cnPicDone[item.t]?'✅ 已写':'⬜ 未写'}</span>
  </div>
  <div style="background:#f0f7ff;padding:20px;border-radius:12px;text-align:center;margin-bottom:12px">
    <div style="font-size:20px;font-weight:700;margin-bottom:8px">${item.t}</div>
    <div style="font-size:40px;margin:10px 0">${item.emoji}</div>
    <div style="font-size:14px;color:#666;margin-top:6px">${item.scene}</div>
  </div>
  <div style="background:#fff8e1;padding:12px;border-radius:10px;margin-bottom:10px">
    <div style="font-weight:600;margin-bottom:6px">💡 写作提示：</div>
    <div style="font-size:15px">${item.guide}</div>
    <div style="margin-top:8px">关键词：<span class="tag tag-orange">${item.keywords.join('</span> <span class="tag tag-orange">')}</span></div>
  </div>
  <textarea class="write-area" placeholder="在这里写你的看图写话..." id="picWrite" style="min-height:140px"></textarea>
  <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-accent" onclick="savePicWrite('${item.t}')">✅ 提交写话 +8分</button>
    <button class="btn" onclick="speak(document.getElementById('picWrite').value||'${item.guide}')">🔊 朗读</button>
    <button class="btn btn-outline" onclick="toggleModel()">📖 范文</button>
    <button class="btn btn-outline" onclick="prevPic()">⬅️ 上一题</button>
    <button class="btn btn-outline" onclick="nextPic(${filtered.length})">下一题 ➡️</button>
  </div>
  <div id="modelEssay" style="display:none;margin-top:12px;background:#e8f5e9;padding:14px;border-radius:10px;border-left:4px solid #4caf7d">
    <div style="font-weight:700;margin-bottom:8px;color:#2e7d57">📝 参考范文</div>
    <div style="font-size:15px;line-height:1.9">${item.model}</div>
    <div style="margin-top:10px;padding:8px;background:#fff;border-radius:8px;font-size:13px;color:#666">💡 ${item.tips}</div>
  </div></div>`;
}
function toggleModel(){
  let d=document.getElementById('modelEssay');
  d.style.display=d.style.display==='none'?'block':'none';
}
function switchPicCat(cat){
  state.cnPicCat=cat;state.cnPicIdx=0;
  Store.set('cnPicCat',cat);Store.set('cnPicIdx',0);
  renderCnTab('pic');
}
function prevPic(){
  let filtered=state.cnPicCat==='all'?CN_PIC_WRITINGS:CN_PIC_WRITINGS.filter(w=>w.u===state.cnPicCat);
  state.cnPicIdx=(state.cnPicIdx-1+filtered.length)%filtered.length;
  Store.set('cnPicIdx',state.cnPicIdx);
  renderCnTab('pic');
}
function nextPic(total){
  let filtered=state.cnPicCat==='all'?CN_PIC_WRITINGS:CN_PIC_WRITINGS.filter(w=>w.u===state.cnPicCat);
  state.cnPicIdx=(state.cnPicIdx+1)%filtered.length;
  Store.set('cnPicIdx',state.cnPicIdx);
  renderCnTab('pic');
}
function savePicWrite(title){
  let txt=document.getElementById('picWrite').value;
  if(!txt||txt.length<15){showToast('再写详细一点哦～至少15个字');return}
  state.cnPicDone[title]=true;Store.set('cnPicDone',state.cnPicDone);
  doCheckin('chinese_pic',8);
}

function renderComp(el){
  let cats=[...new Set(CN_READINGS.map(r=>r.g))];
  let filtered=state.cnReadCat==='all'?CN_READINGS:CN_READINGS.filter(r=>r.g===state.cnReadCat);
  if(state.cnReadIdx>=filtered.length)state.cnReadIdx=0;
  let idx=state.cnReadIdx%filtered.length;
  let item=filtered[idx];
  let doneCount=Object.keys(state.cnReadDone).filter(k=>state.cnReadDone[k]).length;
  el.innerHTML=`<div class="card"><h3>📖 阅读理解 (${idx+1}/${filtered.length})</h3>
  <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
    <button class="btn btn-sm ${state.cnReadCat==='all'?'btn-accent':'btn-outline'}" onclick="switchReadCat('all')">全部</button>
    ${cats.map(c=>`<button class="btn btn-sm ${state.cnReadCat===c?'btn-accent':'btn-outline'}" onclick="switchReadCat('${c}')">${c}</button>`).join('')}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span class="badge badge-green">已完成 ${doneCount}/${CN_READINGS.length}</span>
    <span class="badge ${state.cnReadDone[item.l+item.t]?'badge-green':'badge-orange'}">${state.cnReadDone[item.l+item.t]?'✅ 已做':'⬜ 未做'}</span>
  </div>
  <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:14px;font-size:17px;line-height:1.9;white-space:pre-wrap">
    <div style="font-weight:700;font-size:18px;margin-bottom:4px;color:#2e7d57">${item.g} ${item.l}《${item.t}》</div>
    ${item.p}
  </div>
  <div id="compQuestions">${item.qs.map((q,i)=>renderQuestion(q,i)).join('')}</div>
  <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-accent" onclick="checkReading(${idx})">✅ 提交答案</button>
    <button class="btn btn-outline" onclick="showAnswers(${idx})">👁️ 查看答案</button>
    <button class="btn btn-outline" onclick="prevRead()">⬅️ 上一篇</button>
    <button class="btn btn-outline" onclick="nextRead()">下一篇 ➡️</button>
  </div>
  <div id="compResult"></div></div>`;
}
function renderQuestion(q,i){
  if(q.ty==='choice'){
    return `<div class="math-problem" style="margin-bottom:10px">
      <div class="q" style="margin-bottom:8px">${i+1}. ${q.q}</div>
      <div style="display:flex;flex-direction:column;gap:6px;padding-left:12px">
        ${q.o.map((opt,j)=>`<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 10px;border-radius:8px;border:1px solid #e0e0e0" onclick="selectChoice(${i},${j})" id="opt${i}_${j}">
          <input type="radio" name="comp${i}" value="${j}" style="width:20px;height:20px" onchange="selectChoice(${i},${j})">
          <span style="font-size:16px">${String.fromCharCode(65+j)}. ${opt}</span>
        </label>`).join('')}
      </div>
    </div>`;
  } else {
    return `<div class="math-problem" style="margin-bottom:10px">
      <div class="q" style="margin-bottom:8px">${i+1}. ${q.q}</div>
      <input class="math-input" style="width:100%;text-align:left;font-size:16px" placeholder="请输入答案" id="compA${i}">
    </div>`;
  }
}
function selectChoice(qi,oi){
  document.querySelectorAll(`[id^="opt${qi}_"]`).forEach(el=>el.style.background='');
  let el=document.getElementById('opt'+qi+'_'+oi);
  if(el)el.style.background='#e8f5e9';
}
function switchReadCat(cat){
  state.cnReadCat=cat;state.cnReadIdx=0;
  Store.set('cnReadCat',cat);Store.set('cnReadIdx',0);
  renderCnTab('comp');
}
function prevRead(){
  let filtered=state.cnReadCat==='all'?CN_READINGS:CN_READINGS.filter(r=>r.g===state.cnReadCat);
  state.cnReadIdx=(state.cnReadIdx-1+filtered.length)%filtered.length;
  Store.set('cnReadIdx',state.cnReadIdx);
  renderCnTab('comp');
}
function nextRead(){
  let filtered=state.cnReadCat==='all'?CN_READINGS:CN_READINGS.filter(r=>r.g===state.cnReadCat);
  state.cnReadIdx=(state.cnReadIdx+1)%filtered.length;
  Store.set('cnReadIdx',state.cnReadIdx);
  renderCnTab('comp');
}
function checkReading(idx){
  let filtered=state.cnReadCat==='all'?CN_READINGS:CN_READINGS.filter(r=>r.g===state.cnReadCat);
  let item=filtered[idx];
  let correct=0,total=item.qs.length;
  item.qs.forEach((q,i)=>{
    if(q.ty==='choice'){
      let selected=document.querySelector(`input[name="comp${i}"]:checked`);
      let opts=document.querySelectorAll(`[id^="opt${i}_"]`);
      opts.forEach((el,j)=>{
        if(j===q.a)el.style.background='#c8e6c9';
        else if(selected&&j==selected.value)el.style.background='#ffcdd2';
        else el.style.background='';
      });
      if(selected&&parseInt(selected.value)===q.a)correct++;
    } else {
      let inp=document.getElementById('compA'+i);
      let val=inp.value.trim();
      if(val&&val.includes(q.a)||val===q.a){
        inp.style.borderColor='#4caf50';inp.style.background='#c8e6c9';correct++;
      } else if(val){
        inp.style.borderColor='#ef5350';inp.style.background='#ffcdd2';
      } else {
        inp.style.borderColor='#ccc';
      }
    }
  });
  let pct=Math.round(correct/total*100);
  let result=document.getElementById('compResult');
  result.innerHTML=`<div style="margin-top:12px;padding:14px;border-radius:10px;background:${pct>=80?'#e8f5e9':pct>=50?'#fff8e1':'#ffebee'};text-align:center">
    <div style="font-size:22px;font-weight:700">${pct>=80?'🎉':pct>=50?'💪':'📖'} 答对 ${correct}/${total} 题，正确率 ${pct}%</div>
    ${pct>=80?'<div style="margin-top:6px;color:#2e7d57">太棒了！你真是个阅读小能手！</div>':pct>=50?'<div style="margin-top:6px;color:#f57c00">不错哦！再仔细读读课文就能更好了！</div>':'<div style="margin-top:6px;color:#c62828">没关系，多读几遍课文再试试吧！</div>'}
  </div>`;
  if(pct>=80){
    state.cnReadDone[item.l+item.t]=true;Store.set('cnReadDone',state.cnReadDone);
    doCheckin('chinese_comp',8);
  }
}
function showAnswers(idx){
  let filtered=state.cnReadCat==='all'?CN_READINGS:CN_READINGS.filter(r=>r.g===state.cnReadCat);
  let item=filtered[idx];
  let html=item.qs.map((q,i)=>{
    if(q.ty==='choice'){
      return `<div style="margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:8px">
        <span style="font-weight:600">${i+1}. 答案：${String.fromCharCode(65+q.a)}</span>
        <span style="color:#666;margin-left:8px">${q.o[q.a]}</span>
      </div>`;
    } else {
      return `<div style="margin-bottom:8px;padding:8px;background:#f5f5f5;border-radius:8px">
        <span style="font-weight:600">${i+1}. 参考答案：</span><span style="color:#2e7d57">${q.a}</span>
      </div>`;
    }
  }).join('');
  document.getElementById('compResult').innerHTML=`<div style="margin-top:12px;padding:14px;border-radius:10px;background:#e3f2fd;border-left:4px solid #2196f3">
    <div style="font-weight:700;margin-bottom:8px">📋 参考答案</div>${html}
  </div>`;
}

// ===== 数学板块 =====
function renderMath(c){
  c.innerHTML=`<div class="fade-in"><div class="section-title">🔢 数学乐园</div>
  <div class="tabs">
    <div class="tab active" data-tab="calc">➕ 加减法</div>
    <div class="tab" data-tab="mul">✖️ 乘法口诀</div>
    <div class="tab" data-tab="think">🧩 思维题</div>
  </div>
  <div id="mathContent"></div></div>`;
  c.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    c.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    renderMathTab(t.dataset.tab);
  });
  renderMathTab('calc');
}
function renderMathTab(tab){
  let el=document.getElementById('mathContent');el.innerHTML='';
  if(tab==='calc')renderCalc(el);
  else if(tab==='mul')renderMul(el);
  else if(tab==='think')renderThink(el);
}

function renderCalc(el){
  el.innerHTML=`<div class="card">
  <h3>🔢 每日数学30题 (计时挑战)</h3>
  <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">混合运算：加减法+乘除法，每天30题</div>
  <div style="display:flex;justify-content:center;gap:16px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
    <div style="text-align:center">
      <div style="font-size:14px;color:var(--text-light)">计时器</div>
      <div class="timer-display" id="calcTimer">180</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:14px;color:var(--text-light)">完成/30</div>
      <div style="font-size:32px;font-weight:700;color:var(--primary)" id="calcCount">0</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:14px;color:var(--text-light)">正确</div>
      <div style="font-size:32px;font-weight:700;color:#4caf50" id="calcCorrectDisplay">0</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:14px;color:var(--text-light)">正确率</div>
      <div style="font-size:32px;font-weight:700;color:var(--accent)" id="calcAcc">-</div>
    </div>
  </div>
  <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" id="calcProgressBar" style="width:0%"></div></div>
  <div id="calcProblems"></div>
  <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
    <button class="btn btn-lg" id="calcStartBtn" onclick="startCalc()">▶️ 开始挑战</button>
    <button class="btn btn-outline btn-lg" onclick="newCalcProblems()">🔄 换新题</button>
  </div>
  <div style="margin-top:10px">
    <button class="btn btn-accent" onclick="doCheckin('math_calc',10)">✅ 完成打卡 +10分</button>
    <span style="margin-left:8px;font-size:13px;color:var(--text-light)">完成全部30题即可打卡</span>
  </div>
  </div>`;
  newCalcProblems();
}
let calcTimer=null,calcTime=180,calcDone=0,calcCorrect=0,calcTotal=0;
const CALC_TOTAL=30;
function newCalcProblems(){
  let el=document.getElementById('calcProblems');if(!el)return;
  let html='';
  for(let i=0;i<CALC_TOTAL;i++){
    let type=Math.floor(Math.random()*4); // 0:add 1:sub 2:mul 3:div
    let a,b,q,op;
    if(type===0){ // 加法
      a=Math.floor(Math.random()*40)+10; b=Math.floor(Math.random()*40)+5; q=a+b; op='+';
    } else if(type===1){ // 减法
      a=Math.floor(Math.random()*50)+30; b=Math.floor(Math.random()*30)+5; if(b>a){[a,b]=[b,a]} q=a-b; op='-';
    } else if(type===2){ // 乘法
      a=Math.floor(Math.random()*8)+2; b=Math.floor(Math.random()*8)+2; q=a*b; op='×';
    } else { // 除法
      b=Math.floor(Math.random()*8)+2; q=Math.floor(Math.random()*8)+2; a=b*q; op='÷';
    }
    html+=`<div class="math-problem" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <span style="font-size:13px;color:#999;width:28px">${i+1}.</span>
      <span style="font-size:20px;font-weight:600">${a} ${op} ${b} = </span>
      <input class="math-input" style="width:70px" data-ans="${q}" data-idx="${i}" onkeyup="checkCalcAns(this,event)">
      <span class="check-mark" style="font-size:18px"></span>
    </div>`;
  }
  el.innerHTML=html;
  // 重置统计
  calcDone=0;calcCorrect=0;calcTotal=0;
  updateCalcStats();
}
function updateCalcStats(){
  let cntEl=document.getElementById('calcCount');
  if(cntEl)cntEl.textContent=calcDone;
  let corEl=document.getElementById('calcCorrectDisplay');
  if(corEl)corEl.textContent=calcCorrect;
  let accEl=document.getElementById('calcAcc');
  if(accEl)accEl.textContent=calcTotal>0?Math.round(calcCorrect/calcTotal*100)+'%':'-';
  let pb=document.getElementById('calcProgressBar');
  if(pb)pb.style.width=Math.round(calcDone/CALC_TOTAL*100)+'%';
}
function startCalc(){
  calcTime=180;calcDone=0;calcCorrect=0;calcTotal=0;
  updateCalcStats();
  newCalcProblems();
  let btn=document.getElementById('calcStartBtn');
  btn.textContent='⏹️ 进行中...';btn.disabled=true;
  calcTimer=setInterval(()=>{
    calcTime--;
    let el=document.getElementById('calcTimer');
    if(el){
      let m=Math.floor(calcTime/60),s=calcTime%60;
      el.textContent=m+':'+String(s).padStart(2,'0');
    }
    if(calcTime<=0){
      clearInterval(calcTimer);calcTimer=null;
      btn.textContent='▶️ 再来一次';btn.disabled=false;
      showToast(`时间到！完成${calcDone}题，正确${calcCorrect}题`);
    }
    if(calcDone>=CALC_TOTAL&&calcTimer){
      clearInterval(calcTimer);calcTimer=null;
      btn.textContent='▶️ 再来一次';btn.disabled=false;
      showToast(`太棒了！30题全部完成！正确${calcCorrect}题 🎉`);
    }
  },1000);
}
function checkCalcAns(inp,ev){
  if(inp.dataset.checked)return;
  // 清除之前的延迟定时器，避免边输入边误判
  if(inp._calcTimer)clearTimeout(inp._calcTimer);
  // Enter 立即判断并跳下一题
  if(ev&&ev.key==='Enter'){
    doCheckCalc(inp);
    let inputs=document.querySelectorAll('#calcProblems input');
    let idx=parseInt(inp.dataset.idx);
    if(idx+1<inputs.length)inputs[idx+1].focus();
    return;
  }
  // 输入过程中延迟 500ms 再判断（等用户输完）
  inp._calcTimer=setTimeout(()=>doCheckCalc(inp),500);
}
function doCheckCalc(inp){
  if(inp.dataset.checked)return;
  let ans=parseInt(inp.dataset.ans);
  let val=parseInt(inp.value);
  if(!isNaN(val)){
    inp.dataset.checked='1';
    if(inp._calcTimer){clearTimeout(inp._calcTimer);inp._calcTimer=null;}
    calcTotal++;calcDone++;
    let mark=inp.nextElementSibling;
    if(val===ans){
      inp.style.borderColor='#4caf50';inp.style.background='#c8e6c9';mark.textContent='✅';calcCorrect++;
    } else {
      inp.style.borderColor='#ef5350';inp.style.background='#ffebee';mark.textContent='❌ '+ans;
      // 在输入框旁添加简短提示
      if(!inp.nextElementSibling.nextElementSibling||!inp.nextElementSibling.nextElementSibling.classList.contains('calc-hint')){
        let hint=document.createElement('span');
        hint.className='calc-hint';
        hint.style.cssText='font-size:12px;color:#e65100;margin-left:4px';
        let a=parseInt(inp.dataset.ans);
        hint.textContent='应为 '+a;
        mark.after(hint);
      }
    }
    updateCalcStats();
  }
}

function renderMul(el){
  el.innerHTML=`<div class="card"><h3>✖️ 乘法口诀表</h3>
  <div id="mulTable" style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;text-align:center;font-size:14px"></div>
  <button class="btn" style="margin-top:12px" onclick="speak('乘法口诀表练习')">🔊 语音提示</button>
  <button class="btn btn-accent" style="margin-top:12px;margin-left:8px" onclick="doCheckin('math_mul',5)">✅ 完成打卡 +5分</button>
  </div>
  <div class="card"><h3>🎲 乘法挑战</h3>
  <div id="mulChallenge"></div>
  <button class="btn btn-lg" style="margin-top:10px" onclick="startMulChallenge()">▶️ 开始挑战</button>
  </div>`;
  // 渲染乘法表
  let tbl=document.getElementById('mulTable');let html='';
  html+='<div></div>';
  for(let j=1;j<=9;j++)html+=`<div style="font-weight:700;color:var(--primary)">${j}</div>`;
  for(let i=1;i<=9;i++){
    html+=`<div style="font-weight:700;color:var(--primary)">${i}</div>`;
    for(let j=1;j<=9;j++){
      let bg=i%2===j%2?'#f5f9f5':'#fff';
      html+=`<div style="padding:6px;background:${bg};border-radius:4px">${i*j}</div>`;
    }
  }
  tbl.innerHTML=html;
}
let mulIdx=0,mulDone=0,mulCorrect=0;
function startMulChallenge(){
  mulDone=0;mulCorrect=0;
  nextMulQ();
}
function nextMulQ(){
  let a=Math.floor(Math.random()*8)+2;
  let b=Math.floor(Math.random()*8)+2;
  let ans=a*b;
  let el=document.getElementById('mulChallenge');
  el.innerHTML=`<div class="math-problem">
    <div class="q" style="text-align:center">${a} × ${b} = ?</div>
    <div style="display:flex;justify-content:center;gap:8px">
      <input class="math-input" id="mulAns" onkeyup="if(event.key==='Enter')checkMulAns(${ans})" autofocus>
      <button class="btn" onclick="checkMulAns(${ans})">确认</button>
    </div>
    <div id="mulResult"></div>
  </div>
  <div style="text-align:center;margin-top:8px;font-size:15px">已完成：${mulDone} | 正确：${mulCorrect}</div>`;
  let inp=document.getElementById('mulAns');if(inp)inp.focus();
}
function checkMulAns(ans){
  let inp=document.getElementById('mulAns');
  let val=parseInt(inp.value);
  let result=document.getElementById('mulResult');
  mulDone++;
  if(val===ans){mulCorrect++;result.innerHTML='<span style="color:#4caf50;font-size:20px">✅ 正确！</span>'}
  else{result.innerHTML=`<span style="color:#ef5350;font-size:20px">❌ 答案是 ${ans}</span>`}
  setTimeout(nextMulQ,1500);
}

function renderThink(el){
  let progress=SmartSchedule.getProgress('math_think',MATH_THINKING.length);
  let items=SmartSchedule.pick('math_think',MATH_THINKING,3);
  items.forEach((item,i)=>{item._origIdx=MATH_THINKING.indexOf(item)});
  el.innerHTML=`<div class="card"><h3>🧩 每日思维挑战 (智能3题)</h3>
  <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">📚 题库${MATH_THINKING.length}题 · 已出${progress.shown}题(${progress.pct}%) · 错题${WrongBook.getSubjectCount('math_think')}题</div>
  <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" style="width:${progress.pct}%"></div></div>
  <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">参考学而思小学数学思维培养3级</div>
  ${items.map((item,i)=>`
    <div class="math-problem" id="think${i}">
      <div style="margin-bottom:6px"><span class="tag tag-purple">${item.t}</span></div>
      <div class="q">${i+1}. ${item.q}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
        <input class="math-input" id="thinkAns${i}" style="width:120px;text-align:left" placeholder="你的答案">
        <button class="btn btn-sm" onclick="checkThink(${i},${JSON.stringify(item).replace(/"/g,'&quot;')})">提交</button>
      </div>
      <div id="thinkExp${i}" class="hidden" style="margin-top:10px;padding:12px;background:#fff8e1;border-radius:8px;font-size:15px;line-height:1.6">
        <div style="font-weight:600;margin-bottom:4px">💡 解析：</div>${item.e}
      </div>
    </div>`).join('')}
  <button class="btn btn-accent" onclick="doCheckin('math_think',15)">✅ 完成打卡 +15分</button>
  <button class="btn btn-outline" style="margin-left:8px" onclick="renderMathTab('think')">🔄 换新题</button>
  </div>`;
}
function checkThink(idx,item){
  let inp=document.getElementById('thinkAns'+idx);
  let val=inp.value.trim();
  let exp=document.getElementById('thinkExp'+idx);
  exp.classList.remove('hidden');
  let correct=String(item.a)===val||String(item.a).includes(val)||val.includes(String(item.a));
  if(correct){
    inp.style.borderColor='#4caf50';inp.style.background='#c8e6c9';
    exp.style.background='#e8f5e9';exp.style.borderLeft='4px solid #4caf50';
    exp.innerHTML='<div style="font-weight:600;margin-bottom:4px">🎉 回答正确！答案：'+item.a+'</div><div style="font-weight:600;margin-bottom:4px">💡 解析：</div>'+item.e;
    if(item._origIdx!==undefined)WrongBook.master('math_think',item._origIdx);
  } else {
    inp.style.borderColor='#ef5350';inp.style.background='#ffebee';
    exp.style.background='#fff3e0';exp.style.borderLeft='4px solid #ff9800';
    exp.innerHTML='<div style="font-weight:600;margin-bottom:4px">📖 正确答案：'+item.a+'</div><div style="font-weight:600;margin-bottom:4px">💡 解析：</div>'+item.e;
    if(item._origIdx!==undefined)WrongBook.add('math_think',item._origIdx,{q:item.q,a:item.a,e:item.e,t:item.t});
  }
}

// ===== 英语板块 =====
function getEngWords(){return state.engBook===2?PU2_WORDS:PU1_WORDS}
function getEngGrammar(){return state.engBook===2?GRAMMAR_QUESTIONS:PU1_GRAMMAR}
function getEngReadings(){return state.engBook===2?ENGLISH_READINGS:PU1_READINGS}
function getEngListenings(){return state.engBook===2?PU2_LISTENING:PU1_LISTENING}
function switchEngBook(book){
  state.engBook=book;
  Store.set('engBook',book);
  renderEngTab(document.querySelector('.tab.active')?.dataset.tab||'word');
}
function renderEnglish(c){
  c.innerHTML=`<div class="fade-in"><div class="section-title">🔤 英语学习</div>
  <div style="display:flex;gap:8px;margin-bottom:14px;justify-content:center">
    <button class="btn ${state.engBook===1?'btn-accent':'btn-outline'}" onclick="switchEngBook(1)">📘 Power Up 1</button>
    <button class="btn ${state.engBook===2?'btn-accent':'btn-outline'}" onclick="switchEngBook(2)">📗 Power Up 2</button>
  </div>
  <div class="tabs">
    <div class="tab active" data-tab="word">📚 单词</div>
    <div class="tab" data-tab="read">📖 阅读</div>
    <div class="tab" data-tab="gram">📐 语法</div>
    <div class="tab" data-tab="listen">👂 听力</div>
  </div>
  <div id="engContent"></div></div>`;
  c.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    c.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    renderEngTab(t.dataset.tab);
  });
  renderEngTab('word');
}
function renderEngTab(tab){
  let el=document.getElementById('engContent');if(!el)return;el.innerHTML='';
  if(tab==='word')renderWord(el);
  else if(tab==='read')renderEngRead(el);
  else if(tab==='gram')renderGram(el);
  else if(tab==='listen')renderListen(el);
}

function renderWord(el){
  let WORDS=getEngWords();
  let bookName=state.engBook===2?'Power Up 2':'Power Up 1';
  // 每日2个单词，按日期轮换
  let idx=dayIdx()*2%WORDS.length;
  let words=[WORDS[idx],WORDS[(idx+1)%WORDS.length]];
  el.innerHTML=`<div class="card"><h3>📚 每日单词 (${bookName})</h3>
  ${words.map(w=>`
    <div class="word-card">
      <div class="word">${w.w}</div>
      <div class="phonetic">${w.ph}</div>
      <div class="meaning">${w.pos} ${w.m}</div>
      <div class="example">"${w.e}"</div>
    </div>`).join('')}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
    <button class="btn" onclick="speak('${words[0].w}. ${words[0].m}. ${words[0].e}','en-US')">🔊 读单词1</button>
    <button class="btn" onclick="speak('${words[1].w}. ${words[1].m}. ${words[1].e}','en-US')">🔊 读单词2</button>
    <button class="btn btn-accent" onclick="doCheckin('eng_word',10)">✅ 完成打卡 +10分</button>
  </div>
  </div>
  <div class="card"><h3>📖 ${bookName} 全部单词 (${WORDS.length}个)</h3>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    ${[1,2,3,4,5,6,7,8,9].map(u=>`<span class="tag tag-blue" style="cursor:pointer" onclick="filterWord(${u})">Unit ${u}</span>`).join('')}
    <span class="tag tag-green" style="cursor:pointer" onclick="filterWord(0)">全部</span>
  </div>
  <div id="wordList" style="max-height:300px;overflow-y:auto">
  ${WORDS.map(w=>`<div style="padding:8px;border-bottom:1px solid #eee">
    <span style="font-weight:600;font-size:16px">${w.w}</span>
    <span style="color:#888;font-size:14px"> ${w.ph}</span>
    <span style="color:#555"> ${w.pos} ${w.m}</span>
    <button class="btn btn-sm btn-outline" style="float:right" onclick="speak('${w.w}','en-US')">🔊</button>
  </div>`).join('')}
  </div></div>`;
}
function filterWord(u){
  let WORDS=getEngWords();
  let list=document.getElementById('wordList');
  let words=u>0?WORDS.filter(w=>w.u===u):WORDS;
  list.innerHTML=words.map(w=>`<div style="padding:8px;border-bottom:1px solid #eee">
    <span style="font-weight:600;font-size:16px">${w.w}</span>
    <span style="color:#888;font-size:14px"> ${w.ph}</span>
    <span style="color:#555"> ${w.pos} ${w.m}</span>
    <button class="btn btn-sm btn-outline" style="float:right" onclick="speak('${w.w}','en-US')">🔊</button>
  </div>`).join('');
}

function renderEngRead(el){
  let READINGS=getEngReadings();
  let bookName=state.engBook===2?'Power Up 2':'Power Up 1';
  let item=READINGS[dayIdx()%READINGS.length];
  el.innerHTML=`<div class="card"><h3>📖 英语阅读打卡 (${bookName})</h3>
  <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:14px;font-size:17px;line-height:1.8">
    <div style="font-weight:700;font-size:18px;margin-bottom:8px">${item.t}</div>
    ${item.p}
  </div>
  <button class="btn" style="margin-bottom:12px" onclick="speak('${item.p}','en-US')">🔊 朗读全文</button>
  ${item.q.map((q,i)=>`
    <div class="math-problem">
      <div class="q">${i+1}. ${q}</div>
      <input class="math-input" style="width:100%;text-align:left" placeholder="Your answer..." id="engRA${i}">
      <div id="engRExp${i}" class="hidden" style="margin-top:6px;padding:8px;border-radius:8px;font-size:14px;line-height:1.6"></div>
    </div>`).join('')}
  <button class="btn btn-accent" onclick="checkEngRead(${JSON.stringify(item).replace(/"/g,'&quot;')})">✅ 提交答案</button>
  <button class="btn" style="margin-left:8px" onclick="renderEngTab('read')">🔄 换一篇</button>
  </div>`;
}
function checkEngRead(item){
  let ok=true;
  item.q.forEach((q,i)=>{
    let inp=document.getElementById('engRA'+i);
    let val=inp.value.trim().toLowerCase();
    let ans=item.a[i].toLowerCase();
    let expEl=document.getElementById('engRExp'+i);
    let isCorrect=val.includes(ans)||ans.includes(val)||val===ans;
    if(isCorrect){
      inp.style.borderColor='#4caf50';inp.style.background='#c8e6c9';
      if(expEl){expEl.classList.remove('hidden');expEl.style.background='#e8f5e9';expEl.style.borderLeft='4px solid #4caf50';
        expEl.innerHTML='<div style="font-weight:600">✅ 正确！答案：'+item.a[i]+'</div>';}
    } else {
      inp.style.borderColor='#ef5350';inp.style.background='#ffebee';
      if(expEl){expEl.classList.remove('hidden');expEl.style.background='#fff3e0';expEl.style.borderLeft='4px solid #ff9800';
        expEl.innerHTML='<div style="font-weight:600">📖 正确答案：'+item.a[i]+'</div><div style="margin-top:4px">你的答案：'+(val||'(空)')+'</div>';}
      ok=false;
    }
  });
  if(ok){doCheckin('eng_read',5)}
  else{showToast('有些答案不对，看看正确答案～')}
}

function renderGram(el){
  let GRAMMAR=getEngGrammar();
  let bookName=state.engBook===2?'Power Up 2':'Power Up 1';
  let subj='eng_gram_'+state.engBook;
  let progress=SmartSchedule.getProgress(subj,GRAMMAR.length);
  let items=SmartSchedule.pick(subj,GRAMMAR,4);
  items.forEach((item,i)=>{item._origIdx=GRAMMAR.indexOf(item)});
  el.innerHTML=`<div class="card"><h3>📐 每日语法练习 (${bookName} 智能4题)</h3>
  <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">📚 题库${GRAMMAR.length}题 · 已出${progress.shown}题(${progress.pct}%) · 错题${WrongBook.getSubjectCount(subj)}题</div>
  <div class="progress-bar" style="margin-bottom:12px"><div class="progress-fill" style="width:${progress.pct}%"></div></div>
  <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">${bookName}语法点练习，答题后查看解析！</div>
  ${items.map((item,i)=>`
    <div class="math-problem" id="gram${i}">
      <div style="margin-bottom:6px"><span class="tag tag-blue">${item.t}</span></div>
      <div class="q">${i+1}. ${item.q}</div>
      ${item.o.map((o,j)=>`<div class="quiz-option" onclick="checkGram(${i},${j},${item.a},'${(item.e||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">${String.fromCharCode(65+j)}. ${o}</div>`).join('')}
      <div id="gramExp${i}" class="hidden" style="margin-top:8px;padding:10px;border-radius:8px;font-size:14px;line-height:1.7"></div>
    </div>`).join('')}
  <button class="btn btn-accent" onclick="doCheckin('eng_gram',10)">✅ 完成打卡 +10分</button>
  <button class="btn btn-outline" style="margin-left:8px" onclick="renderEngTab('gram')">🔄 换新题</button>
  </div>`;
  window._gramItems=items;
}
function checkGram(idx,optIdx,ansIdx,exp){
  let q=document.getElementById('gram'+idx);
  let opts=q.querySelectorAll('.quiz-option');
  let isCorrect=optIdx===ansIdx;
  let items=window._gramItems||[];
  let qData=items[idx];
  let subj='eng_gram_'+state.engBook;
  opts.forEach((o,i)=>{
    o.onclick=null;
    if(i===ansIdx)o.classList.add('correct');
    if(i===optIdx&&i!==ansIdx)o.classList.add('wrong');
  });
  let expEl=document.getElementById('gramExp'+idx);
  if(expEl){
    expEl.classList.remove('hidden');
    expEl.style.background=isCorrect?'#e8f5e9':'#fff3e0';
    expEl.style.borderLeft='4px solid '+(isCorrect?'#4caf50':'#ff9800');
    expEl.innerHTML=`<div style="font-weight:600;margin-bottom:4px">${isCorrect?'🎉 Correct! 正确！':'📖 正确答案是 '+String.fromCharCode(65+ansIdx)+'</div>'}`+
      (exp?`<div>${exp}</div>`:'');
  }
  if(qData&&qData._origIdx!==undefined){
    if(isCorrect)WrongBook.master(subj,qData._origIdx);
    else WrongBook.add(subj,qData._origIdx,{q:qData.q,o:qData.o,a:qData.a,e:qData.e||'',t:qData.t});
  }
  if(isCorrect){speak('Correct!','en-US')}
  else{speak('Wrong. The answer is '+String.fromCharCode(65+ansIdx),'en-US')}
}

let _listenUnit=0;
function renderListen(el){
  let DIALOGUES=getEngListenings();
  let bookName=state.engBook===2?'Power Up 2':'Power Up 1';
  let isPU2=state.engBook===2;
  let units=[0,1,2,3,4,5];
  let unitNames=['全部','U1 农场生活','U2 我的一周','U3 派对时光','U4 家人居家','U5 动物世界'];
  let filtered=isPU2&&_listenUnit>0?DIALOGUES.filter(d=>d.u===_listenUnit):DIALOGUES;
  let subj='eng_listen_'+state.engBook;
  let items=SmartSchedule.pick(subj,filtered,Math.min(8,filtered.length));
  items.forEach((item,i)=>{item._origIdx=DIALOGUES.indexOf(item)});
  el.innerHTML=`<div class="card"><h3>👂 每日听力练习 (${bookName} 智能出题)</h3>
  <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">📚 题库${filtered.length}题 · 错题${WrongBook.getSubjectCount(subj)}题</div>
  <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">点击🔊听对话，选择正确答案，答题后查看解析！</div>
  ${isPU2?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${units.map(u=>`<button class="btn btn-sm ${_listenUnit===u?'btn-accent':'btn-outline'}" onclick="_listenUnit=${u};renderEngTab('listen')">${unitNames[u]}</button>`).join('')}</div>`:''}
  ${items.map((item,i)=>`
    <div class="math-problem" id="listen${i}">
      <div style="margin-bottom:6px"><span class="tag tag-purple">${item.t}</span>${isPU2&&item.u?`<span class="tag tag-blue" style="margin-left:4px">Unit ${item.u}</span>`:''}</div>
      <div class="q">${i+1}. ${item.q}</div>
      <button class="btn btn-sm" style="margin:8px 0" onclick="speak('${item.d.replace(/'/g,"\\'")}','en-US')">🔊 听对话</button>
      <div>${item.o.map((o,j)=>`<div class="quiz-option" onclick="checkListen(${i},${j},${item.a},'${(item.e||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">${String.fromCharCode(65+j)}. ${o}</div>`).join('')}</div>
      <div id="listenExp${i}" class="hidden" style="margin-top:8px;padding:10px;border-radius:8px;font-size:14px;line-height:1.7"></div>
    </div>`).join('')}
  <button class="btn btn-accent" onclick="doCheckin('eng_listen',10)">✅ 完成打卡 +10分</button>
  <button class="btn btn-outline" style="margin-left:8px" onclick="renderEngTab('listen')">🔄 换新题</button>
  </div>`;
  window._listenItems=items;
}
function checkListen(idx,optIdx,ansIdx,exp){
  let q=document.getElementById('listen'+idx);
  let opts=q.querySelectorAll('.quiz-option');
  let isCorrect=optIdx===ansIdx;
  let items=window._listenItems||[];
  let qData=items[idx];
  let subj='eng_listen_'+state.engBook;
  opts.forEach((o,i)=>{
    o.onclick=null;
    if(i===ansIdx)o.classList.add('correct');
    if(i===optIdx&&i!==ansIdx)o.classList.add('wrong');
  });
  let expEl=document.getElementById('listenExp'+idx);
  if(expEl){
    expEl.classList.remove('hidden');
    expEl.style.background=isCorrect?'#e8f5e9':'#fff3e0';
    expEl.style.borderLeft='4px solid '+(isCorrect?'#4caf50':'#ff9800');
    expEl.innerHTML=`<div style="font-weight:600;margin-bottom:4px">${isCorrect?'🎉 Correct! 正确！':'📖 正确答案是 '+String.fromCharCode(65+ansIdx)+'</div>'}`+
      (exp?`<div>${exp}</div>`:'');
  }
  if(qData&&qData._origIdx!==undefined){
    if(isCorrect)WrongBook.master(subj,qData._origIdx);
    else WrongBook.add(subj,qData._origIdx,{q:qData.q,o:qData.o,a:qData.a,e:qData.e||'',d:qData.d,t:qData.t});
  }
}
function renderSport(c){
  let ropeDone=Store.get('ropeCount_'+today(),0);
  let postureDone=Store.get('postureDone_'+today(),false);
  let ropeGoal=Store.get('ropeGoal',200);
  let ropeHistory=Store.get('ropeHistory',{});
  let ropeChecked=Store.get('checkins',{})['sport_rope'];
  // 计算连续打卡天数
  let streak=calcRopeStreak(ropeHistory);
  let totalDays=Object.keys(ropeHistory).filter(k=>ropeHistory[k]>=ropeGoal).length;
  // 最近7天数据
  let last7=[];
  for(let i=6;i>=0;i--){
    let d=new Date();d.setDate(d.getDate()-i);
    let ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    last7.push({date:ds,count:ropeHistory[ds]||0,label:d.getMonth()+1+'/'+d.getDate()});
  }
  let maxCount=Math.max(ropeGoal,...last7.map(d=>d.count));
  c.innerHTML=`<div class="fade-in">
  <div class="section-title">🏃 运动打卡</div>
  <div class="card">
    <h3>🏃 跳绳挑战 (每日${ropeGoal}个)</h3>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="badge ${ropeChecked?'badge-gold':'badge-orange'}">${ropeChecked?'✅ 今日已打卡':'⬜ 今日未打卡'}</span>
      <span class="badge badge-green">🔥 连续${streak}天</span>
      <span class="badge badge-blue">累计${totalDays}天达标</span>
    </div>
    <div style="text-align:center;margin:20px 0">
      <div style="font-size:60px;font-weight:700;color:var(--primary)">${ropeDone}</div>
      <div style="font-size:16px;color:var(--text-light)">/ ${ropeGoal} 个</div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(ropeDone/ropeGoal*100,100)}%;background:${ropeDone>=ropeGoal?'#4caf50':'var(--primary)'}"></div></div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-lg" onclick="addRope(10)">+10</button>
      <button class="btn btn-lg" onclick="addRope(20)">+20</button>
      <button class="btn btn-lg" onclick="addRope(50)">+50</button>
      <button class="btn btn-lg" onclick="addRope(100)">+100</button>
      <button class="btn btn-lg btn-outline" onclick="resetRope()">重置</button>
    </div>
    ${ropeDone>=ropeGoal&&!ropeChecked?'<button class="btn btn-accent" style="margin-top:10px;width:100%" onclick="checkinRope()">✅ 完成打卡 +15分</button>':''}
    ${ropeChecked?'<div style="text-align:center;margin-top:12px"><span class="badge badge-gold">🎉 已完成今日跳绳！</span></div>':''}
    <!-- 最近7天记录 -->
    <div style="margin-top:16px">
      <div style="font-weight:600;margin-bottom:8px">📊 最近7天记录</div>
      <div style="display:flex;gap:4px;align-items:flex-end;justify-content:center;height:100px">
        ${last7.map(d=>`
          <div style="display:flex;flex-direction:column;align-items:center;width:40px">
            <div style="font-size:11px;color:#666;margin-bottom:2px">${d.count}</div>
            <div style="width:28px;height:${Math.max(d.count/maxCount*60,3)}px;background:${d.count>=ropeGoal?'#4caf50':d.count>0?'#ff9800':'#e0e0e0'};border-radius:4px 4px 0 0"></div>
            <div style="font-size:10px;color:#999;margin-top:4px">${d.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <!-- 目标设置 -->
    <div style="margin-top:12px;display:flex;gap:6px;align-items:center;justify-content:center">
      <span style="font-size:14px;color:#666">每日目标：</span>
      <button class="btn btn-sm ${ropeGoal===100?'btn-accent':'btn-outline'}" onclick="setRopeGoal(100)">100</button>
      <button class="btn btn-sm ${ropeGoal===200?'btn-accent':'btn-outline'}" onclick="setRopeGoal(200)">200</button>
      <button class="btn btn-sm ${ropeGoal===300?'btn-accent':'btn-outline'}" onclick="setRopeGoal(300)">300</button>
      <button class="btn btn-sm ${ropeGoal===500?'btn-accent':'btn-outline'}" onclick="setRopeGoal(500)">500</button>
    </div>
  </div>
  <div class="card">
    <h3>🧘 改善圆肩驼背 (每日10分钟)</h3>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px">📋 动作清单：</div>
      <div style="line-height:2;font-size:15px">
        1. 靠墙站立（后脑勺、肩、臀、脚跟贴墙）2分钟<br>
        2. 肩胛骨收缩运动（双手叉腰，肩胛骨向后夹紧）2分钟<br>
        3. 胸部拉伸（门框拉伸，每侧30秒×4组）2分钟<br>
        4. Y-T-W练习（俯卧做Y/T/W字母动作）2分钟<br>
        5. 下巴微收练习（靠墙收下巴）2分钟
      </div>
    </div>
    <div style="text-align:center;margin:16px 0">
      <div class="timer-display" id="postureTimer">10:00</div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn btn-lg" id="postureBtn" onclick="startPosture()">▶️ 开始计时</button>
    </div>
    ${postureDone?'<div style="text-align:center;margin-top:12px"><span class="badge badge-gold">🎉 已完成今日体态练习！</span></div>':''}
  </div>
  </div>`;
}
function calcRopeStreak(history){
  let streak=0;
  let d=new Date();
  // 如果今天还没达标，从昨天开始算
  let todayStr=today();
  if(!history[todayStr]||history[todayStr]<(Store.get('ropeGoal',200))){
    d.setDate(d.getDate()-1);
  }
  while(true){
    let ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(history[ds]&&history[ds]>=(Store.get('ropeGoal',200))){
      streak++;
      d.setDate(d.getDate()-1);
    } else break;
  }
  return streak;
}
function addRope(n){
  let cur=Store.get('ropeCount_'+today(),0);
  cur+=n;
  let goal=Store.get('ropeGoal',200);
  if(cur>goal*2)cur=goal*2;
  Store.set('ropeCount_'+today(),cur);
  // 记录历史
  let hist=Store.get('ropeHistory',{});
  hist[today()]=cur;
  Store.set('ropeHistory',hist);
  renderSport();
}
function setRopeGoal(g){
  Store.set('ropeGoal',g);
  renderSport();
}
function checkinRope(){
  doCheckin('sport_rope',15);
  showToast('跳绳打卡成功！+15分 🎉');
  renderSport();
}
function resetRope(){
  Store.set('ropeCount_'+today(),0);
  let hist=Store.get('ropeHistory',{});
  hist[today()]=0;
  Store.set('ropeHistory',hist);
  renderSport();
}
let postureTimer=null,postureSec=600;
function startPosture(){
  if(postureTimer){clearInterval(postureTimer);postureTimer=null;
    document.getElementById('postureBtn').textContent='▶️ 继续';return}
  document.getElementById('postureBtn').textContent='⏸️ 暂停';
  postureTimer=setInterval(()=>{
    postureSec--;
    let m=Math.floor(postureSec/60),s=postureSec%60;
    let el=document.getElementById('postureTimer');
    if(el)el.textContent=m+':'+String(s).padStart(2,'0');
    if(postureSec<=0){
      clearInterval(postureTimer);postureTimer=null;
      Store.set('postureDone_'+today(),true);
      doCheckin('sport_posture',10);
      showToast('体态练习完成！+10分 🎉');
      renderSport();
    }
  },1000);
}

// ===== 围棋板块 =====
function renderWeiqi(c){
  let quizDone=Store.get('weiqiQuizDone',[]);
  let quizCorrect=Store.get('weiqiQuizCorrect',0);
  let rhymeDone=Store.get('weiqiRhymeDone',[]);
  c.innerHTML=`<div class="fade-in"><div class="section-title">⚫ 围棋学堂</div>
  <div class="tabs">
    <div class="tab active" data-tab="practice">🎯 每日练习</div>
    <div class="tab" data-tab="rhyme">📜 口诀</div>
    <div class="tab" data-tab="quiz">📝 答题</div>
    <div class="tab" data-tab="lesson">📚 课程</div>
    <div class="tab" data-tab="allproblems">📋 题库</div>
  </div>
  <div id="weiqiContent"></div></div>`;
  c.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    c.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    renderWeiqiTab(t.dataset.tab);
  });
  renderWeiqiTab('practice');
}
function renderWeiqiTab(tab){
  let el=document.getElementById('weiqiContent');el.innerHTML='';
  if(tab==='practice')renderWeiqiPractice(el);
  else if(tab==='rhyme')renderWeiqiRhyme(el);
  else if(tab==='quiz')renderWeiqiQuiz(el);
  else if(tab==='lesson')renderWeiqiLesson(el);
  else if(tab==='allproblems')renderWeiqiAll(el);
}
function renderWeiqiPractice(el){
  let todayIdx=dayIdx()%WEIQI_PROBLEMS.length;
  let p=WEIQI_PROBLEMS[todayIdx];
  el.innerHTML=`<div class="card">
    <h3>🎯 每日围棋练习题 (${todayIdx+1}/${WEIQI_PROBLEMS.length})</h3>
    <div style="font-size:14px;color:var(--text-light);margin-bottom:10px">结合聂卫平围棋启蒙教程</div>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:12px">
      <div style="font-size:20px;font-weight:700;margin-bottom:6px">${p.title}</div>
      <div style="font-size:16px;line-height:1.8">${p.desc}</div>
    </div>
    <div style="display:flex;justify-content:center;margin:16px 0">
      <div id="weiqiBoard"></div>
    </div>
    <div style="text-align:center;font-size:15px;color:var(--text-light);margin-bottom:10px">
      👆 点击棋盘上的交叉点来回答
    </div>
    <div id="weiqiResult"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-sm btn-outline" onclick="showWeiqiHint(${todayIdx})">💡 提示</button>
      <button class="btn btn-sm btn-outline" onclick="showWeiqiAnswer(${todayIdx})">👁️ 看答案</button>
      <button class="btn btn-sm" onclick="speak('${p.title}。${p.desc}。${p.hint}')">🔊 语音讲解</button>
    </div>
    <div id="weiqiHint" class="hidden" style="margin-top:10px;padding:12px;background:#fff8e1;border-radius:8px;font-size:15px"></div>
    <div id="weiqiExplain" class="hidden" style="margin-top:10px;padding:12px;background:#e8f5e9;border-radius:8px;font-size:15px;line-height:1.6"></div>
  </div>
  <div style="display:flex;gap:8px;margin-top:12px">
    <button class="btn btn-accent" onclick="doCheckin('weiqi_practice',10)">✅ 完成打卡 +10分</button>
  </div>`;
  renderWeiqiBoard(p,todayIdx);
}
function renderWeiqiBoard(p,probIdx){
  let el=document.getElementById('weiqiBoard');
  if(!el)return;
  let bs=p.boardSize;
  let cellSize=32;
  let totalSize=(bs-1)*cellSize+cellSize*2;
  let html=`<svg width="${totalSize}" height="${totalSize}" style="background:#dcB878;border-radius:8px;touch-action:manipulation">`;
  // 背景填充
  html+=`<rect width="${totalSize}" height="${totalSize}" fill="#dcb878"/>`;
  // 画线
  let offset=cellSize;
  for(let i=0;i<bs;i++){
    let x=offset+i*cellSize;
    html+=`<line x1="${offset}" y1="${x}" x2="${offset+(bs-1)*cellSize}" y2="${x}" stroke="#333" stroke-width="1"/>`;
    html+=`<line x1="${x}" y1="${offset}" x2="${x}" y2="${offset+(bs-1)*cellSize}" stroke="#333" stroke-width="1"/>`;
  }
  // 画交叉点和棋子
  for(let r=0;r<bs;r++){
    for(let c=0;c<bs;c++){
      let cx=offset+c*cellSize;
      let cy=offset+r*cellSize;
      let val=p.board[r][c];
      if(val===1){
        html+=`<circle cx="${cx}" cy="${cy}" r="14" fill="#1a1a1a" stroke="#000" stroke-width="1"/>`;
      } else if(val===2){
        html+=`<circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="#999" stroke-width="1"/>`;
      } else {
        // 空位可点击
        html+=`<circle cx="${cx}" cy="${cy}" r="14" fill="transparent" stroke="transparent" style="cursor:pointer" onclick="checkWeiqiAnswer(${probIdx},${r},${c})"/>`;
        html+=`<circle cx="${cx}" cy="${cy}" r="2" fill="#dcb878" opacity="0" class="hover-dot" style="pointer-events:none"/>`;
      }
    }
  }
  // 坐标标注
  for(let i=0;i<bs;i++){
    html+=`<text x="${offset+i*cellSize}" y="${12}" text-anchor="middle" font-size="10" fill="#666">${String.fromCharCode(65+i)}</text>`;
    html+=`<text x="${8}" y="${offset+i*cellSize+4}" text-anchor="middle" font-size="10" fill="#666">${i+1}</text>`;
  }
  html+=`</svg>`;
  el.innerHTML=html;
}
function checkWeiqiAnswer(probIdx,r,c){
  let p=WEIQI_PROBLEMS[probIdx];
  let result=document.getElementById('weiqiResult');
  let [ar,ac]=p.answer;
  if(r===ar&&c===ac){
    result.innerHTML=`<div style="padding:14px;background:#c8e6c9;border-radius:10px;text-align:center;font-size:18px;font-weight:700;color:#2e7d57">🎉 回答正确！太棒了！</div>`;
    // 在正确位置画一个黑子
    let board=document.getElementById('weiqiBoard');
    let svg=board.querySelector('svg');
    let bs=p.boardSize,cellSize=32,offset=cellSize;
    let cx=offset+c*cellSize,cy=offset+r*cellSize;
    let ns='http://www.w3.org/2000/svg';
    let circle=document.createElementNS(ns,'circle');
    circle.setAttribute('cx',cx);circle.setAttribute('cy',cy);
    circle.setAttribute('r','14');circle.setAttribute('fill','#1a1a1a');
    circle.setAttribute('stroke','#00cc00');circle.setAttribute('stroke-width','3');
    svg.appendChild(circle);
    // 显示解析
    let exp=document.getElementById('weiqiExplain');
    exp.classList.remove('hidden');
    exp.innerHTML=`<div style="font-weight:600;margin-bottom:6px">💡 解析：</div>${p.explain}`;
    speak(p.explain);
    showToast('回答正确！+10分');
  } else {
    result.innerHTML=`<div style="padding:14px;background:#ffebee;border-radius:10px;text-align:center;font-size:16px;color:#c62828">❌ 不太对，再想想？点击"看答案"查看解析</div>`;
    // 在错误位置画一个半透明标记
    let board=document.getElementById('weiqiBoard');
    let svg=board.querySelector('svg');
    let bs=p.boardSize,cellSize=32,offset=cellSize;
    let cx=offset+c*cellSize,cy=offset+r*cellSize;
    let ns='http://www.w3.org/2000/svg';
    let circle=document.createElementNS(ns,'circle');
    circle.setAttribute('cx',cx);circle.setAttribute('cy',cy);
    circle.setAttribute('r','10');circle.setAttribute('fill','#ff5350');
    circle.setAttribute('opacity','0.5');
    svg.appendChild(circle);
    setTimeout(()=>{circle.remove()},2000);
  }
}
function showWeiqiHint(probIdx){
  let p=WEIQI_PROBLEMS[probIdx];
  let el=document.getElementById('weiqiHint');
  el.classList.remove('hidden');
  el.innerHTML=`💡 ${p.hint}`;
  speak(p.hint);
}
function showWeiqiAnswer(probIdx){
  let p=WEIQI_PROBLEMS[probIdx];
  let [ar,ac]=p.answer;
  // 在正确位置画一个标记
  let board=document.getElementById('weiqiBoard');
  let svg=board.querySelector('svg');
  let bs=p.boardSize,cellSize=32,offset=cellSize;
  let cx=offset+ac*cellSize,cy=offset+ar*cellSize;
  let ns='http://www.w3.org/2000/svg';
  let circle=document.createElementNS(ns,'circle');
  circle.setAttribute('cx',cx);circle.setAttribute('cy',cy);
  circle.setAttribute('r','14');circle.setAttribute('fill','#1a1a1a');
  circle.setAttribute('stroke','#4caf50');circle.setAttribute('stroke-width','3');
  circle.setAttribute('opacity','0.6');
  svg.appendChild(circle);
  let result=document.getElementById('weiqiResult');
  result.innerHTML=`<div style="padding:14px;background:#e3f2fd;border-radius:10px;text-align:center;font-size:16px;color:#1565c0">📍 正确答案：${String.fromCharCode(65+ac)}${ar+1} 行</div>`;
  let exp=document.getElementById('weiqiExplain');
  exp.classList.remove('hidden');
  exp.innerHTML=`<div style="font-weight:600;margin-bottom:6px">💡 解析：</div>${p.explain}`;
  speak(p.explain);
}
function renderWeiqiLesson(el){
  let todayLesson=WEIQI_LESSONS[dayIdx()%WEIQI_LESSONS.length];
  el.innerHTML=`<div class="card">
    <h3>🎯 今日课程</h3>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px">
      <div style="font-size:20px;font-weight:700;margin-bottom:8px">${todayLesson.t}</div>
      <div style="font-size:16px;line-height:1.8;margin-bottom:10px">${todayLesson.c}</div>
      <div><span class="tag tag-green">🔑 ${todayLesson.k}</span></div>
      <button class="btn" style="margin-top:10px" onclick="speak('${todayLesson.t}。${todayLesson.c}')">🔊 语音讲解</button>
    </div>
  </div>
  <div class="card">
    <h3>📚 全部课程 (${WEIQI_LESSONS.length}课)</h3>
    <div style="max-height:400px;overflow-y:auto">
      ${WEIQI_LESSONS.map((l,i)=>`<div style="padding:10px;border-bottom:1px solid #eee;cursor:pointer" onclick="showWeiqiLesson(${i})">
        <div style="font-weight:600">${i+1}. ${l.t}</div>
        <div style="font-size:13px;color:#999">${l.k}</div>
      </div>`).join('')}
    </div>
  </div>`;
}
function showWeiqiLesson(idx){
  let l=WEIQI_LESSONS[idx];
  let el=document.querySelector('#weiqiContent .card:first-child');
  if(!el)return;
  el.innerHTML=`<h3>🎯 课程详情</h3>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px">
      <div style="font-size:20px;font-weight:700;margin-bottom:8px">${l.t}</div>
      <div style="font-size:16px;line-height:1.8;margin-bottom:10px">${l.c}</div>
      <div><span class="tag tag-green">🔑 ${l.k}</span></div>
      <button class="btn" style="margin-top:10px" onclick="speak('${l.t}。${l.c}')">🔊 语音讲解</button>
    </div>`;
}
function renderWeiqiAll(el){
  el.innerHTML=`<div class="card">
    <h3>📋 围棋题库 (${WEIQI_PROBLEMS.length}题)</h3>
    <div style="max-height:400px;overflow-y:auto">
      ${WEIQI_PROBLEMS.map((p,i)=>`<div style="padding:12px;border-bottom:1px solid #eee;cursor:pointer" onclick="goWeiqiProblem(${i})">
        <div style="font-weight:600">${i+1}. ${p.title}</div>
        <div style="font-size:13px;color:#999">${p.desc.substring(0,40)}...</div>
      </div>`).join('')}
    </div>
  </div>`;
}
function goWeiqiProblem(idx){
  // 切换到练习tab
  document.querySelectorAll('#weiqiContent').forEach(()=>{});
  let tabs=document.querySelectorAll('.tab');
  tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab==='practice'));
  let el=document.getElementById('weiqiContent');
  let p=WEIQI_PROBLEMS[idx];
  el.innerHTML=`<div class="card">
    <h3>🎯 围棋练习题 (${idx+1}/${WEIQI_PROBLEMS.length})</h3>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:12px">
      <div style="font-size:20px;font-weight:700;margin-bottom:6px">${p.title}</div>
      <div style="font-size:16px;line-height:1.8">${p.desc}</div>
    </div>
    <div style="display:flex;justify-content:center;margin:16px 0"><div id="weiqiBoard"></div></div>
    <div id="weiqiResult"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-sm btn-outline" onclick="showWeiqiHint(${idx})">💡 提示</button>
      <button class="btn btn-sm btn-outline" onclick="showWeiqiAnswer(${idx})">👁️ 看答案</button>
      <button class="btn btn-sm" onclick="speak('${p.title}。${p.desc}。${p.hint}')">🔊 语音讲解</button>
    </div>
    <div id="weiqiHint" class="hidden" style="margin-top:10px;padding:12px;background:#fff8e1;border-radius:8px;font-size:15px"></div>
    <div id="weiqiExplain" class="hidden" style="margin-top:10px;padding:12px;background:#e8f5e9;border-radius:8px;font-size:15px;line-height:1.6"></div>
  </div>`;
  renderWeiqiBoard(p,idx);
}

// ===== 围棋口诀 =====
function renderWeiqiRhyme(el){
  let rhymeDone=Store.get('weiqiRhymeDone',[]);
  let doneCount=rhymeDone.length;
  el.innerHTML=`<div class="card">
    <h3>📜 围棋口诀 (${doneCount}/${WEIQI_RHYMES.length})</h3>
    <div style="font-size:14px;color:var(--text-light);margin-bottom:12px">来自《围棋口诀》教材，朗读背诵口诀，掌握围棋基础！</div>
    <div id="rhymeList">
      ${WEIQI_RHYMES.map((r,i)=>`
        <div style="background:${rhymeDone.includes(i)?'#e8f5e9':'#f5f9f5'};padding:14px;border-radius:10px;margin-bottom:10px;border-left:4px solid ${rhymeDone.includes(i)?'#4caf50':'#2196f3'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:18px;font-weight:700;color:#2e7d57">${i+1}. ${r.t}</span>
            <span class="badge ${rhymeDone.includes(i)?'badge-green':'badge-orange'}">${rhymeDone.includes(i)?'✅ 已学':'⬜ 未学'}</span>
          </div>
          <div style="background:#fff;padding:12px;border-radius:8px;margin-bottom:8px;font-size:16px;line-height:2;font-weight:600;color:#333">${r.rhyme}</div>
          <div style="font-size:14px;color:#666;line-height:1.7;margin-bottom:8px">📖 ${r.explain}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm" onclick="speakRhyme(${i})">🔊 朗读口诀</button>
            <button class="btn btn-sm btn-outline" onclick="toggleRhymeExplain(${i})" id="rExpBtn${i}">📖 详细讲解</button>
            <button class="btn btn-sm ${rhymeDone.includes(i)?'btn-outline':'btn-accent'}" onclick="markRhymeDone(${i})">${rhymeDone.includes(i)?'↩️ 取消标记':'✅ 标记已学 +5分'}</button>
          </div>
          <div id="rExp${i}" class="hidden" style="margin-top:8px;padding:10px;background:#e3f2fd;border-radius:8px;font-size:14px;line-height:1.7">
            <div style="font-weight:600;margin-bottom:6px">💡 口诀解读：</div>
            ${r.explain}
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
}
function speakRhyme(i){
  let r=WEIQI_RHYMES[i];
  speak(r.t+'。'+r.rhyme);
}
function toggleRhymeExplain(i){
  let el=document.getElementById('rExp'+i);
  let btn=document.getElementById('rExpBtn'+i);
  if(el.classList.contains('hidden')){
    el.classList.remove('hidden');
    btn.textContent='📖 收起讲解';
  } else {
    el.classList.add('hidden');
    btn.textContent='📖 详细讲解';
  }
}
function markRhymeDone(i){
  let done=Store.get('weiqiRhymeDone',[]);
  if(done.includes(i)){
    done=done.filter(x=>x!==i);
    Store.set('weiqiRhymeDone',done);
  } else {
    done.push(i);
    Store.set('weiqiRhymeDone',done);
    doCheckin('weiqi_rhyme',5);
  }
  renderWeiqiRhyme(document.getElementById('weiqiContent'));
}

// ===== 围棋阶梯答题 =====
function renderWeiqiQuiz(el){
  let quizIdx=Store.get('weiqiQuizIdx',0);
  let quizDone=Store.get('weiqiQuizDone',[]);
  let quizCorrect=Store.get('weiqiQuizCorrect',0);
  let levels=[
    {lv:1,name:'第一阶：认识棋盘',color:'#4caf50'},
    {lv:2,name:'第二阶：气和吃子',color:'#2196f3'},
    {lv:3,name:'第三阶：基本技巧',color:'#ff9800'},
    {lv:4,name:'第四阶：布局理念',color:'#9c27b0'},
    {lv:5,name:'第五阶：死活基础',color:'#f44336'}
  ];
  // 筛选当前等级题目
  let curLv=Store.get('weiqiQuizLv',1);
  let lvQuestions=WEIQI_QUIZ.filter(q=>q.lv===curLv);
  let lvDone=quizDone.filter(idx=>WEIQI_QUIZ[idx]&&WEIQI_QUIZ[idx].lv===curLv).length;
  let lvCorrect=quizDone.filter(idx=>WEIQI_QUIZ[idx]&&WEIQI_QUIZ[idx].lv===curLv&&Store.get('weiqiQuizAns_'+idx,null)===WEIQI_QUIZ[idx].a).length;
  let q=lvQuestions[quizIdx%lvQuestions.length];
  let globalIdx=WEIQI_QUIZ.indexOf(q);
  let answered=Store.get('weiqiQuizAns_'+globalIdx,null);
  el.innerHTML=`<div class="card">
    <h3>📝 围棋阶梯答题</h3>
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${levels.map(l=>`<button class="btn btn-sm ${curLv===l.lv?'btn-accent':'btn-outline'}" onclick="switchQuizLv(${l.lv})" style="border-color:${l.color}">${l.name}</button>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span class="badge badge-green">本阶进度 ${lvDone}/${lvQuestions.length}</span>
      <span class="badge ${lvCorrect/lvQuestions.length>=0.8?'badge-green':lvCorrect/lvQuestions.length>=0.5?'badge-orange':'badge-red'}">正确 ${lvCorrect}/${lvDone}</span>
    </div>
    <div style="background:#f5f9f5;padding:16px;border-radius:12px;margin-bottom:14px">
      <div style="font-size:14px;color:#999;margin-bottom:6px">第${quizIdx%lvQuestions.length+1}/${lvQuestions.length}题 · ${q.t}</div>
      <div style="font-size:18px;font-weight:600;line-height:1.6">${q.q}</div>
    </div>
    <div id="quizOptions">
      ${q.o.map((opt,j)=>`
        <div id="qopt${j}" style="padding:12px 16px;margin-bottom:8px;border:2px solid #e0e0e0;border-radius:10px;cursor:pointer;font-size:16px;transition:all .2s"
          onclick="answerQuiz(${globalIdx},${j})">
          <span style="font-weight:700;margin-right:8px">${String.fromCharCode(65+j)}.</span>${opt}
        </div>
      `).join('')}
    </div>
    <div id="quizExplain"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-outline" onclick="prevQuiz()">⬅️ 上一题</button>
      <button class="btn btn-outline" onclick="nextQuiz()">下一题 ➡️</button>
    </div>
    <div id="quizResult"></div>
  </div>`;
  // 如果已经答过，显示答案
  if(answered!==null){
    showQuizAnswer(globalIdx,answered);
  }
}
function switchQuizLv(lv){
  Store.set('weiqiQuizLv',lv);
  Store.set('weiqiQuizIdx',0);
  renderWeiqiQuiz(document.getElementById('weiqiContent'));
}
function answerQuiz(gIdx,choice){
  let q=WEIQI_QUIZ[gIdx];
  let answered=Store.get('weiqiQuizAns_'+gIdx,null);
  if(answered!==null)return; // 已答过不能再答
  Store.set('weiqiQuizAns_'+gIdx,choice);
  let done=Store.get('weiqiQuizDone',[]);
  if(!done.includes(gIdx)){done.push(gIdx);Store.set('weiqiQuizDone',done);}
  showQuizAnswer(gIdx,choice);
}
function showQuizAnswer(gIdx,choice){
  let q=WEIQI_QUIZ[gIdx];
  let isCorrect=choice===q.a;
  q.o.forEach((opt,j)=>{
    let el=document.getElementById('qopt'+j);
    if(!el)return;
    if(j===q.a){el.style.background='#c8e6c9';el.style.borderColor='#4caf50';}
    else if(j===choice&&!isCorrect){el.style.background='#ffcdd2';el.style.borderColor='#ef5350';}
    else{el.style.background='#f5f5f5';}
    el.style.cursor='default';
    el.onclick=null;
  });
  let exp=document.getElementById('quizExplain');
  exp.innerHTML=`<div style="margin-top:12px;padding:14px;border-radius:10px;background:${isCorrect?'#e8f5e9':'#fff3e0'};border-left:4px solid ${isCorrect?'#4caf50':'#ff9800'}">
    <div style="font-weight:700;font-size:17px;margin-bottom:6px">${isCorrect?'🎉 回答正确！':'📖 正确答案是 '+String.fromCharCode(65+q.a)+'</div>'}
    <div style="font-size:15px;line-height:1.7">${q.explain}</div>
  </div>`;
  let result=document.getElementById('quizResult');
  if(isCorrect){
    let correct=Store.get('weiqiQuizCorrect',0);
    Store.set('weiqiQuizCorrect',correct+1);
    doCheckin('weiqi_quiz',3);
    result.innerHTML=`<div style="text-align:center;margin-top:10px"><span class="badge badge-gold">⭐ +3分</span></div>`;
  } else {
    result.innerHTML=`<div style="text-align:center;margin-top:10px"><span style="color:#ff9800">💪 答错了没关系，看看解析再试试！</span></div>`;
  }
}
function prevQuiz(){
  let curLv=Store.get('weiqiQuizLv',1);
  let lvQs=WEIQI_QUIZ.filter(q=>q.lv===curLv);
  let idx=Store.get('weiqiQuizIdx',0);
  idx=(idx-1+lvQs.length)%lvQs.length;
  Store.set('weiqiQuizIdx',idx);
  renderWeiqiQuiz(document.getElementById('weiqiContent'));
}
function nextQuiz(){
  let curLv=Store.get('weiqiQuizLv',1);
  let lvQs=WEIQI_QUIZ.filter(q=>q.lv===curLv);
  let idx=Store.get('weiqiQuizIdx',0);
  idx=(idx+1)%lvQs.length;
  Store.set('weiqiQuizIdx',idx);
  renderWeiqiQuiz(document.getElementById('weiqiContent'));
}

// ===== 奥特曼养成 =====
function renderUltraman(c){
  let ultra=getUltraLevel(state.ultraExp);
  let nextLv=getNextLevel(state.ultraExp);
  let expInLv=state.ultraExp-ultra.exp;
  let expNeed=nextLv?nextLv.exp-ultra.exp:1;
  let expPct=nextLv?Math.round(expInLv/expNeed*100):100;
  
  // 检查今日任务完成情况
  let allTasks=['chinese_idiom','chinese_poem','chinese_fill','chinese_quiz','chinese_read',
    'math_calc','math_mul','math_think','eng_word','eng_read','eng_gram','eng_listen',
    'sport_rope','sport_posture','weiqi_practice','weiqi_rhyme','weiqi_quiz'];
  let doneCount=allTasks.filter(t=>state.checkins[t]).length;
  
  c.innerHTML=`<div class="fade-in">
  <div class="card">
    <h3>🦸 奥特曼养成</h3>
    <div class="ultra-stage">
      <div class="ultra-avatar">${ultra.emoji}</div>
      <div class="ultra-level">Lv.${ultra.lv} ${ultra.name}</div>
      <div class="exp-bar"><div class="exp-fill" style="width:${expPct}%"></div></div>
      <div style="font-size:14px;opacity:0.8">经验值：${state.ultraExp} ${nextLv?`/ ${nextLv.exp}`:'(满级)'}</div>
      <div style="font-size:13px;opacity:0.6;margin-top:8px">${nextLv?`再获得${nextLv.exp-state.ultraExp}分即可升级为「${nextLv.name}」`:'你已是宇宙最强守护者！'}</div>
    </div>
  </div>
  
  <div class="card">
    <h3>📊 今日战绩</h3>
    <div style="font-size:16px;line-height:2">
      <div>今日完成任务：<span class="badge badge-green">${doneCount}/${allTasks.length}</span></div>
      <div>今日获得经验：<span class="badge badge-gold">⭐ ${state.todayPts}</span></div>
      <div>累计经验值：<span class="badge badge-green">🏆 ${state.ultraExp}</span></div>
      <div>连续打卡：<span class="badge badge-orange">🔥 ${state.streak}天</span></div>
    </div>
  </div>
  
  <div class="card">
    <h3>🎖️ 奥特曼等级表</h3>
    ${ULTRA_LEVELS.map(l=>`
      <div style="padding:10px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px;${state.ultraExp>=l.exp?'background:#e8f5e9;border-radius:8px':''}">
        <span style="font-size:28px">${l.emoji}</span>
        <div style="flex:1">
          <div style="font-weight:600;${state.ultraExp>=l.exp?'color:var(--primary-dark)':''}">Lv.${l.lv} ${l.name}</div>
          <div style="font-size:13px;color:#999">需要 ${l.exp} 经验</div>
        </div>
        ${state.ultraExp>=l.exp?'<span class="badge badge-green">✅ 已达成</span>':'<span class="badge badge-red">🔒</span>'}
      </div>`).join('')}
  </div>
  
  <div class="card">
    <h3>💪 激励墙</h3>
    <div style="background:linear-gradient(135deg,#fff8e1,#ffe0b2);padding:16px;border-radius:12px;text-align:center">
      <div style="font-size:18px;font-weight:700;color:#f57c00">${getMotivation()}</div>
    </div>
  </div>
  </div>`;
}
function getMotivation(){
  let msgs=[
    "每天进步一点点，奥特曼也能变得更强！",
    "你是最棒的光之战士！继续加油！",
    "学习就像变身，积攒能量就能发光！",
    "今天的努力，就是明天的光！",
    "知识就是光，你就是光之守护者！",
    "坚持打卡，奥特曼在等你升级！",
    "每完成一个任务，就离英雄更近一步！",
    "加油，祝一一！奥特曼相信你！"
  ];
  return msgs[dayIdx()%msgs.length];
}

// ===== 打卡完成 =====
function doCheckin(task,pts){
  if(checkin(task)){
    addPts(pts,task);
    // 更新首页
    setTimeout(()=>{if(state.section==='home')render();else if(state.section==='ultraman')render()},100);
  } else {
    showToast('今日已完成此项打卡 ✅');
  }
}

// ===== 错题本板块 =====
function renderWrong(c){
  let wb=WrongBook._get();
  let subjects=[
    {key:'cn_quiz',name:'语文小测',icon:'📝',arr:typeof CHINESE_QUIZ!=='undefined'?CHINESE_QUIZ:getChineseQuiz()},
    {key:'cn_fill',name:'好句填空',icon:'✏️',arr:FILL_BLANKS},
    {key:'math_think',name:'数学思维',icon:'🧩',arr:MATH_THINKING},
    {key:'eng_gram_1',name:'英语语法PU1',icon:'📐',arr:typeof PU1_GRAMMAR!=='undefined'?PU1_GRAMMAR:[]},
    {key:'eng_gram_2',name:'英语语法PU2',icon:'📐',arr:typeof GRAMMAR_QUESTIONS!=='undefined'?GRAMMAR_QUESTIONS:[]},
    {key:'eng_listen_1',name:'英语听力PU1',icon:'👂',arr:typeof PU1_LISTENING!=='undefined'?PU1_LISTENING:[]},
    {key:'eng_listen_2',name:'英语听力PU2',icon:'👂',arr:typeof PU2_LISTENING!=='undefined'?PU2_LISTENING:[]}
  ];
  let totalWrong=WrongBook.getTotalCount();
  c.innerHTML=`<div class="fade-in">
    <div class="section-title">📕 错题本</div>
    <div class="card" style="background:linear-gradient(135deg,#ffebee,#ffcdd2);text-align:center">
      <div style="font-size:48px;font-weight:700;color:#c62828">${totalWrong}</div>
      <div style="font-size:16px;color:#c62828">道错题待攻克</div>
      <div style="font-size:13px;color:#888;margin-top:6px">答对的错题会自动移出，坚持复习消灭它们！💪</div>
    </div>
    ${totalWrong===0?`<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:60px">🎉</div>
      <div style="font-size:20px;font-weight:700;color:var(--primary-dark);margin-top:10px">太棒了！错题本空空如也！</div>
      <div style="font-size:14px;color:var(--text-light);margin-top:6px">继续保持，做题时仔细一点哦～</div>
    </div>`:''}
    ${subjects.map(s=>{
      let items=WrongBook.getWrongItems(s.key);
      if(items.length===0)return '';
      return `<div class="card">
        <h3>${s.icon} ${s.name} <span class="badge badge-red">${items.length}题</span></h3>
        ${items.map((item,i)=>{
          let d=item.data||{};
          let isChoice=d.o&&Array.isArray(d.o);
          return `<div class="math-problem" id="wrong_${s.key}_${item.qid}" style="border-left:4px solid #ef5350">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="badge badge-red">❌ 错${item.count}次</span>
              <span style="font-size:12px;color:#999">最近出错：${item.lastWrong}</span>
            </div>
            <div class="q">${d.q||'题目加载中...'}</div>
            ${isChoice?`<div style="margin:8px 0">${d.o.map((o,j)=>`<div class="quiz-option" style="${j===d.a?'background:#c8e6c9;border-color:#4caf50':''};cursor:pointer" onclick="reviewWrongAnswer('${s.key}',${item.qid},${j},${d.a})">${String.fromCharCode(65+j)}. ${o}</div>`).join('')}</div>`:`<div style="margin:8px 0"><input class="math-input" style="width:100%;text-align:left" placeholder="输入答案" id="wrongInput_${s.key}_${item.qid}"><button class="btn btn-sm" style="margin-left:8px" onclick="reviewWrongFill('${s.key}',${item.qid})">提交</button></div>`}
            <div id="wrongExp_${s.key}_${item.qid}" class="hidden" style="margin-top:8px;padding:10px;border-radius:8px;font-size:14px;line-height:1.7">
              <div style="font-weight:600;margin-bottom:4px">📖 正确答案：${isChoice?String.fromCharCode(65+d.a)+'. '+d.o[d.a]:d.a}</div>
              ${d.e?`<div>${d.e}</div>`:''}
              ${d.t?`<div style="margin-top:4px"><span class="tag tag-purple">${d.t}</span></div>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;
}
function reviewWrongAnswer(subject,qid,choice,ans){
  let isCorrect=choice===ans;
  let expEl=document.getElementById('wrongExp_'+subject+'_'+qid);
  if(expEl){
    expEl.classList.remove('hidden');
    expEl.style.background=isCorrect?'#e8f5e9':'#fff3e0';
    expEl.style.borderLeft='4px solid '+(isCorrect?'#4caf50':'#ff9800');
  }
  if(isCorrect){
    WrongBook.master(subject,qid);
    showToast('答对了！错题已消灭 🎉');
    setTimeout(()=>{if(state.section==='wrong')render()},1500);
  } else {
    showToast('再想想，看看解析～');
  }
}
function reviewWrongFill(subject,qid){
  let expEl=document.getElementById('wrongExp_'+subject+'_'+qid);
  if(expEl){
    expEl.classList.remove('hidden');
    expEl.style.background='#fff3e0';
    expEl.style.borderLeft='4px solid #ff9800';
  }
  // 填空题直接显示答案，用户自行核对
  let inp=document.getElementById('wrongInput_'+subject+'_'+qid);
  if(inp){
    inp.style.borderColor='#ff9800';
    inp.style.background='#fff3e0';
  }
  showToast('查看正确答案，核对一下～');
}

// ===== 数据同步 =====
function exportData(){
  let data={};
  for(let i=0;i<localStorage.length;i++){
    let k=localStorage.key(i);
    if(k.startsWith('yy_'))data[k]=localStorage.getItem(k);
  }
  let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  let a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`祝一一学习数据_${today()}.json`;
  a.click();
  showToast('数据已导出！');
}
function importData(e){
  let file=e.target.files[0];if(!file)return;
  let reader=new FileReader();
  reader.onload=()=>{
    try{
      let data=JSON.parse(reader.result);
      for(let k in data)localStorage.setItem(k,data[k]);
      showToast('数据导入成功！请刷新页面');
      setTimeout(()=>location.reload(),1500);
    }catch(err){showToast('导入失败，文件格式不对')}
  };
  reader.readAsText(file);
}
function getShareCode(){
  let data={};
  for(let i=0;i<localStorage.length;i++){
    let k=localStorage.key(i);
    if(k.startsWith('yy_'))data[k]=localStorage.getItem(k);
  }
  let code=btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  if(code.length>2000){
    showToast('数据较多，请使用导出功能');
    return;
  }
  let url=location.href.split('#')[0]+'#sync='+code;
  navigator.clipboard?navigator.clipboard.writeText(url).then(()=>showToast('分享链接已复制！发给另一个微信账号打开即可同步')):
    (prompt('复制以下链接分享：',url),showToast('请复制链接分享'));
}

// 检查URL中的同步数据
function checkSync(){
  let hash=location.hash;
  if(hash.startsWith('#sync=')){
    try{
      let code=hash.slice(6);
      let data=JSON.parse(decodeURIComponent(escape(atob(code))));
      for(let k in data)localStorage.setItem(k,data[k]);
      document.getElementById('syncInfo').textContent='✅已同步';
      showToast('数据同步成功！');
      history.replaceState(null,'',location.pathname);
      setTimeout(()=>location.reload(),1000);
    }catch(e){console.error(e)}
  } else {
    document.getElementById('syncInfo').textContent='🔗本地存储';
  }
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded',()=>{
  // 侧边栏导航事件
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>navigate(n.dataset.section));
  // 移动端底部导航事件
  document.querySelectorAll('.mbn-item').forEach(n=>n.onclick=()=>navigate(n.dataset.section));
  // 检查同步
  checkSync();
  // 更新显示
  updatePtsDisplay();
  // 渲染首页
  render();
  // 欢迎语
  if(!Store.get('welcomed',false)){
    setTimeout(()=>{showToast('欢迎来到奥特曼学习站！祝一一加油！🦸');Store.set('welcomed',true)},500);
  }
});
