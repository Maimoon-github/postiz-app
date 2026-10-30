import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AllProvidersSettings } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings';
import { Integration } from '@prisma/client';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { timer } from '@gitroom/helpers/utils/timer';
import {
  ValidUrlExtension,
  ValidUrlPath,
} from '@gitroom/helpers/utils/valid.url.path';

const validUrlExtension = new ValidUrlExtension();
const validUrlPath = new ValidUrlPath();

// Same URL validation as MediaDto (valid.url.path) - each attachment must
// point to an allowed upload domain and a supported file extension.
const attachmentUrl = z
  .string()
  .refine((url) => validUrlPath.validate(url, {} as any), {
    message: validUrlPath.defaultMessage({} as any),
  })
  .refine((url) => validUrlExtension.validate(url, {} as any), {
    message: validUrlExtension.defaultMessage({} as any),
  });

// Attachments are either a plain URL string or { path, alt?, thumbnail?,
// thumbnailTimestamp? }, the same per-media fields as the public API.
const attachment = z.union([
  attachmentUrl,
  z.object({
    path: attachmentUrl,
    alt: z.string().optional(),
    thumbnail: attachmentUrl.optional(),
    thumbnailTimestamp: z.number().int().min(0).optional(),
  }),
]);

const toMedia = (
  a:
    | string
    | {
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }
) =>
  typeof a === 'string'
    ? { path: a }
    : {
        path: a.path,
        alt: a.alt,
        thumbnail: a.thumbnail,
        thumbnailTimestamp: a.thumbnailTimestamp,
      };

