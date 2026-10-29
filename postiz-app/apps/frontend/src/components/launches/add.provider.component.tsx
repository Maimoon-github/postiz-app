'use client';

import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { Button } from '@gitroom/react/form/button';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ApiKeyDto } from '@gitroom/nestjs-libraries/dtos/integrations/api.key.dto';
import { useRouter } from 'next/navigation';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import {
  SocialEnvVarStatus,
  useVariables,
} from '@gitroom/react/helpers/variable.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { object, string } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { web3List } from '@gitroom/frontend/components/launches/web3/web3.list';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { capitalize } from 'lodash';
const resolver = classValidatorResolver(ApiKeyDto);

export const useAddProvider = (update?: () => void, invite?: boolean) => {
  const modal = useModals();
  const fetch = useFetch();
  return useCallback(async () => {
    const data = await (await fetch('/integrations')).json();
    modal.openModal({
      title: 'Add Channel',
      withCloseButton: true,
      children: (
        <AddProviderComponent invite={!!invite} update={update} {...data} />
      ),
    });
  }, []);
};
export const AddProviderButton: FC<{
  update?: () => void;
}> = (props) => {
  const { update } = props;
  const add = useAddProvider(update);
  const invite = useAddProvider(update, true);
  const t = useT();

  return (
    <div className="flex group-[.sidebar]:block gap-[8px]">
      <button
        className="flex-1 group-[.sidebar]:w-[100%] group-[.sidebar]:flex-none text-btnText bg-btnSimple h-[44px] pt-[12px] pb-[14px] ps-[16px] pe-[20px] justify-center items-center flex rounded-[8px] gap-[8px]"
        onClick={add}
      >
        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M1.66675 10.0417C3.35907 10.2299 4.93698 10.9884 6.14101 12.1924C7.34504 13.3964 8.10353 14.9743 8.29175 16.6667M1.66675 13.4167C2.46749 13.58 3.20253 13.9751 3.7804 14.553C4.35827 15.1309 4.75344 15.8659 4.91675 16.6667M1.66675 16.6667H1.67508M11.6667 17.5H14.3334C15.7335 17.5 16.4336 17.5 16.9684 17.2275C17.4388 16.9878 17.8212 16.6054 18.0609 16.135C18.3334 15.6002 18.3334 14.9001 18.3334 13.5V6.5C18.3334 5.09987 18.3334 4.3998 18.0609 3.86502C17.8212 3.39462 17.4388 3.01217 16.9684 2.77248C16.4336 2.5 15.7335 2.5 14.3334 2.5H5.66675C4.26662 2.5 3.56655 2.5 3.03177 2.77248C2.56137 3.01217 2.17892 3.39462 1.93923 3.86502C1.66675 4.3998 1.66675 5.09987 1.66675 6.5V6.66667"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-start text-[14px] group-[.sidebar]:hidden">
          {t('add_channel', 'Add Channel')}
        </div>
      </button>
      <button
        onClick={invite}
        data-tooltip-id="tooltip"
        data-tooltip-content={t(
          'invite_link',
          'Send Invite Link to a customer to add channel'
        )}
        className="group-[.sidebar]:hidden min-h-[44px] min-w-[44px] bg-btnSimple justify-center items-center flex rounded-[8px] cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
        >
          <g clipPath="url(#clip0_2452_193804)">
            <path
              d="M6.6668 8.66599C6.9531 9.04875 7.31837 9.36545 7.73783 9.59462C8.1573 9.82379 8.62114 9.96007 9.0979 9.99422C9.57466 10.0284 10.0532 9.95957 10.501 9.79251C10.9489 9.62546 11.3555 9.36404 11.6935 9.02599L13.6935 7.02599C14.3007 6.39732 14.6366 5.55531 14.629 4.68132C14.6215 3.80733 14.2709 2.97129 13.6529 2.35326C13.0348 1.73524 12.1988 1.38467 11.3248 1.37708C10.4508 1.36948 9.60881 1.70547 8.98013 2.31266L7.83347 3.45266M9.33347 7.33266C9.04716 6.94991 8.68189 6.6332 8.26243 6.40403C7.84297 6.17486 7.37913 6.03858 6.90237 6.00444C6.4256 5.97029 5.94708 6.03908 5.49924 6.20614C5.0514 6.3732 4.64472 6.63461 4.3068 6.97266L2.3068 8.97266C1.69961 9.60133 1.36363 10.4433 1.37122 11.3173C1.37881 12.1913 1.72938 13.0274 2.3474 13.6454C2.96543 14.2634 3.80147 14.614 4.67546 14.6216C5.54945 14.6292 6.39146 14.2932 7.02013 13.686L8.16013 12.546"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            ></path>
          </g>
          <defs>
            <clipPath id="clip0_2452_193804">
              <rect width="16" height="16" fill="textColor"></rect>
            </clipPath>
          </defs>
        </svg>
      </button>
    </div>
  );
};

