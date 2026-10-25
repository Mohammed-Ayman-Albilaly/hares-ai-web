import { useId, type SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Visually hide the label (it is still read by screen readers). */
  hideLabel?: boolean;
}

/** A labelled native select: keyboard and screen-reader behaviour comes from the browser. */
export function SelectField({ label, hideLabel, id, children, className, ...rest }: Props) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={selectId} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </label>
      <select id={selectId} {...rest}>
        {children}
      </select>
    </div>
  );
}
