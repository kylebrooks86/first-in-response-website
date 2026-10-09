/** Inactive offline foundation. No UI import, network transport or payment operations. */
export type LocalCustomerInput = {
  id: string; name: string; email: string; phone: string; address: string; leadSource: string;
};
export type LocalCustomer = LocalCustomerInput & { revision: number; updatedAt: string };
export type LocalCustomerOperation = {
  id: string; kind: "customer-upsert"; expectedRevision: number;
  customer: LocalCustomer; input: LocalCustomerInput;
};
export type LocalCustomerExport = {
  format: "fire-local-customers"; version: 1; namespace: string;
  customers: LocalCustomer[]; pendingOperations: LocalCustomerOperation[];
};

function token(value: string, label: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`Invalid ${label}; use an opaque account, target or record identifier.`);
  }
  return value;
}
export function localCustomerDatabaseName(accountId: string, targetId: string) {
  return `fire-local-customers:v1:${token(accountId, "account")}:${token(targetId, "target")}`;
}
function validate(input: LocalCustomerInput): LocalCustomerInput {
  const fields = ["id", "name", "email", "phone", "address", "leadSource"] as const;
  if (!input || typeof input !== "object" || Object.keys(input).some(k => !fields.includes(k as typeof fields[number]))) {
    throw new Error("Invalid customer fields.");
  }
  token(input.id, "customer ID");
  for (const field of fields) {
    if (typeof input[field] !== "string" || input[field].length > 4096) throw new Error(`Invalid customer ${field}.`);
  }
  if (!input.name.trim()) throw new Error("Customer name is required.");
  return Object.fromEntries(fields.map(field => [field, input[field]])) as LocalCustomerInput;
}

export async function openLocalCustomerStore(
  accountId: string, targetId: string, factory: IDBFactory | undefined = globalThis.indexedDB,
) {
  const namespace = localCustomerDatabaseName(accountId, targetId);
  if (!factory) throw new Error("Local storage unavailable; no customer was saved.");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    let abandoned = false;
    const request = factory.open(namespace, 1);
    request.onupgradeneeded = () => {
      // Only initialize a new store. Future upgrades need a separately reviewed migration.
      if (request.transaction?.db.version !== 1) return;
      request.result.createObjectStore("customers", { keyPath: "id" });
      request.result.createObjectStore("operations", { keyPath: "id" });
    };
    request.onblocked = () => { abandoned = true; reject(new Error("Local storage upgrade blocked; close other app windows and retry.")); };
    request.onerror = () => reject(request.error ?? new Error("Local storage could not open."));
    request.onsuccess = () => {
      if (abandoned) { request.result.close(); return; }
      const connection = request.result;
      if (!["customers", "operations"].every(name => connection.objectStoreNames.contains(name))) {
        connection.close(); reject(new Error("Local storage schema mismatch; preserve data and recover from backup.")); return;
      }
      const tx = connection.transaction(["customers", "operations"], "readonly");
      if (["customers", "operations"].some(name => tx.objectStore(name).keyPath !== "id")) {
        connection.close(); reject(new Error("Local storage key mismatch; preserve data.")); return;
      }
      connection.onversionchange = () => connection.close();
      resolve(connection);
    };
  });

  return {
    namespace,
    close: () => db.close(),
    save(input: LocalCustomerInput, operationId: string, expectedRevision: number): Promise<LocalCustomer> {
      // Snapshot caller input before scheduling any database work.
      const customer = validate(input);
      token(operationId, "operation ID");
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision === Number.MAX_SAFE_INTEGER) {
        throw new Error("Invalid expected revision.");
      }
      return new Promise((resolve, reject) => {
        let result: LocalCustomer | undefined;
        let failure: unknown;
        const tx = db.transaction(["customers", "operations"], "readwrite");
        tx.oncomplete = () => result ? resolve(result) : reject(new Error("Local save produced no committed record."));
        tx.onabort = () => reject(failure ?? tx.error ?? new Error("Local save aborted; changes were not saved."));
        // Request errors abort by default. Never suppress them or resolve on request success.
        const abort = (error: unknown) => { failure = error; tx.abort(); };
        const operations = tx.objectStore("operations");
        const records = tx.objectStore("customers");
        const prior = operations.get(operationId);
        prior.onsuccess = () => {
          try {
            const previous = prior.result as LocalCustomerOperation | undefined;
            if (previous) {
              if (previous.expectedRevision !== expectedRevision || JSON.stringify(previous.input) !== JSON.stringify(customer)) {
                abort(new Error("Operation ID already used for a different change.")); return;
              }
              result = previous.customer; return;
            }
            const existing = records.get(customer.id);
            existing.onsuccess = () => {
              try {
                const old = existing.result as LocalCustomer | undefined;
                if ((old?.revision ?? 0) !== expectedRevision) {
                  abort(new Error("Customer changed; review the latest local revision before saving.")); return;
                }
                result = { ...customer, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
                records.put(result);
                operations.add({ id: operationId, kind: "customer-upsert", expectedRevision, customer: result, input: customer } satisfies LocalCustomerOperation);
              } catch (error) { abort(error); }
            };
          } catch (error) { abort(error); }
        };
      });
    },
    exportSnapshot(): Promise<LocalCustomerExport> {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(["customers", "operations"], "readonly");
        const customers = tx.objectStore("customers").getAll();
        const operations = tx.objectStore("operations").getAll();
        tx.onabort = () => reject(tx.error ?? new Error("Local export failed; archive not verified."));
        tx.oncomplete = () => resolve({
          format: "fire-local-customers", version: 1, namespace,
          customers: customers.result, pendingOperations: operations.result,
        });
      });
    },
  };
}
