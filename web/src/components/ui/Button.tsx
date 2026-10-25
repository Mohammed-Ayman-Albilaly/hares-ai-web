import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  /** Disables the button and shows the busy label; announce the change to screen readers. */
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({ variant = 'secondary', small, loading, loadingLabel, className, children, disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn('btn', VARIANT[variant], small && 'btn-sm', className)}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant = 'secondary',
  small,
  className,
  ...rest
}: LinkProps & { variant?: Variant; small?: boolean }) {
  return <Link {...rest} className={cn('btn', VARIANT[variant], small && 'btn-sm', className)} />;
}
