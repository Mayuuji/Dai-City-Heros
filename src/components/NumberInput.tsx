import React, { useState, useEffect } from 'react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  /** Value applied when the field is empty on blur (default: 0) */
  defaultValue?: number;
}

/**
 * A number input that allows the field to be empty while typing.
 * The default/fallback value is only applied on blur, so users
 * don't have to delete a leading "0" before typing.
 */
export default function NumberInput({
  value,
  onChange,
  defaultValue = 0,
  onBlur,
  ...rest
}: NumberInputProps) {
  const [display, setDisplay] = useState(String(value));

  // Sync external value changes into the display string
  useEffect(() => {
    setDisplay(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={(e) => {
        const parsed = e.target.value === '' ? defaultValue : Number(e.target.value);
        const final = isNaN(parsed) ? defaultValue : parsed;
        setDisplay(String(final));
        onChange(final);
        onBlur?.(e);
      }}
    />
  );
}
