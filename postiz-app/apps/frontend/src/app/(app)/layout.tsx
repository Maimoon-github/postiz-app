import { SentryComponent } from '@gitroom/frontend/components/layout/sentry.component';

export const dynamic = 'force-dynamic';
import '../global.scss';
import 'react-tooltip/dist/react-tooltip.css';
import '@copilotkit/react-ui/styles.css';
import LayoutContext from '@gitroom/frontend/components/layout/layout.context';
import { ReactNode } from 'react';
import { jakartaSans } from '@gitroom/frontend/fonts/plus-jakarta-sans/plus.jakarta.sans.font';
import PlausibleProvider from 'next-plausible';
import clsx from 'clsx';
import {
  SocialEnvVarStatus,
  VariableContextComponent,
} from '@gitroom/react/helpers/variable.context';
import fs from 'fs';
import path from 'path';
import { Fragment } from 'react';
import UtmSaver from '@gitroom/helpers/utils/utm.saver';
import { DubAnalytics } from '@gitroom/frontend/components/layout/dubAnalytics';
import { FacebookComponent } from '@gitroom/frontend/components/layout/facebook.component';
import { GoogleTagManagerComponent } from '@gitroom/frontend/components/layout/gtm.component';
import { cookies } from 'next/headers';
import {
  cookieName,
  fallbackLng,
} from '@gitroom/react/translation/i18n.config';
import { HtmlComponent } from '@gitroom/frontend/components/layout/html.component';
import Script from 'next/script';
import { ChangeDirClient } from '@gitroom/frontend/components/new-layout/change.dir.client';

const NON_SECRET_SOCIAL_KEYS = new Set([
  'X_URL',
  'MASTODON_URL',
  'LISTMONK_DOMAIN',
  'LISTMONK_USER',
  'LISTMONK_LIST_ID',
  'TELEGRAM_BOT_NAME',
  'EXTENSION_ID',
  'MEWE_HOST',
  'NEYNAR_SPONSOR_SIGNERS',
]);

const KNOWN_SOCIAL_ENV_KEYS = [
  'X_URL',
  'X_API_KEY',
  'X_API_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'REDDIT_CLIENT_ID',
  'REDDIT_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'NEYNAR_CLIENT_ID',
  'NEYNAR_SECRET_KEY',
  'NEYNAR_APP_FID',
  'NEYNAR_APP_MNEMONIC',
  'NEYNAR_SPONSOR_SIGNERS',
  'BEEHIIVE_API_KEY',
  'BEEHIIVE_PUBLICATION_ID',
  'LISTMONK_DOMAIN',
  'LISTMONK_USER',
  'LISTMONK_API_KEY',
  'LISTMONK_LIST_ID',
  'THREADS_APP_ID',
  'THREADS_APP_SECRET',
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'INSTAGRAM_APP_ID',
  'INSTAGRAM_APP_SECRET',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'GOOGLE_GMB_CLIENT_ID',
  'GOOGLE_GMB_CLIENT_SECRET',
  'TIKTOK_CLIENT_ID',
  'TIKTOK_CLIENT_SECRET',
  'TIKTOK_BUSINESS_CLIENT_ID',
  'TIKTOK_BUSINESS_CLIENT_SECRET',
  'PINTEREST_CLIENT_ID',
  'PINTEREST_CLIENT_SECRET',
  'DRIBBBLE_CLIENT_ID',
  'DRIBBBLE_CLIENT_SECRET',
  'TUMBLR_CLIENT_ID',
  'TUMBLR_CLIENT_SECRET',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN_ID',
  'SLACK_ID',
  'SLACK_SECRET',
  'SLACK_SIGNING_SECRET',
  'KICK_CLIENT_ID',
  'KICK_SECRET',
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'MASTODON_URL',
  'MASTODON_CLIENT_ID',
  'MASTODON_CLIENT_SECRET',
  'TELEGRAM_TOKEN',
  'TELEGRAM_BOT_NAME',
  'VK_ID',
  'WHOP_CLIENT_ID',
  'EXTENSION_ID',
  'MEWE_APP_ID',
  'MEWE_API_KEY',
  'MEWE_HOST',
];

function parseEnvFileMap(
  fileName: string,
  includeCommentedKeys = false
): Record<string, string> {
  const candidates = [
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), fileName),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../../', fileName),
  ];
  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) continue;
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8');
      const result: Record<string, string> = {};
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isComment = trimmed.startsWith('#');
        if (isComment && !includeCommentedKeys) continue;
        const normalized = isComment ? trimmed.replace(/^#+\s*/, '') : trimmed;
        const match = normalized.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        const key = match[1];
        let val = match[2].trim();
        if (val.startsWith('"') && val.includes('"', 1)) {
          val = val.slice(1, val.indexOf('"', 1));
        } else if (val.startsWith("'") && val.includes("'", 1)) {
          val = val.slice(1, val.indexOf("'", 1));
        } else {
          val = val.split(/\s+#/)[0].trim();
        }
        result[key] = isComment ? '' : val;
      }
      return result;
    } catch {
      // Ignore read errors and try next candidate
    }
  }
  return {};
}

function maskEnvValue(val: string): string {
  if (!val) return '';
  if (val.length <= 6) return '••••••';
  return `${val.slice(0, 4)}••••••${val.slice(-2)}`;
}