export const UrlModal: FC<{
  gotoUrl(url: string): void;
}> = (props) => {
  const { gotoUrl } = props;
  const methods = useForm({
    mode: 'onChange',
  });

  const t = useT();

  const submit = useCallback(async (data: FieldValues) => {
    gotoUrl(data.url);
  }, []);
  return (
    <div className="rounded-[4px] border border-customColor6 bg-sixth px-[16px] pb-[16px] relative">
      <TopTitle title={`Instance URL`} />
      <button
        onClick={close}
        className="outline-none absolute end-[20px] top-[20px] mantine-UnstyledButton-root mantine-ActionIcon-root hover:bg-tableBorder cursor-pointer mantine-Modal-close mantine-1dcetaa"
        type="button"
      >
        <svg
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
        >
          <path
            d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="URL" name="url" />
          </div>
          <div>
            <Button type="submit">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
export const CustomVariables: FC<{
  variables: Array<{
    key: string;
    label: string;
    defaultValue?: string;
    validation: string;
    type: 'text' | 'password';
    hint?: string;
  }>;
  close?: () => void;
  identifier: string;
  gotoUrl(url: string): void;
  onboarding?: boolean;
}> = (props) => {
  const { close, gotoUrl, identifier, variables, onboarding } = props;
  const fetch = useFetch();
  const modals = useModals();
  const schema = useMemo(() => {
    return object({
      ...variables.reduce((aIcc, item) => {
        const splitter = item.validation.split('/');
        const regex = new RegExp(
          splitter.slice(1, -1).join('/'),
          splitter.pop()
        );
        return {
          ...aIcc,
          [item.key]: string()
            .matches(regex, `${item.label} is invalid`)
            .required(),
        };
      }, {}),
    });
  }, [variables]);
  const methods = useForm({
    mode: 'onChange',
    resolver: yupResolver(schema),
    values: variables.reduce(
      (acc, item) => ({
        ...acc,
        ...(item.defaultValue
          ? {
              [item.key]: item.defaultValue,
            }
          : {}),
      }),
      {}
    ),
  });
  const submit = useCallback(
    async (data: FieldValues) => {
      const response = await fetch(
        `/integrations/social/${identifier}${
          onboarding ? '?onboarding=true' : ''
        }`
      );
      if (response.status === 402) {
        return;
      }
      const { url } = await response.json();
      modals.closeAll();
      gotoUrl(
        `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
          JSON.stringify(data)
        ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`
      );
    },
    [variables, onboarding]
  );

  const t = useT();

  return (
    <div className="rounded-[4px] relative">
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col pt-[10px]"
          onSubmit={methods.handleSubmit(submit)}
        >
          {variables.map((variable) => (
            <div key={variable.key}>
              {variable.hint ? (
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[14px] flex items-center gap-[6px]">
                    <span>{variable.label}</span>
                    <span
                      data-tooltip-id="tooltip"
                      data-tooltip-content={variable.hint}
                      className="w-[16px] h-[16px] rounded-full border border-textColor/60 text-textColor/60 flex items-center justify-center text-[11px] leading-none cursor-help select-none"
                    >
                      i
                    </span>
                  </div>
                  <Input
                    label=""
                    name={variable.key}
                    type={variable.type == 'text' ? 'text' : 'password'}
                  />
                </div>
              ) : (
                <Input
                  label={variable.label}
                  name={variable.key}
                  type={variable.type == 'text' ? 'text' : 'password'}
                />
              )}
            </div>
          ))}
          <div>
            <Button type="submit">{t('connect', 'Connect')}</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
const ExtensionNotFound: FC = () => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <p className="text-[14px] text-textColor/80">
        {t(
          'extension_not_available',
          'The Postiz browser extension is not installed. You need to install it before connecting this channel.'
        )}
      </p>
      <div className="flex gap-[10px]">
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            window.open(
              'https://chromewebstore.google.com/detail/postiz/cidhffagahknaeodkplfbcpfeielnkjl?hl=en',
              '_blank'
            );
            modals.closeCurrent();
          }}
        >
          {t('install_extension', 'Install Extension')}
        </Button>
        <Button
          type="button"
          className="flex-1 !bg-transparent border border-tableBorder text-textColor"
          onClick={() => modals.closeCurrent()}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};

const ChromeExtensionWarning: FC<{
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ onConfirm, onCancel }) => {
  const modals = useModals();
  const t = useT();
  return (
    <div className="flex flex-col gap-[16px] pt-[8px]">
      <p className="text-[14px] text-textColor/80">
        {t(
          'chrome_extension_warning_intro',
          'This channel connects via the browser extension. Please be aware of the following:'
        )}
      </p>
      <ul className="flex flex-col gap-[8px] list-disc ps-[20px] text-[14px] text-textColor/80">
        <li>
          {t(
            'chrome_extension_warning_tos',
            'Using a browser extension to interact with a platform may violate its terms of service and could result in your account being suspended or banned.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_unstable',
            'This method is not as reliable as native integrations and may experience random disconnections.'
          )}
        </li>
        <li>
          {t(
            'chrome_extension_warning_reconnect',
            'You may need to reconnect periodically if the session expires.'
          )}
        </li>
        <li>
          We will store your cookies securely to facilitate the connection.
        </li>
        <li>
          Postiz does not take responsibility for any issues arising or account
          termination due to the use of this method.
        </li>
      </ul>
      <div className="flex gap-[10px] mt-[8px]">
        <Button
          type="button"
          className="flex-1"
          onClick={() => {
            modals.closeCurrent();
            onConfirm();
          }}
        >
          {t('i_understand_continue', 'I understand, continue')}
        </Button>
        <Button
          type="button"
          className="flex-1 !bg-transparent border border-tableBorder text-textColor"
          onClick={() => {
            modals.closeCurrent();
            onCancel();
          }}
        >
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};

type EnvFieldSpec = {
  envKey: string;
  label: string;
  type: 'text' | 'password';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
};

type PlatformCredentialSpec = {
  authType: string;
  portalName: string;
  portalUrl: string;
  steps: string[];
  note?: string;
  httpsRedirectProxy?: boolean;
  trailingSlash?: boolean;
  customBaseUrlEnvKey?: string;
  portalUsesRedirectUri?: boolean;
  envFields: EnvFieldSpec[];
  customFieldEnvAliases?: Record<string, string>;
};

const PLATFORM_CREDENTIAL_SPECS: Record<string, PlatformCredentialSpec> = {
  x: {
    authType: 'OAuth 1.0a',
    portalName: 'X Developer Console',
    portalUrl: 'https://console.x.com',
    steps: [
      'Open console.x.com, create or select your Project & App, and open User authentication settings.',
      'Set App permissions to Read and Write, and select Web App, Automated App or Bot.',
      'Paste the Callback URI / Redirect URL shown below and fill in your Website URL.',
      'Open Keys and tokens, generate Consumer Keys (API Key & API Key Secret), and enter them below.',
    ],
    note: 'Use the OAuth 1.0a Consumer Keys (API Key & Secret), not the OAuth 2.0 Client ID.',
    customBaseUrlEnvKey: 'X_URL',
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'X_API_KEY',
        label: 'API Key (Consumer Key)',
        type: 'text',
        required: true,
        placeholder: 'e.g. J2U6dC73iV1Nr1lPn57Iz1zRH',
      },
      {
        envKey: 'X_API_SECRET',
        label: 'API Key Secret (Consumer Secret)',
        type: 'password',
        required: true,
        placeholder: 'Enter X Consumer Secret',
      },
      {
        envKey: 'X_URL',
        label: 'Custom Callback Base URL (Optional)',
        type: 'text',
        required: false,
        placeholder: 'Defaults to FRONTEND_URL (e.g. http://localhost:4007)',
        hint: 'Overrides FRONTEND_URL only for the X callback if using a custom tunnel.',
      },
    ],
  },
  linkedin: {
    authType: 'OAuth 2.0',
    portalName: 'LinkedIn Developers',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    steps: [
      'Go to linkedin.com/developers/apps and click Create app (link a LinkedIn Page).',
      'Open the Products tab and request Share on LinkedIn and Sign In with LinkedIn using OpenID Connect.',
      'Open the Auth tab and add the exact Authorized redirect URL shown below under OAuth 2.0 settings.',
      'Copy your Client ID and Primary Client Secret from Application credentials into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'LINKEDIN_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. 772iajvf05ncmu',
      },
      {
        envKey: 'LINKEDIN_CLIENT_SECRET',
        label: 'Primary Client Secret',
        type: 'password',
        required: true,
        placeholder: 'e.g. WPL_AP1...',
      },
    ],
  },
  'linkedin-page': {
    authType: 'OAuth 2.0',
    portalName: 'LinkedIn Developers',
    portalUrl: 'https://www.linkedin.com/developers/apps',
    steps: [
      'Open your app in linkedin.com/developers/apps and verify your Company Page in the Settings tab.',
      'In the Products tab, enable Share on LinkedIn, Sign In with OpenID Connect, and Advertising API (or Community Management API).',
      'In the Auth tab, register the exact Authorized redirect URL below (/integrations/social/linkedin-page).',
      'Enter your Client ID and Primary Client Secret below.',
    ],
    note: 'Publishing to Company Pages requires organization scopes (w_organization_social, r_organization_social).',
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'LINKEDIN_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. 772iajvf05ncmu',
      },
      {
        envKey: 'LINKEDIN_CLIENT_SECRET',
        label: 'Primary Client Secret',
        type: 'password',
        required: true,
        placeholder: 'e.g. WPL_AP1...',
      },
    ],
  },
  reddit: {
    authType: 'OAuth 2.0',
    portalName: 'Reddit App Preferences',
    portalUrl: 'https://www.reddit.com/prefs/apps',
    steps: [
      'Open reddit.com/prefs/apps, scroll to the bottom, and click "create another app...".',
      'Select the "web app" radio button (do not choose script or installed app).',
      'Paste the exact Redirect URI shown below into the redirect uri field and click create app.',
      'Copy the Client ID (14-character code under "web app") and the secret into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'REDDIT_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: '14-character Reddit web app ID',
      },
      {
        envKey: 'REDDIT_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Reddit app secret',
      },
    ],
  },
  instagram: {
    authType: 'OAuth 2.0 (Meta Business)',
    portalName: 'Meta for Developers',
    portalUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Create a Business app at developers.facebook.com/apps and add Facebook Login for Business.',
      'Link your Instagram Professional (Creator/Business) account to a Facebook Page you manage.',
      'Under Facebook Login for Business -> Settings, add the Valid OAuth Redirect URI shown below.',
      'Open App settings -> Basic and copy your main Meta App ID and App Secret below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'FACEBOOK_APP_ID',
        label: 'Meta App ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Facebook / Meta App ID',
      },
      {
        envKey: 'FACEBOOK_APP_SECRET',
        label: 'Meta App Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Facebook / Meta App Secret',
      },
    ],
  },
  'instagram-standalone': {
    authType: 'OAuth 2.0 (Instagram Login)',
    portalName: 'Meta for Developers',
    portalUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Open your Meta app at developers.facebook.com/apps and add the Instagram product.',
      'Navigate to Instagram -> API setup with Instagram business login and click Set up.',
      'Paste the exact OAuth Redirect URI shown below into Business login settings.',
      'Copy the dedicated Instagram App ID and Instagram App Secret from the Instagram API setup page.',
    ],
    note: 'Use the sub-App ID inside Products -> Instagram -> API setup, not the top-level Facebook App ID.',
    httpsRedirectProxy: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'INSTAGRAM_APP_ID',
        label: 'Instagram App ID',
        type: 'text',
        required: true,
        placeholder: 'Dedicated Instagram App ID',
      },
      {
        envKey: 'INSTAGRAM_APP_SECRET',
        label: 'Instagram App Secret',
        type: 'password',
        required: true,
        placeholder: 'Dedicated Instagram App Secret',
      },
    ],
  },
  facebook: {
    authType: 'OAuth 2.0',
    portalName: 'Meta for Developers',
    portalUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Open developers.facebook.com/apps, create a Business app, and add Facebook Login for Business.',
      'Enable permissions: pages_show_list, pages_manage_posts, pages_read_engagement, and read_insights.',
      'Under Facebook Login for Business -> Settings, add the Valid OAuth Redirect URI shown below.',
      'Go to App settings -> Basic and copy your App ID and App Secret below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'FACEBOOK_APP_ID',
        label: 'Facebook App ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Facebook App ID',
      },
      {
        envKey: 'FACEBOOK_APP_SECRET',
        label: 'Facebook App Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Facebook App Secret',
      },
    ],
  },
  threads: {
    authType: 'OAuth 2.0',
    portalName: 'Meta for Developers (Threads)',
    portalUrl: 'https://developers.facebook.com/apps',
    steps: [
      'Create an app at developers.facebook.com/apps and choose the "Access the Threads API" use case.',
      'Enable threads_basic, threads_content_publish, and threads_manage_insights; add your account under App Roles -> Threads Testers.',
      'Open Use cases -> Access the Threads API -> Settings and paste the Redirect Callback URL below.',
      'Copy the dedicated Threads App ID and Threads App Secret from that Threads Settings screen.',
    ],
    note: 'Accept the tester invite in Threads -> Settings -> Account -> Website permissions -> Invites before connecting.',
    httpsRedirectProxy: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'THREADS_APP_ID',
        label: 'Threads App ID',
        type: 'text',
        required: true,
        placeholder: 'Dedicated Threads App ID',
      },
      {
        envKey: 'THREADS_APP_SECRET',
        label: 'Threads App Secret',
        type: 'password',
        required: true,
        placeholder: 'Dedicated Threads App Secret',
      },
    ],
  },
  youtube: {
    authType: 'OAuth 2.0',
    portalName: 'Google Cloud Console',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    steps: [
      'In Google Cloud Console, enable YouTube Data API v3 and YouTube Analytics API.',
      'Configure the OAuth consent screen (add your Google email under Test users while in Testing status).',
      'Go to Credentials -> Create Credentials -> OAuth client ID (Web application) and add the Redirect URI below.',
      'Copy the generated Client ID and Client Secret into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'YOUTUBE_CLIENT_ID',
        label: 'Google OAuth Client ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. 123456789-abc.apps.googleusercontent.com',
      },
      {
        envKey: 'YOUTUBE_CLIENT_SECRET',
        label: 'Google OAuth Client Secret',
        type: 'password',
        required: true,
        placeholder: 'e.g. GOCSPX-...',
      },
    ],
  },
  gmb: {
    authType: 'OAuth 2.0',
    portalName: 'Google Cloud Console',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    steps: [
      'In Google Cloud Console, request access to and enable My Business Business Information API and Account Management API.',
      'Open Credentials -> Create Credentials -> OAuth client ID (Web application).',
      'Add the exact Authorized redirect URI shown below (/integrations/social/gmb).',
      'Paste the Client ID and Client Secret below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'GOOGLE_GMB_CLIENT_ID',
        label: 'Google GMB Client ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. 123456789-abc.apps.googleusercontent.com',
        hint: 'Falls back to YOUTUBE_CLIENT_ID on the server if shared.',
      },
      {
        envKey: 'GOOGLE_GMB_CLIENT_SECRET',
        label: 'Google GMB Client Secret',
        type: 'password',
        required: true,
        placeholder: 'e.g. GOCSPX-...',
      },
    ],
  },
  tiktok: {
    authType: 'OAuth 2.0 (Login Kit)',
    portalName: 'TikTok for Developers',
    portalUrl: 'https://developers.tiktok.com/apps',
    steps: [
      'Open developers.tiktok.com/apps, create an app (or Sandbox), and enable the Web platform.',
      'Add Login Kit and Content Posting API (enable Direct Post) with scopes user.info.basic, video.publish, video.upload, and video.list.',
      'Paste the exact Redirect URI below under Login Kit settings.',
      'Copy the alphanumeric Client Key (not numeric App ID) and Client Secret into the fields below.',
    ],
    httpsRedirectProxy: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'TIKTOK_CLIENT_ID',
        label: 'Client Key',
        type: 'text',
        required: true,
        placeholder: 'Alphanumeric TikTok Client Key',
      },
      {
        envKey: 'TIKTOK_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter TikTok Client Secret',
      },
    ],
  },
  'tiktok-business': {
    authType: 'OAuth 2.0 (Business API)',
    portalName: 'TikTok Business API Portal',
    portalUrl: 'https://business-api.tiktok.com/portal/apps',
    steps: [
      'Open business-api.tiktok.com/portal/apps and create or select your Business App.',
      'Enable Business Account management, organic publishing, and video insights scopes.',
      'Paste the exact Redirect URI below — make sure to keep the trailing slash (/).',
      'Copy your TikTok Business App / Client ID and Secret into the fields below.',
    ],
    note: 'The TikTok Business callback URI must include the trailing slash (/integrations/social/tiktok-business/).',
    httpsRedirectProxy: true,
    trailingSlash: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'TIKTOK_BUSINESS_CLIENT_ID',
        label: 'Business Client / App ID',
        type: 'text',
        required: true,
        placeholder: 'Enter TikTok Business Client ID',
      },
      {
        envKey: 'TIKTOK_BUSINESS_CLIENT_SECRET',
        label: 'Business Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter TikTok Business Secret',
      },
    ],
  },
  pinterest: {
    authType: 'OAuth 2.0',
    portalName: 'Pinterest Developers',
    portalUrl: 'https://developers.pinterest.com/apps/',
    steps: [
      'Sign in at developers.pinterest.com/apps/ with a Pinterest Business account and click Connect app.',
      'Request API v5 access (boards:read, boards:write, pins:read, pins:write, user_accounts:read).',
      'Add the exact Redirect URI shown below under Redirect URIs and save.',
      'Copy your App ID and App secret key into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'PINTEREST_CLIENT_ID',
        label: 'App ID (Client ID)',
        type: 'text',
        required: true,
        placeholder: 'Numeric Pinterest App ID',
      },
      {
        envKey: 'PINTEREST_CLIENT_SECRET',
        label: 'App Secret Key',
        type: 'password',
        required: true,
        placeholder: 'Enter Pinterest App Secret',
      },
    ],
  },
  dribbble: {
    authType: 'OAuth 2.0',
    portalName: 'Dribbble Applications',
    portalUrl: 'https://dribbble.com/account/applications/new',
    steps: [
      'Open dribbble.com/account/applications/new to register a new OAuth application.',
      'Enter Application Name, Description, Website URL, and paste the Callback URL shown below.',
      'Click Register application to generate your keys.',
      'Copy Client ID and Client Secret into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'DRIBBBLE_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Dribbble Client ID',
      },
      {
        envKey: 'DRIBBBLE_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Dribbble Client Secret',
      },
    ],
  },
  discord: {
    authType: 'OAuth 2.0 + Bot Token',
    portalName: 'Discord Developer Portal',
    portalUrl: 'https://discord.com/developers/applications',
    steps: [
      'Go to discord.com/developers/applications and click New Application.',
      'Open OAuth2, add the exact Redirect URL below, and copy Client ID & Client Secret.',
      'Open the Bot tab, click Reset Token to copy your Bot Token, and enable Send Messages + Attach Files.',
      'Enter all three credentials below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'DISCORD_CLIENT_ID',
        label: 'Client ID (Application ID)',
        type: 'text',
        required: true,
        placeholder: 'Enter Discord Application / Client ID',
      },
      {
        envKey: 'DISCORD_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Discord OAuth2 Client Secret',
      },
      {
        envKey: 'DISCORD_BOT_TOKEN_ID',
        label: 'Bot Token',
        type: 'password',
        required: true,
        placeholder: 'Enter Discord Bot Token',
      },
    ],
  },
  slack: {
    authType: 'OAuth 2.0',
    portalName: 'Slack API Apps',
    portalUrl: 'https://api.slack.com/apps',
    steps: [
      'Open api.slack.com/apps, click Create New App -> From scratch, and choose your workspace.',
      'Under OAuth & Permissions, add the Redirect URL below and Bot Token Scopes (channels:read, chat:write, chat:write.public, files:write, users:read).',
      'Open Basic Information -> App Credentials.',
      'Copy Client ID, Client Secret, and Signing Secret into the fields below.',
    ],
    httpsRedirectProxy: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'SLACK_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Slack Client ID',
      },
      {
        envKey: 'SLACK_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Slack Client Secret',
      },
      {
        envKey: 'SLACK_SIGNING_SECRET',
        label: 'Signing Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Slack Signing Secret',
      },
    ],
  },
  kick: {
    authType: 'OAuth 2.1 + PKCE',
    portalName: 'Kick Developer Settings',
    portalUrl: 'https://kick.com/settings/developer',
    steps: [
      'Log in to Kick (with 2FA enabled) and open kick.com/settings/developer.',
      'Create a new Developer App and select scopes user:read, channel:read, and chat:write.',
      'Paste the exact Redirect URI shown below.',
      'Copy your Client ID and Client Secret into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'KICK_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Kick Client ID',
      },
      {
        envKey: 'KICK_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Kick Client Secret',
      },
    ],
  },
  twitch: {
    authType: 'OAuth 2.0',
    portalName: 'Twitch Developer Console',
    portalUrl: 'https://dev.twitch.tv/console/apps',
    steps: [
      'Open dev.twitch.tv/console/apps and click Register Your Application.',
      'Add the exact OAuth Redirect URL below and set Category to Application Integration (Confidential).',
      'Click Manage on your app and click New Secret.',
      'Copy your Client ID and Client Secret into the fields below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'TWITCH_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Twitch Client ID',
      },
      {
        envKey: 'TWITCH_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Twitch Client Secret',
      },
    ],
  },
  mastodon: {
    authType: 'Dynamic Instance OAuth 2.0',
    portalName: 'Mastodon Development Settings',
    portalUrl: 'https://mastodon.social/settings/applications',
    steps: [
      'Enter your Mastodon Instance URL below (e.g. https://mastodon.social or your custom server).',
      'Postiz can dynamically register an OAuth application on your instance during connection.',
      'If configuring static instance keys in .env, open Preferences -> Development -> New application and paste the Redirect URI below.',
      'Copy Client key and Client secret if using static .env credentials, or connect directly with your Instance URL.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'MASTODON_URL',
        label: 'Instance URL',
        type: 'text',
        required: true,
        defaultValue: 'https://mastodon.social',
        placeholder: 'https://mastodon.social',
      },
      {
        envKey: 'MASTODON_CLIENT_ID',
        label: 'Client Key (Optional for dynamic instances)',
        type: 'text',
        required: false,
        placeholder: 'Auto-created per instance if omitted',
      },
      {
        envKey: 'MASTODON_CLIENT_SECRET',
        label: 'Client Secret (Optional for dynamic instances)',
        type: 'password',
        required: false,
        placeholder: 'Auto-created per instance if omitted',
      },
    ],
  },
  bluesky: {
    authType: 'AT Protocol App Password',
    portalName: 'Bluesky App Passwords',
    portalUrl: 'https://bsky.app/settings/app-passwords',
    steps: [
      'Sign in to Bluesky and open Settings -> Privacy and security -> App passwords.',
      'Click Add App Password, name it "Postiz", and copy the generated xxxx-xxxx-xxxx-xxxx password.',
      'Enter your PDS Service URL (https://bsky.social), handle or email, and App Password below.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  lemmy: {
    authType: 'Instance Credentials',
    portalName: 'Lemmy Instances Directory',
    portalUrl: 'https://join-lemmy.org/instances',
    steps: [
      'Locate your Lemmy instance base URL including https:// (e.g. https://lemmy.world).',
      'Enter your Lemmy username (or email) and account password below.',
      'Click Connect to authenticate directly against your Lemmy server API.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  wrapcast: {
    authType: 'Neynar SIWN / Signer',
    portalName: 'Neynar Developer Portal',
    portalUrl: 'https://dev.neynar.com/',
    steps: [
      'Sign in at dev.neynar.com and create or select your Farcaster application.',
      'Register your Postiz origin / Redirect URI below under Sign In With Neynar (SIWN) settings.',
      'Configure NEYNAR_CLIENT_ID and NEYNAR_SECRET_KEY (plus optional App FID & Mnemonic).',
      'Click Continue below to launch the Farcaster / Warpcast signer approval flow.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'NEYNAR_CLIENT_ID',
        label: 'Neynar Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Neynar SIWN Client ID',
      },
      {
        envKey: 'NEYNAR_SECRET_KEY',
        label: 'Neynar Secret / API Key',
        type: 'password',
        required: true,
        placeholder: 'Enter Neynar Secret Key',
      },
      {
        envKey: 'NEYNAR_APP_FID',
        label: 'App FID (Optional)',
        type: 'text',
        required: false,
        placeholder: 'Farcaster ID representing your app',
      },
      {
        envKey: 'NEYNAR_APP_MNEMONIC',
        label: 'Custody Wallet Mnemonic (Optional)',
        type: 'password',
        required: false,
        placeholder: 'Recovery phrase for managed signers',
      },
    ],
  },
  telegram: {
    authType: 'Telegram Bot API',
    portalName: 'Telegram @BotFather',
    portalUrl: 'https://t.me/BotFather',
    steps: [
      'Open Telegram, chat with @BotFather (t.me/BotFather), and send /newbot.',
      'Copy the HTTP API Bot Token (TELEGRAM_TOKEN) and Bot Username without @ (TELEGRAM_BOT_NAME).',
      'Add your bot as an Administrator (with Post Messages permission) in your Telegram Channel or Group.',
      'Click Continue below to get the /connect command and link your chat.',
    ],
    portalUsesRedirectUri: false,
    envFields: [
      {
        envKey: 'TELEGRAM_TOKEN',
        label: 'Bot HTTP API Token',
        type: 'password',
        required: true,
        placeholder: 'e.g. 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
      },
      {
        envKey: 'TELEGRAM_BOT_NAME',
        label: 'Bot Username (without @)',
        type: 'text',
        required: true,
        placeholder: 'e.g. my_postiz_bot',
      },
    ],
  },
  nostr: {
    authType: 'Schnorr Hex Private Key',
    portalName: 'Nostr Key Guide',
    portalUrl: 'https://nostr.com/',
    steps: [
      'Export your private key from your Nostr client (Damus, Primal, Amethyst, Alby, or iris.to).',
      'Ensure the key is in 64-character hexadecimal format (convert from nsec1... if necessary).',
      'Paste your hex private key below and click Connect.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  vk: {
    authType: 'VK ID OAuth 2.1 + PKCE',
    portalName: 'VK ID Business Console',
    portalUrl: 'https://id.vk.com/about/business/go',
    steps: [
      'Open id.vk.com/about/business/go and create a Web application.',
      'Configure your base domain and paste the exact Trusted Redirect URL shown below.',
      'Enable permissions for wall, photos, video, docs, and groups.',
      'Copy your numeric VK App ID into the field below.',
    ],
    httpsRedirectProxy: true,
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'VK_ID',
        label: 'VK App ID',
        type: 'text',
        required: true,
        placeholder: 'Numeric VK Application ID',
      },
    ],
  },
  medium: {
    authType: 'Integration Token',
    portalName: 'Medium Security Settings',
    portalUrl: 'https://medium.com/me/settings/security',
    steps: [
      'Open medium.com/me/settings/security while signed in to Medium.',
      'Select Integration tokens, enter "Postiz" as the description, and click Get token.',
      'Paste the Integration Token into the API Key field below and click Connect.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  devto: {
    authType: 'API Key',
    portalName: 'DEV Community Extensions',
    portalUrl: 'https://dev.to/settings/extensions',
    steps: [
      'Sign in to dev.to and open Settings -> Extensions (dev.to/settings/extensions).',
      'Scroll to DEV Community API Keys, enter a description, and click Generate API Key.',
      'Paste the generated key below and click Connect.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  hashnode: {
    authType: 'Personal Access Token',
    portalName: 'Hashnode Developer Settings',
    portalUrl: 'https://hashnode.com/settings/developer',
    steps: [
      'Sign in to Hashnode and open hashnode.com/settings/developer.',
      'Click Generate New Token to create a Personal Access Token.',
      'Paste the token into the API Key field below and click Connect.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  wordpress: {
    authType: 'WP Application Password',
    portalName: 'WordPress Application Passwords Guide',
    portalUrl:
      'https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/',
    steps: [
      'Log in to your WordPress Admin (/wp-admin) and navigate to Users -> Profile.',
      'Scroll to Application Passwords, enter "Postiz", and click Add New Application Password.',
      'Enter your site Domain URL, WordPress Username, and generated Application Password below.',
    ],
    note: 'Use the generated 24-character Application Password, not your regular WordPress login password.',
    portalUsesRedirectUri: false,
    envFields: [],
  },
  listmonk: {
    authType: 'Admin / API User Credentials',
    portalName: 'Listmonk API Docs',
    portalUrl: 'https://listmonk.app/docs/apis/apis/',
    steps: [
      'Open your Listmonk dashboard and navigate to Admin -> Users.',
      'Create an API user with campaigns & lists permissions and copy its token (or use admin credentials).',
      'Enter your Listmonk instance URL, username, and API token/password below.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
    customFieldEnvAliases: {
      url: 'LISTMONK_DOMAIN',
      username: 'LISTMONK_USER',
      password: 'LISTMONK_API_KEY',
    },
  },
  moltbook: {
    authType: 'Agent Registration / API Key',
    portalName: 'Moltbook',
    portalUrl: 'https://www.moltbook.com',
    steps: [
      'Click Continue below to open the Moltbook Agent setup wizard.',
      'Register a new agent (Name & Description) or paste an existing moltbook_... API key.',
      'Open the generated Claim URL on moltbook.com to verify agent ownership and complete setup.',
    ],
    portalUsesRedirectUri: false,
    envFields: [],
  },
  whop: {
    authType: 'OAuth 2.0 + PKCE',
    portalName: 'Whop Developer Dashboard',
    portalUrl: 'https://whop.com/dashboard/developer/',
    steps: [
      'Open whop.com/dashboard/developer/ and create or select an App.',
      'In OAuth settings, add the exact Redirect URI below and enable openid, profile, company:basic:read, forum:read, and forum:post:create.',
      'Copy your Whop Client / App ID into the field below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'WHOP_CLIENT_ID',
        label: 'Whop Client ID',
        type: 'text',
        required: true,
        placeholder: 'Enter Whop App / Client ID',
      },
    ],
  },
  skool: {
    authType: 'Postiz Browser Extension',
    portalName: 'Postiz Chrome Extension',
    portalUrl:
      'https://chromewebstore.google.com/detail/postiz/cidhffagahknaeodkplfbcpfeielnkjl?hl=en',
    steps: [
      'Install the Postiz Chrome Extension (or load apps/extension/dist unpacked in chrome://extensions).',
      'Copy the 32-character Extension ID from chrome://extensions into EXTENSION_ID below.',
      'Log in to skool.com in this browser, then click Continue to sync your session.',
    ],
    portalUsesRedirectUri: false,
    envFields: [
      {
        envKey: 'EXTENSION_ID',
        label: 'Chrome Extension ID',
        type: 'text',
        required: true,
        placeholder: 'e.g. cidhffagahknaeodkplfbcpfeielnkjl',
      },
    ],
  },
  mewe: {
    authType: 'OAuth 2.0 + API Key',
    portalName: 'MeWe Developers',
    portalUrl: 'https://mewe.com',
    steps: [
      'Register your application with MeWe developer support / portal.',
      'Configure the exact OAuth Redirect URI shown below.',
      'Enter your MeWe App ID, API Key, and optional Host URL below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'MEWE_APP_ID',
        label: 'MeWe App ID',
        type: 'text',
        required: true,
        placeholder: 'Enter MeWe App ID',
      },
      {
        envKey: 'MEWE_API_KEY',
        label: 'MeWe API Key',
        type: 'password',
        required: true,
        placeholder: 'Enter MeWe API Key',
      },
      {
        envKey: 'MEWE_HOST',
        label: 'MeWe Host URL (Optional)',
        type: 'text',
        required: false,
        defaultValue: 'https://mewe.com',
        placeholder: 'https://mewe.com',
      },
    ],
  },
  tumblr: {
    authType: 'OAuth 2.0',
    portalName: 'Tumblr OAuth Apps',
    portalUrl: 'https://www.tumblr.com/oauth/apps',
    steps: [
      'Go to tumblr.com/oauth/apps and click "+ Register application".',
      'Fill in Application Name, Website, and paste the Default callback URL / OAuth2 redirect URL below.',
      'Save the application to generate your keys.',
      'Copy OAuth Consumer Key (TUMBLR_CLIENT_ID) and Secret Key (TUMBLR_CLIENT_SECRET) below.',
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: 'TUMBLR_CLIENT_ID',
        label: 'OAuth Consumer Key (Client ID)',
        type: 'text',
        required: true,
        placeholder: 'Enter Tumblr OAuth Consumer Key',
      },
      {
        envKey: 'TUMBLR_CLIENT_SECRET',
        label: 'Secret Key (Client Secret)',
        type: 'password',
        required: true,
        placeholder: 'Enter Tumblr Secret Key',
      },
    ],
  },
};

