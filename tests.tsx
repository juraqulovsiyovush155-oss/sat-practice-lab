'use client';
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Test={id:string;title:string;kind:"topic"|"mock";section:string|null;topic:string|null;duration_seconds:number};
type Question={id:string;section:string;topic:string;prompt:string;choices:string[];position:number};
type Overlay="directions"|"questions"|"review"|"reference"|"help"|"shortcuts"|null;
function calculate(raw:string){const m=raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*([+−×÷*/-])\s*(-?\d+(?:\.\d+)?)\s*$/);if(!m)return "Xato";const a=Number(m[1]),b=Number(m[3]);switch(m[2]){case "+":return String(a+b);case "-":case "−":return String(a-b);case "*":case "×":return String(a*b);case "/":case "÷":return b===0?"Xato":String(a/b);default:return "Xato"}}

export default function TestList({tests}:{tests:Test[]}) {
  const [active,setActive]=useState<Test|null>(null);
  const [items,setItems]=useState<Question[]>([]);
  const [index,setIndex]=useState(0);
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [flags,setFlags]=useState<Record<string,boolean>>({});
  const [eliminated,setEliminated]=useState<Record<string,number[]>>({});
  const [seconds,setSeconds]=useState(0);
  const [overlay,setOverlay]=useState<Overlay>(null);
  const [menu,setMenu]=useState(false);
  const [calc,setCalc]=useState(false);
  const [calcValue,setCalcValue]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [showTimer,setShowTimer]=useState(true);
  const [lineReader,setLineReader]=useState(false);
  const [highlight,setHighlight]=useState(false);
  const [crossMode,setCrossMode]=useState(false);
  const [directionsSeen,setDirectionsSeen]=useState(false);

  const current=items[index];
  useEffect(()=>{ if(!active||!directionsSeen||seconds<=0)return; const id=window.setTimeout(()=>setSeconds(s=>Math.max(0,s-1)),1000); return ()=>window.clearTimeout(id); },[active,directionsSeen,seconds]);
  useEffect(()=>{if(active&&directionsSeen&&seconds===0)setOverlay("review")},[active,directionsSeen,seconds]);
  useEffect(()=>{if(!active)return;const key=(e:KeyboardEvent)=>{if(overlay||calc||menu)return;if(e.key==="ArrowRight")setIndex(i=>Math.min(items.length-1,i+1));if(e.key==="ArrowLeft")setIndex(i=>Math.max(0,i-1));if(["1","2","3","4"].includes(e.key)&&current)setAnswers(a=>({...a,[current.id]:Number(e.key)-1}));if(e.key.toLowerCase()==="r"&&current)setFlags(f=>({...f,[current.id]:!f[current.id]}))};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[active,overlay,items.length,current]);

  const timeLabel=useMemo(()=>`${Math.floor(seconds/60).toString().padStart(2,"0")}:${(seconds%60).toString().padStart(2,"0")}`,[seconds]);

  async function start(test:Test){
    setMessage("");setBusy(true);
    try{
      const supabase=createClient();
      const {data,error}=await supabase.rpc("get_test_questions",{p_test_id:test.id});
      if(error)throw error;
      if(!data?.length){setMessage("Bu testda savollar yo‘q.");return}
      setItems(data as Question[]);setActive(test);setIndex(0);setAnswers({});setFlags({});setEliminated({});
      setSeconds(test.duration_seconds);setDirectionsSeen(false);setOverlay("directions");
    }catch(e){setMessage(e instanceof Error?e.message:"Testni yuklab bo‘lmadi.")}
    finally{setBusy(false)}
  }
  async function submit(){
    if(!active)return;
    setBusy(true);setMessage("");
    try{
      const supabase=createClient();
      const payload=items.map(q=>({question_id:q.id,selected_index:answers[q.id]??null}));
      const {data,error}=await supabase.rpc("submit_test_attempt",{p_test_id:active.id,p_answers:payload});
      if(error)throw error;
      setMessage(`Test yakunlandi: ${data.correct_count}/${data.question_count} to‘g‘ri. Taxminiy ball: ${data.estimated_score}. Natijalar dashboardda saqlandi.`);
      setActive(null);setItems([]);setOverlay(null);window.location.reload();
    }catch(e){setMessage(e instanceof Error?e.message:"Natijani saqlab bo‘lmadi.")}
    finally{setBusy(false)}
  }
  function toggleEliminate(i:number){
    if(!current)return;
    setEliminated(old=>{const prev=old[current.id]??[];return {...old,[current.id]:prev.includes(i)?prev.filter(x=>x!==i):[...prev,i]}});
  }
  function finishDirections(){setDirectionsSeen(true);setOverlay(null)}
  function selectQuestion(i:number){setIndex(i);setOverlay(null)}
  function renderQuestion(q:Question,number:number){
    return <section className="bb-question" key={q.id}>
      <div className="bb-qbar">
        <span className="bb-qnumber">{number+1}</span>
        <button className={flags[q.id]?"bb-mark active":"bb-mark"} onClick={()=>setFlags(f=>({...f,[q.id]:!f[q.id]}))}><span className="bb-bookmark">{flags[q.id]?"▮":"♧"}</span>{flags[q.id]?"Review uchun belgilangan":"Review uchun belgilash"}</button>
        <button className={crossMode?"bb-cross-toggle active":"bb-cross-toggle"} onClick={()=>setCrossMode(x=>!x)}>A̸B̸C̸</button>
      </div>
      <p className={lineReader?"bb-prompt line-reader":highlight?"bb-prompt text-highlight":"bb-prompt"}>{q.prompt}</p>
      <div className="bb-choices">
        {(q.choices||[]).map((choice,i)=>{
          const chosen=answers[q.id]===i, crossed=(eliminated[q.id]??[]).includes(i);
          return <div className={`bb-choice-wrap ${crossed?"crossed":""}`} key={i}>
            <button className={`bb-choice ${chosen?"selected":""} ${crossed?"eliminated":""}`} onClick={()=>crossMode?toggleEliminate(i):(!crossed&&setAnswers(a=>({...a,[q.id]:i})))}>
              <span className="bb-letter">{String.fromCharCode(65+i)}</span><span>{choice}</span>
            </button>
            <button className="bb-choice-x" aria-label={` ${String.fromCharCode(65+i)} variantini chiqarib tashlash`} onClick={()=>toggleEliminate(i)}>{crossed?"↶":String.fromCharCode(65+i)}</button>
          </div>
        })}
      </div>
    </section>;
  }

  if(active&&current){
    return <div className="bb-shell">
      <header className="bb-top">
        <div className="bb-testname"><strong>Section {active.section==="math"?"2":"1"}, Module 1: {active.section==="math"?"Math":"Reading and Writing"}</strong><button onClick={()=>setOverlay("directions")}>Directions⌄</button></div>
        <div className="bb-clock">{showTimer?timeLabel:<span className="bb-clock-hidden">◴</span>}<button onClick={()=>setShowTimer(x=>!x)}>{showTimer?"Hide":"Show"}</button></div>
        <div className="bb-tools">
          {active.section==="math"&&<><button onClick={()=>setCalc(x=>!x)}>▦<span>Calculator</span></button><button onClick={()=>setOverlay("reference")}>x²<span>Reference</span></button></>}
          {active.section!=="math"&&<button onClick={()=>setHighlight(x=>!x)}>✎<span>{highlight?"Highlight on":"Highlights & Notes"}</span></button>}
          <div className="bb-menu-wrap"><button onClick={()=>setMenu(x=>!x)}>⋮<span>More</span></button>{menu&&<div className="bb-menu">
            <button onClick={()=>{setOverlay("help");setMenu(false)}}>ⓘ　Yordam</button><button onClick={()=>{setOverlay("shortcuts");setMenu(false)}}>⌨　Tugmalar</button><button onClick={()=>{setLineReader(x=>!x);setMenu(false)}}>☰　{lineReader?"Line Reader o‘chirish":"Line Reader"}</button><button onClick={()=>{setOverlay("review");setMenu(false)}}>☑　Testni yakunlash</button>
          </div>}</div>
        </div>
      </header>
      <div className="bb-practice">BU MASHQ TESTI</div>
      <main className="bb-content">{renderQuestion(current,index)}</main>
      {calc&&<aside className="bb-calculator"><div className="bb-calc-head"><strong>Kalkulyator</strong><button onClick={()=>setCalc(false)}>×</button></div><input value={calcValue} onChange={e=>setCalcValue(e.target.value)} aria-label="Kalkulyator qiymati" placeholder="Hisoblash uchun kiriting"/><div className="bb-calc-grid">{["7","8","9","÷","4","5","6","×","1","2","3","−","C","0",".","+","="].map(k=><button key={k} onClick={()=>k==="C"?setCalcValue(""):k==="="?setCalcValue(v=>{try{return calculate(v)}catch{return "Xato"}}):setCalcValue(v=>v+k)}>{k}</button>)}</div></aside>}
      <footer className="bb-footer"><strong>{active.title}</strong><button className="bb-question-count" onClick={()=>setOverlay("questions")}>Question {index+1} of {items.length}⌃</button><div className="bb-nav">{index>0&&<button onClick={()=>setIndex(i=>i-1)}>Back</button>}<button onClick={()=>index<items.length-1?setIndex(i=>i+1):setOverlay("review")}>{index<items.length-1?"Next":"Review"}</button></div></footer>
      {overlay&&<div className="bb-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)setOverlay(null)}}>
        <div className={`bb-modal ${overlay==="directions"?"bb-directions":""}`}>
          <button className="bb-close" onClick={()=>overlay==="directions"?finishDirections():setOverlay(null)}>×</button>
          {overlay==="directions"&&<><h2>{active.section==="math"?"Math":"Reading and Writing"} Directions</h2><p>Bu bo‘limdagi savollar SAT ko‘nikmalarini tekshiradi. Har bir savolni diqqat bilan o‘qing va eng yaxshi javobni tanlang.</p><p>{active.section==="math"?"Kalkulyator va reference sheet bo‘lim davomida ochiq. Javobingizni istalgan payt o‘zgartirishingiz mumkin.":"Savollar matnini belgilang, javobni tanlang yoki keyin ko‘rib chiqish uchun belgilang."}</p><div className="bb-modal-actions"><button className="bb-primary" onClick={finishDirections}>Davom etish</button></div></>}
          {overlay==="questions"&&<><h2>Section {active.section==="math"?"2":"1"}, Module 1: {active.section==="math"?"Math":"Reading and Writing"} Questions</h2><div className="bb-legend"><span>● Joriy</span><span>□ Javobsiz</span><span>▮ Review</span></div><div className="bb-grid">{items.map((q,i)=><button key={q.id} className={`bb-grid-item ${i===index?"current":""} ${answers[q.id]!==undefined?"answered":""} ${flags[q.id]?"flagged":""}`} onClick={()=>selectQuestion(i)}>{i+1}</button>)}</div><button className="bb-outline" onClick={()=>setOverlay("review")}>Review sahifasiga o‘tish</button></>}
          {overlay==="review"&&<><h2>Testni yakunlashdan oldin</h2><p>{Object.keys(answers).length} ta javob berildi · {items.length-Object.keys(answers).length} ta javobsiz · {Object.values(flags).filter(Boolean).length} ta review belgisi</p><div className="bb-review-list">{items.map((q,i)=><button key={q.id} onClick={()=>selectQuestion(i)}><span>Savol {i+1}</span><span>{answers[q.id]!==undefined?"Javob berilgan":"Javobsiz"} {flags[q.id]?" · Review":""}</span></button>)}</div><div className="bb-modal-actions"><button className="bb-outline" onClick={()=>setOverlay(null)}>Testga qaytish</button><button className="bb-primary" disabled={busy} onClick={submit}>{busy?"Saqlanmoqda…":"Testni topshirish"}</button></div></>}
          {overlay==="reference"&&<><h2>Reference</h2><div className="bb-formulas"><p>Aylana: A = πr²　C = 2πr</p><p>To‘g‘ri to‘rtburchak: A = lw</p><p>Uchburchak: A = ½bh</p><p>Pifagor teoremasi: c² = a² + b²</p><p>Silindr: V = πr²h　　Shar: V = ⁴⁄₃πr³</p><p>Konus: V = ⅓πr²h</p><p>Aylana: 360° = 2π radian</p><p>Uchburchak ichki burchaklari yig‘indisi: 180°</p></div></>}
          {overlay==="help"&&<><h2>Yordam</h2><p>Javob variantini tanlash uchun variant ustiga bosing. Har bir savol yonidagi belgidan keyin ko‘rib chiqish uchun foydalaning.</p><p>Pastdagi savollar tugmasi savollar xaritasini ochadi. Testni yakunlashdan oldin javobsiz savollarni tekshiring.</p></>}
          {overlay==="shortcuts"&&<><h2>Tugmalar</h2><div className="bb-shortcuts"><p><kbd>←</kbd> Oldingi savol</p><p><kbd>→</kbd> Keyingi savol</p><p><kbd>1–4</kbd> Javob tanlash</p><p><kbd>R</kbd> Review uchun belgilash</p></div></>}
        </div>
      </div>}

    </div>
  }

  return <div>{message&&<p className="notice" style={{marginBottom:12}}>{message}</p>}{tests.length?<div className="cards">{tests.map(t=><article className="test-card" key={t.id}><span className="tag">{t.kind==="mock"?"Full Mock":"Topic Practice"}</span><h3>{t.title}</h3><p>{t.topic||t.section||"SAT"} · {Math.round(t.duration_seconds/60)} daqiqa</p><button className="btn primary" disabled={busy} onClick={()=>start(t)}>{busy?"Yuklanmoqda…":"Testni boshlash →"}</button></article>)}</div>:<div className="notice">Hozircha e’lon qilingan test yo‘q. Admin paneldan test yarating va publish qiling.</div>}</div>;
}





