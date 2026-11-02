import {createHash,createHmac,timingSafeEqual} from "node:crypto";
const digest=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
/** The client can only submit original/approved bytes issued for this private session. */
export function signReviewImage(bytes:Uint8Array,submissionId:string,secret:string,now=Date.now()):string{
 const payload=Buffer.from(JSON.stringify({id:submissionId,hash:digest(bytes),expires:now+6*60*60*1000})).toString("base64url");
 return payload+"."+createHmac("sha256",secret).update(payload).digest("base64url");
}
export function verifyReviewImage(bytes:Uint8Array,submissionId:string,receipt:unknown,secret:string,now=Date.now()):boolean{
 if(typeof receipt!=="string"||receipt.length>1000)return false;
 const [payload,sig,...extra]=receipt.split(".");if(!payload||!sig||extra.length)return false;
 const expected=createHmac("sha256",secret).update(payload).digest();const actual=Buffer.from(sig,"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
 try{const p=JSON.parse(Buffer.from(payload,"base64url").toString());return p.id===submissionId&&p.hash===digest(bytes)&&Number.isFinite(p.expires)&&p.expires>now;}catch{return false;}
}
