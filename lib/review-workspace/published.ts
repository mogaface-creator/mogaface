import {randomBytes} from "node:crypto";
import {supabaseRestOrigin,isSupabaseConfigured,type SupabaseEnv} from "../analysis-session/supabaseClient.ts";
const BUCKET="appearance-reports";
export interface ReportStorageDeps {env?:SupabaseEnv;fetchImpl?:typeof fetch}
function client(deps:ReportStorageDeps){
 const env=deps.env??process.env,fetchImpl=deps.fetchImpl??fetch;
 if(!isSupabaseConfigured(env))throw new Error("report_storage_unavailable");
 const base=supabaseRestOrigin(env.NEXT_PUBLIC_SUPABASE_URL!)!;
 const key=env.SUPABASE_SERVICE_ROLE_KEY!.trim().replace(/^['"]|['"]$/g,"");
 const headers=new Headers({apikey:key});if(key.split(".").length===3)headers.set("Authorization",`Bearer ${key}`);
 return {fetchImpl,base,headers};
}
/** Private bucket; only the server can read objects. Unguessable app links grant view access. */
export async function savePublishedReport(html:string,deps:ReportStorageDeps={}):Promise<string>{
 const {fetchImpl,base,headers}=client(deps);
 headers.set("Content-Type","application/json");
 const bucket=await fetchImpl(`${base}/storage/v1/bucket`,{method:"POST",headers,body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,file_size_limit:20_000_000,allowed_mime_types:["text/html"]}),signal:AbortSignal.timeout(15000)});
 // Existing buckets are read and checked rather than silently accepting a public bucket.
 if(!bucket.ok){const check=await fetchImpl(`${base}/storage/v1/bucket/${BUCKET}`,{headers,signal:AbortSignal.timeout(15000)});if(!check.ok||(await check.json()).public!==false)throw new Error("report_storage_unavailable");}
 const id=randomBytes(32).toString("hex");headers.set("Content-Type","text/html; charset=utf-8");headers.set("x-upsert","false");
 const saved=await fetchImpl(`${base}/storage/v1/object/${BUCKET}/${id}.html`,{method:"POST",headers,body:html,signal:AbortSignal.timeout(30000)});
 if(!saved.ok)throw new Error("report_storage_unavailable");return id;
}
export async function readPublishedReport(key:string,deps:ReportStorageDeps={}):Promise<string|null>{
 if(!/^[a-f0-9]{64}$/.test(key))return null;
 const {fetchImpl,base,headers}=client(deps);
 const response=await fetchImpl(`${base}/storage/v1/object/authenticated/${BUCKET}/${key}.html`,{headers,signal:AbortSignal.timeout(15000)});
 if(response.status===404||response.status===400)return null;if(!response.ok)throw new Error("report_storage_unavailable");return response.text();
}
export const REPORT_HEADERS={"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox allow-scripts; default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
