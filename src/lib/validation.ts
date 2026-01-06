import { z } from 'zod'

// Entry name validation
export const entryNameSchema = z
  .string()
  .trim()
  .min(2, 'Entry name must be at least 2 characters')
  .max(30, 'Entry name must be 30 characters or less')

// Signup form validation
export const signupSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Name is required'),
    email: z
      .string()
      .email('Please enter a valid email address'),
    phone: z
      .string()
      .trim()
      .min(10, 'Please enter a valid phone number'),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// Login form validation
export const loginSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
})

// Type exports
export type EntryNameInput = z.infer<typeof entryNameSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

// Validation helper - returns first error message or null
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): string | null {
  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message || 'Invalid input'
}

// Validation helper - returns all error messages
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || 'root'
    if (!errors[path]) {
      errors[path] = issue.message
    }
  }
  return { success: false, errors }
}
