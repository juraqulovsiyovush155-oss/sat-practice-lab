import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LoginForm from "./form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  return <main className="wrap" style={{maxWidth:520}}><a href="/" style={{color:"var(--green)",textDecoration:"none"}}>← AAT Practice Lab</a><section className="panel" style={{marginTop:18}}><div className="eyebrow">Xush kelibsiz</div><h1 style={{fontSize:30}}>Akkauntga kirish</h1><p>Email va parolingizni kiriting.</p>{params.message && <p className="notice">{params.message}</p>}<LoginForm/></section></main>;
}