@Injectable()
export class IntegrationSchedulePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _integrationService: IntegrationService
  ) {}
  name = 'integrationSchedulePostTool';

  run() {
    return createTool({
      id: 'schedulePostTool',
      mcp: {
        annotations: {
          title: 'Schedule Social Media Post',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      description: `
Use this when the user wants to create a draft, scheduled, or immediate social media post on their connected channels, based on the integrationSchema tool.
Examples of the input shape:

A single LinkedIn post with one comment
- socialPost array length will be one
- postsAndComments array length will be two (one for the post, one for the comment)

20 Facebook posts each on individual days without comments
- socialPost array length will be 20
- postsAndComments array length will be one

Do not use this to update or delete existing posts.
If validation fails, the result contains output.errors describing what to fix; the call can be retried with corrected parameters.

CRITICAL INSTRUCTIONS FOR REPORTING POST STATUS:
1. "state === 'PUBLISHED'" AND "liveUrl" is NOT null:
   The post is confirmed LIVE on the social network. Share the "liveUrl" (e.g. LinkedIn feed link).
2. "state === 'QUEUE'" OR "state === 'DRAFT'" (or "liveUrl" is null):
   The post has NOT been published to the social network yet! It is scheduled, drafted, or queued locally inside Postiz.
   DO NOT claim it is "Successfully published"! Instead, tell the user: "Your post is scheduled/queued locally in Postiz" and provide "previewUrl" as the "Internal Postiz Preview".
3. "previewUrl" (${process.env.FRONTEND_URL}/p/...) is strictly an internal Postiz preview. It is NEVER the live external social post URL.
4. Channel Type Awareness:
   - "linkedin" = Personal LinkedIn Profile
   - "linkedin-page" = LinkedIn Company/Organization Page
   If the user asked to post to a "LinkedIn page" but the channel platform is "linkedin" (personal profile), make sure to clarify that it was posted to their personal LinkedIn profile ("channelName"), NOT a LinkedIn Company Page.
`,
      inputSchema: z.object({
        socialPost: z
          .array(
            z.object({
              integrationId: z
                .string()
                .describe('The id of the integration (not internal id)'),
              isPremium: z
                .boolean()
                .describe(
                  "If the integration is X, return if it's premium or not"
                ),
              date: z.string().describe('The date of the post in UTC time'),
              shortLink: z
                .boolean()
                .describe(
                  'If the post has a link inside, we can ask the user if they want to add a short link'
                ),
              type: z
                .enum(['draft', 'schedule', 'now'])
                .describe(
                  'The type of the post, if we pass now, we should pass the current date also'
                ),
              postsAndComments: z
                .array(
                  z.object({
                    content: z
                      .string()
                      .describe(
                        "The content of the post, HTML, Each line must be wrapped in <p> here is the possible tags: h1, h2, h3, u, strong, li, ul, p (you can't have u and strong together), img (<img src=\"...\">) only when the integration rules say pictures go inside the content, and span only for a mention in the exact format given by a mention tool from the integrationSchema tools"
                      ),
                    attachments: z
                      .array(attachment)
                      .describe(
                        'The media of the post: either an uploaded media URL string, or { path, alt?, thumbnail?, thumbnailTimestamp? } where path is the uploaded media URL, alt is its alt text, thumbnail is the path of an uploaded jpeg/png (returned by uploadFromUrlTool) used as the video thumbnail / cover, and thumbnailTimestamp is the video frame to use as the cover, in milliseconds'
                      ),
                  })
                )
                .describe(
                  'first item is the post, every other item is the comments'
                ),
              settings: z
                .array(
                  z.object({
                    key: z
                      .string()
                      .describe('Name of the settings key to pass'),
                    value: z
                      .any()
                      .describe(
                        'Value of the key, always prefer the id then label if possible. When the settings schema says a field is an id, pass the id returned by the channel tools, never the display label'
                      ),
                  })
                )
                .describe(
                  'This relies on the integrationSchema tool to get the settings [input:settings]'
                ),
            })
          )
          .describe('Individual post'),
      }),
      outputSchema: z.object({
        output: z
          .array(
            z.object({
              postId: z.string(),
              integration: z.string(),
              platform: z.string().optional(),
              channelName: z.string().optional(),
              channelType: z.string().optional(),
              state: z
                .string()
                .describe('PUBLISHED, QUEUE, DRAFT, or ERROR'),
              liveUrl: z
                .string()
                .nullable()
                .describe(
                  'The external live post URL on the social platform (e.g. LinkedIn feed link). Only present when state is PUBLISHED. NEVER report a post as successfully published or live unless liveUrl is non-null!'
                ),
              previewUrl: z
                .string()
                .describe(
                  'Internal Postiz dashboard/calendar preview URL. This is NOT a live social media URL.'
                ),
              statusDescription: z
                .string()
                .describe(
                  'Human-readable explanation of whether the post is live on the social platform or merely scheduled/queued/drafted in Postiz'
                ),
            })
          )
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;
        const finalOutput = [];

        const integrations = {} as Record<string, Integration>;
        for (const platform of inputData.socialPost) {
          integrations[platform.integrationId] =
            await this._integrationService.getIntegrationById(
              organizationId,
              platform.integrationId
            );

          // Same server-side validation as the dashboard / public API
          // (settings DTO + media checkValidity + empty / too-long content).
          const settings = platform.settings.reduce(
            (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
              ...acc,
              [s.key]: s.value,
            }),
            {} as AllProvidersSettings
          );

          const [validation] = await this._postsService.validatePosts(
            organizationId,
            [
              {
                integration: { id: platform.integrationId },
                settings,
                value: platform.postsAndComments.map((p: any) => ({
                  content: p.content,
                  image: (p.attachments || []).map(toMedia),
                })),
              },
            ]
          );

          if (validation.emptyContent) {
            return {
              output: {
                errors: `${validation.name}: Your post should have at least one character or one image.`,
              },
            };
          }

          if (platform.type !== 'draft') {
            if (!validation.valid) {
              return {
                output: {
                  errors: `${validation.name}: ${
                    validation.settingsError || 'Please fix your settings'
                  }, please fix it, and try integrationSchedulePostTool again.`,
                },
              };
            }

            if (validation.errors !== true) {
              return {
                output: {
                  errors: `${validation.name}: ${validation.errors}, please fix it, and try integrationSchedulePostTool again.`,
                },
              };
            }

            if (validation.tooLong) {
              return {
                output: {
                  errors: `${validation.name}: The maximum characters is ${validation.maximumCharacters}, please fix it, and try integrationSchedulePostTool again.`,
                },
              };
            }
          }
        }

        for (const post of inputData.socialPost) {
          const integration = integrations[post.integrationId];

          if (!integration) {
            throw new Error('Integration not found');
          }

          const output = await this._postsService.createPost(organizationId, {
            date: post.date,
            type: post.type as 'draft' | 'schedule' | 'now',
            shortLink: post.shortLink,
            tags: [],
            posts: [
              {
                integration,
                group: makeId(10),
                settings: post.settings.reduce(
                  (acc: AllProvidersSettings, s: { key: string; value: any }) => ({
                    ...acc,
                    [s.key]: s.value,
                  }),
                  {
                    __type: integration.providerIdentifier,
                  } as AllProvidersSettings
                ),
                value: post.postsAndComments.map((p: any) => ({
                  content: p.content,
                  id: makeId(10),
                  delay: 0,
                  image: p.attachments.map((a: any) => ({
                    id: makeId(10),
                    ...toMedia(a),
                  })),
                })),
              },
            ],
          }, 'MCP');
          for (const p of output) {
            let currentPost = await this._postsService.getPostById(
              p.postId,
              organizationId
            );

            // If the post was requested to be published 'now', give background workers a few seconds to finalize
            if (
              post.type === 'now' &&
              currentPost &&
              currentPost.state !== 'PUBLISHED' &&
              currentPost.state !== 'ERROR'
            ) {
              for (let i = 0; i < 4; i++) {
                await timer(1000);
                currentPost = await this._postsService.getPostById(
                  p.postId,
                  organizationId
                );
                if (
                  currentPost?.state === 'PUBLISHED' ||
                  currentPost?.state === 'ERROR'
                ) {
                  break;
                }
              }
            }

            const isPublished = currentPost?.state === 'PUBLISHED';
            const isError = currentPost?.state === 'ERROR';
            const liveUrl =
              isPublished && currentPost?.releaseURL
                ? currentPost.releaseURL
                : null;
            const previewUrl = `${process.env.FRONTEND_URL}/p/${p.postId}?share=true`;

            const channelType =
              integration.providerIdentifier === 'linkedin'
                ? 'LinkedIn Personal Profile'
                : integration.providerIdentifier === 'linkedin-page'
                ? 'LinkedIn Company Page'
                : integration.name;

            let statusDescription = '';
            if (isPublished) {
              statusDescription = `The post has been successfully published LIVE on ${channelType}! Direct live post URL: ${liveUrl}`;
            } else if (isError) {
              statusDescription = `The post failed to publish to ${channelType}. Error: ${
                currentPost?.error || 'Unknown error'
              }`;
            } else if (post.type === 'draft') {
              statusDescription = `The post was saved locally as a DRAFT in Postiz. It has NOT been published to ${channelType}. Local Postiz preview URL: ${previewUrl}`;
            } else if (post.type === 'schedule') {
              statusDescription = `The post was SCHEDULED locally in Postiz for ${post.date}. It is queued in Postiz and has NOT yet been published to ${channelType}. Local Postiz preview URL: ${previewUrl}`;
            } else {
              statusDescription = `The post was QUEUED locally in Postiz to go live immediately on ${channelType}. Background workers are currently processing it. It is NOT yet confirmed live on ${channelType}. The previewUrl (${previewUrl}) is an internal Postiz preview, NOT the live external post URL.`;
            }

            finalOutput.push({
              postId: p.postId,
              integration: p.integration,
              platform: integration.providerIdentifier,
              channelName: integration.name,
              channelType,
              state:
                currentPost?.state ||
                (post.type === 'draft' ? 'DRAFT' : 'QUEUE'),
              liveUrl,
              previewUrl,
              statusDescription,
            });
          }
        }

        return {
          output: finalOutput,
        };
      },
    });
  }
}
