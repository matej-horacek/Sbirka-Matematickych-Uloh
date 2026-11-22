import { z } from 'zod';

// `?tagId=a&tagId=b` arrives as an array, `?tagId=a` as a string: normalise to an array.
const toArray = (v: unknown) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

/** listWorksheets query. No `scope`: the list is always the caller's own worksheets (D-40). */
export const listWorksheetsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tagId: z.preprocess(toArray, z.array(z.string()).optional()),
  chapterId: z.preprocess(toArray, z.array(z.string()).optional()),
  language: z.string().optional(),
});

export type ListWorksheetsQuery = z.infer<typeof listWorksheetsQuery>;
