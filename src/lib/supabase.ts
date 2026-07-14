import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined
export const hasSupabase=Boolean(url&&key&&!url.includes('SEU-PROJETO'))
export const supabase:SupabaseClient|null=hasSupabase?createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null
export async function getSession():Promise<Session|null>{if(!supabase)return null;const{data,error}=await supabase.auth.getSession();if(error)throw error;return data.session}
export async function ensureAnonymousSession(){return getSession()}
export async function signIn(email:string,password:string){if(!supabase)throw new Error('Supabase não configurado.');const{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;return data.session}
export async function signUp(email:string,password:string){if(!supabase)throw new Error('Supabase não configurado.');const{data,error}=await supabase.auth.signUp({email,password});if(error)throw error;return data.session}
export async function signOut(){if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)throw error}
export async function updatePassword(password:string){if(!supabase)throw new Error('Supabase não configurado.');const{error}=await supabase.auth.updateUser({password});if(error)throw error}
export async function currentEmail(){const s=await getSession();return s?.user.email||''}