function loadSocialEnvConfig(): Record<string, SocialEnvVarStatus> {
  const exampleMap = parseEnvFileMap('.env.example', true);
  const activeEnvMap = parseEnvFileMap('.env', false);
  const allKeys = new Set<string>([
    ...KNOWN_SOCIAL_ENV_KEYS,
    ...Object.keys(exampleMap).filter((k) =>
      /^(X_|LINKEDIN_|REDDIT_|GITHUB_|NEYNAR_|BEEHIIVE_|LISTMONK_|THREADS_|FACEBOOK_|INSTAGRAM_|YOUTUBE_|GOOGLE_GMB_|TIKTOK_|PINTEREST_|DRIBBBLE_|TUMBLR_|DISCORD_|SLACK_|KICK_|TWITCH_|MASTODON_|TELEGRAM_|VK_|WHOP_|EXTENSION_ID$|MEWE_)/.test(
        k
      )
    ),
    ...Object.keys(activeEnvMap).filter((k) =>
      /^(X_|LINKEDIN_|REDDIT_|GITHUB_|NEYNAR_|BEEHIIVE_|LISTMONK_|THREADS_|FACEBOOK_|INSTAGRAM_|YOUTUBE_|GOOGLE_GMB_|TIKTOK_|PINTEREST_|DRIBBBLE_|TUMBLR_|DISCORD_|SLACK_|KICK_|TWITCH_|MASTODON_|TELEGRAM_|VK_|WHOP_|EXTENSION_ID$|MEWE_)/.test(
        k
      )
    ),
  ]);

  const statusMap: Record<string, SocialEnvVarStatus> = {};
  for (const key of allKeys) {
    const runtimeVal = process.env[key];
    const fileVal = activeEnvMap[key];
    const resolved =
      runtimeVal !== undefined && runtimeVal !== ''
        ? runtimeVal
        : fileVal !== undefined
        ? fileVal
        : '';
    const configured = resolved.trim().length > 0;
    statusMap[key] = {
      configured,
      ...(configured ? { masked: maskEnvValue(resolved.trim()) } : {}),
      ...(NON_SECRET_SOCIAL_KEYS.has(key)
        ? { value: resolved.trim() || exampleMap[key] || '' }
        : {}),
    };
  }
  return statusMap;
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const language = cookieStore.get(cookieName)?.value || fallbackLng;
  const socialEnvConfig = loadSocialEnvConfig();
  const Plausible = !!process.env.STRIPE_PUBLISHABLE_KEY
    ? PlausibleProvider
    : Fragment;
  return (
    <html>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {!!process.env.DATAFAST_WEBSITE_ID && (
          <Script
            data-website-id={process.env.DATAFAST_WEBSITE_ID}
            data-domain="postiz.com"
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <ChangeDirClient />
      <body
        className={clsx(jakartaSans.className, 'dark text-primary !bg-primary')}
      >
        <VariableContextComponent
          storageProvider={
            process.env.STORAGE_PROVIDER! as 'local' | 'cloudflare'
          }
          environment={process.env.NODE_ENV!}
          backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
          plontoKey={process.env.NEXT_PUBLIC_POLOTNO!}
          stripeClient={process.env.STRIPE_PUBLISHABLE_KEY!}
          isChatBase={!!process.env.CHATBASE_TOKEN}
          billingEnabled={!!process.env.STRIPE_PUBLISHABLE_KEY}
          discordUrl={process.env.NEXT_PUBLIC_DISCORD_SUPPORT!}
          frontEndUrl={process.env.FRONTEND_URL!}
          isGeneral={!!process.env.IS_GENERAL}
          genericOauth={!!process.env.POSTIZ_GENERIC_OAUTH}
          oauthLogoUrl={process.env.NEXT_PUBLIC_POSTIZ_OAUTH_LOGO_URL!}
          oauthDisplayName={process.env.NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME!}
          uploadDirectory={process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY!}
          cloudflareUrl={process.env.CLOUDFLARE_BUCKET_URL || ''}
          mainUrl={process.env.MAIN_URL || ''}
          mcpUrl={process.env.MCP_URL}
          dub={!!process.env.STRIPE_PUBLISHABLE_KEY}
          facebookPixel={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL!}
          telegramBotName={process.env.TELEGRAM_BOT_NAME!}
          neynarClientId={process.env.NEYNAR_CLIENT_ID!}
          appleClientId={process.env.APPLE_CLIENT_ID!}
          isSecured={!process.env.NOT_SECURED}
          disableImageCompression={!!process.env.DISABLE_IMAGE_COMPRESSION}
          disableXAnalytics={!!process.env.DISABLE_X_ANALYTICS}
          sentryDsn={process.env.NEXT_PUBLIC_SENTRY_DSN!}
          extensionId={process.env.EXTENSION_ID || ''}
          googleAdsId={process.env.NEXT_PUBLIC_GTM_ID}
          googleAdsTrialTracking={process.env.NEXT_PUBLIC_TRACKING_TRIAL}
          language={language}
          recaptchaSiteKey={process.env.RECAPTCHA_SITE_KEY || ''}
          socialEnvConfig={socialEnvConfig}
          mediaProcessing={
            process.env.STORAGE_PROVIDER === 'cloudflare' &&
            !!process.env.RUNPOD_API_KEY &&
            !!process.env.RUNPOD_ENDPOINT_ID
          }
          transloadit={
            process.env.TRANSLOADIT_AUTH && process.env.TRANSLOADIT_TEMPLATE
              ? [
                  process.env.TRANSLOADIT_AUTH!,
                  process.env.TRANSLOADIT_TEMPLATE!,
                ]
              : []
          }
        >
          <SentryComponent>
            <HtmlComponent />
            <DubAnalytics />
            <FacebookComponent />
            <GoogleTagManagerComponent gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
            <Plausible
              domain={!!process.env.IS_GENERAL ? 'postiz.com' : 'gitroom.com'}
            >
              <LayoutContext>
                <UtmSaver />
                {children}
              </LayoutContext>
            </Plausible>
          </SentryComponent>
        </VariableContextComponent>
      </body>
    </html>
  );
}
