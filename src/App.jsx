import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Apple, ArrowLeft, Bookmark, Check, ChefHat, CircleHelp, Clock3, Flame, Leaf, ListFilter, Plus, Search, Sparkles, Target, Utensils, X, Pencil, Trash2, ChevronDown, RotateCcw, CalendarDays, ShoppingBasket, Wallet, Heart, ArrowUpDown, Download, Upload, Scale, Dumbbell, Bike, Zap, ExternalLink, WandSparkles, Sun, Moon, RefreshCw, ShoppingBag } from 'lucide-react';
import seedFoods from './data/foods.json';

const STORE_KEY = 'akly-foods-v1';
const LOG_KEY = 'akly-daily-log-v1';
const PROFILE_KEY = 'akly-profile-v1';
const WEEK_KEY = 'akly-week-plan-v1';
const WEIGHT_KEY = 'akly-weight-history-v1';
const blankNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
const fmt = n => Math.round(Number(n) || 0).toLocaleString('ar-EG');
const initialProfile = { calorieTarget: 2100, proteinTarget: 150, carbTarget: 220, fatTarget: 65, activityDay: 'rest', monthlyDeliveryBudget: 3000, monthlyGroceriesBudget: 4000, monthlyOtherBudget: 1000, defaultMealBudget: 180 };

