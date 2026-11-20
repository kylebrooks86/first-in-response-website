import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../../chatgpt-auth';
import {exportCompletePhotoStorage} from '../../../../../lib/photo-storage-archive';
const privateHeaders={'cache-control':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff'};
export async function GET(){
 const user=await getChatGPTUser();
 if(typeof user?.email!=='string'||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401,headers:privateHeaders});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Records and retained bytes were preserved.'},{status:503,headers:privateHeaders});
 try{const archive=await exportCompletePhotoStorage({all:async<T>(sql:string)=>(await env.DB.prepare(sql).all<T>()).results},env.BUCKET);
  // Preserve ZIP streaming, manifest and filename; protect customer photo bytes in every cache.
  for(const [key,value] of Object.entries(privateHeaders))archive.headers.set(key,value);
  return archive;}
 catch{return Response.json({error:'A complete photo archive could not be verified. Source records and bytes were preserved. No restore or cleanup was attempted.'},{status:503,headers:privateHeaders});}
}
