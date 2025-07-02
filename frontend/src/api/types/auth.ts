import { UUID } from './common';
import { UserDetailResponse } from './user';

export interface SignInRequest {
  clerk_token: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
}

export interface SignInResponse {
  user: UserDetailResponse;
  token: TokenData;
}

export interface UserAuthResponse {
  id: UUID;
  email: string;
  name: string;
  clerk_user_id: string;
}

export interface TokenVerifyRequest {
  token: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  user?: UserAuthResponse;
  error?: string;
}

export interface LogoutResponse {
  message: string;
}