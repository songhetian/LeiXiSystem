import { z } from 'zod';

export const punchImportSchema = z.object({
  csv: z.string().min(1, 'CSV数据不能为空'),
});

export type PunchImportDto = z.infer<typeof punchImportSchema>;
