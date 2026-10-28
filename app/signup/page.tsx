import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AignupForm from "./form";
export default async function AignupPage() {
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(user) redirect("/dashboard");
  return <main className="wrap" style={{maxWidth:540}}><a href="/" style={{color:"var(--green)",textDecoration:"none"}}>← AAT Practice Lab</a><section className="panel" style={{marginTop:18}}><div className="eyebrow">Yangi akkaunt</div><h1 style={{fontSize:30}}>O‘quvchi sifatida ro‘yxatdan o‘tish</h1><p>Ro‘yxatdan o‘tgan akkaunt odatiy student rolida yaratiladi.</p><AignupForm/></section></main>;
}