function readJSON(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
function normalizeFood(food) {
  const normalizeType = value => ({'فطار':'الفطار','غدا':'الغدا','عشا':'العشا'}[value] || value);
  return {...food, mealTypes:(food.mealTypes || []).map(normalizeType), ingredients:food.ingredients || [], links:food.links || [], isFavorite:Boolean(food.isFavorite)};
}
function loadFoods() {
  const saved = readJSON(STORE_KEY, null);
  if (!Array.isArray(saved)) return seedFoods.map(normalizeFood);
  const normalizedSeeds = seedFoods.map(normalizeFood);
  const normalizedSaved = saved.map(normalizeFood);
  const savedById = new Map(normalizedSaved.map(food => [food.id, food]));
  const mergedSeeds = normalizedSeeds.map(food => ({ ...food, ...(savedById.get(food.id) || {}) }));
  const seedIds = new Set(normalizedSeeds.map(food => food.id));
  return [...mergedSeeds, ...normalizedSaved.filter(food => !seedIds.has(food.id))];
}
function estimateNutrition(ingredients) {
  return ingredients.reduce((total, item) => {
    const n = item.nutritionPer100g || {};
    const factor = Math.max(0, Number(item.grams) || 0) / 100;
    Object.keys(blankNutrition).forEach(k => total[k] += (Number(n[k]) || 0) * factor);
    return total;
  }, { ...blankNutrition });
}
function App() {
  const [foods, setFoods] = useState(() => loadFoods());
  const [logs, setLogs] = useState(() => readJSON(LOG_KEY, {}));
  const [profile, setProfile] = useState(() => ({...initialProfile, ...readJSON(PROFILE_KEY, {})}));
  const [weekPlan, setWeekPlan] = useState(() => readJSON(WEEK_KEY, {}));
  const [weightHistory, setWeightHistory] = useState(() => readJSON(WEIGHT_KEY, []));
  const [tab, setTab] = useState('today');
  const [suggestionMeal, setSuggestionMeal] = useState('الغدا');
  const [suggestionSource, setSuggestionSource] = useState('الكل');
  const [suggestionRefresh, setSuggestionRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('الكل');
  const [source, setSource] = useState('الكل');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const today = new Date().toLocaleDateString('en-CA');
  const todayLog = logs[today] || { breakfast: null, lunch: null, dinner: null, snacks: [] };

  useEffect(() => localStorage.setItem(STORE_KEY, JSON.stringify(foods)), [foods]);
  useEffect(() => localStorage.setItem(LOG_KEY, JSON.stringify(logs)), [logs]);
  useEffect(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem(WEEK_KEY, JSON.stringify(weekPlan)), [weekPlan]);
  useEffect(() => localStorage.setItem(WEIGHT_KEY, JSON.stringify(weightHistory)), [weightHistory]);

  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const total = useMemo(() => {
    const selected = [todayLog.breakfast, todayLog.lunch, todayLog.dinner, ...(todayLog.snacks || [])].filter(Boolean);
    return selected.reduce((sum, food) => {
      Object.keys(blankNutrition).forEach(k => sum[k] += Number(food.nutrition?.[k]) || 0);
      return sum;
    }, { ...blankNutrition });
  }, [todayLog]);

  const dailyCost = [todayLog.breakfast, todayLog.lunch, todayLog.dinner, ...(todayLog.snacks || [])].filter(Boolean).reduce((sum, food) => sum + (Number(food.price) || 0), 0);
  const currentMonth = today.slice(0,7);
  const monthEntries = Object.entries(logs).filter(([date])=>date.startsWith(currentMonth)).flatMap(([,log])=>[log.breakfast,log.lunch,log.dinner,...(log.snacks||[])]).filter(Boolean);
  const monthlySpend = monthEntries.reduce((sum,food)=>sum+(Number(food.price)||0),0);
  const monthlyDeliverySpend = monthEntries.filter(food=>food.source==='مطعم').reduce((sum,food)=>sum+(Number(food.price)||0),0);
  const monthlyGrocerySpend = monthEntries.filter(food=>food.source==='سوبر ماركت'||food.source==='بيتي').reduce((sum,food)=>sum+(Number(food.price)||0),0);
  const monthlyOtherSpend = monthEntries.filter(food=>food.source==='أخرى').reduce((sum,food)=>sum+(Number(food.price)||0),0);
  const recommendations = useMemo(() => {
    const choose = (type, avoid = []) => {
      const pool = foods.filter(f => (f.mealTypes || []).includes(type) && f.category !== 'dessert' && !avoid.includes(f.id));
      if (!pool.length) return null;
      const score = f => (Number(f.nutrition?.protein || 0) * (profile.activityDay==='rest' ? 1 : 1.15)) + (f.isFavorite?12:0) - (Number(f.price)>Number(profile.defaultMealBudget)?8:0);
      return [...pool].sort((a,b) => score(b)-score(a))[0];
    };
    const breakfast = choose('الفطار');
    const lunch = choose('الغدا', [breakfast?.id]);
    const dinner = choose('العشا', [breakfast?.id, lunch?.id]);
    return [{key:'breakfast',label:'الفطار',food:breakfast,time:'٨:٠٠ ص',icon:'☀️'}, {key:'lunch',label:'الغدا',food:lunch,time:'٢:٠٠ م',icon:'🍽️'}, {key:'dinner',label:'العشا',food:dinner,time:'٨:٠٠ م',icon:'🌙'}];
  }, [foods, profile.defaultMealBudget, profile.activityDay]);

  const filteredFoods = useMemo(() => foods.filter(f => {
    const q = search.trim().toLowerCase();
    const matchesText = !q || `${f.name} ${f.description || ''} ${f.source || ''}`.toLowerCase().includes(q);
    const matchesCat = category === 'الكل' || (f.mealTypes || []).includes(category);
    const matchesSource = source === 'الكل' || f.source === source;
    return matchesText && matchesCat && matchesSource;
  }).sort((a,b)=>Number(Boolean(b.isFavorite))-Number(Boolean(a.isFavorite))), [foods, search, category, source]);

  function setMeal(slot, food) {
    setLogs(prev => ({...prev, [today]: {...(prev[today] || {breakfast:null,lunch:null,dinner:null,snacks:[]}), [slot]: food}}));
    notify(`اتضافت ${food.name} لليوم`);
  }
  function quickLog(food, slot) {
    const normalizedSlot = ({'الفطار':'breakfast','الغدا':'lunch','العشا':'dinner'}[slot] || slot);
    if (normalizedSlot==='سناك' || normalizedSlot==='حلويات' || normalizedSlot==='snacks') addSnack(food);
    else setMeal(normalizedSlot, food);
  }
  function addSnack(food) {
    setLogs(prev => {
      const log = prev[today] || {breakfast:null,lunch:null,dinner:null,snacks:[]};
      return {...prev, [today]: {...log, snacks:[...(log.snacks || []), food]}};
    });
    notify(`اتضاف ${food.name} للسناك`);
  }
  function removeMeal(slot) {
    setLogs(prev => ({...prev, [today]: {...(prev[today] || {}), [slot]: null}}));
  }
  function saveFood(food) {
    setFoods(prev => food.id ? prev.map(f => f.id === food.id ? normalizeFood({...food, isCustom:true}) : f) : [normalizeFood({...food, id:`custom-${Date.now()}`, isCustom:true}), ...prev]);
    setModal(null); notify('تم حفظ الأكلة');
  }
  function deleteFood(food) {
    if (!food.isCustom) { notify('تقدر تعدّل الأكلات الأساسية لكن حذفها غير متاح'); return; }
    if (window.confirm(`متأكد إنك عايز تحذف «${food.name}»؟`)) {
      setFoods(prev => prev.filter(f => f.id !== food.id)); notify('تم حذف الأكلة');
    }
  }
  function addRecommended(item) {
    if (!item.food) return;
    if (item.key === 'snacks') addSnack(item.food); else setMeal(item.key, item.food);
  }
  function exportBackup() {
    const payload = {app:'Akly',version:3,exportedAt:new Date().toISOString(),foods,logs,profile,weekPlan,weightHistory};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href=url; anchor.download=`akly-backup-${today}.json`; anchor.click(); URL.revokeObjectURL(url); notify('تم تصدير النسخة الاحتياطية');
  }
  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data=JSON.parse(String(reader.result||'')); if(!Array.isArray(data.foods)||typeof data.logs!=='object') throw new Error('invalid');
      setFoods(data.foods.map(normalizeFood)); setLogs(data.logs||{}); setProfile({...initialProfile,...(data.profile||{})}); setWeekPlan(data.weekPlan||{}); setWeightHistory(Array.isArray(data.weightHistory)?data.weightHistory:[]); notify('تم استرجاع بيانات أكلي');
    } catch { notify('ملف النسخة الاحتياطية غير صالح'); } };
    reader.readAsText(file);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Apple size={24}/></div><div><strong>أكلي</strong><small>مساعدك الغذائي</small></div></div>
      <div className="profile-mini"><div className="avatar">ز</div><div><b>خطتك الشخصية</b><span>تقليل الدهون • الحفاظ على العضلات</span></div></div>
      <nav className="side-nav">
        {[['today',Activity,'ملخص اليوم'],['foods',Utensils,'الأكلات والوجبات'],['log',Bookmark,'سجل أكلي'],['week',CalendarDays,'خطة الأسبوع والمشتريات'],['progress',Scale,'التقدم والميزانية'],['settings',Target,'الأهداف الغذائية']].map(([id,Icon,label])=><button key={id} className={`nav-item ${tab===id?'active':''}`} onClick={()=>setTab(id)}><Icon size={19}/><span>{label}</span>{tab===id&&<ArrowLeft size={16} className="nav-arrow"/>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="tip-icon"><Sparkles size={18}/></div><b>خطوة صغيرة كل يوم</b><p>اختيارات مرنة ومتوازنة أفضل من المثالية المستحيلة.</p></div>
      <div className="sidebar-footer">نسخة تجريبية · البيانات على جهازك</div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><Apple size={21}/></div><strong>أكلي</strong></div><div className="breadcrumbs">مساحتك الشخصية <span>/</span> {({today:'ملخص اليوم',foods:'الأكلات والوجبات',log:'سجل أكلي',week:'خطة الأسبوع والمشتريات',progress:'التقدم والميزانية',settings:'الأهداف الغذائية',choose:'نختار ناكل إيه؟'})[tab]}</div><div className="top-actions"><span className="today-pill"><span className="online-dot"></span> {new Date().toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long'})}</span><button className="icon-button reset-filters" aria-label="إعادة تعيين الفلاتر" onClick={()=>{setSearch('');setCategory('الكل');setSource('الكل');}}><RotateCcw size={18}/></button><button className="icon-button settings-shortcut" aria-label="الأهداف والإعدادات" onClick={()=>setTab('settings')}><Target size={18}/></button></div></header>
      {tab==='today' && <TodayView foods={foods} recommendations={recommendations} total={total} dailyCost={dailyCost} profile={profile} todayLog={todayLog} onAdd={addRecommended} onBrowse={()=>setTab('foods')} onRemove={removeMeal} onCustom={()=>setModal({type:'new'})} onEdit={food=>setModal({type:'edit',food})} onAddFavorite={food=>setModal({type:'addToDay',food})} onQuickLog={quickLog} activityDay={profile.activityDay} defaultMealBudget={profile.defaultMealBudget} />}
      {tab==='foods' && <FoodsView foods={filteredFoods} search={search} setSearch={setSearch} category={category} setCategory={setCategory} source={source} setSource={setSource} onAdd={food=>setModal({type:'addToDay',food})} onEdit={food=>setModal({type:'edit',food})} onDelete={deleteFood} onCreate={()=>setModal({type:'new'})} onQuickAdd={food=>quickLog(food,(food.mealTypes||[]).find(t=>['الفطار','الغدا','العشا'].includes(t))||'سناك')}/>}
      {tab==='log' && <LogView todayLog={todayLog} total={total} onBrowse={()=>setTab('foods')} onRemove={removeMeal}/>}
      {tab==='week' && <WeekView foods={foods} weekPlan={weekPlan} setWeekPlan={setWeekPlan} />}
      {tab==='progress' && <ProgressView weightHistory={weightHistory} setWeightHistory={setWeightHistory} profile={profile} setProfile={setProfile} monthlySpend={monthlySpend} monthlyDeliverySpend={monthlyDeliverySpend} monthlyGrocerySpend={monthlyGrocerySpend} monthlyOtherSpend={monthlyOtherSpend} exportBackup={exportBackup} importBackup={importBackup} />}
      {tab==='settings' && <SettingsView profile={profile} setProfile={setProfile} />}
      {tab==='choose' && <MealSuggestionsView foods={foods} meal={suggestionMeal} setMeal={setSuggestionMeal} source={suggestionSource} setSource={setSuggestionSource} refreshKey={suggestionRefresh} onRefresh={()=>setSuggestionRefresh(v=>v+1)} onAdd={(food)=>{const slot=({'الفطار':'breakfast','الغدا':'lunch','العشا':'dinner'})[suggestionMeal];setMeal(slot,food);}} onBrowse={()=>setTab('foods')} />}
      <footer className="page-footer"><span>صُمم عشان يناسب أكلك الحقيقي، مش نظام مثالي صعب الالتزام بيه.</span><span>القيم الغذائية تقديرية وليست بديلًا عن استشارة مختص.</span></footer>
    </main>
    <nav className="mobile-bottom-nav" aria-label="التنقل الرئيسي">{[['today',Activity,'اليوم'],['foods',Utensils,'الأكلات'],['choose',WandSparkles,'اقتراحات'],['log',Bookmark,'سجلي'],['week',CalendarDays,'الخطة']].map(([id,Icon,label])=><button key={id} className={`mobile-nav-item ${tab===id?'active':''}`} onClick={()=>setTab(id)} aria-current={tab===id?'page':undefined}><Icon size={20} strokeWidth={tab===id?2.4:1.8}/><span>{label}</span></button>)}</nav>
    <div className="floating-actions"><button className={`floating-primary floating-discover ${tab==='choose'?'is-active':''}`} aria-label="اقتراح أكلة" title="نختار ناكل إيه؟" onClick={()=>setTab('choose')}><WandSparkles size={22}/><span>ناكل إيه؟</span></button><button className="floating-secondary" aria-label="إضافة أكلة" title="إضافة أكلة جديدة" onClick={()=>setModal({type:'new'})}><Plus size={20}/></button></div>
    {modal && <MealModal modal={modal} foods={foods} onClose={()=>setModal(null)} onSave={saveFood} onAdd={(food,slot)=>{if(slot==='سناك'||slot==='حلويات')addSnack(food);else setMeal(({الفطار:'breakfast',الغدا:'lunch',العشا:'dinner'})[slot] || slot,food);setModal(null);}} />}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>;
}

function MealSuggestionsView({foods,meal,setMeal,source,setSource,refreshKey,onRefresh,onAdd,onBrowse}) {
  const options = [{label:'الفطار',icon:Sun,hint:'بداية يوم مشبعة',tone:'breakfast'},{label:'الغدا',icon:Utensils,hint:'وجبة رئيسية',tone:'lunch'},{label:'العشا',icon:Moon,hint:'وجبة خفيفة أو مشبعة',tone:'dinner'}];
  const mealCopy = {'الفطار':'نفسك تفطر إيه النهارده؟','الغدا':'عايز تطلب ولا تعمل غدا في البيت؟','العشا':'نختار عشا خفيف ولا وجبة تشبعك؟'};
  const pool = useMemo(() => {
    const eligible = foods.filter(food => (food.mealTypes || []).includes(meal) && food.category !== 'dessert' && (source === 'الكل' || (source === 'اطلب' ? food.source === 'مطعم' : ['بيتي','سوبر ماركت'].includes(food.source))));
    const seed = refreshKey + meal.length * 7;
    return [...eligible].sort((a,b) => { const score = food => (Number(food.nutrition?.protein)||0) * .6 - (Number(food.nutrition?.calories)||0) * .006 + (food.isFavorite ? 8 : 0) + (((food.id || '').length * 13 + seed * 17) % 23) / 10; return score(b)-score(a); }).slice(0,12);
  },[foods,meal,source,refreshKey]);
  return <div className="page-content suggestion-page">
    <section className="suggestion-hero"><div className="suggestion-hero-orb orb-one"></div><div className="suggestion-hero-orb orb-two"></div><span className="suggestion-kicker"><WandSparkles size={15}/> مساعد اختيار الوجبة</span><h1>محتار ناكل إيه؟ <span>✨</span></h1><p>اختار نوع الوجبة، وأنا أطلعلك اقتراحات من أكلك المعتاد — طلبات المطاعم وأكل البيت.</p><div className="suggestion-hero-note"><ChefHat size={17}/> اقتراحات من مكتبتك الشخصية</div></section>
    <section className="suggestion-controls"><div className="section-heading"><div><h2>عايز تاكل إيه؟</h2><p>{mealCopy[meal]}</p></div><span className="suggestion-step">01 / 02</span></div>
      <div className="meal-choice-grid">{options.map(({label,icon:Icon,hint,tone})=><button key={label} className={'meal-choice '+tone+' '+(meal===label?'selected':'')} onClick={()=>setMeal(label)} aria-pressed={meal===label}><span className="meal-choice-icon"><Icon size={22}/></span><span className="meal-choice-copy"><b>{label}</b><small>{hint}</small></span><span className="meal-choice-check"><Check size={14}/></span></button>)}</div>
      <div className="suggestion-filter-row"><span>عايزها منين؟</span><div className="suggestion-filter-pills">{[['الكل','الكل'],['اطلب','من مطعم'],['البيت','البيت أو الماركت']].map(([value,label])=><button key={value} className={source===value?'active':''} onClick={()=>setSource(value)}>{label}</button>)}</div></div></section>
    <section className="suggestion-results"><div className="section-heading"><div><h2>اقتراحات ليك <span className="suggestion-count">{fmt(pool.length)}</span></h2><p>اختار اللي على مزاجك وسجّلها لليوم.</p></div><button className="suggestion-refresh" onClick={onRefresh}><RefreshCw size={15}/> اقتراحات تانية</button></div>
      {pool.length ? <div className="suggestion-card-grid">{pool.map((food,index)=><article key={food.id} className="suggestion-card" style={{'--card-index':index}}><div className="suggestion-card-art"><span className="suggestion-card-emoji">{food.emoji||'🍽️'}</span><span className="suggestion-card-source">{food.source==='مطعم'?<><ShoppingBag size={12}/> اطلبها</>:<><ChefHat size={12}/> اعملها</>}</span>{food.isFavorite&&<span className="suggestion-favorite"><Heart size={12} fill="currentColor"/></span>}</div><div className="suggestion-card-body"><div className="suggestion-card-meta"><span>{meal}</span><span>حصة تقديرية {fmt(food.servingGrams||0)} جم</span></div><h3>{food.name}</h3><p>{food.description||'اختيار من مكتبة أكلي'}</p><div className="suggestion-nutrition"><div><Flame size={15}/><b>{fmt(food.nutrition?.calories)}</b><small>سعرة</small></div><div><Activity size={15}/><b>{fmt(food.nutrition?.protein)}</b><small>جم بروتين</small></div><div><Leaf size={15}/><b>{fmt(food.nutrition?.carbs)}</b><small>جم كارب</small></div></div><div className="suggestion-card-footer"><span>{food.confidence==='منخفض'?'قيم تقريبية':'تقدير غذائي'}</span><button onClick={()=>onAdd(food)}><Plus size={16}/> اختار الوجبة</button></div></div></article>)}</div> : <div className="suggestion-empty"><span>🍽️</span><h3>لسه مفيش اقتراحات للوجبة دي</h3><p>جرّب نوع وجبة تاني أو افتح مكتبة الأكلات عشان تضيف اختيارات.</p><button className="btn btn-primary" onClick={onBrowse}><Utensils size={16}/> افتح مكتبة الأكلات</button></div>}</section>
  </div>;
}
function MacroBar({label,value,target,color,unit='جم'}) {
  const pct = target > 0 ? Math.min(100, value / target * 100) : 0;
  return <div className="macro-row"><div className="macro-label"><span>{label}</span><b>{fmt(value)} <small>/ {fmt(target)} {unit}</small></b></div><div className="progress-track"><div className={`progress-fill ${color}`} style={{width:`${pct}%`}}/></div></div>;
}
function TodayView({foods,recommendations,total,dailyCost,profile,todayLog,onAdd,onBrowse,onRemove,onCustom,onEdit,onAddFavorite,onQuickLog,activityDay,defaultMealBudget}) {
  const eaten = [todayLog.breakfast,todayLog.lunch,todayLog.dinner,...(todayLog.snacks||[])].filter(Boolean).length;
  const remaining = Math.max(0, profile.calorieTarget - total.calories);
  return <div className="page-content">
    <section className="welcome-row"><div><div className="eyebrow"><Sparkles size={15}/> يوم جديد، اختيارات أذكى</div><h1>ناكل إيه النهارده؟ <span>🥑</span></h1><p>خلّي اختيار وجبتك أسهل، ووازن أكلك من غير حرمان.</p></div><button className="btn btn-primary" onClick={onCustom}><Plus size={18}/> أضف أكلة من عندك</button></section>
    <section className="cost-strip">
      <div><Wallet size={19}/><span>تكلفة أكل اليوم</span><b>{fmt(dailyCost)} ج.م</b></div>
      <div><Heart size={19}/><span>بروتين مقابل كل 100 جنيه</span><b>{dailyCost>0?fmt(total.protein/dailyCost*100):'—'} جم</b></div>
      <small>الأسعار اختيارية؛ اكتب سعر الحصة في بيانات كل أكلة لحساب التكلفة.</small>
    </section>
    <section className="hero-card"><div className="hero-copy"><span className="hero-kicker">خطة مرنة تناسبك</span><h2>الهدف مش إنك تاكل أقل وخلاص،<br/>الهدف إنك تختار بذكاء.</h2><p>ركّز على البروتين، ظبّط الكميات، وسيب مساحة للأكلات اللي بتحبها.</p><button className="btn btn-light" onClick={onBrowse}>استكشف الأكلات <ArrowLeft size={17}/></button></div><div className="hero-illustration"><div className="hero-circle"><span>🥗</span></div><div className="float-tag tag-one"><Flame size={16}/> توازن يومك</div><div className="float-tag tag-two"><Leaf size={16}/> اختيارات مرنة</div></div><div className="hero-decoration deco-one"></div><div className="hero-decoration deco-two"></div></section>
    <section className="alternatives-panel"><div className="section-heading"><div><h2>بدائل أذكى لنفس مزاجك</h2><p>قارن الوجبات حسب البروتين والسعرات والسعر قبل ما تختار.</p></div></div><div className="alternative-grid">{foods.filter(f=>(f.mealTypes||[]).some(t=>['الغدا','العشا','سناك','حلويات'].includes(t))).sort((a,b)=>(Number(b.nutrition?.protein)||0)-(Number(a.nutrition?.protein)||0)).slice(0,3).map(food=><article key={food.id} className="alternative-card"><span>{food.emoji||'🍽️'}</span><b>{food.name}</b><small>{fmt(food.nutrition?.calories)} سعرة · {fmt(food.nutrition?.protein)} جم بروتين</small><small>{Number(food.price)>0?`${fmt(food.price)} ج.م`:'السعر غير مسجل'}</small><button className="btn btn-outline" onClick={()=>onAddFavorite(food)}>اختار الوجبة</button></article>)}</div></section>
    <SmartMealHelper foods={foods} total={total} profile={profile} onQuickLog={onQuickLog} activityDay={activityDay} defaultMealBudget={defaultMealBudget} />
    <section className="favorites-section"><div className="section-heading"><div><h2>أكلي المفضل <span>⭐</span></h2><p>وجباتك المعتادة في مكان واحد — أضفها أو عدّلها من المكتبة.</p></div><button className="text-button" onClick={onBrowse}>إدارة المفضلة <ArrowLeft size={16}/></button></div>{foods.some(food=>food.isFavorite)?<div className="favorite-strip">{foods.filter(food=>food.isFavorite).map(food=><article className="favorite-card" key={food.id}><div className="favorite-emoji">{food.emoji||'🍽️'}</div><div className="favorite-info"><b>{food.name}</b><small>{fmt(food.nutrition?.calories)} سعرة · {fmt(food.nutrition?.protein)} جم بروتين</small><div className="favorite-links">{(food.links||[]).slice(0,2).map((link,i)=><a key={i} href={link.url} target="_blank" rel="noreferrer">{link.title||'فيديو الوصفة'}</a>)}</div></div><button className="favorite-add" onClick={()=>onAddFavorite(food)} title="أضف لسجل اليوم"><Plus size={17}/></button></article>)}</div>:<div className="favorites-empty"><span>⭐</span><div><b>لسه مفيش وجبات في المفضلة</b><small>ضيف وجباتك اللي بتطلبها باستمرار، وهتظهر هنا قبل الأكلات المشهورة.</small></div><button className="btn btn-outline" onClick={onBrowse}>اختار من الأكلات</button></div>}</section>
    <section className="stats-grid">
      <div className="stat-card calories-stat"><div className="stat-top"><span>السعرات المستهلكة</span><span className="stat-icon"><Flame size={18}/></span></div><div className="stat-value">{fmt(total.calories)} <small>سعرة</small></div><div className="stat-sub">متبقي {fmt(remaining)} سعرة من هدفك</div><div className="progress-track"><div className="progress-fill orange" style={{width:`${Math.min(100,total.calories/Math.max(1,profile.calorieTarget)*100)}%`}}/></div></div>
      <div className="stat-card"><div className="stat-top"><span>البروتين</span><span className="stat-icon green"><Activity size={18}/></span></div><div className="stat-value">{fmt(total.protein)} <small>جم</small></div><div className="stat-sub">هدفك {fmt(profile.proteinTarget)} جم يوميًا</div><div className="progress-track"><div className="progress-fill green-fill" style={{width:`${Math.min(100,total.protein/Math.max(1,profile.proteinTarget)*100)}%`}}/></div></div>
      <div className="stat-card"><div className="stat-top"><span>الكربوهيدرات</span><span className="stat-icon purple"><Activity size={18}/></span></div><div className="stat-value">{fmt(total.carbs)} <small>جم</small></div><div className="stat-sub">من هدف {fmt(profile.carbTarget)} جم</div><div className="progress-track"><div className="progress-fill purple-fill" style={{width:`${Math.min(100,total.carbs/Math.max(1,profile.carbTarget)*100)}%`}}/></div></div>
      <div className="stat-card"><div className="stat-top"><span>الدهون</span><span className="stat-icon yellow"><Activity size={18}/></span></div><div className="stat-value">{fmt(total.fat)} <small>جم</small></div><div className="stat-sub">من هدف {fmt(profile.fatTarget)} جم</div><div className="progress-track"><div className="progress-fill yellow-fill" style={{width:`${Math.min(100,total.fat/Math.max(1,profile.fatTarget)*100)}%`}}/></div></div>
    </section>
    <div className="section-heading"><div><h2>اقتراحات النهارده</h2><p>٣ وجبات مقترحة من قائمتك — غيّر أي اختيار وقت ما تحب.</p></div><button className="text-button" onClick={onBrowse}>كل الأكلات <ArrowLeft size={16}/></button></div>
    <section className="recommendation-grid">{recommendations.map(item=><RecommendationCard key={item.key} item={item} selected={todayLog[item.key]} onAdd={()=>onAdd(item)} onRemove={()=>onRemove(item.key)} />)}</section>
    <section className="bottom-grid"><div className="panel nutrition-panel"><div className="panel-heading"><div><h3>ملخص العناصر الغذائية</h3><p>متابعة بسيطة لتقدمك خلال اليوم</p></div><div className="panel-icon"><Target size={19}/></div></div><MacroBar label="البروتين" value={total.protein} target={profile.proteinTarget} color="green-fill"/><MacroBar label="الكربوهيدرات" value={total.carbs} target={profile.carbTarget} color="purple-fill"/><MacroBar label="الدهون" value={total.fat} target={profile.fatTarget} color="yellow-fill"/><div className="fiber-note"><Leaf size={17}/><span>الألياف: <b>{fmt(total.fiber)} جم</b></span><span className="muted">اختار خضار وفاكهة وحبوب كاملة</span></div></div><div className="panel quick-panel"><div className="panel-heading"><div><h3>إضافات سريعة</h3><p>سجّل أكلك بطريقتك</p></div><div className="panel-icon"><Plus size={19}/></div></div><button className="quick-action" onClick={onBrowse}><span className="quick-emoji">🍽️</span><span><b>اختار من قائمة الأكلات</b><small>أكلات مصرية وطلبات مطاعم</small></span><ArrowLeft size={17}/></button><button className="quick-action" onClick={onCustom}><span className="quick-emoji">📝</span><span><b>أضف وجبة مخصصة</b><small>اكتب المكونات والكميات بنفسك</small></span><ArrowLeft size={17}/></button><div className="tiny-note"><CircleHelp size={15}/> القيم التقديرية تختلف حسب الوزن والوصفة.</div></div></section>
  </div>;
}
function RecommendationCard({item,selected,onAdd,onRemove}) {
  const food = selected || item.food;
  if (!food) return <div className="meal-card"><p>أضف أكلة من هذا النوع لعرض اقتراح.</p></div>;
  return <article className={`meal-card ${selected?'selected-card':''}`}><div className="meal-card-top"><span className={`meal-badge ${item.key}`}>{item.icon} {item.label}</span><span className="meal-time"><Clock3 size={13}/>{item.time}</span></div><div className="food-emoji">{food.emoji || '🍽️'}</div><h3>{food.name}</h3><p className="food-description">{food.description || 'وجبة محفوظة في قائمتك'}</p><div className="meal-nutrition"><div><b>{fmt(food.nutrition?.calories)}</b><small>سعرة</small></div><div><b>{fmt(food.nutrition?.protein)}<small> جم</small></b><small>بروتين</small></div><div><b>{fmt(food.nutrition?.carbs)}<small> جم</small></b><small>كربوهيدرات</small></div></div><div className="confidence"><span className={`confidence-dot ${food.confidence==='عالي'?'high':food.confidence==='منخفض'?'low':''}`}></span>دقة التقدير: {food.confidence || 'متوسط'}</div>{selected?<button className="btn btn-outline full-btn" onClick={onRemove}><X size={16}/> إزالة من اليوم</button>:<button className="btn btn-primary full-btn" onClick={onAdd}><Plus size={17}/> أضف لليوم</button>}</article>;
}
function FoodsView({foods,search,setSearch,category,setCategory,source,setSource,onAdd,onQuickAdd,onEdit,onDelete,onCreate}) {
  return <div className="page-content"><section className="welcome-row"><div><div className="eyebrow"><Utensils size={15}/> مكتبتك الشخصية</div><h1>الأكلات والوجبات <span>🍲</span></h1><p>احفظ أكلك المعتاد، من أكل البيت لطلبات الدليفري.</p></div><button className="btn btn-primary" onClick={onCreate}><Plus size={18}/> أضف أكلة جديدة</button></section>
    <div className="filter-bar"><div className="search-box"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="دور على أكلة أو مكون..."/></div><div className="select-wrap"><ListFilter size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option>الكل</option><option>الفطار</option><option>الغدا</option><option>العشا</option><option>سناك</option><option>حلويات</option></select><ChevronDown size={15}/></div><div className="select-wrap"><select value={source} onChange={e=>setSource(e.target.value)}><option>الكل</option><option>بيتي</option><option>مطعم</option><option>سوبر ماركت</option><option>أخرى</option></select><ChevronDown size={15}/></div></div>
    <div className="library-summary"><span>{fmt(foods.length)} أكلة</span><span>·</span><span>تقدر تضيف وتعدّل وجباتك في أي وقت</span></div>
    <section className="food-grid">{foods.map(food=><article className="food-library-card" key={food.id}><div className="library-card-top"><span className="library-emoji">{food.emoji||'🍽️'}</span><div className="library-tags">{food.isFavorite&&<span className="favorite-tag">⭐ مفضل</span>}<span className={`source-tag ${food.source==='مطعم'?'restaurant':''}`}>{food.source||'بيتي'}</span></div></div><h3>{food.name}</h3><p>{food.description || 'مكونات غير محددة'}</p><div className="library-macros"><span><Flame size={14}/>{fmt(food.nutrition?.calories)} سعرة</span><span><Activity size={14}/>{fmt(food.nutrition?.protein)} جم بروتين</span></div><div className="library-meta"><span>{(food.mealTypes||[]).join(' • ')}</span><span className="confidence-text">الدقة: {food.confidence||'متوسط'}</span></div><div className="food-price-row"><b>{Number(food.price)>0?`${fmt(food.price)} جنيه للحصة`:'السعر غير مسجل'}</b>{Number(food.price)>0&&<span>{fmt((Number(food.nutrition?.protein)||0)/Number(food.price)*100)} جم بروتين / 100 جنيه</span>}</div>{(food.links||[]).length>0&&<div className="recipe-link-list">{food.links.map((link,i)=><a href={link.url} target="_blank" rel="noreferrer" key={i}><ExternalLink size={13}/> {link.title||'افتح الرابط'}</a>)}</div>}<div className="library-actions"><button className="btn btn-primary" onClick={()=>onQuickAdd(food)}><Zap size={15}/> سجّل بسرعة</button><button className="btn btn-outline" onClick={()=>onAdd(food)}><Plus size={15}/> اختيار الحجم</button><button className="icon-button" title="تعديل" onClick={()=>onEdit(food)}><Pencil size={16}/></button><button className="icon-button" title="حذف" onClick={()=>onDelete(food)}><Trash2 size={16}/></button></div></article>)}</section>
    {foods.length===0&&<div className="empty-state"><span>🔎</span><h3>ملقيناش أكلة بالمواصفات دي</h3><p>جرّب تغيّر البحث أو الفلاتر.</p></div>}
  </div>;
}
function LogView({todayLog,total,onBrowse,onRemove}) {
  const rows=[['breakfast','الفطار','☀️',todayLog.breakfast],['lunch','الغدا','🍽️',todayLog.lunch],['dinner','العشا','🌙',todayLog.dinner]];
  return <div className="page-content"><section className="welcome-row"><div><div className="eyebrow"><Bookmark size={15}/> سجل يومك</div><h1>أكلت إيه النهارده؟ <span>📋</span></h1><p>راجع وجباتك المسجلة وإجمالي العناصر الغذائية.</p></div><button className="btn btn-primary" onClick={onBrowse}><Plus size={18}/> سجّل أكلة</button></section><section className="log-summary"><div><span>السعرات</span><b>{fmt(total.calories)} <small>سعرة</small></b></div><div><span>البروتين</span><b>{fmt(total.protein)} <small>جم</small></b></div><div><span>الكربوهيدرات</span><b>{fmt(total.carbs)} <small>جم</small></b></div><div><span>الدهون</span><b>{fmt(total.fat)} <small>جم</small></b></div></section><div className="log-list">{rows.map(([key,label,emoji,food])=><div className="log-row" key={key}><div className="log-meal-icon">{emoji}</div><div className="log-info"><span>{label}</span><b>{food?.name || 'لسه مسجلتش وجبة'}</b>{food&&<small>{fmt(food.nutrition?.calories)} سعرة · {fmt(food.nutrition?.protein)} جم بروتين</small>}</div>{food&&<button className="icon-button" onClick={()=>onRemove(key)} title="إزالة"><X size={17}/></button>}</div>)}{(todayLog.snacks||[]).map((food,i)=><div className="log-row" key={`snack-${i}`}><div className="log-meal-icon">🍎</div><div className="log-info"><span>سناك</span><b>{food.name}</b><small>{fmt(food.nutrition?.calories)} سعرة · {fmt(food.nutrition?.protein)} جم بروتين</small></div></div>)}</div></div>;
}


function SmartMealHelper({foods,total,profile,onQuickLog,activityDay,defaultMealBudget}) {
  const [slot,setSlot]=useState('الغدا');
  const [budget,setBudget]=useState(String(defaultMealBudget||''));
  const remainingCalories=Math.max(0,(Number(profile.calorieTarget)||0)-(Number(total.calories)||0));
  const remainingProtein=Math.max(0,(Number(profile.proteinTarget)||0)-(Number(total.protein)||0));
  const pick=useMemo(()=>{
    const pool=foods.filter(f=>(f.mealTypes||[]).includes(slot) && (slot==='حلويات'||f.category!=='dessert') && (!Number(budget)||!Number(f.price)||Number(f.price)<=Number(budget)) && (Number(f.nutrition?.calories)||0)<=remainingCalories+180);
    return [...pool].sort((a,b)=>((Number(b.nutrition?.protein)||0)+(b.isFavorite?14:0)-(Number(b.nutrition?.calories)||0)*.015)-((Number(a.nutrition?.protein)||0)+(a.isFavorite?14:0)-(Number(a.nutrition?.calories)||0)*.015))[0]||foods.filter(f=>(f.mealTypes||[]).includes(slot)).sort((a,b)=>(Number(b.nutrition?.protein)||0)-(Number(a.nutrition?.protein)||0))[0]||null;
  },[foods,slot,budget,remainingCalories]);
  const activityLabel=({'rest':'يوم راحة','resistance':'تمرين مقاومة','padel':'يوم بادل'})[activityDay]||'يومك';
  return <section className="smart-helper"><div className="smart-helper-heading"><div className="smart-helper-icon"><Zap size={21}/></div><div><h2>آكل إيه دلوقتي؟</h2><p>اقتراح من أكلك المحفوظ حسب هدفك والميزانية — {activityLabel}</p></div></div><div className="smart-controls"><label className="field-label"><span>نوع الأكلة</span><select value={slot} onChange={e=>setSlot(e.target.value)}><option>الفطار</option><option>الغدا</option><option>العشا</option><option>سناك</option><option>حلويات</option></select></label><label className="field-label"><span>أقصى ميزانية للحصة (جنيه)</span><input type="number" min="0" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="بدون حد"/></label></div>{pick?<div className="smart-pick"><span className="smart-pick-emoji">{pick.emoji||'🍽️'}</span><div className="smart-pick-copy"><b>{pick.name} {pick.isFavorite?'⭐':''}</b><small>{fmt(pick.nutrition?.calories)} سعرة · {fmt(pick.nutrition?.protein)} جم بروتين · {Number(pick.price)>0?`${fmt(pick.price)} جنيه`:'السعر غير مسجل'}</small><small>متبقي لك اليوم تقريبًا {fmt(remainingCalories)} سعرة و{fmt(remainingProtein)} جم بروتين.</small></div><button className="btn btn-primary" onClick={()=>onQuickLog(pick,slot)}><Zap size={15}/> سجّل الوجبة</button></div>:<p className="smart-empty">مفيش اختيار مناسب بالبيانات الحالية. زوّد أكلك أو وسّع الميزانية.</p>}</section>;
}
function ProgressView({weightHistory,setWeightHistory,profile,setProfile,monthlySpend,monthlyDeliverySpend,monthlyGrocerySpend,monthlyOtherSpend,exportBackup,importBackup}) {
  const [weight,setWeight]=useState('');
  const [date,setDate]=useState(new Date().toLocaleDateString('en-CA'));
  const recent=[...weightHistory].sort((a,b)=>a.date.localeCompare(b.date)).slice(-10);
  const values=recent.map(x=>Number(x.weight)||0); const min=values.length?Math.min(...values):0; const max=values.length?Math.max(...values):1;
  function saveWeight(e){e.preventDefault();if(Number(weight)<=0)return;setWeightHistory(prev=>[...prev.filter(x=>x.date!==date),{date,weight:Number(weight)}].sort((a,b)=>a.date.localeCompare(b.date)));setWeight('');}
  const budgetRows=[['monthlyDeliveryBudget','الدليفري والمطاعم',monthlyDeliverySpend],['monthlyGroceriesBudget','السوبر ماركت والأكل البيتي',monthlyGrocerySpend],['monthlyOtherBudget','مصاريف أكل أخرى',monthlyOtherSpend]];
  return <div className="page-content"><section className="welcome-row"><div><div className="eyebrow"><Scale size={15}/> تقدمك ومصاريفك</div><h1>التقدم والميزانية <span>📈</span></h1><p>تابع اتجاه الوزن ومصاريف الأكل الشهرية في مكان واحد.</p></div></section>
    <section className="progress-grid"><article className="progress-panel"><div className="panel-heading"><div><h3>متابعة الوزن</h3><p>سجّل الوزن بنفس الوحدة وبشكل دوري.</p></div><Scale size={20}/></div><form className="weight-form" onSubmit={saveWeight}><label className="field-label"><span>التاريخ</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label className="field-label"><span>الوزن (كجم)</span><input type="number" min="1" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="مثلاً 79.5" required/></label><button className="btn btn-primary" type="submit">حفظ الوزن</button></form>{recent.length?<><div className="weight-chart">{recent.map((entry,i)=><div className="weight-bar-wrap" key={entry.date} title={`${entry.date}: ${entry.weight} كجم`}><b>{entry.weight}</b><div className="weight-bar" style={{height:`${Math.max(14,((Number(entry.weight)-min)/Math.max(0.1,max-min))*90+20)}px`}}/><small>{entry.date.slice(5)}</small></div>)}</div><div className="weight-trend">{recent.length>1?`التغير من أول تسجيل ظاهر: ${(Number(recent[recent.length-1].weight)-Number(recent[0].weight)).toFixed(1)} كجم`:'سجّل وزن تاني بعد فترة عشان نعرض اتجاه التغير.'}</div></>:<div className="empty-state compact-empty"><span>⚖️</span><h3>لسه مفيش سجل وزن</h3><p>أضف أول قراءة عشان تبدأ متابعة التقدم.</p></div>}</article>
    <article className="progress-panel"><div className="panel-heading"><div><h3>ميزانية الشهر</h3><p>المصروف المحسوب من الوجبات المسجلة ذات الأسعار المدخلة.</p></div><Wallet size={20}/></div><div className="monthly-total"><span>إجمالي مسجل الشهر الحالي</span><b>{fmt(monthlySpend)} ج.م</b></div>{budgetRows.map(([key,label,spent])=>{const limit=Number(profile[key])||0;return <div className="budget-row" key={key}><div className="budget-row-head"><span>{label}</span><b>{fmt(spent)} / {fmt(limit)} ج.م</b></div><div className="progress-track"><div className="progress-fill green-fill" style={{width:`${limit?Math.min(100,spent/limit*100):0}%`}}/></div><label className="budget-input"><span>ميزانية الشهر</span><input type="number" min="0" value={profile[key]||0} onChange={e=>setProfile(p=>({...p,[key]:Math.max(0,Number(e.target.value))}))}/></label></div>})}<p className="muted-note">التكلفة لا تشمل أي وجبة لم يُسجّل سعرها. المشتريات المنزلية تقديرية لو سعر الوصفة لا يمثل تكلفة مكوناتها الفعلية.</p></article></section>
    <section className="progress-panel activity-panel"><div className="panel-heading"><div><h3>نوع يومك</h3><p>اختيارك يساعد الاقتراحات تبرز الوجبات المناسبة لنشاطك.</p></div><Dumbbell size={20}/></div><div className="activity-options">{[['rest','يوم راحة','🌿'],['resistance','تمرين مقاومة','🏋️'],['padel','يوم بادل','🎾']].map(([key,label,emoji])=><button type="button" key={key} className={profile.activityDay===key?'active':''} onClick={()=>setProfile(p=>({...p,activityDay:key}))}><span>{emoji}</span>{label}</button>)}</div><label className="field-label meal-budget-field"><span>الميزانية الافتراضية للحصة (جنيه)</span><input type="number" min="0" value={profile.defaultMealBudget||0} onChange={e=>setProfile(p=>({...p,defaultMealBudget:Math.max(0,Number(e.target.value))}))}/></label></section>
    <section className="progress-panel backup-panel"><div className="panel-heading"><div><h3>نسخة احتياطية لبياناتك</h3><p>نزّل بياناتك أو استرجعها على جهاز تاني. الملف يحتوي الأكلات والسجل والأهداف والخطة والوزن.</p></div><Download size={20}/></div><div className="backup-actions"><button className="btn btn-primary" onClick={exportBackup}><Download size={16}/> تصدير بياناتي</button><label className="btn btn-outline upload-backup"><Upload size={16}/> استيراد نسخة JSON<input type="file" accept="application/json,.json" onChange={e=>{importBackup(e.target.files?.[0]);e.target.value='';}}/></label></div></section>
  </div>;
}

function WeekView({foods,weekPlan,setWeekPlan}) {
  const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const slots = [['breakfast','الفطار'],['lunch','الغدا'],['dinner','العشا']];
  const [selectedDay,setSelectedDay] = useState('السبت');
  const dayPlan = weekPlan[selectedDay] || {};
  const chosen = Object.values(weekPlan).flatMap(day => Object.values(day || {})).filter(Boolean);
  const shopping = [...new Set(chosen.flatMap(food => {
    const names = (food.ingredients || []).map(i => i.name).filter(Boolean);
    return names.length ? names : (food.description ? [food.description] : []);
  }))];
  function choose(slot,id) {
    const food = foods.find(f=>f.id===id);
    setWeekPlan(prev=>({...prev,[selectedDay]:{...(prev[selectedDay]||{}),[slot]:food||null}}));
  }
  const cost = chosen.reduce((sum,f)=>sum+(Number(f.price)||0),0);
  return <div className="page-content">
    <section className="welcome-row"><div><div className="eyebrow"><CalendarDays size={15}/> خطط على قد أسبوعك</div><h1>خطة الأسبوع والمشتريات <span>🛒</span></h1><p>اختار وجبات كل يوم، وشوف تكلفة الخطة وقائمة مبدئية بالمكونات.</p></div></section>
    <div className="week-days">{days.map(day=><button key={day} className={selectedDay===day?'active':''} onClick={()=>setSelectedDay(day)}>{day}<small>{Object.values(weekPlan[day]||{}).filter(Boolean).length}/3 وجبات</small></button>)}</div>
    <section className="weekly-plan-card"><div className="section-heading"><div><h2>وجبات يوم {selectedDay}</h2><p>اختار الوجبة من قائمتك المحفوظة.</p></div></div><div className="weekly-slots">{slots.map(([key,label])=><label className="field-label" key={key}><span>{label}</span><select value={dayPlan[key]?.id||''} onChange={e=>choose(key,e.target.value)}><option value="">اختار أكلة...</option>{foods.filter(f=>(f.mealTypes||[]).includes(label)).sort((a,b)=>Number(b.isFavorite)-Number(a.isFavorite)).map(f=><option key={f.id} value={f.id}>{f.isFavorite?'⭐ ':''}{f.name}</option>)}</select>{dayPlan[key]&&<small>{fmt(dayPlan[key].nutrition?.calories)} سعرة · {fmt(dayPlan[key].nutrition?.protein)} جم بروتين</small>}</label>)}</div></section>
    <div className="week-summary-grid"><article><Wallet size={20}/><span>تكلفة الخطة الحالية</span><b>{fmt(cost)} جنيه</b><small>مجموع أسعار الحصص المسجلة للأيام السبعة</small></article><article><ShoppingBasket size={20}/><span>مكونات مختلفة</span><b>{fmt(shopping.length)} عنصر</b><small>قائمة مبدئية من تفاصيل الأكلات المختارة</small></article></div>
    <section className="shopping-card"><div className="section-heading"><div><h2>قائمة المشتريات المبدئية</h2><p>بتتجمع من مكونات الأكلات اللي اخترتها خلال الأسبوع.</p></div></div>{shopping.length?<ul>{shopping.map((item,i)=><li key={i}><span>□</span>{item}</li>)}</ul>:<div className="empty-state"><span>🛍️</span><h3>اختار وجبات للأسبوع الأول</h3><p>لما تختار وجبات فيها مكونات مسجلة، هتظهر هنا.</p></div>}</section>
  </div>;
}

function SettingsView({profile,setProfile}) {
  const fields=[['calorieTarget','هدف السعرات اليومية','سعرة'],['proteinTarget','هدف البروتين','جم'],['carbTarget','هدف الكربوهيدرات','جم'],['fatTarget','هدف الدهون','جم']];
  return <div className="page-content"><section className="welcome-row"><div><div className="eyebrow"><Target size={15}/> إعداداتك</div><h1>أهدافك الغذائية <span>🎯</span></h1><p>عدّل الأهداف لتناسب احتياجاتك. القيم الافتراضية مجرد نقطة بداية.</p></div></section><section className="settings-card"><div className="settings-intro"><div className="settings-icon"><Target size={22}/></div><div><h2>أهداف اليوم</h2><p>الأهداف تختلف حسب الوزن والطول والعمر والنشاط.</p></div></div><div className="settings-fields">{fields.map(([key,label,unit])=><label key={key} className="field-label"><span>{label}</span><div className="number-field"><input type="number" min="0" value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:Math.max(0,Number(e.target.value))}))}/><span>{unit}</span></div></label>)}</div><div className="settings-note"><CircleHelp size={17}/><p>لو هدفك تقليل الدهون مع الحفاظ على العضلات، اهتم بالبروتين وتمارين المقاومة، وتجنّب عجز السعرات القاسي. استعن بأخصائي لتحديد أهداف شخصية دقيقة.</p></div><button className="btn btn-outline" onClick={()=>setProfile({...initialProfile})}><RotateCcw size={16}/> إعادة القيم الافتراضية</button></section></div>;
}
function MealModal({modal,foods,onClose,onSave,onAdd}) {
  const editing = modal.type==='edit';
  const adding = modal.type==='addToDay';
  const existing = modal.food || {};
  const [name,setName] = useState(existing.name || '');
  const [category,setCategory] = useState(existing.mealTypes?.[0] || 'الغدا');
  const [source,setSource] = useState(existing.source || 'بيتي');
  const [emoji,setEmoji] = useState(existing.emoji || '🍽️');
  const [description,setDescription] = useState(existing.description || '');
  const [grams,setGrams] = useState(existing.servingGrams || 300);
  const [price,setPrice] = useState(String(existing.price || ''));
  const [portionFactor,setPortionFactor] = useState('1');
  const [ingredientsText,setIngredientsText] = useState((existing.ingredients||[]).map(item=>`${item.name}${item.grams?' | '+item.grams:''}`).join('\n'));
  const [calories,setCalories] = useState(existing.nutrition?.calories ?? 450);
  const [protein,setProtein] = useState(existing.nutrition?.protein ?? 30);
  const [carbs,setCarbs] = useState(existing.nutrition?.carbs ?? 45);
  const [fat,setFat] = useState(existing.nutrition?.fat ?? 15);
  const [fiber,setFiber] = useState(existing.nutrition?.fiber ?? 5);
  const [confidence,setConfidence] = useState(existing.confidence || 'منخفض');
  const [slot,setSlot] = useState(category);
  const [sides,setSides] = useState(existing.sides?.join('، ') || '');
  const [linksText,setLinksText] = useState((existing.links || []).map(link => `${link.title || 'رابط وصفة'} | ${link.url}`).join('\n'));
  const [isFavorite,setIsFavorite] = useState(Boolean(existing.isFavorite));
  function submit(e) {
    e.preventDefault();
    if (adding) { const factor=Number(portionFactor)||1; const scaled={...existing,name:factor===1?existing.name:`${existing.name} (${factor} حصة)`,servingGrams:(Number(existing.servingGrams)||0)*factor,price:(Number(existing.price)||0)*factor,nutrition:Object.fromEntries(Object.entries(existing.nutrition||{}).map(([key,value])=>[key,(Number(value)||0)*factor]))}; onAdd(scaled,slot); return; }
    onSave({...(existing.id?{id:existing.id}:{}),name:name.trim(),category:category==='الفطار'?'breakfast':category==='الغدا'?'lunch':category==='العشا'?'dinner':category==='حلويات'?'dessert':'snack',mealTypes:[category],source,emoji,description,servingGrams:Number(grams)||0,price:Number(price)||0,isFavorite,links:linksText.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|');return {title:(parts.length>1?parts[0]:'رابط وصفة').trim(),url:(parts.length>1?parts.slice(1).join('|'):parts[0]).trim()};}).filter(link=>/^https?:\/\//i.test(link.url)),nutrition:{calories:Number(calories)||0,protein:Number(protein)||0,carbs:Number(carbs)||0,fat:Number(fat)||0,fiber:Number(fiber)||0},confidence,ingredients:ingredientsText.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|');return {name:parts[0].trim(),grams:Number(parts[1])||0};}),sides:sides.split(/[،,]/).map(s=>s.trim()).filter(Boolean),isCustom:true});
  }
  if (adding) return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card small-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><div><h2>إضافة لليوم</h2><p>اختار هتسجل الوجبة فين.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div><div className="add-food-preview"><span>{existing.emoji||'🍽️'}</span><div><b>{existing.name}</b><small>{fmt(existing.nutrition?.calories)} سعرة · {fmt(existing.nutrition?.protein)} جم بروتين</small></div></div><form onSubmit={submit}><label className="field-label"><span>نوع الوجبة</span><select value={slot} onChange={e=>setSlot(e.target.value)}><option>الفطار</option><option>الغدا</option><option>العشا</option><option>سناك</option><option>حلويات</option></select></label><label className="field-label"><span>حجم الحصة</span><select value={portionFactor} onChange={e=>setPortionFactor(e.target.value)}><option value="0.5">نصف حصة</option><option value="1">حصة عادية</option><option value="1.5">حصة ونصف</option><option value="2">حصتين</option></select></label><button className="btn btn-primary full-btn" type="submit"><Plus size={17}/> سجّل الوجبة</button></form></div></div>;
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><div><h2>{editing?'تعديل الأكلة':'أضف أكلة جديدة'}</h2><p>كل ما تدخل تفاصيل أدق، التقدير هيكون أقرب للواقع.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div><form onSubmit={submit} className="food-form"><div className="form-grid"><label className="field-label span-two"><span>اسم الأكلة *</span><input required value={name} onChange={e=>setName(e.target.value)} placeholder="مثلاً: شيش طاووق مع لسان عصفور"/></label><label className="field-label"><span>نوع الوجبة</span><select value={category} onChange={e=>{setCategory(e.target.value);setSlot(e.target.value)}}><option>الفطار</option><option>الغدا</option><option>العشا</option><option>سناك</option><option>حلويات</option></select></label><label className="field-label"><span>المصدر</span><select value={source} onChange={e=>setSource(e.target.value)}><option>بيتي</option><option>مطعم</option><option>سوبر ماركت</option><option>أخرى</option></select></label><label className="field-label"><span>رمز تعبيري</span><input value={emoji} onChange={e=>setEmoji(e.target.value)} maxLength={5}/></label><label className="field-label"><span>وزن الحصة (جم)</span><input type="number" min="0" value={grams} onChange={e=>setGrams(e.target.value)}/></label><label className="field-label"><span>سعر الحصة (جنيه)</span><input type="number" min="0" step="0.5" value={price} onChange={e=>setPrice(e.target.value)} placeholder="اختياري"/></label><label className="field-label span-two"><span>المكونات (كل سطر مكون، واختياريًا | الكمية بالجرام)</span><textarea value={ingredientsText} onChange={e=>setIngredientsText(e.target.value)} placeholder="صدور فراخ | 150\nمكرونة | 100" rows={3}/></label><label className="field-label span-two"><span>المكونات والتفاصيل</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="المكونات، الحجم، الإضافات، الصوص..." rows={2}/></label><div className="form-divider span-two"><span>القيم الغذائية للحصة كلها</span><small>أدخل تقدير الوجبة كاملة، وليس لكل 100 جم.</small></div><label className="field-label"><span>السعرات (kcal)</span><input type="number" min="0" value={calories} onChange={e=>setCalories(e.target.value)}/></label><label className="field-label"><span>البروتين (جم)</span><input type="number" min="0" value={protein} onChange={e=>setProtein(e.target.value)}/></label><label className="field-label"><span>الكربوهيدرات (جم)</span><input type="number" min="0" value={carbs} onChange={e=>setCarbs(e.target.value)}/></label><label className="field-label"><span>الدهون (جم)</span><input type="number" min="0" value={fat} onChange={e=>setFat(e.target.value)}/></label><label className="field-label"><span>الألياف (جم)</span><input type="number" min="0" value={fiber} onChange={e=>setFiber(e.target.value)}/></label><label className="field-label"><span>دقة التقدير</span><select value={confidence} onChange={e=>setConfidence(e.target.value)}><option>عالي</option><option>متوسط</option><option>منخفض</option></select></label><label className="field-label span-two"><span>أطباق جانبية مقترحة</span><input value={sides} onChange={e=>setSides(e.target.value)} placeholder="سلطة، رز، لسان عصفور..."/></label><label className="field-label span-two"><span>روابط فيديو أو وصفات (كل سطر رابط، ويمكن كتابة الاسم ثم | ثم الرابط)</span><textarea rows={3} value={linksText} onChange={e=>setLinksText(e.target.value)} placeholder="الفيديو الأساسي | https://...\nوصفة بديلة | https://..."/></label><label className="favorite-check span-two"><input type="checkbox" checked={isFavorite} onChange={e=>setIsFavorite(e.target.checked)}/><span><b>إضافة إلى أكلي المفضل</b><small>هتظهر الوجبة في أول الصفحة وقبل الأكلات العامة.</small></span></label></div><div className="modal-footer"><button type="button" className="btn btn-outline" onClick={onClose}>إلغاء</button><button type="submit" className="btn btn-primary"><Check size={17}/>{editing?'حفظ التعديلات':'حفظ الأكلة'}</button></div></form></div></div>;
}
export default App;