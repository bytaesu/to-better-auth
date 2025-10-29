import { betterAuth } from 'better-auth';
import { admin, anonymous, phoneNumber } from 'better-auth/plugins';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '../constants';
import { toDB } from './db';

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  database: toDB,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    // IMPORTANT: Add the social providers you have enabled in Supabase below.
    //
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // },
    // github: {
    //   clientId: process.env.GITHUB_CLIENT_ID ?? '',
    //   clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    // },
    // kakao: {
    //   clientId: process.env.KAKAO_CLIENT_ID ?? '',
    //   clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
    // },
    // facebook: {
    //   clientId: process.env.FACEBOOK_CLIENT_ID ?? '',
    //   clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? '',
    // },
  },
  user: {
    additionalFields: {
      userMetadata: {
        type: 'json',
        required: false,
        input: false,
      },
      appMetadata: {
        type: 'json',
        required: false,
        input: false,
      },
      invitedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      lastSignInAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },
  plugins: [admin(), anonymous(), phoneNumber()],
});
