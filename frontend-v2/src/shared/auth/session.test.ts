import { describe, expect, it } from 'vitest';

import { toStoreSessionPayload, toStoreUser, type TokenSessionResponse } from './session';

describe('auth session mappers', () => {
  it('maps API user to store user format', () => {
    const mapped = toStoreUser({
      id: 'u-1',
      username: 'inspector',
      display_name: '巡检员',
      roles: ['task_operator'],
    });
    expect(mapped).toEqual({
      id: 'u-1',
      username: 'inspector',
      displayName: '巡检员',
      roles: ['task_operator'],
    });
  });

  it('maps token response to store session payload', () => {
    const payload: TokenSessionResponse = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      user: {
        id: 'u-2',
        username: 'viewer',
        display_name: '查看者',
        roles: ['analysis_viewer'],
      },
    };
    expect(toStoreSessionPayload(payload)).toEqual({
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'u-2',
        username: 'viewer',
        displayName: '查看者',
        roles: ['analysis_viewer'],
      },
    });
  });
});
