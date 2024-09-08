// Copied from @auth/core@0.34.2 for the chrysalis/Gemini integration.

type ISODateString = string;

export interface DefaultSession {
  user?: User;
  expires: ISODateString;
}

/** The active session of the logged in user. */
export interface Session extends DefaultSession {}

/**
 * The shape of the returned object in the OAuth providers' `profile` callback,
 * available in the `jwt` and `session` callbacks,
 * or the second parameter of the `session` callback, when using a database.
 */
export interface User {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export type RedirectableProviderType = "email" | "credentials";

// Util type that matches some strings literally, but allows any other string as well.
// @source https://github.com/microsoft/TypeScript/issues/29729#issuecomment-832522611
export type LiteralUnion<T extends U, U = string> =
  | T
  | (U & Record<never, never>);

export type BuiltInProviderType =
  | RedirectableProviderType
  | OAuthProviderType
  | WebAuthnProviderType;

export type OAuthProviderType =
  | "42-school"
  | "apple"
  | "asgardeo"
  | "auth0"
  | "authentik"
  | "azure-ad-b2c"
  | "azure-ad"
  | "azure-devops"
  | "bankid-no"
  | "battlenet"
  | "beyondidentity"
  | "box"
  | "boxyhq-saml"
  | "bungie"
  | "click-up"
  | "cognito"
  | "coinbase"
  | "descope"
  | "discord"
  | "dribbble"
  | "dropbox"
  | "duende-identity-server6"
  | "eveonline"
  | "facebook"
  | "faceit"
  | "foursquare"
  | "freshbooks"
  | "fusionauth"
  | "github"
  | "gitlab"
  | "google"
  | "hubspot"
  | "identity-server4"
  | "instagram"
  | "kakao"
  | "keycloak"
  | "line"
  | "linkedin"
  | "mailchimp"
  | "mailru"
  | "mastodon"
  | "mattermost"
  | "medium"
  | "microsoft-entra-id"
  | "naver"
  | "netlify"
  | "netsuite"
  | "nodemailer"
  | "notion"
  | "okta"
  | "onelogin"
  | "ory-hydra"
  | "osso"
  | "osu"
  | "passage"
  | "passkey"
  | "patreon"
  | "pinterest"
  | "pipedrive"
  | "postmark"
  | "reddit"
  | "resend"
  | "salesforce"
  | "sendgrid"
  | "simplelogin"
  | "slack"
  | "spotify"
  | "strava"
  | "threads"
  | "tiktok"
  | "todoist"
  | "trakt"
  | "twitch"
  | "twitter"
  | "united-effects"
  | "vk"
  | "webauthn"
  | "webex"
  | "wikimedia"
  | "wordpress"
  | "workos"
  | "yandex"
  | "zitadel"
  | "zoho"
  | "zoom";

export type WebAuthnProviderType = "webauthn";

/**
 * Match `inputType` of `new URLSearchParams(inputType)`
 * @internal
 */
export type SignInAuthorizationParams =
  | string
  | string[][]
  | Record<string, string>
  | URLSearchParams;

export interface SignInOptions extends Record<string, unknown> {
  /**
   * Specify to which URL the user will be redirected after signing in. Defaults to the page URL the sign-in is initiated from.
   *
   * [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl)
   */
  callbackUrl?: string;
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option) */
  redirect?: boolean;
}

export interface SignInResponse {
  error: string | undefined;
  code: string | undefined;
  status: number;
  ok: boolean;
  url: string | null;
}

// Extracted from signIn definition in @auth/core.
export type SignInFunction<
  P extends RedirectableProviderType | undefined = undefined,
> = (
  provider?: LiteralUnion<
    P extends RedirectableProviderType
      ? P | BuiltInProviderType
      : BuiltInProviderType
  >,
  options?: SignInOptions,
  authorizationParams?: SignInAuthorizationParams,
) => Promise<
  P extends RedirectableProviderType ? SignInResponse | undefined : undefined
>;

/** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option-1) */
export interface SignOutResponse {
  url: string;
}

export interface SignOutParams<R extends boolean = true> {
  /** [Documentation](https://next-auth.js.org/getting-started/client#specifying-a-callbackurl-1) */
  callbackUrl?: string;
  /** [Documentation](https://next-auth.js.org/getting-started/client#using-the-redirect-false-option-1 */
  redirect?: R;
}

// Extracted from signOut definition in @auth/core.
export type SignOutFunction<R extends boolean = true> = (
  options?: SignOutParams<R>,
) => Promise<R extends true ? undefined : SignOutResponse>;
