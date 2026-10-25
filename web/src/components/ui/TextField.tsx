import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDir } from '@/i18n/useLang';
import { I } from './icons';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Message already translated; shown under the field and linked with aria-describedby. */
  error?: string;
  hint?: string;
  /** Content after the label on the same row (e.g. a "Forgot password?" link). */
  labelAction?: ReactNode;
}

/**
 * Label above the input (never placeholder-only), error and hint tied to the
 * input for screen readers, `aria-invalid` for the error style. Works with
 * react-hook-form's `register` (forwardRef).
 */
export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, labelAction, id, type = 'text', ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = [error ? `${inputId}-err` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(' ') || undefined;
  const { t } = useTranslation();
  const rtl = useDir() === 'rtl';
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="field">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId}>{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // Email and similar values are always typed left to right, even in Arabic pages.
          dir={type === 'email' || type === 'password' ? 'ltr' : undefined}
          // The value is left to right but lines up with its (right-aligned, in Arabic) label; the reveal button
          // sits at the end of the line of the page's direction.
          style={{
            ...(type === 'email' || type === 'password' ? { textAlign: rtl ? 'right' : 'left' } : {}),
            ...(isPassword ? (rtl ? { paddingLeft: 42 } : { paddingRight: 42 }) : {}),
          }}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={shown}
            className={`absolute ${rtl ? 'left-1.5' : 'right-1.5'} top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md border-0 bg-transparent text-ink-4 hover:text-ink`}
          >
            {shown ? <I.EyeOff size={16} /> : <I.Eye size={16} />}
          </button>
        )}
      </div>
      {hint && !error && (
        <div id={`${inputId}-hint`} className="hint">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${inputId}-err`} className="err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});
