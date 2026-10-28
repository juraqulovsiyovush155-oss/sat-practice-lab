'use client';
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
export default function LoginForm() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const router=useRouter();
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");try{const supabase=createClient();const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;router.push("/dashboard");router.refresh()}catch(err){setError(err instanceof Error?err.message:"Kirish amalga oshmadi.")}finally{setBusy(false)}}
  return <form onSubmit={submit}><label htmlFor="email">Email</label><input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><label htmlFor="password">Parol</label><input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Parolingiz"/>{error&&<p className="error">{error}</p>}<button className="btn primary full" disabled={busy}>{busy?"Kirilmoqda…":"Login qilish"}</button><p style={{fontSize:12,marginTop:12}}>Parolni unutdingizmi? Admin bilan bog‘laning.</p></form>;
}
