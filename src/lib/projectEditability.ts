export function isProjectEditable(
  status: string,
  pendingEditAccessStatus?: string | null
): boolean {
  if (status === 'ONGOING') return true;
  if (status === 'IN_REVIEW') return pendingEditAccessStatus === 'GRANTED';
  return false;
}