const getPlatformSpec = (identifier: string, name: string): PlatformCredentialSpec => {
  if (PLATFORM_CREDENTIAL_SPECS[identifier]) {
    return PLATFORM_CREDENTIAL_SPECS[identifier];
  }
  const prefix = identifier.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return {
    authType: 'OAuth 2.0',
    portalName: `${name} Developer Portal`,
    portalUrl: 'https://docs.postiz.com/providers',
    steps: [
      `Create an application in the ${name} developer console.`,
      `Add the exact Redirect URI shown below to your ${name} OAuth callback settings.`,
      `Copy your Client ID and Client Secret into the fields below and click Connect.`,
    ],
    portalUsesRedirectUri: true,
    envFields: [
      {
        envKey: `${prefix}_CLIENT_ID`,
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: `Enter ${name} Client ID`,
      },
      {
        envKey: `${prefix}_CLIENT_SECRET`,
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: `Enter ${name} Client Secret`,
      },
    ],
  };
};

const isChannelConfiguredInEnv = (
  identifier: string,
  socialEnvConfig?: Record<string, SocialEnvVarStatus>
): boolean => {
  const spec = PLATFORM_CREDENTIAL_SPECS[identifier];
  if (!spec || !socialEnvConfig) return false;
  const requiredFields = spec.envFields.filter((f) => f.required);
  if (requiredFields.length === 0) return false;
  return requiredFields.every((f) => socialEnvConfig[f.envKey]?.configured);
};

