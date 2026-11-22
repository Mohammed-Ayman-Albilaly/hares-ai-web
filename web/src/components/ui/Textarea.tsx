import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** Message already translated; shown under the field and linked with aria-describedby. */
  error?: string;
  hint?: string;
  labelAction?: ReactNode;
}

/**
 * A labelled textarea with the same error/hint wiring as TextField. Works with
 * react-hook-form's `register` (forwardRef) and keeps the 44px minimum height
 * (rule-actions-components.md / Touch targets).
 */
export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, hint, labelAction, id, ...rest },
  ref,
) {
  const auto = useId();
  const textareaId = id ?? auto;
  const describedBy =
    [error ? `${textareaId}-err` : null, hint ? `${textareaId}-hint` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={textareaId}>{label}</label>
        {labelAction}
      </div>
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && !error && (
        <div id={`${textareaId}-hint`} className="hint">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${textareaId}-err`} className="err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});
