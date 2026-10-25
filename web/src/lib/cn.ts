import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names and resolve Tailwind conflicts (later wins). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
