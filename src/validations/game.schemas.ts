import { z } from "zod";
import { CV_VALUES, DR_VALUES, SE_VALUES, SR_VALUES } from "@/lib/constants";

export const NewSessionSchema = z.object({
  userId: z.string().min(1).optional(),
});

export const SubmitAnswerSchema = z.object({
  profileId: z.string().min(1),
  selections: z.object({
    DR: z.enum(DR_VALUES),
    SE: z.enum(SE_VALUES),
    SR: z.enum(SR_VALUES),
    CV: z.enum(CV_VALUES),
  }),
  clueUsed: z.boolean(),
  timeTakenMs: z.number().int().positive(),
});

export const CompleteSessionSchema = z.object({});

export const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type NewSessionInput = z.infer<typeof NewSessionSchema>;
export type SubmitAnswerInput = z.infer<typeof SubmitAnswerSchema>;
export type CompleteSessionInput = z.infer<typeof CompleteSessionSchema>;
export type CredentialsInput = z.infer<typeof CredentialsSchema>;
