import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

/**
 * A native checkbox with its label as one 44px-high target. The native input
 * keeps keyboard, form and screen-reader behaviour; `accent-color` follows the
 * Saudi green token. Works with react-hook-form's `register` (forwardRef).
 */
export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { label, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const checkboxId = id ?? auto;
  return (
    <label
      htmlFor={checkboxId}
      className={cn('flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px] text-ink-2', className)}
    >
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className="size-4 shrink-0"
        style={{ accentColor: 'var(--accent)' }}
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
});
