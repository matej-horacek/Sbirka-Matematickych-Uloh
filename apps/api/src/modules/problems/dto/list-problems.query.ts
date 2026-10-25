import { z } from 'zod';
import { zScope } from '@matematika/contracts';

// `?tagId=a&tagId=b` arrives as an array, `?tagId=a` as a string: normalise to an array.
const toArray = (v: unknown) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export const listProblemsQuery = z.object({
  scope: zScope,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tagId: z.preprocess(toArray, z.array(z.string()).optional()),
  chapterId: z.preprocess(toArray, z.array(z.string()).optional()),
  language: z.string().optional(),
});

export type ListProblemsQuery = z.infer<typeof listProblemsQuery>;
