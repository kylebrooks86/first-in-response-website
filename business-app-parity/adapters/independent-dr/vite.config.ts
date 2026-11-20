/** SOURCE-ONLY DR candidate: intentionally not remotely deployable as built.
 * A physical D1 UUID, unique R2 bucket, per-environment owner secrets and a
 * separate approved provider action are required before any hosted launch.
 * The placeholder DB and blocked auth MUST stay until a target-bound private
 * preflight explicitly creates a reviewed local manifest. Never use this
 * default Wrangler file to deploy, including via Cloudflare direct upload.
 */
import {buildOfflineFieldAssets} from './scripts/build-offline-field.mjs';
import vinext from 'vinext';
import {defineConfig} from 'vite';
const PROPOSED_WORKER='fire-fullapp-dr';
const PROPOSED_DB='fire-fullapp-dr-db';
const SITE_ORIGIN='https://fire-fullapp-dr.kyle-bfc.workers.dev';
const PLACEHOLDER='00000000-0000-4000-8000-000000000000';
export default defineConfig(async()=>{
 process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
 process.env.WRANGLER_SEND_METRICS ??= 'false';
 const {cloudflare}=await import('@cloudflare/vite-plugin');
 return {
  server:{host:'127.0.0.1'},
  plugins:[
   vinext(),
   {name:'fire-private-field-shell',apply:'build' as const,async generateBundle(){
    if(this.environment.name!=='client')return;
    const assets=await buildOfflineFieldAssets();
    for(const [fileName,source] of Object.entries(assets))this.emitFile({type:'asset',fileName,source:source as string});
   }},
   cloudflare({viteEnvironment:{name:'rsc',childEnvironments:['ssr']},inspectorPort:false,
    config:{
     name:PROPOSED_WORKER,
     main:'vinext/server/fetch-handler',
     compatibility_date:'2026-11-13',
     compatibility_flags:['nodejs_compat'],
     workers_dev:true,
     secrets:{required:['FIRE_DR_PASSWORD_HASH','FIRE_DR_SESSION_SECRET']},
     vars:{FIRE_ENV:'isolated-dr',SITE_ORIGIN,FIRE_DR_AUTH_ENABLED:'blocked'},
     d1_databases:[{binding:'DB',database_name:PROPOSED_DB,database_id:PLACEHOLDER}],
     r2_buckets:[]
    }
   })
  ]
 };
});
