// src/utils/branchResolver.ts

/** แปลงชื่อสาขาให้เป็น key มาตรฐาน */
export const normalizeBranchKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');

/**
 * หา canonical branch จาก raw branch
 * @returns canonical branch หรือ null ถ้าไม่เจอ
 */
export const resolveCanonicalBranch = (
  rawBranch: string,
  canonicalBranches: Set<string>
): string | null => {
  if (!rawBranch) return null;

  const rawKey = normalizeBranchKey(rawBranch);

  for (const canonical of canonicalBranches) {
    if (normalizeBranchKey(canonical) === rawKey) {
      return canonical;
    }
  }

  return null;
};
