// shadcn/ui's expected className-merge helper — combines clsx (conditional classes)
// with tailwind-merge (resolves conflicting Tailwind classes sanely). Used by every
// shadcn component as `cn(...)`.
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
