import {env} from 'cloudflare:workers';
import {getOwnerUser} from '../../../../owner-auth';
import {inspectPhotoStorage} from '../../../../../lib/photo-storage-integrity';

const privateHeaders={'cache-control':'private, no-store','vary':'Cookie','x-content-type-options':'nosniff'};
async function authorized(){
 try{const user=await getOwnerUser();
  return typeof user?.email==='string'&&user.email.toLowerCase()==='kylebrooks8605@gmail.com';}
 catch{return false;}
}
async function verifiedPhotoRows<T>(sql:string):Promise<T[]>{
 const result=await env.DB.prepare(sql).all<T>();
 if((result as {success?:boolean}).success===false||!Array.isArray(result?.results))
  throw new Error('Photo integrity D1 read was not confirmed');
 return result.results;
}
export async function GET(){
 if(!await authorized())return Response.json({error:'Unauthorized'},{status:401,headers:privateHeaders});
 if(!env.BUCKET)return Response.json({error:'Photo storage is unavailable. Existing records and bytes were preserved.'},{status:503,headers:privateHeaders});
 try{
  const report=await inspectPhotoStorage({all:verifiedPhotoRows},env.BUCKET);
  return Response.json(report,{headers:privateHeaders});
 }catch{
  return Response.json({error:'Photo inspection could not confirm complete coverage. Existing records and bytes were preserved. No cleanup or retry was attempted.',inspectionUncertain:true,writesAttempted:0},{status:503,headers:privateHeaders});
 }
}
