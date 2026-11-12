import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

const OWNER_EMAIL = "kylebrooks8605@gmail.com";
async function authorized() {
  const user = await getChatGPTUser();
  return Boolean(user && user.email.toLowerCase() === OWNER_EMAIL);
}

type SavedReport = {
  id: string; estimateId: string; customerId: string; checklist: string;
  notes: string | null; airflowBefore: string | null; airflowAfter: string | null;
  status: string; createdAt: string; completedAt: string | null;
};
const reportColumns = `id,estimate_id AS estimateId,customer_id AS customerId,checklist,notes,
  airflow_before AS airflowBefore,airflow_after AS airflowAfter,status,
  created_at AS createdAt,completed_at AS completedAt`;
const privateHeaders = { "Cache-Control": "no-store, private" };

export async function GET(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const estimateId = new URL(request.url).searchParams.get("estimateId") || "";
  const rows = await env.DB.prepare(`SELECT ${reportColumns} FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC`)
    .bind(estimateId).all<SavedReport>();
  // Duplicate historical reports are not safe evidence for marking a job complete.
  if (rows.results.length > 1)
    return Response.json({ error: "More than one report is linked to this job. Review its saved history before changing completion status." },
      { status: 409, headers: privateHeaders });
  return Response.json({ reports: rows.results }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    estimateId?: string; customerId?: string; checklist?: unknown; notes?: string;
    airflowBefore?: string; airflowAfter?: string; status?: string; complete?: boolean
  };
  try { body = await request.json(); }
  catch { return Response.json({ error: "A valid job-report request is required." }, { status: 400 }); }
  if (!body.estimateId || !body.customerId)
    return Response.json({ error: "Job and customer are required." }, { status: 400 });

  try {
    const job = await env.DB.prepare("SELECT customer_id AS customerId,status FROM estimates WHERE id=?")
      .bind(body.estimateId).first<{ customerId: string; status: string }>();
    if (!job || job.customerId !== body.customerId)
      return Response.json({ error: "That job does not belong to the selected customer." }, { status: 409 });

    const complete = body.complete === true || body.status === "complete" || body.status === "completed";
    if (complete && !["scheduled", "completed"].includes(job.status))
      return Response.json({ error: "Schedule the approved job before completing its service report." }, { status: 409 });
    if (complete) {
      const c = (body.checklist ?? {}) as Record<string, boolean>;
      const required = ["Property condition documented", "Before photos captured",
        "Plants and fragile areas protected", "Service completed as quoted", "After photos captured"];
      const walkthrough = c?.["Customer walkthrough completed"] === true;
      const absent = c?.["Customer absent — completion documented for follow-up"] === true;
      if (!c || typeof c !== "object" || Array.isArray(c) ||
          required.some(key => c[key] !== true) || walkthrough === absent ||
          (absent && !String(body.notes ?? "").trim()))
        return Response.json({ error: "Complete service steps, then document a real walkthrough or customer absence in technician notes." }, { status: 409 });
    }

    const previous = await env.DB.prepare(`SELECT ${reportColumns} FROM job_reports WHERE estimate_id=? ORDER BY created_at DESC LIMIT 2`)
      .bind(body.estimateId).all<SavedReport>();
    if (previous.results.length > 1)
      return Response.json({ error: "Multiple saved reports exist for this job. No report was changed; review the duplicate history first." }, { status: 409 });
    const existing = previous.results[0] ?? null;
    if (existing && existing.customerId !== body.customerId)
      return Response.json({ error: "The saved report belongs to a different customer. No report was changed." }, { status: 409 });
    // Completion is a historical milestone. Ordinary report edits must not
    // silently erase it, change its original time, or demote the finished report.
    if (existing?.status === "completed" && !complete)
      return Response.json({ error: "This report is already completed. Edit its notes with the completion checklist intact; do not return it to draft." }, { status: 409 });
    if (existing && ((existing.status === "completed" && !existing.completedAt) ||
                     (existing.status !== "completed" && existing.completedAt)))
      return Response.json({ error: "Existing report completion history is inconsistent. No report was changed." }, { status: 409 });

    const now = new Date().toISOString();
    const id = existing?.id ?? crypto.randomUUID();
    const status = complete ? "completed" : "draft";
    const completedAt = complete ? (existing?.completedAt ?? now) : null;
    const createdAt = existing?.createdAt ?? now;
    const checklist = JSON.stringify(body.checklist ?? {});
    const notes = String(body.notes ?? "");
    const airflowBefore = String(body.airflowBefore ?? "") || null;
    const airflowAfter = String(body.airflowAfter ?? "") || null;

    if (existing) {
      // Compare the prior row in the UPDATE itself, so a second phone/tab
      // cannot overwrite a report edited after this request began.
      const changed = await env.DB.prepare(`UPDATE job_reports
        SET checklist=?,notes=?,airflow_before=?,airflow_after=?,status=?,completed_at=?
        WHERE id=? AND estimate_id=? AND customer_id=? AND status=? AND created_at=?
          AND completed_at IS ? AND checklist=? AND notes IS ?
          AND airflow_before IS ? AND airflow_after IS ?
          AND EXISTS (SELECT 1 FROM estimates e WHERE e.id=job_reports.estimate_id
            AND e.customer_id=job_reports.customer_id
            AND (?=0 OR e.status IN ('scheduled','completed')))`)
        .bind(checklist,notes,airflowBefore,airflowAfter,status,completedAt,
          id,body.estimateId,body.customerId,existing.status,existing.createdAt,
          existing.completedAt,existing.checklist,existing.notes,existing.airflowBefore,existing.airflowAfter,
          complete?1:0).run();
      if (changed.meta?.changes !== 1)
        return Response.json({ error: "This job report changed while you were saving. Reopen the saved report before trying again." },
          { status: 409, headers: privateHeaders });
    } else {
      // Atomic conditional INSERT prevents two first-time POST requests from
      // creating different reports for the same job without a risky migration.
      const inserted = await env.DB.prepare(`INSERT INTO job_reports
        (id,estimate_id,customer_id,checklist,notes,airflow_before,airflow_after,status,created_at,completed_at)
        SELECT ?,?,?,?,?,?,?,?,?,?
        WHERE NOT EXISTS (SELECT 1 FROM job_reports WHERE estimate_id=?)
          AND EXISTS (SELECT 1 FROM estimates e WHERE e.id=? AND e.customer_id=?
            AND (?=0 OR e.status IN ('scheduled','completed')))`)
        .bind(id,body.estimateId,body.customerId,checklist,notes,airflowBefore,airflowAfter,
          status,createdAt,completedAt,body.estimateId,body.estimateId,body.customerId,complete?1:0).run();
      if (inserted.meta?.changes !== 1)
        return Response.json({ error: "A job report was created while you were saving. Reopen it before making another change." },
          { status: 409, headers: privateHeaders });
    }

    const saved = await env.DB.prepare(`SELECT ${reportColumns} FROM job_reports WHERE id=?`)
      .bind(id).first<SavedReport>();
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM job_reports WHERE estimate_id=?")
      .bind(body.estimateId).first<{ count: number }>();
    if (!saved || count?.count !== 1 || saved.id !== id ||
        saved.estimateId !== body.estimateId || saved.customerId !== body.customerId ||
        saved.checklist !== checklist || saved.notes !== notes ||
        saved.airflowBefore !== airflowBefore || saved.airflowAfter !== airflowAfter ||
        saved.status !== status || saved.createdAt !== createdAt ||
        saved.completedAt !== completedAt)
      throw Error("The saved report did not match this exact request.");
    return Response.json({ report: saved }, { status: existing ? 200 : 201, headers: privateHeaders });
  } catch {
    return Response.json({ error: "Report save was not confirmed. Reopen the saved report before repeating this operation.",
      saveUncertain: true }, { status: 503, headers: privateHeaders });
  }
}
