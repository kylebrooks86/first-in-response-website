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

function objectWithKeys(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new Error(`Invalid ${label} fields.`);
  }
  return value as Record<string, unknown>;
}
function customerRecord(value: unknown): LocalCustomer {
  const row = objectWithKeys(value, ["id", "name", "email", "phone", "address", "leadSource", "revision", "updatedAt"], "customer record");
  const input = validate({ id: row.id, name: row.name, email: row.email, phone: row.phone,
    address: row.address, leadSource: row.leadSource } as LocalCustomerInput);
  if (!Number.isSafeInteger(row.revision) || (row.revision as number) < 1) throw new Error("Invalid customer revision.");
  if (typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt))
    || new Date(row.updatedAt).toISOString() !== row.updatedAt) throw new Error("Invalid customer timestamp.");
  return { ...input, revision: row.revision as number, updatedAt: row.updatedAt };
}

/** Pure preflight only. This customer-only format is not the production records backup. */
export function validateLocalCustomerExport(value: unknown, expectedNamespace: string): LocalCustomerExport {
  if (typeof expectedNamespace !== "string" || !/^fire-local-customers:v1:[A-Za-z0-9_-]{1,128}:[A-Za-z0-9_-]{1,128}$/.test(expectedNamespace)) {
    throw new Error("Invalid expected namespace.");
  }
  const root = objectWithKeys(value, ["format", "version", "namespace", "customers", "pendingOperations"], "export");
  if (root.format !== "fire-local-customers" || root.version !== 1) throw new Error("Unsupported customer export format/version.");
  if (root.namespace !== expectedNamespace) throw new Error("Customer export belongs to a different account or target.");
  if (!Array.isArray(root.customers) || !Array.isArray(root.pendingOperations)
    || root.customers.length > 10000 || root.pendingOperations.length > 100000) throw new Error("Invalid or oversized customer collections.");
  const customers: LocalCustomer[] = [];
  const records = new Map<string, LocalCustomer>();
  for (const value of root.customers) {
    const row = customerRecord(value);
    if (records.has(row.id)) throw new Error("Duplicate customer ID.");
    records.set(row.id, row); customers.push(row);
  }
  const operations: LocalCustomerOperation[] = [];
  const ids = new Set<string>();
  const histories = new Map<string, Map<number, LocalCustomer>>();
  for (const value of root.pendingOperations) {
    const op = objectWithKeys(value, ["id", "kind", "expectedRevision", "customer", "input"], "operation");
    const id = token(op.id as string, "operation ID");
    if (ids.has(id)) throw new Error("Duplicate operation ID.");
    ids.add(id);
    if (op.kind !== "customer-upsert" || !Number.isSafeInteger(op.expectedRevision)
      || (op.expectedRevision as number) < 0 || op.expectedRevision === Number.MAX_SAFE_INTEGER) throw new Error("Invalid operation kind/revision.");
    const row = customerRecord(op.customer);
    const inputRow = objectWithKeys(op.input, ["id", "name", "email", "phone", "address", "leadSource"], "operation input");
    const input = validate(inputRow as LocalCustomerInput);
    const current = records.get(row.id);
    if (!current || row.revision !== (op.expectedRevision as number) + 1 || row.revision > current.revision
      || ["id", "name", "email", "phone", "address", "leadSource"].some(key => row[key as keyof LocalCustomer] !== input[key as keyof LocalCustomerInput])) {
      throw new Error("Invalid operation customer reference or payload.");
    }
    const history = histories.get(row.id) ?? new Map<number, LocalCustomer>();
    if (history.has(row.revision)) throw new Error("Duplicate customer revision in operations.");
    history.set(row.revision, row); histories.set(row.id, history);
    operations.push({ id, kind: "customer-upsert", expectedRevision: op.expectedRevision as number, customer: row, input });
  }
  // Version 1 retains every local operation. Missing history must not be silently restored.
  for (const current of customers) {
    const history = histories.get(current.id);
    if (!history || history.size !== current.revision
      || [...history.keys()].sort((a, b) => a - b).some((revision, index) => revision !== index + 1)
      || JSON.stringify(history.get(current.revision)) !== JSON.stringify(current)) throw new Error("Incomplete or inconsistent customer operation history.");
  }
  return { format: "fire-local-customers", version: 1, namespace: expectedNamespace, customers, pendingOperations: operations };
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
    getCustomer(id: string): Promise<LocalCustomer | null> {
      token(id, "customer ID");
      return new Promise((resolve, reject) => {
        const tx = db.transaction("customers", "readonly");
        const request = tx.objectStore("customers").get(id);
        tx.onabort = () => reject(tx.error ?? new Error("Local customer read failed."));
        tx.oncomplete = () => {
          try {
            const row = request.result === undefined ? null : customerRecord(request.result);
            if (row && row.id !== id) throw new Error("Local customer identity mismatch.");
            resolve(row);
          } catch (error) { reject(error); }
        };
      });
    },
    listCustomers(): Promise<LocalCustomer[]> {
      return new Promise((resolve, reject) => {
        const tx = db.transaction("customers", "readonly");
        const request = tx.objectStore("customers").getAll();
        tx.onabort = () => reject(tx.error ?? new Error("Local customer list failed."));
        tx.oncomplete = () => {
          try { resolve((request.result as unknown[]).map(customerRecord)); }
          catch (error) { reject(error); }
        };
      });
    },
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
    /** Inactive customer-only recovery: add missing records, never replace existing data. */
    restoreSnapshot(value: unknown): Promise<{ insertedCustomers: number; insertedOperations: number }> {
      // Validate and detach before scheduling work; caller mutations cannot change this import.
      const incoming = validateLocalCustomerExport(value, namespace);
      return new Promise((resolve, reject) => {
        let failure: unknown;
        let result: { insertedCustomers: number; insertedOperations: number } | undefined;
        const tx = db.transaction(["customers", "operations"], "readwrite");
        tx.onabort = () => reject(failure ?? tx.error ?? new Error("Local restore aborted; no import changes committed."));
        tx.oncomplete = () => result ? resolve(result) : reject(new Error("Local restore produced no committed result."));
        const records = tx.objectStore("customers"), operations = tx.objectStore("operations");
        const customerRead = records.getAll(), operationRead = operations.getAll();
        let reads = 0;
        const merge = () => {
          if (++reads !== 2) return;
          try {
            // Read, conflict-check and write inside the same transaction, including other tabs.
            const current = validateLocalCustomerExport({ format: "fire-local-customers", version: 1, namespace,
              customers: customerRead.result, pendingOperations: operationRead.result }, namespace);
            const customers = new Map(current.customers.map(row => [row.id, row]));
            const receipts = new Map(current.pendingOperations.map(op => [op.id, op]));
            const newCustomers: LocalCustomer[] = [], newOperations: LocalCustomerOperation[] = [];
            for (const row of incoming.customers) {
              const old = customers.get(row.id);
              if (old && JSON.stringify(old) !== JSON.stringify(row)) throw new Error("Restore customer conflict; existing records preserved.");
              if (!old) { customers.set(row.id, row); newCustomers.push(row); }
            }
            for (const op of incoming.pendingOperations) {
              const old = receipts.get(op.id);
              if (old && JSON.stringify(old) !== JSON.stringify(op)) throw new Error("Restore operation conflict; existing records preserved.");
              if (!old) { receipts.set(op.id, op); newOperations.push(op); }
            }
            // Different operation IDs for an existing revision are conflicts too.
            validateLocalCustomerExport({ ...incoming, customers: [...customers.values()], pendingOperations: [...receipts.values()] }, namespace);
            for (const row of newCustomers) records.add(row);
            for (const op of newOperations) operations.add(op);
            result = { insertedCustomers: newCustomers.length, insertedOperations: newOperations.length };
          } catch (error) { failure = error; tx.abort(); }
        };
        customerRead.onsuccess = merge; operationRead.onsuccess = merge;
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
