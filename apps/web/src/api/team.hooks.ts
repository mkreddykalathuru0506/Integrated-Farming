/**
 * Farm membership hooks (slice 11.9) — roster + OWNER-only lifecycle actions
 * over the 11.4b endpoints. Queries via useFarmApi + farmKeys, mutations via
 * useApiMutation (toasts + invalidation handled centrally).
 */
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../lib/useApiMutation';
import { useFarmApi } from './FarmContext';
import { farmKeys } from './keys';

/** GET /api/farm/members row — `id` is the membership id, actions key on `userId`. */
export type FarmMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

export function useMembers() {
  const { farmId, fetchJson } = useFarmApi();
  return useQuery({
    queryKey: farmKeys.list(farmId, 'members'),
    queryFn: async () => (await fetchJson<{ members: FarmMember[] }>('/api/farm/members')).members,
  });
}

/**
 * Add a member by email (OWNER only). Re-adding a SUSPENDED member reactivates
 * it with the given role (the API answers 200 instead of 201 — same shape).
 */
export function useAddMember() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ member: FarmMember }, { email: string; role: string }>({
    mutationFn: (data) =>
      fetchJson('/api/farm/members', { method: 'POST', body: JSON.stringify(data) }),
    successKey: 'team.added',
    errorKeyByCode: {
      USER_NOT_FOUND: 'team.errUserNotFound',
      ALREADY_MEMBER: 'team.errAlreadyMember',
    },
    invalidate: [farmKeys.list(farmId, 'members')],
  });
}

export function useChangeMemberRole() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ member: FarmMember }, { userId: string; role: string }>({
    mutationFn: ({ userId, role }) =>
      fetchJson(`/api/farm/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    successKey: 'team.roleChanged',
    errorKeyByCode: { LAST_OWNER: 'team.errLastOwner' },
    invalidate: [farmKeys.list(farmId, 'members')],
  });
}

/** Deactivate (suspend) a member — reversible by re-adding the same email. */
export function useDeactivateMember() {
  const { farmId, fetchJson } = useFarmApi();
  return useApiMutation<{ member: FarmMember }, string>({
    mutationFn: (userId) =>
      fetchJson(`/api/farm/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
    successKey: 'team.deactivated',
    errorKeyByCode: { LAST_OWNER: 'team.errLastOwner' },
    invalidate: [farmKeys.list(farmId, 'members')],
  });
}