const ChannelCredentialModal: FC<{
  item: {
    identifier: string;
    name: string;
    toolTip?: string;
    isExternal: boolean;
    isWeb3: boolean;
    isChromeExtension?: boolean;
    customFields?: Array<{
      key: string;
      label: string;
      validation: string;
      defaultValue?: string;
      type: 'text' | 'password';
      hint?: string;
    }>;
  };
  invite: boolean;
  onBack: () => void;
  onProceedOAuth: (params: {
    externalUrl?: string;
    extensionIdOverride?: string;
    credentials: Record<string, string>;
  }) => Promise<void>;
  onProceedCustomFields: (data: Record<string, string>) => Promise<void>;
}> = ({ item, invite, onBack, onProceedOAuth, onProceedCustomFields }) => {
  const { frontEndUrl, extensionId, socialEnvConfig } = useVariables();
  const toaster = useToaster();
  const t = useT();
  const spec = useMemo(
    () => getPlatformSpec(item.identifier, item.name),
    [item.identifier, item.name]
  );

  const storageKey = `postiz_channel_creds_${item.identifier}`;

  const initialValues = useMemo(() => {
    let saved: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) saved = JSON.parse(raw);
      } catch {
        // Ignore storage read errors
      }
    }

    const base: Record<string, string> = {};
    if (item.customFields?.length) {
      for (const field of item.customFields) {
        const aliasKey = spec.customFieldEnvAliases?.[field.key];
        const envVal = aliasKey ? socialEnvConfig?.[aliasKey]?.value : '';
        base[field.key] =
          saved[field.key] ?? envVal ?? field.defaultValue ?? '';
      }
    } else {
      for (const field of spec.envFields) {
        const envVal =
          field.envKey === 'EXTENSION_ID'
            ? socialEnvConfig?.EXTENSION_ID?.value || extensionId || ''
            : socialEnvConfig?.[field.envKey]?.value || '';
        base[field.envKey] =
          saved[field.envKey] ?? envVal ?? field.defaultValue ?? '';
      }
    }
    return base;
  }, [item.customFields, spec, socialEnvConfig, extensionId, storageKey]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedUri, setCopiedUri] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const resolvedOrigin = useMemo(() => {
    const base =
      frontEndUrl ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:4007');
    return base.replace(/\/+$/, '');
  }, [frontEndUrl]);

  const redirectUri = useMemo(() => {
    const customBase = spec.customBaseUrlEnvKey
      ? values[spec.customBaseUrlEnvKey]?.trim().replace(/\/+$/, '')
      : '';
    const effectiveBase = customBase || resolvedOrigin;
    const isHttps = effectiveBase.startsWith('https://');
    const prefix =
      spec.httpsRedirectProxy && !isHttps ? 'https://redirectmeto.com/' : '';
    const suffix = spec.trailingSlash ? '/' : '';
    return `${prefix}${effectiveBase}/integrations/social/${item.identifier}${suffix}`;
  }, [spec, values, resolvedOrigin, item.identifier]);

  const allEnvAlreadyConfigured = useMemo(
    () => isChannelConfiguredInEnv(item.identifier, socialEnvConfig),
    [item.identifier, socialEnvConfig]
  );

  const handleFieldChange = (key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      if (typeof window !== 'undefined') {
        try {
          const nonSecretToPersist: Record<string, string> = {};
          for (const [k, v] of Object.entries(next)) {
            const isSecret =
              item.customFields?.find((f) => f.key === k)?.type ===
                'password' ||
              spec.envFields.find((f) => f.envKey === k)?.type === 'password';
            if (!isSecret && v) {
              nonSecretToPersist[k] = v;
            }
          }
          window.localStorage.setItem(
            storageKey,
            JSON.stringify(nonSecretToPersist)
          );
        } catch {
          // Ignore storage write errors
        }
      }
      return next;
    });
    if (errors[key]) {
      setErrors((prev) => {
        const copyErr = { ...prev };
        delete copyErr[key];
        return copyErr;
      });
    }
  };

  const handleCopyRedirectUri = () => {
    copy(redirectUri);
    setCopiedUri(true);
    toaster.show('Redirect URI copied to clipboard', 'success');
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleCopyEnvSnippet = () => {
    const lines = spec.envFields
      .map((f) => `${f.envKey}="${(values[f.envKey] || '').trim()}"`)
      .join('\n');
    if (!lines) return;
    copy(lines);
    setCopiedEnv(true);
    toaster.show('.env variables copied to clipboard', 'success');
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const validateForm = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (item.customFields?.length) {
      for (const field of item.customFields) {
        const val = (values[field.key] || '').trim();
        if (!val) {
          nextErrors[field.key] = `${field.label} is required`;
          continue;
        }
        try {
          const splitter = field.validation.split('/');
          const flags = splitter.pop() || '';
          const pattern = splitter.slice(1).join('/');
          const regex = new RegExp(pattern, flags);
          if (!regex.test(val)) {
            nextErrors[field.key] = `${field.label} format is invalid`;
          }
        } catch {
          // Skip malformed regex
        }
      }
    } else {
      for (const field of spec.envFields) {
        const val = (values[field.envKey] || '').trim();
        const isConfiguredServerSide =
          !!socialEnvConfig?.[field.envKey]?.configured;
        if (field.required && !val && !isConfiguredServerSide) {
          nextErrors[field.envKey] = `${field.label} (${field.envKey}) is required`;
        }
        if (
          field.envKey === 'MASTODON_URL' &&
          val &&
          !/^https?:\/\/.+/i.test(val)
        ) {
          nextErrors[field.envKey] =
            'Enter a valid URL starting with https:// or http://';
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (item.customFields?.length) {
        const trimmedData = Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, (v || '').trim()])
        );
        await onProceedCustomFields(trimmedData);
        return;
      }

      const externalUrl = item.isExternal
        ? (values.MASTODON_URL || 'https://mastodon.social').trim()
        : undefined;
      const extensionIdOverride = item.isChromeExtension
        ? (values.EXTENSION_ID || extensionId || '').trim()
        : undefined;

      await onProceedOAuth({
        externalUrl,
        extensionIdOverride,
        credentials: values,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasEnvFields = !item.customFields?.length && spec.envFields.length > 0;

  return (
    <div className="whitespace-normal flex flex-col gap-[18px] w-full max-w-[640px] text-textColor">
      {/* Channel Banner */}
      <div className="flex items-center justify-between gap-[12px] p-[14px] rounded-[12px] bg-newTableHeader border border-newTableBorder mobile:flex-col mobile:items-start">
        <div className="flex items-center gap-[12px]">
          <div className="w-[42px] h-[42px] rounded-[10px] bg-newBgColor flex items-center justify-center shrink-0 border border-newTableBorder">
            {item.identifier === 'youtube' ? (
              <img
                src="/icons/platforms/youtube.svg"
                alt={item.name}
                className="w-[26px] h-[26px]"
              />
            ) : (
              <img
                src={`/icons/platforms/${item.identifier}.png`}
                alt={item.name}
                className={clsx(
                  'w-[28px] h-[28px]',
                  item.identifier !== 'google_my_business' && 'rounded-full'
                )}
              />
            )}
          </div>
          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center gap-[8px] flex-wrap">
              <span className="text-[16px] font-[600] leading-tight">
                {item.name}
              </span>
              <span className="text-[11px] font-[500] px-[8px] py-[2px] rounded-full bg-btnSimple text-textColor/80 border border-newTableBorder">
                {spec.authType}
              </span>
              {allEnvAlreadyConfigured && (
                <span className="text-[11px] font-[600] px-[8px] py-[2px] rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  .env Configured
                </span>
              )}
            </div>
            <span className="text-[12px] text-textColor/60">
              Configure developer portal credentials & callback URL
            </span>
          </div>
        </div>
        <a
          href={spec.portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-[500] px-[12px] py-[7px] rounded-[8px] bg-btnSimple hover:bg-boxHover border border-newTableBorder text-textColor flex items-center gap-[6px] shrink-0 transition-colors"
        >
          <span>{spec.portalName}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>

      {/* Generated Redirect / Callback URI */}
      <div className="flex flex-col gap-[8px] p-[14px] rounded-[12px] bg-newBgColor border border-newTableBorder">
        <div className="flex items-center justify-between gap-[8px] flex-wrap">
          <div className="flex items-center gap-[8px]">
            <span className="text-[12px] font-[600] uppercase tracking-wider text-textColor/80">
              {spec.portalUsesRedirectUri !== false
                ? 'Redirect URI / Callback URL'
                : 'Postiz Callback Endpoint'}
            </span>
            {spec.httpsRedirectProxy && !resolvedOrigin.startsWith('https://') && (
              <span className="text-[10px] px-[6px] py-[1px] rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                HTTPS Relay Active
              </span>
            )}
          </div>
          <span className="text-[11px] text-textColor/55">
            {spec.portalUsesRedirectUri !== false
              ? 'Paste this exact URL in your developer console'
              : 'Direct API flow — external OAuth callback optional'}
          </span>
        </div>
        <div className="flex items-center gap-[8px]">
          <div className="flex-1 px-[12px] py-[9px] rounded-[8px] bg-newBgColorInner border border-newTableBorder font-mono text-[12.5px] text-textColor select-all overflow-x-auto whitespace-nowrap">
            {redirectUri}
          </div>
          <button
            type="button"
            onClick={handleCopyRedirectUri}
            className={clsx(
              'px-[12px] h-[38px] rounded-[8px] text-[12px] font-[600] flex items-center gap-[6px] shrink-0 border transition-all cursor-pointer',
              copiedUri
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-btnSimple hover:bg-boxHover text-textColor border-newTableBorder'
            )}
          >
            {copiedUri ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <rect
                    x="5.5"
                    y="5.5"
                    width="8"
                    height="8"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M10.5 5.5V3.5C10.5 2.94772 10.0523 2.5 9.5 2.5H3.5C2.94772 2.5 2.5 2.94772 2.5 3.5V9.5C2.5 10.0523 2.94772 10.5 3.5 10.5H5.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
                <span>Copy URI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step-by-Step Instructions */}
      <div className="flex flex-col gap-[10px] p-[14px] rounded-[12px] bg-newTableHeader/70 border border-newTableBorder">
        <div className="text-[12px] font-[600] uppercase tracking-wider text-textColor/80">
          Step-by-Step Setup Instructions
        </div>
        <ol className="flex flex-col gap-[8px] m-0 p-0 list-none">
          {spec.steps.map((step, idx) => (
            <li
              key={idx}
              className="flex items-start gap-[10px] text-[13px] leading-[1.5] text-textColor/85"
            >
              <span className="w-[20px] h-[20px] rounded-full bg-btnPrimary/20 text-textColor border border-btnPrimary/40 text-[11px] font-[600] flex items-center justify-center shrink-0 mt-[1px]">
                {idx + 1}
              </span>
              <span className="flex-1">{step}</span>
            </li>
          ))}
        </ol>
        {(spec.note || item.toolTip) && (
          <div className="mt-[2px] px-[10px] py-[8px] rounded-[8px] bg-amber-500/10 border border-amber-500/25 text-[12px] text-amber-300 leading-[1.45]">
            <strong className="font-[600]">Important: </strong>
            {spec.note || item.toolTip}
          </div>
        )}
      </div>

      {/* Credential Inputs Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
        {item.customFields?.length ? (
          <div className="flex flex-col gap-[12px]">
            <div className="text-[12px] font-[600] uppercase tracking-wider text-textColor/80">
              Channel Credentials
            </div>
            {item.customFields.map((field) => {
              const aliasEnvKey = spec.customFieldEnvAliases?.[field.key];
              const isPassword = field.type === 'password';
              const showPlain = !!revealed[field.key];
              return (
                <div key={field.key} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <label className="text-[13px] font-[500] text-textColor flex items-center gap-[6px]">
                      <span>{field.label}</span>
                      <span className="text-red-400">*</span>
                      {field.hint && (
                        <span
                          data-tooltip-id="tooltip"
                          data-tooltip-content={field.hint}
                          className="w-[15px] h-[15px] rounded-full border border-textColor/50 text-textColor/60 inline-flex items-center justify-center text-[10px] cursor-help"
                        >
                          i
                        </span>
                      )}
                    </label>
                    {aliasEnvKey && (
                      <code className="text-[11px] px-[6px] py-[1px] rounded bg-newBgColor border border-newTableBorder text-textColor/70 font-mono">
                        {aliasEnvKey}
                      </code>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={isPassword && !showPlain ? 'password' : 'text'}
                      value={values[field.key] || ''}
                      onChange={(e) =>
                        handleFieldChange(field.key, e.target.value)
                      }
                      placeholder={`Enter ${field.label}`}
                      className={clsx(
                        'w-full h-[42px] px-[14px] rounded-[8px] bg-input border text-[13.5px] text-textColor placeholder-textColor/40 transition-colors',
                        isPassword && 'pe-[64px]',
                        errors[field.key]
                          ? 'border-red-500'
                          : 'border-newTableBorder focus:border-btnPrimary'
                      )}
                    />
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((r) => ({
                            ...r,
                            [field.key]: !r[field.key],
                          }))
                        }
                        className="absolute end-[10px] px-[8px] py-[4px] text-[11px] rounded bg-btnSimple text-textColor/75 hover:text-textColor cursor-pointer"
                      >
                        {showPlain ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                  {errors[field.key] && (
                    <span className="text-[12px] text-red-400">
                      {errors[field.key]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : hasEnvFields ? (
          <div className="flex flex-col gap-[12px]">
            <div className="flex items-center justify-between gap-[8px]">
              <span className="text-[12px] font-[600] uppercase tracking-wider text-textColor/80">
                Environment Authentication Variables
              </span>
              <button
                type="button"
                onClick={handleCopyEnvSnippet}
                className="text-[11px] font-[500] text-textColor/70 hover:text-textColor underline cursor-pointer"
              >
                {copiedEnv ? 'Copied .env lines!' : 'Copy as .env snippet'}
              </button>
            </div>
            {spec.envFields.map((field) => {
              const envStatus = socialEnvConfig?.[field.envKey];
              const isConfigured = !!envStatus?.configured;
              const isPassword = field.type === 'password';
              const showPlain = !!revealed[field.envKey];
              return (
                <div key={field.envKey} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between gap-[8px] flex-wrap">
                    <label className="text-[13px] font-[500] text-textColor flex items-center gap-[6px]">
                      <span>{field.label}</span>
                      {field.required && !isConfigured && (
                        <span className="text-red-400">*</span>
                      )}
                      {field.hint && (
                        <span
                          data-tooltip-id="tooltip"
                          data-tooltip-content={field.hint}
                          className="w-[15px] h-[15px] rounded-full border border-textColor/50 text-textColor/60 inline-flex items-center justify-center text-[10px] cursor-help"
                        >
                          i
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-[6px]">
                      {isConfigured && (
                        <span className="text-[10.5px] font-[600] px-[6px] py-[1px] rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Loaded from .env
                        </span>
                      )}
                      <code
                        onClick={() => {
                          copy(field.envKey);
                          toaster.show(`Copied ${field.envKey}`, 'success');
                        }}
                        title="Click to copy variable name"
                        className="text-[11px] px-[6px] py-[1px] rounded bg-newBgColor border border-newTableBorder text-textColor/75 font-mono cursor-pointer hover:border-btnPrimary"
                      >
                        {field.envKey}
                      </code>
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type={isPassword && !showPlain ? 'password' : 'text'}
                      value={values[field.envKey] || ''}
                      onChange={(e) =>
                        handleFieldChange(field.envKey, e.target.value)
                      }
                      placeholder={
                        isConfigured && envStatus?.masked
                          ? `Configured in .env (${envStatus.masked})`
                          : field.placeholder || `Enter ${field.envKey}`
                      }
                      className={clsx(
                        'w-full h-[42px] px-[14px] rounded-[8px] bg-input border text-[13.5px] text-textColor placeholder-textColor/45 transition-colors',
                        isPassword && 'pe-[64px]',
                        errors[field.envKey]
                          ? 'border-red-500'
                          : 'border-newTableBorder focus:border-btnPrimary'
                      )}
                    />
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((r) => ({
                            ...r,
                            [field.envKey]: !r[field.envKey],
                          }))
                        }
                        className="absolute end-[10px] px-[8px] py-[4px] text-[11px] rounded bg-btnSimple text-textColor/75 hover:text-textColor cursor-pointer"
                      >
                        {showPlain ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                  {errors[field.envKey] && (
                    <span className="text-[12px] text-red-400">
                      {errors[field.envKey]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-[10px] pt-[6px] border-t border-newTableBorder mt-[2px]">
          <button
            type="button"
            onClick={onBack}
            className="h-[42px] px-[16px] rounded-[8px] bg-transparent hover:bg-boxHover border border-newTableBorder text-[13.5px] font-[500] text-textColor flex items-center gap-[6px] cursor-pointer transition-colors"
          >
            <span>←</span>
            <span>{t('back', 'Back')}</span>
          </button>
          <Button
            type="submit"
            disabled={submitting}
            className="min-w-[180px] h-[42px] !rounded-[8px]"
          >
            {submitting
              ? t('connecting', 'Connecting...')
              : invite
              ? t('copy_invite_link', 'Copy Invite Link')
              : item.isWeb3 || item.isChromeExtension
              ? t('continue_to_connect', `Continue to ${item.name}`)
              : t('connect_channel', `Connect ${item.name}`)}
          </Button>
        </div>
      </form>
    </div>
  );
};

export const AddProviderComponent: FC<{
  social: Array<{
    identifier: string;
    name: string;
    toolTip?: string;
    isExternal: boolean;
    isWeb3: boolean;
    isChromeExtension?: boolean;
    extensionCookies?: Array<{
      name: string;
      domain: string;
    }>;
    customFields?: Array<{
      key: string;
      label: string;
      validation: string;
      type: 'text' | 'password';
      hint?: string;
    }>;
  }>;
  article: Array<{
    identifier: string;
    name: string;
  }>;
  invite: boolean;
  update?: () => void;
  onboarding?: boolean;
  isMobile?: boolean;
}> = (props) => {
  const { update, social, article, onboarding, isMobile } = props;
  const { isGeneral, extensionId, socialEnvConfig } = useVariables();
  const toaster = useToaster();
  const router = useRouter();
  const fetch = useFetch();
  const modal = useModals();
  const t = useT();

  const getSocialLink = useCallback(
    (
        invite: boolean,
        item: {
          identifier: string;
          name: string;
          toolTip?: string;
          isExternal: boolean;
          isWeb3: boolean;
          isChromeExtension?: boolean;
          customFields?: Array<{
            key: string;
            label: string;
            validation: string;
            defaultValue?: string;
            type: 'text' | 'password';
            hint?: string;
          }>;
        }
      ) =>
      async () => {
        const {
          identifier,
          isWeb3,
          isChromeExtension,
        } = item;
        const onboardingParam = onboarding ? 'onboarding=true' : '';
        const configModalId = `channel-config-${identifier}`;

        const openWeb3 = async () => {
          const found = web3List.find((w) => w.identifier === identifier);
          if (!found) return;
          const { component: Web3Providers } = found;
          const response = await fetch(
            `/integrations/social/${identifier}${
              onboarding ? '?onboarding=true' : ''
            }`
          );
          if (response.status === 402) {
            return;
          }
          const { url, err } = await response.json();
          if (err) {
            toaster.show(
              t(
                'could_not_connect_to_platform',
                'Could not connect to the platform. Verify environment credentials.'
              ),
              'warning'
            );
            return;
          }
          modal.closeById(configModalId);
          modal.openModal({
            title: `Add ${item.name || capitalize(identifier)}`,
            withCloseButton: true,
            ...(isMobile ? { removeLayout: true, fullScreen: true } : {}),
            classNames: {
              modal: 'bg-transparent text-textColor',
            },
            children: (
              <div
                {...(isMobile ? { className: 'h-full bg-black p-[20px]' } : {})}
              >
                <Web3Providers
                  onComplete={(code, newState) => {
                    window.location.href = `/integrations/social/${identifier}?code=${encodeURIComponent(code)}&state=${newState}${
                      onboarding ? '&onboarding=true' : ''
                    }`;
                  }}
                  nonce={url}
                />
              </div>
            ),
          });
        };

        const runChromeExtensionFlow = async (effectiveExtId: string) => {
          modal.closeById(configModalId);
          const confirmed = await new Promise<boolean>((resolve) => {
            modal.openModal({
              title: t('chrome_extension_notice', 'Browser Extension Notice'),
              withCloseButton: true,
              onClose: () => resolve(false),
              children: (
                <ChromeExtensionWarning
                  onConfirm={() => resolve(true)}
                  onCancel={() => resolve(false)}
                />
              ),
            });
          });
          if (!confirmed) {
            return;
          }
          if (
            !effectiveExtId ||
            typeof chrome === 'undefined' ||
            !chrome?.runtime?.sendMessage
          ) {
            modal.openModal({
              title: t('extension_not_available_title', 'Extension Not Found'),
              withCloseButton: true,
              children: <ExtensionNotFound />,
            });
            return;
          }
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.runtime.sendMessage(
                effectiveExtId,
                { type: 'PING' },
                (response: any) => {
                  if (chrome.runtime.lastError || !response?.status) {
                    reject(new Error('Extension not reachable'));
                  } else {
                    resolve();
                  }
                }
              );
            });
          } catch {
            toaster.show(
              t(
                'extension_not_installed',
                'Postiz browser extension is not installed or not reachable.'
              ),
              'warning'
            );
            return;
          }
          try {
            const cookieResponse = await new Promise<any>((resolve, reject) => {
              chrome.runtime.sendMessage(
                effectiveExtId,
                { type: 'GET_COOKIES', provider: identifier },
                (response: any) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                }
              );
            });
            if (!cookieResponse.success) {
              toaster.show(
                cookieResponse.error ||
                  t(
                    'extension_cookies_missing',
                    'Could not get cookies. Please log in to the platform first.'
                  ),
                'warning'
              );
              return;
            }
            const response = await fetch(
              `/integrations/social/${identifier}${
                onboarding ? '?onboarding=true' : ''
              }`
            );
            if (response.status === 402) {
              return;
            }
            const { url } = await response.json();
            modal.closeAll();
            window.location.href = `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
              JSON.stringify(cookieResponse.cookies)
            ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`;
          } catch {
            toaster.show(
              t(
                'extension_communication_error',
                'Failed to communicate with the browser extension.'
              ),
              'warning'
            );
          }
        };

        const gotoIntegration = async (externalUrl?: string) => {
          const params = [
            externalUrl ? `externalUrl=${encodeURIComponent(externalUrl)}` : '',
            onboardingParam,
            isMobile
              ? `redirectUrl=${encodeURIComponent('postiz://integrations')}`
              : '',
          ]
            .filter(Boolean)
            .join('&');
          const response = await fetch(
            `/integrations/social/${identifier}${params ? `?${params}` : ''}`
          );
          if (response.status === 402) {
            return;
          }
          const { url, err } = await response.json();
          if (err) {
            toaster.show(
              t(
                'could_not_connect_to_platform',
                'Could not connect to the platform. Ensure credentials are saved in your environment and match the Redirect URI.'
              ),
              'warning'
            );
            return;
          }

          if (invite) {
            toaster.show(
              'Invite link copied to clipboard, link will be available for 1 hour',
              'success'
            );
            modal.closeAll();
            copy(url);
            return;
          }

          if (isMobile) {
            const rn = (window as any).ReactNativeWebView;
            if (rn && typeof rn.postMessage === 'function') {
              rn.postMessage(JSON.stringify({ type: 'open-external', url }));
              return;
            }
            window.open(url, '_blank');
            return;
          }

          window.location.href = url;
        };

        modal.openModal({
          id: configModalId,
          title: `Configure ${item.name}`,
          withCloseButton: true,
          top: '48px',
          maxSize: '680px',
          ...(isMobile ? { fullScreen: true } : {}),
          children: (
            <ChannelCredentialModal
              item={item}
              invite={invite}
              onBack={() => modal.closeById(configModalId)}
              onProceedCustomFields={async (data) => {
                const response = await fetch(
                  `/integrations/social/${identifier}${
                    onboarding ? '?onboarding=true' : ''
                  }`
                );
                if (response.status === 402) {
                  return;
                }
                const { url } = await response.json();
                modal.closeAll();
                router.push(
                  `/integrations/social/${identifier}?state=${url}&code=${Buffer.from(
                    JSON.stringify(data)
                  ).toString('base64')}${onboarding ? '&onboarding=true' : ''}`
                );
              }}
              onProceedOAuth={async ({
                externalUrl,
                extensionIdOverride,
              }) => {
                if (isWeb3) {
                  await openWeb3();
                  return;
                }
                if (isChromeExtension) {
                  await runChromeExtensionFlow(
                    extensionIdOverride || extensionId
                  );
                  return;
                }
                await gotoIntegration(externalUrl);
              }}
            />
          ),
        });
      },
    [onboarding, extensionId, isMobile, fetch, modal, router, toaster, t]
  );

  return (
    <div className="w-full flex flex-col gap-[20px] rounded-[4px] relative">
      <div className="flex flex-col">
        <div
          className={clsx(
            isMobile && 'gap-[20px] flex flex-col',
            !isMobile &&
              'grid grid-cols-5 gap-[10px] justify-items-center justify-center mobile:!grid-cols-3',
            isMobile ? {} : onboarding ? 'grid-cols-9' : 'grid-cols-5'
          )}
        >
          {social
            .filter((item) => {
              if (!props.invite) {
                return true;
              }

              return (
                !item.isExternal &&
                !item.isWeb3 &&
                !item.isChromeExtension &&
                !item.customFields
              );
            })
            .map((item) => {
              const configured = isChannelConfiguredInEnv(
                item.identifier,
                socialEnvConfig
              );
              return (
                <div
                  key={item.identifier}
                  onClick={getSocialLink(props.invite, item)}
                  {...(!!item.toolTip
                    ? {
                        'data-tooltip-id': 'tooltip',
                        'data-tooltip-content': item.toolTip,
                      }
                    : {})}
                  className={clsx(
                    isMobile
                      ? 'flex-row h-[72px] p-[16px]'
                      : 'flex-col p-[10px] h-[100px] justify-center mobile:text-[13px] mobile:leading-[1.2]',
                    'w-full text-[14px] rounded-[8px] bg-newTableHeader hover:bg-boxHover border border-transparent hover:border-newTableBorder text-textColor relative items-center flex gap-[10px] cursor-pointer transition-all'
                  )}
                >
                  {configured && !isMobile && (
                    <span
                      title="Configured in .env"
                      className="w-[7px] h-[7px] rounded-full bg-emerald-400 absolute top-[10px] start-[10px]"
                    />
                  )}
                  <div>
                    {item.identifier === 'youtube' ? (
                      <img src={`/icons/platforms/youtube.svg`} alt={item.name} />
                    ) : (
                      <img
                        className={clsx(
                          'w-[32px] h-[32px]',
                          item.identifier !== 'google_my_business' &&
                            'rounded-full'
                        )}
                        src={`/icons/platforms/${item.identifier}.png`}
                        alt={item.name}
                      />
                    )}
                  </div>
                  <div
                    className={clsx(
                      isMobile ? '' : 'whitespace-pre-wrap',
                      'text-center'
                    )}
                  >
                    {item.name}
                    {!!item.toolTip && !isMobile && (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 26 26"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="absolute top-[10px] end-[10px]"
                      >
                        <path
                          d="M13 0C10.4288 0 7.91543 0.762437 5.77759 2.1909C3.63975 3.61935 1.97351 5.64968 0.989572 8.02512C0.0056327 10.4006 -0.251811 13.0144 0.249797 15.5362C0.751405 18.0579 1.98953 20.3743 3.80762 22.1924C5.6257 24.0105 7.94208 25.2486 10.4638 25.7502C12.9856 26.2518 15.5995 25.9944 17.9749 25.0104C20.3503 24.0265 22.3807 22.3603 23.8091 20.2224C25.2376 18.0846 26 15.5712 26 13C25.9964 9.5533 24.6256 6.24882 22.1884 3.81163C19.7512 1.37445 16.4467 0.00363977 13 0ZM13 21C12.7033 21 12.4133 20.912 12.1667 20.7472C11.92 20.5824 11.7277 20.3481 11.6142 20.074C11.5007 19.7999 11.471 19.4983 11.5288 19.2074C11.5867 18.9164 11.7296 18.6491 11.9393 18.4393C12.1491 18.2296 12.4164 18.0867 12.7074 18.0288C12.9983 17.9709 13.2999 18.0007 13.574 18.1142C13.8481 18.2277 14.0824 18.42 14.2472 18.6666C14.412 18.9133 14.5 19.2033 14.5 19.5C14.5 19.8978 14.342 20.2794 14.0607 20.5607C13.7794 20.842 13.3978 21 13 21ZM14 14.91V15C14 15.2652 13.8946 15.5196 13.7071 15.7071C13.5196 15.8946 13.2652 16 13 16C12.7348 16 12.4804 15.8946 12.2929 15.7071C12.1054 15.5196 12 15.2652 12 15V14C12 13.7348 12.1054 13.4804 12.2929 13.2929C12.4804 13.1054 12.7348 13 13 13C14.6538 13 16 11.875 16 10.5C16 9.125 14.6538 8 13 8C11.3463 8 10 9.125 10 10.5V11C10 11.2652 9.89465 11.5196 9.70711 11.7071C9.51958 11.8946 9.26522 12 9.00001 12C8.73479 12 8.48044 11.8946 8.2929 11.7071C8.10536 11.5196 8.00001 11.2652 8.00001 11V10.5C8.00001 8.01875 10.2425 6 13 6C15.7575 6 18 8.01875 18 10.5C18 12.6725 16.28 14.4913 14 14.91Z"
                          fill="currentColor"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
