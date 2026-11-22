import {env} from 'cloudflare:workers';
import {getOwnerUser} from '../../../../owner-auth';
import {exportCompletePhotoStorage} from '../../../../../lib/photo-storage-archive';

const privateHeaders={'cache-control':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff'};
async function authorized(){
 try{const user=await getOwnerUser();
  return typeof user?.email==='string'&&user.email.toLowerCase()==='kylebrooks8605@gmail.com';}
 catch{return false;}
}
async function verifiedPhotoRows<T>(sql:string):Promise<T[]>{
 const result=await env.DB.prepare(sql).all<T>();
 // D1 may report success:false without throwing, or return no result array.
 // Neither can prove a complete and recoverable photo-storage archive.
 if((result as {success?:boolean}).success===false||!Array.isArray(result?.results))
  throw new Error('Photo archive D1 read was not confirmed');
 return result.results;
}
export async function GET(){
 if(!await authorized())return Response.json({error:'Unauthorized'},{status:401,headers:privateHeaders});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Records and retained bytes were preserved.'},{status:503,headers:privateHeaders});
 try{
  const archive=await exportCompletePhotoStorage({all:verifiedPhotoRows},env.BUCKET);
  // The streaming complete original-photo ZIP is owner-specific, including
  // successful downloads, not just error JSON.
  for(const [key,value] of Object.entries(privateHeaders))archive.headers.set(key,value);
  return archive;
 }catch{
  return Response.json({error:'A complete photo archive could not be verified. Source records and bytes were preserved. No restore or cleanup was attempted.'},{status:503,headers:privateHeaders});
 }
}
