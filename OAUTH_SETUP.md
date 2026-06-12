# OAuth / OIDC Setup (Google & Facebook)

Social login is optional. A provider is only registered when **both** of its
env vars are present (see `packages/auth/src/index.ts`), so the app boots fine
without credentials — the buttons just won't complete a real sign-in.

Any new social signup is forced to the **`patient`** role by the
`databaseHooks.user.create.before` hook in `packages/auth/src/index.ts`.

## How it works

The app uses Better-Auth's `genericOAuth` plugin, which supports:

- **Google** — full **OpenID Connect** via discovery URL
  (`https://accounts.google.com/.well-known/openid-configuration`). Better-Auth
  auto-discovers the auth, token, and userinfo endpoints and validates the
  returned `id_token`.
- **Facebook** — plain **OAuth 2.0** (Facebook has no standard OIDC discovery
  endpoint). Scopes: `email`, `public_profile`.

## Redirect (callback) URIs

The `genericOAuth` plugin uses the path `/api/auth/oauth2/callback/{providerId}`.

For local dev (`BETTER_AUTH_URL=http://localhost:3001`):

| Provider | Redirect URI |
|----------|--------------|
| Google   | `http://localhost:3001/api/auth/oauth2/callback/google` |
| Facebook | `http://localhost:3001/api/auth/oauth2/callback/facebook` |

In production, swap the origin for your deployed domain and register the
matching `https://yourdomain.com/api/auth/oauth2/callback/{provider}` URIs.
Providers reject any redirect URI not on the registered list.

## Google (Google Cloud Console)

1. Open <https://console.cloud.google.com> and create/select a project.
2. **APIs & Services → OAuth consent screen** → choose **External**, fill in the
   app name + your email, save. Add yourself under **Test users** so you can log
   in while the app is in "testing" mode (no verification required).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Under **Authorized redirect URIs**, add the Google URI from the table above.
6. Create, then copy the **Client ID** and **Client secret**.

## Facebook (Meta for Developers)

1. Open <https://developers.facebook.com/apps> → **Create app**.
2. Use case: **Authenticate and request data from users** (adds "Facebook Login").
3. Add the **Facebook Login** product → **Settings**.
4. Under **Valid OAuth Redirect URIs**, add the Facebook URI from the table above.
5. **App settings → Basic** → copy the **App ID** (client id) and
   **App Secret** (client secret).
6. While the app is in **Development mode**, only you and listed test users can
   log in — fine for testing, no app review required.

## Wire them in

Add the values to `apps/web/.env` (gitignored — secrets stay local):

```dotenv
GOOGLE_CLIENT_ID=<your google client id>
GOOGLE_CLIENT_SECRET=<your google client secret>
FACEBOOK_CLIENT_ID=<your facebook app id>
FACEBOOK_CLIENT_SECRET=<your facebook app secret>
```

Then **restart the dev server** — providers are registered at boot, so the new
credentials are only picked up on a fresh start.

## Verify

With credentials set, this should return an authorize URL pointing at the provider:

```bash
# Google
curl -s -X POST http://localhost:3001/api/auth/sign-in/oauth2 \
  -H 'content-type: application/json' \
  -d '{"providerId":"google","callbackURL":"/dashboard"}'
# → { "url": "https://accounts.google.com/o/oauth2/auth?...", "redirect": true }

# Facebook
curl -s -X POST http://localhost:3001/api/auth/sign-in/oauth2 \
  -H 'content-type: application/json' \
  -d '{"providerId":"facebook","callbackURL":"/dashboard"}'
# → { "url": "https://www.facebook.com/v21.0/dialog/oauth?...", "redirect": true }
```
