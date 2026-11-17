import { useRef, useState, type DragEvent, type ReactNode } from "react";
import styles from "./ui.module.css";
import { cx } from "./cx";

type DropZoneProps = {
  id?: string;
  name?: string;
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: FileList) => void;
  className?: string;
  children?: ReactNode;
};

/** Drag styling around a real file input; the input keeps the accessible name. */
export function DropZone({
  id,
  name,
  label,
  accept,
  multiple,
  disabled,
  onFiles,
  className,
  children,
}: DropZoneProps) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const onDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setActive(true);
  };

  const onDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    depth.current = 0;
    setActive(false);
    if (disabled || !event.dataTransfer.files.length) return;
    onFiles(event.dataTransfer.files);
  };

  return (
    <label
      className={cx(styles.dropzone, disabled && styles.dropzoneDisabled, active && styles.dropzoneActive, className)}
      onDragEnter={onDragEnter}
      onDragOver={event => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        className={styles.fileInput}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={label}
        onChange={event => {
          const files = event.target.files;
          if (files && files.length > 0) onFiles(files);
        }}
      />
      {children ?? <span>{label}</span>}
    </label>
  );
}
