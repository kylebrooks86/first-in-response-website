import { env } from 'cloudflare:workers';
import { requireChatGPTUser } from '../../chatgpt-auth';
import { LOCAL_CUSTOMER_DEPLOYMENT } from '../../local-customer-deployment';
import { candidateCustomerAccess } from '../../../lib/candidate-customer-access';
import { CandidateLocalCustomers } from '../../../components/candidate-local-customers';
export const dynamic = 'force-dynamic';
export default async function LocalCustomersDevelopmentPage() {
  const runtime = env as typeof env & { FIRE_LOCAL_CUSTOMERS_CANDIDATE?: string;
    FIRE_ENV?: string; FIRE_QA_SYNTHETIC_ONLY?: string; SITE_ORIGIN?: string };
  const qaScope = {fireEnv: runtime.FIRE_ENV, syntheticOnly: runtime.FIRE_QA_SYNTHETIC_ONLY,
    siteOrigin: runtime.SITE_ORIGIN};
  const hostedQA = String(LOCAL_CUSTOMER_DEPLOYMENT) === 'qa'
    && process.env.NODE_ENV === 'production'
    && qaScope.fireEnv === 'synthetic-qa' && qaScope.syntheticOnly === 'enabled'
    && qaScope.siteOrigin === 'https://fire-fullapp-qa-20261016.kyle-bfc.workers.dev';
  if ((process.env.NODE_ENV !== 'development' && !hostedQA)
    || runtime.FIRE_LOCAL_CUSTOMERS_CANDIDATE !== 'synthetic-only')
    return <main><h1>Development screen disabled</h1><a href="/">Home</a></main>;
  const owner = await requireChatGPTUser('/development/local-customers');
  const identity = candidateCustomerAccess(owner, LOCAL_CUSTOMER_DEPLOYMENT,
    runtime.FIRE_LOCAL_CUSTOMERS_CANDIDATE, process.env.NODE_ENV, qaScope);
  if (!identity) return <main><h1>Owner access required</h1><a href="/">Home</a></main>;
  return <CandidateLocalCustomers identity={identity}/>;
}
