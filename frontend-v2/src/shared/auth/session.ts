export type AuthApiUser = {
  id: string;
  username: string;
  display_name: string;
  roles: string[];
};

export type TokenSessionResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthApiUser;
};

export type StoreUser = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
};

export type StoreSessionPayload = {
  token: string;
  refreshToken: string;
  user: StoreUser;
};

export function toStoreUser(user: AuthApiUser): StoreUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    roles: user.roles,
  };
}

export function toStoreSessionPayload(payload: TokenSessionResponse): StoreSessionPayload {
  return {
    token: payload.access_token,
    refreshToken: payload.refresh_token,
    user: toStoreUser(payload.user),
  };
}
