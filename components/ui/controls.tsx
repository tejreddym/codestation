import type {
  ChangeEventHandler,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(styles.control, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(styles.control, styles.textarea, className)} />;
}

/** Dark monospace editor used for tool input and secondary code fields. */
export function CodeArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(styles.codeArea, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(styles.control, className)}>{children}</select>;
}

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  labelClassName?: string;
};

export function Checkbox({ label, labelClassName, className, ...props }: CheckboxProps) {
  return (
    <label className={cx(styles.checkboxRow, labelClassName)}>
      <input {...props} type="checkbox" className={cx(className)} />
      {label !== undefined ? <span>{label}</span> : null}
    </label>
  );
}

type CheckboxOption = {
  value: string;
  label: ReactNode;
  checked: boolean;
  disabled?: boolean;
};

type CheckboxGroupProps = {
  id?: string;
  legend: ReactNode;
  name: string;
  options: CheckboxOption[];
  describedBy?: string;
  invalid?: boolean;
  hint?: ReactNode;
  hintId?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export function CheckboxGroup({ id, legend, name, options, describedBy, invalid, hint, hintId, onChange }: CheckboxGroupProps) {
  return (
    <fieldset className={styles.fieldset} id={id} aria-describedby={describedBy}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.checkGrid}>
        {options.map(option => (
          <Checkbox
            key={option.value}
            id={id ? `${id}-${option.value}` : undefined}
            name={name}
            value={option.value}
            label={option.label}
            checked={option.checked}
            disabled={option.disabled}
            aria-describedby={describedBy}
            aria-invalid={invalid ? true : undefined}
            onChange={onChange}
          />
        ))}
      </div>
      {hint ? <p className={styles.hint} id={hintId ?? (id ? `${id}-hint` : undefined)}>{hint}</p> : null}
    </fieldset>
  );
}

type RadioGroupProps = {
  id?: string;
  legend: ReactNode;
  name: string;
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>;
  value: string;
  describedBy?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export function RadioGroup({ id, legend, name, options, value, describedBy, onChange }: RadioGroupProps) {
  return (
    <fieldset className={styles.fieldset} id={id} aria-describedby={describedBy}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.checkGrid}>
        {options.map(option => (
          <label className={styles.checkboxRow} key={option.value}>
            <input
              type="radio"
              id={id ? `${id}-${option.value}` : undefined}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              aria-describedby={describedBy}
              onChange={onChange}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RangeInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="range" className={cx(styles.range, className)} />;
}

export function ColorInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="color" className={cx(styles.colorInput, className)} />;
}
