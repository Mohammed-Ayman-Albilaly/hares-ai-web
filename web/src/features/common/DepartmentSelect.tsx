import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SelectField } from '@/components/ui/SelectField';
import { useDepartments } from './useDepartments';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Text of the empty option ("Choose a department", "All", "Keep the current one"). */
  placeholder: string;
  /** Only departments that are still active: the ones an account or a policy can be moved into. */
  activeOnly?: boolean;
  /** Two pickers on one screen share the list: the second can skip the message the first one shows. */
  hideError?: boolean;
}

/**
 * Department picker: the list, its loading state and its failure in one place, because five
 * screens ask the same question. When the list cannot be loaded the select says so instead of
 * sitting there empty and disabled with no reason (the picker is unusable either way).
 */
export function DepartmentSelect({ label, value, onChange, placeholder, activeOnly, hideError }: Props) {
  const { t } = useTranslation();
  const departments = useDepartments();
  const errorId = useId();
  const items = (departments.data?.items ?? []).filter((d) => !activeOnly || d.active);
  return (
    <>
      <SelectField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={departments.isLoading}
        aria-describedby={departments.isError && !hideError ? errorId : undefined}
      >
        <option value="">{placeholder}</option>
        {items.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
      {departments.isError && !hideError && (
        <div id={errorId} className="err w-full" role="alert">
          {t('departments.listError')}
        </div>
      )}
    </>
  );
}
