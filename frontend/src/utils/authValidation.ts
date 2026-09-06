import { z } from 'zod';

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Please enter your full name.'),
    company: z.string().trim().optional(),
    email: z.string().trim().min(1, 'Email is required.').email('Please enter a valid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    agreedToTerms: z.boolean().refine((v) => v === true, {
      message: 'Please agree to the Terms and Privacy Policy.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignupFormData = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Please enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
