import { env } from 'cloudflare:workers';
import { requireChatGPTUser } from '../../chatgpt-auth';
import { LOCAL_CUSTOMER_DEPLOYMENT } from '../../local-customer-deployment';
import { candidateCustomerAccess } from '../../../lib/candidate-customer-access';
import { CandidateLocalCustomers } from '../../../components/candidate-local-customers';
export const dynamic = 'force-dynamic';
export default async function LocalCustomersDevelopmentPage() {
  if (process.env.NODE_ENV !== 'development' || (env as typeof env & { FIRE_LOCAL_CUSTOMERS_CANDIDATE?: string }).FIRE_LOCAL_CUSTOMERS_CANDIDATE !== 'synthetic-only')
    return <main><h1>Development screen disabled</h1><a href="/">Home</a></main>;
  const owner = await requireChatGPTUser('/development/local-customers');
  const identity = candidateCustomerAccess(owner, LOCAL_CUSTOMER_DEPLOYMENT,
    (env as typeof env & { FIRE_LOCAL_CUSTOMERS_CANDIDATE?: string }).FIRE_LOCAL_CUSTOMERS_CANDIDATE, process.env.NODE_ENV);
  if (!identity) return <main><h1>Owner access required</h1><a href="/">Home</a></main>;
  return <CandidateLocalCustomers identity={identity}/>;
}
