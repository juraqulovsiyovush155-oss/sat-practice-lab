'use client';
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
export default function SignOutButton(){const [busy,setBusy]=useState(false);const router=useRouter();return <button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);const supabase=createClient();await supabase.auth.signOut();router.push("/login");router.refresh()}}>{busy?"Chiqilmoqda…":"Chiqish"}</button>}
