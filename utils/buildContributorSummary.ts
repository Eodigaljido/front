import type { CourseItem } from '../data/mockData';
import {
  getCourseAuthorLabel,
  getCourseModifierLabel,
  hasDistinctCourseModifier,
  type CourseAuthorContext,
} from './formatCourseAuthor';

export type ContributorEntry = {
  key: string;
  label: string;
};

function contributorDisplayLabel(
  raw: string,
  authorCtx?: CourseAuthorContext,
): string {
  const s = String(raw ?? '').trim();
  if (!s || s.includes('미표시')) return '';
  if (s === '내가 제작' || s === '내가 수정') {
    const nick = String(authorCtx?.myNickname ?? '').trim();
    return nick ? `${nick} (나)` : '나';
  }
  return s;
}

function normalizeContributorKey(label: string): string {
  return label.replace(/\s*\(나\)\s*$/u, '').trim().toLowerCase();
}

function addContributor(
  out: ContributorEntry[],
  seen: Set<string>,
  key: string,
  rawLabel: string,
  authorCtx?: CourseAuthorContext,
): void {
  const label = contributorDisplayLabel(rawLabel, authorCtx);
  if (!label) return;
  const dedupeKey = normalizeContributorKey(label);
  if (!dedupeKey || seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  out.push({ key, label });
}

/** 제작·수정·공동 멤버 등 루트에 관여한 사람 목록 */
export function collectCourseContributorLabels(
  course: Pick<
    CourseItem,
    'authorUuid' | 'authorUserId' | 'modifierUuid' | 'modifierUserId'
  >,
  authorCtx?: CourseAuthorContext,
  extraNames?: Array<string | null | undefined>,
): ContributorEntry[] {
  const seen = new Set<string>();
  const out: ContributorEntry[] = [];

  addContributor(
    out,
    seen,
    `creator:${course.authorUuid ?? ''}:${course.authorUserId ?? ''}`,
    getCourseAuthorLabel(course, authorCtx),
    authorCtx,
  );

  if (hasDistinctCourseModifier(course)) {
    addContributor(
      out,
      seen,
      `modifier:${course.modifierUuid ?? ''}:${course.modifierUserId ?? ''}`,
      getCourseModifierLabel(course, authorCtx),
      authorCtx,
    );
  }

  for (const raw of extraNames ?? []) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    addContributor(out, seen, `member:${name}`, name, authorCtx);
  }

  return out;
}

export function formatContributorSummary(
  entries: ContributorEntry[],
): string {
  if (entries.length === 0) return '';
  return `멤버: ${entries.map((e) => e.label).join(', ')}`;
}

export function buildContributorSummary(
  course: CourseItem,
  authorCtx?: CourseAuthorContext,
  extraNames?: Array<string | null | undefined>,
): string {
  return formatContributorSummary(
    collectCourseContributorLabels(course, authorCtx, extraNames),
  );
}
