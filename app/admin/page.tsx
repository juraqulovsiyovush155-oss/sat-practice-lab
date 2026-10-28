import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCreateTest from "./create-test";

export default async function AdminPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();if(profile?.role!=="admin")redirect("/dashboard");
 const {data:tests}=await supabase.from("tests").select("id,title,kind,published,created_at").order("created_at",{ascending:false});
 return <><header className="topbar"><Link href="/dashboard" className="brand" style={{textDecoration:"none",color:"inherit"}}><div className="logo">S</div><span>Siyovush SAT</span></Link><span className="tag">Admin panel</span></header><main className="wrap"><div className="eyebrow">Boshqaruv</div><h1>Testlar boshqaruvi</h1><p>Test yaratish, savol qo‘shish va e’lon qilish.</p><AdminCreateTest/><section className="panel"><h2>Mavjud testlar</h2>{tests?.length?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:10}}>Test</th><th style={{textAlign:"left",padding:10}}>Tur</th><th style={{textAlign:"left",padding:10}}>Holat</th></tr></thead><tbody>{tests.map(t=><tr key={t.id}><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{t.title}</td><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{t.kind}</td><td style={{padding:10,borderTop:"1px solid var(--line)"}}>{t.published?"E’lon qilingan":"Qoralama"}</td></tr>)}</tbody></table></div>:<p>Testlar hali yaratilmagan.</p>}</section><p className="notice">Admin roli faqat Supabase SQL Editor orqali ishonchli tarzda beriladi; foydalanuvchi brauzeridan o‘zgartirib bo‘lmaydi.</p></main></>;
}
