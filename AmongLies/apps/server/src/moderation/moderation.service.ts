import { Injectable } from '@nestjs/common';
import type {
  ReportEvidence,
  ReportReason,
  ReportStatus,
  ReportView,
} from '@amonglies/shared';
import { UUID, supabaseRest } from './supabase-rest.js';

export interface NewReport {
  kind: 'player' | 'workshop_item';
  reporterId: string | null;
  reporterNickname: string;
  targetUserId: string | null;
  targetNickname: string | null;
  targetItemId: string | null;
  reason: ReportReason;
  details: string;
  evidence: ReportEvidence[];
  roomCode: string | null;
}

interface ReportRow {
  id: string;
  kind: 'player' | 'workshop_item';
  reason: ReportReason;
  details: string;
  evidence: ReportEvidence[];
  room_code: string | null;
  status: ReportStatus;
  resolution: string | null;
  created_at: string;
  reporter_id: string | null;
  reporter_nickname: string;
  target_user_id: string | null;
  target_nickname: string | null;
  reporter: { username: string } | null;
  target: { username: string; suspended_until: string | null } | null;
  item: { id: string; title: string; published: boolean } | null;
}

const SELECT = [
  '*',
  'reporter:profiles!reports_reporter_id_fkey(username)',
  'target:profiles!reports_target_user_id_fkey(username,suspended_until)',
  'item:workshop_items!reports_target_item_id_fkey(id,title,published)',
].join(',');

/** Reportes y acciones sobre el workshop (todo pasa por el servidor). */
@Injectable()
export class ModerationService {
  async createReport(report: NewReport): Promise<void> {
    await supabaseRest('reports', {
      method: 'POST',
      body: JSON.stringify({
        kind: report.kind,
        reporter_id: report.reporterId,
        reporter_nickname: report.reporterNickname,
        target_user_id: report.targetUserId,
        target_nickname: report.targetNickname,
        target_item_id: report.targetItemId,
        reason: report.reason,
        details: report.details,
        evidence: report.evidence,
        room_code: report.roomCode,
      }),
    });
  }

  async listReports(status: ReportStatus): Promise<ReportView[]> {
    const res = await supabaseRest(
      `reports?status=eq.${status}&select=${SELECT}&order=created_at.desc&limit=100`,
    );
    return ((await res.json()) as ReportRow[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      reason: r.reason,
      details: r.details,
      evidence: r.evidence,
      roomCode: r.room_code,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.created_at,
      reporter: {
        userId: r.reporter_id,
        nickname: r.reporter_nickname,
        username: r.reporter?.username ?? null,
      },
      target:
        r.kind === 'player'
          ? {
              userId: r.target_user_id,
              nickname: r.target_nickname,
              username: r.target?.username ?? null,
              suspendedUntil: r.target?.suspended_until ?? null,
            }
          : null,
      item: r.item,
    }));
  }

  async resolve(
    id: string,
    adminId: string,
    status: 'resolved' | 'dismissed',
    resolution: string,
  ): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const res = await supabaseRest(`reports?id=eq.${id}&select=id`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status,
        resolution: resolution.slice(0, 300) || null,
        resolved_by: adminId,
        resolved_at: new Date().toISOString(),
      }),
    });
    return ((await res.json()) as unknown[]).length > 0;
  }

  /** ¿Existe y está publicado? (sólo se reporta lo que se puede ver). */
  async isPublishedItem(itemId: string): Promise<boolean> {
    if (!UUID.test(itemId)) return false;
    const res = await supabaseRest(
      `workshop_items?id=eq.${itemId}&published=is.true&select=id`,
    );
    return ((await res.json()) as unknown[]).length > 0;
  }

  async workshopAction(
    itemId: string,
    action: 'hide' | 'delete',
  ): Promise<boolean> {
    if (!UUID.test(itemId)) return false;
    const res = await supabaseRest(`workshop_items?id=eq.${itemId}&select=id`, {
      method: action === 'hide' ? 'PATCH' : 'DELETE',
      headers: { Prefer: 'return=representation' },
      ...(action === 'hide'
        ? { body: JSON.stringify({ published: false }) }
        : {}),
    });
    return ((await res.json()) as unknown[]).length > 0;
  }
}
