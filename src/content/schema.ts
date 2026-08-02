import { z } from 'zod';

const objective = z.object({
  id: z.string(),
  label: z.string(),
  keywords: z.array(z.string()),
  required: z.boolean()
});
const node = z.object({
  id: z.string(),
  speaker: z.enum(['partner', 'user']),
  text: z.string(),
  expectedIntent: z.string().optional(),
  next: z.array(z.string())
});
export const contentPackSchema = z.object({
  id: z.string().regex(/^(hotel|flight)-(email|chat)-core$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  minAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  releasedAt: z.string().datetime(),
  scenarios: z
    .array(
      z.object({
        id: z.string(),
        version: z.string(),
        titleZh: z.string(),
        titleEn: z.string(),
        category: z.enum(['hotel', 'flight']),
        channel: z.enum(['email', 'chat']),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        duration: z.number().int().positive(),
        context: z.string(),
        userRole: z.string(),
        partnerRole: z.string(),
        partnerMessage: z.string(),
        translation: z.string(),
        requiredObjectives: z.array(objective).min(2),
        optionalObjectives: z.array(objective),
        requiredEntities: z.array(z.string()),
        keywords: z.record(z.string(), z.array(z.string())),
        nodes: z.array(node).min(5),
        hints: z.array(z.string()).min(1),
        vocabulary: z.array(z.object({ term: z.string(), meaning: z.string() })),
        phrases: z.array(z.object({ text: z.string(), meaning: z.string() })),
        commonErrors: z.array(z.string()),
        reference: z.object({
          subject: z.string().optional(),
          body: z.string(),
          dialogue: z
            .array(z.object({ role: z.enum(['partner', 'user']), text: z.string() }))
            .optional()
        }),
        scoring: z.object({
          politenessTerms: z.array(z.string()),
          minWords: z.number(),
          maxChatWords: z.number()
        })
      })
    )
    .length(12)
});
export type ContentPackInput = z.infer<typeof contentPackSchema>;
