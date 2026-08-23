import { z } from 'zod';

export const confirmRunSchema = z.object({
  checkedEmployeeIds: z.array(z.number().int().positive()).min(3, '至少抽检3名员工'),
});

export type ConfirmRunDto = z.infer<typeof confirmRunSchema>;
