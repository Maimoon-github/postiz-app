import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || 'http://host.docker.internal:11435/v1',
});
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:9b-q4_K_M';

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

const ClipsPrompt = z.object({
  clips: z.array(
    z.object({
      from: z.number().describe('Number of the first line of the clip'),
      to: z.number().describe('Number of the last line of the clip'),
      title: z.string().describe('Short title of the clip'),
      content: z
        .string()
        .describe('Social media post to publish the clip with, no hashtags'),
    })
  ),
});

@Injectable()
export class OpenaiService {
  // The model answers with line numbers and not times, so a clip can only
  // start and end where the transcript really has a boundary
  async pickClips(
    title: string,
    language: string,
    segments: { start: number; end: number; text: string }[],
    maxClips: number
  ) {
    const { clips } = (
      await openai.chat.completions.parse(
        {
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes the transcript of a video and picks the parts that will work best as short vertical clips for social media.
Every line of the transcript is "number [start seconds - end seconds] text".
Pick up to ${maxClips} clips, best first. A clip is a range of consecutive lines that starts with a hook, makes one complete point and is understandable without the rest of the video.
The length of a clip is the end of its last line minus the start of its first line: it must be between 20 and 90 seconds, never longer, so check the numbers before answering.
Clips must not overlap. Write the title and the post in this language, whatever the language of these instructions: ${language}.`,
            },
            {
              role: 'user',
              content: `title: ${title}\n\n${segments
                .map(
                  (p, index) =>
                    `${index} [${p.start.toFixed(1)} - ${p.end.toFixed(1)}] ${
                      p.text
                    }`
                )
                .join('\n')}`,
            },
          ],
          response_format: zodResponseFormat(ClipsPrompt, 'clipsPrompt'),
        },
        // shorter than the activity: an attempt that was given up on must not
        // still be running, and storing clips, when its retry gets there
        { timeout: 8 * 60 * 1000, maxRetries: 0 }
      )
    ).choices[0].message.parsed || { clips: [] };

    return clips;
  }

  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: OLLAMA_MODEL,
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: OLLAMA_MODEL,
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: OLLAMA_MODEL,
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: OLLAMA_MODEL,
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        const parse =
          (
            await openai.chat.completions.parse({
              model: OLLAMA_MODEL,
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text.slice(0, 8000),
      });
      return response.data[0].embedding;
    } catch (err) {
      // Deterministic pseudo-embedding for testing or offline environments
      return this._deterministicVector(text, 64);
    }
  }

  async generateSummary(content: string, title = ''): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: OLLAMA_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Summarize the following document in exactly one concise, high-signal sentence preserving key topics, rules, and entities.',
          },
          {
            role: 'user',
            content: `Title: ${title}\nContent:\n${content.slice(0, 4000)}`,
          },
        ],
        temperature: 0,
        max_tokens: 100,
      });
      return (
        completion.choices[0]?.message?.content?.trim() ||
        this._heuristicSummary(content, title)
      );
    } catch (err) {
      return this._heuristicSummary(content, title);
    }
  }

  async classifyQueryComplexity(
    query: string
  ): Promise<{ isComplex: boolean; subQueries: string[] }> {
    try {
      const ComplexitySchema = z.object({
        isComplex: z
          .boolean()
          .describe(
            'True if query requires multi-hop reasoning, comparative analysis, or multiple distinct facts'
          ),
        subQueries: z
          .array(z.string())
          .describe('List of independent atomic sub-queries if complex, otherwise single query'),
      });

      const parsed = (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are an adaptive RAG planner. Classify the user query at temperature 0. If it asks multiple questions or compares platforms/rules, decompose into 2-3 parallel sub-queries. Otherwise keep it single.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
          response_format: zodResponseFormat(ComplexitySchema, 'complexity'),
          temperature: 0,
        })
      ).choices[0]?.message?.parsed;

      if (
        parsed &&
        typeof parsed.isComplex === 'boolean' &&
        Array.isArray(parsed.subQueries) &&
        parsed.subQueries.length > 0
      ) {
        return {
          isComplex: parsed.isComplex,
          subQueries: parsed.subQueries,
        };
      }
    } catch (err) {}

    // Fallback heuristic classification
    const isMultiPart =
      query.includes(' and ') ||
      query.includes(' vs ') ||
      query.includes('compare') ||
      query.includes('?') && query.indexOf('?') !== query.lastIndexOf('?');

    if (isMultiPart) {
      const parts = query
        .split(/\band\b|\bvs\b|\?/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 5);
      return {
        isComplex: parts.length > 1,
        subQueries: parts.length > 1 ? parts : [query],
      };
    }

    return { isComplex: false, subQueries: [query] };
  }

  async gradeEvidence(
    query: string,
    chunks: Array<{ id: string; text: string }>
  ): Promise<{
    isSufficient: boolean;
    status: 'COMPLETE' | 'PARTIAL' | 'ABSTAIN';
    relevantChunkIds: string[];
    missingInfo: string[];
    nextQueries: string[];
  }> {
    if (!chunks.length) {
      return {
        isSufficient: false,
        status: 'ABSTAIN',
        relevantChunkIds: [],
        missingInfo: ['No evidence found in knowledge base'],
        nextQueries: [query],
      };
    }

    try {
      const GraderSchema = z.object({
        isSufficient: z.boolean(),
        status: z.enum(['COMPLETE', 'PARTIAL', 'ABSTAIN']),
        relevantChunkIds: z.array(z.string()),
        missingInfo: z.array(z.string()),
        nextQueries: z.array(z.string()),
      });

      const parsed = (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a Corrective RAG (CRAG) evidence grader. Evaluate candidate passages on (1) Relevancy and (2) Sufficiency to answer the query. Return COMPLETE if all parts are covered, PARTIAL if some parts are missing, or ABSTAIN if irrelevant.',
            },
            {
              role: 'user',
              content: `Query: ${query}\n\nEvidence Chunks:\n${chunks
                .map((c) => `[ID: ${c.id}]\n${c.text}`)
                .join('\n\n')}`,
            },
          ],
          response_format: zodResponseFormat(GraderSchema, 'evidenceGrade'),
          temperature: 0,
        })
      ).choices[0]?.message?.parsed;

      if (
        parsed &&
        typeof parsed.isSufficient === 'boolean' &&
        parsed.status &&
        Array.isArray(parsed.relevantChunkIds) &&
        Array.isArray(parsed.missingInfo) &&
        Array.isArray(parsed.nextQueries)
      ) {
        return {
          isSufficient: parsed.isSufficient,
          status: parsed.status,
          relevantChunkIds: parsed.relevantChunkIds,
          missingInfo: parsed.missingInfo,
          nextQueries: parsed.nextQueries,
        };
      }
    } catch (err) {}

    // Deterministic lexical scoring fallback
    const queryTokens = query
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);
    const relevantIds: string[] = [];
    for (const chunk of chunks) {
      const lower = chunk.text.toLowerCase();
      const matchCount = queryTokens.filter((tok) => lower.includes(tok)).length;
      if (matchCount / (queryTokens.length || 1) >= 0.25) {
        relevantIds.push(chunk.id);
      }
    }

    if (relevantIds.length === 0) {
      return {
        isSufficient: false,
        status: 'ABSTAIN',
        relevantChunkIds: [],
        missingInfo: ['No relevant chunks matched query tokens'],
        nextQueries: [query],
      };
    }

    return {
      isSufficient: true,
      status: 'COMPLETE',
      relevantChunkIds: relevantIds,
      missingInfo: [],
      nextQueries: [],
    };
  }

  async rewriteQuery(
    originalQuery: string,
    missingInfo: string[],
    attemptedQueries: string[]
  ): Promise<string> {
    try {
      const RewriteSchema = z.object({
        rewrittenQuery: z.string().describe('Targeted search query focused on the missing facts'),
      });

      const parsed = (
        await openai.chat.completions.parse({
          model: OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You are a reflective query rewriter. Formulate a refined, targeted search query to locate missing information. Do not repeat any attempted queries.',
            },
            {
              role: 'user',
              content: `Original Query: ${originalQuery}\nMissing Facts: ${missingInfo.join(
                '; '
              )}\nAttempted Queries: ${attemptedQueries.join(' | ')}`,
            },
          ],
          response_format: zodResponseFormat(RewriteSchema, 'rewrite'),
          temperature: 0,
        })
      ).choices[0]?.message?.parsed;

      if (parsed?.rewrittenQuery && !attemptedQueries.includes(parsed.rewrittenQuery)) {
        return parsed.rewrittenQuery;
      }
    } catch (err) {}

    // Fallback: append highest priority missing info
    const addition = missingInfo[0] || 'details';
    const fallback = `${originalQuery} ${addition}`.trim();
    return attemptedQueries.includes(fallback) ? `${fallback} specification` : fallback;
  }

  private _heuristicSummary(content: string, title: string): string {
    const sentences = content
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length > 0) {
      return title ? `${title}: ${sentences[0]}` : sentences[0];
    }
    return title || 'Document knowledge overview';
  }

  private _deterministicVector(text: string, dimensions = 64): number[] {
    const vec = new Array(dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      const idx = (code + i * 17) % dimensions;
      vec[idx] += 1;
    }
    // L2 Normalize
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vec.map((v) => Number((v / norm).toFixed(6)));
  }
}
