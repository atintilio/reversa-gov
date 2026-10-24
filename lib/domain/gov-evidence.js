// Reversa Gov — evidências, vínculos e revisão humana (isolado, aditivo).

const { getSql } = require('../db');
const { audit } = require('../audit');
const { HttpError } = require('../authz');

async function listarEvidencias(ctx, candidatoId) {
  const sql = getSql();
  const rows = await sql`
    select id, evidence_type, record_locator, validation_status, validated_by, validated_at, created_at
    from gov_evidence_links
    where candidate_id = ${candidatoId} and organization_id = ${ctx.organization.id}
    order by created_at desc
  `;
  return {
    evidencias: rows.map((r) => ({
      id: r.id,
      evidenceType: r.evidence_type,
      recordLocator: r.record_locator,
      validationStatus: r.validation_status,
      validatedBy: r.validated_by,
      validatedAt: r.validated_at,
      createdAt: r.created_at,
    })),
  };
}

async function vincularEvidencia(ctx, candidatoId, { documentId, evidenceType, recordLocator }) {
  const sql = getSql();
  const row = (await sql`
    insert into gov_evidence_links (organization_id, candidate_id, document_id, evidence_type, record_locator)
    values (${ctx.organization.id}, ${candidatoId}, ${documentId}, ${evidenceType}, ${recordLocator})
    returning id
  `)[0];

  await audit('gov.evidencia.vinculada', {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    entityType: 'gov_evidence_link',
    entityId: row.id,
    metadata: { candidateId, evidenceType },
  });

  return { id: row.id };
}

async function registrarRevisao(ctx, candidatoId, { decision, reason }) {
  const sql = getSql();
  const row = (await sql`
    insert into gov_reviews (organization_id, candidate_id, reviewer_id, reviewer_role, decision, reason)
    values (${ctx.organization.id}, ${candidatoId}, ${ctx.user.id}, ${ctx.role}, ${decision}, ${reason})
    returning id, created_at
  `)[0];

  await audit('gov.revisao.registrada', {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    entityType: 'gov_review',
    entityId: row.id,
    metadata: { candidateId, decision },
  });

  return {
    id: row.id,
    decision,
    reason,
    createdAt: row.created_at,
  };
}

module.exports = { listarEvidencias, vincularEvidencia, registrarRevisao };