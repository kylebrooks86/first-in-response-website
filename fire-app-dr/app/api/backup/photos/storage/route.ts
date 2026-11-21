import {env} from 'cloudflare:workers';
import {getOwnerUser} from '../../../../owner-auth';
import {exportCompletePhotoStorage} from '../../../../../lib/photo-storage-archive';
export async function GET(){
 const user=await getOwnerUser();
 if(!user||user.email.toLowerCase()!=='kylebrooks8605@gmail.com')return Response.json({error:'Unauthorized'},{status:401});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Records and retained bytes were preserved.'},{status:503});
 try{return await exportCompletePhotoStorage({all:async<T>(sql:string)=>(await env.DB.prepare(sql).all<T>()).results},env.BUCKET);}
 catch{return Response.json({error:'A complete photo archive could not be verified. Source records and bytes were preserved. No restore or cleanup was attempted.'},{status:503,headers:{'cache-control':'no-store'}});}
}
