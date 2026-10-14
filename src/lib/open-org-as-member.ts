/** Ask the superadmin API for a tenant session as a specific org member. */
export async function requestOrgMemberSession(
  orgId: string,
  userId?: string
): Promise<{ url: string } | { error: string }> {
  const res = await fetch('/api/platform/superadmin/impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userId ? { orgId, userId } : { orgId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.success || !json.data?.url) {
    return { error: json.error || 'No se pudo abrir el admin' }
  }
  return { url: json.data.url as string }
}
