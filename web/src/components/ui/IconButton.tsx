import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; icon-only buttons have no visible text (rule-actions-components.md / Icon buttons). */
  label: string;
  variant?: Variant;
  children: ReactNode;
}

/**
 * A 44x44 icon-only button. `label` becomes both the accessible name and the
 * tooltip, so the button is never announced as "button" alone.
 */
export function IconButton({ label, variant = 'ghost', className, children, ...rest }: Props) {
  return (
    <Button variant={variant} aria-label={label} title={label} className={cn('btn-icon', className)} {...rest}>
      {children}
    </Button>
  );
}
