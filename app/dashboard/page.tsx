import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./signout";
import TestList from "./tests";

export default async function DashboardPage() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:profile}=await supabase.from("profiles").select("full_name,role").eq("id",user.id).maybeSingle();
  const isAdmin=profile?.role==="admin";
  const {data:tests}=await supabase.from("tests").select("id,title,kind,section,topic,duration_seconds").eq("published",true).order("created_at",{ascending:false});
  const {data:attempts}=await supabase.from("attempts").select("id,correct_count,question_count,estimated_score,submitted_at,test_id").eq("student_id",user.id).not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(10);
  return <><header className="topbar"><Link href="/" className="brand" style={{textDecoration:"none",color:"inherit"}}><div className="logo">S</div><span>SAT Practice <span style={{color:"var(--green)"}}>Lab</span></span></Link><div className="row"><span className="tag">{isAdmin?"Admin":"Student"}</span><SignOutButton/></div></header><main className="wrap"><div className="eyebrow">Dashboard</div><h1>Salom, {profile?.full_name||user.user_metadata?.full_name||user.email}!</h1><p>Bugungi mashg‘ulotni tanlang.</p><div className="stats"><div className="stat"><small>Yakunlangan testlar</small><strong>{attempts?.length??0}</strong></div><div className="stat"><small>Oxirgi natija</small><strong>{attempts?.[0]?.estimated_score??"—"}</strong><p>Taxminiy SAT balli</p></div><div className="stat"><small>Akkaunt</small><strong style={{fontSize:18}}>{isAdmin?"Administrator":"O‘quvchi"}</strong><p>{user.email}</p></div></div>
  <section className="panel"><div className="row"><div><h2>Mavjud testlar</h2><p>Faqat admin e’lon qilgan testlar ko‘rsatiladi.</p></div>{isAdmin&&<Link className="btn secondary" href="/admin">Admin panel →</Link>}</div><TestList tests={tests??[]}/></section>
  <section className="panel"><h2>So‘nggi natijalar</h2>{attempts?.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:10}}>Yakunlangan</th><th style={{textAlign:"left",padding:10}}>To‘g‘ri</th><th style={{textAlign:"left",padding:10}}>Taxminiy ball</th></tr></thead><tbody>{attempts.map(a=><tr key={a.id}><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{a.submitted_at?new Date(a.submitted_at).toLocaleString("uz-UZ"):"—"}</td><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{a.correct_count}/{a.question_count}</td><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{a.estimated_score??"—"}</td></tr>)}</tbody></table></div>:<p>Hali yakunlangan test yo‘q.</p>}</section>
  <p className="notice">Ball hozircha taxminiy. Rasmiy SAT scoring uchun kalibrlangan testlar va alohida baholash modeli kerak.</p></main><footer>SAT Practice Lab · O‘quv platformasi</footer></>;
}
