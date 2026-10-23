// One local validation contract for preflight and config generation. No API calls.
export const independentEnvNames = [
  'FIRE_WORKER_NAME', 'FIRE_D1_DATABASE_NAME', 'FIRE_D1_DATABASE_ID', 'FIRE_R2_BUCKET_NAME',
];

export function independentConfigValues(environment) {
  const values = Object.fromEntries(independentEnvNames.map(name => [name, environment[name]?.trim() || '']));
  const missing = independentEnvNames.slice(0, 3).filter(name => !values[name]);
  if (missing.length) throw Error('Missing required deployment values: ' + missing.join(', '));
  const namePattern = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
  for (const name of ['FIRE_WORKER_NAME', 'FIRE_D1_DATABASE_NAME']) {
    if (!namePattern.test(values[name])) throw Error('Invalid isolated resource name: ' + name);
  }
  // Keep this preparation route limited to isolated environments.
  for (const name of ['FIRE_WORKER_NAME', 'FIRE_D1_DATABASE_NAME', 'FIRE_R2_BUCKET_NAME']) {
    if (/prod|production/i.test(values[name])) throw Error('Production resource name is not allowed: ' + name);
  }
  const databaseId = values.FIRE_D1_DATABASE_ID;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)
      || /^0{8}-0{4}-(?:0{4}|4000)-[08]0{3}-0{12}$/.test(databaseId)) {
    throw Error('FIRE_D1_DATABASE_ID must be a non-placeholder UUID.');
  }
  const bucket = values.FIRE_R2_BUCKET_NAME;
  if (bucket && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw Error('Invalid optional R2 bucket name.');
  return { worker: values.FIRE_WORKER_NAME, databaseName: values.FIRE_D1_DATABASE_NAME, databaseId, bucket };
}
