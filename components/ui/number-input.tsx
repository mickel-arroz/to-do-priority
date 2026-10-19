"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * Numeric input that lets the user clear the field (or type below the minimum)
 * while focused, so a leading digit can be deleted and replaced. The minimum is
 * only enforced on blur: an empty/invalid/too-low value snaps to `min` (or 0),
 * a too-high value snaps to `max`. `max` is still clamped live while typing.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  onFocus,
  onBlur,
  ...props
}: NumberInputProps) {
  const [text, setText] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);

  // Mirror external value changes while the field is not being edited.
  // Derived state during render instead of an effect: no extra render pass.
  // On blur the field already writes back the value it commits.
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setText(String(value));
  }

  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "") return; // allow an empty field while focused
        const n = Number(raw);
        if (Number.isNaN(n)) return;
        onChange(max !== undefined ? Math.min(max, n) : n);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = Number(text);
        let next = text === "" || Number.isNaN(n) ? (min ?? 0) : n;
        if (max !== undefined) next = Math.min(max, next);
        if (min !== undefined) next = Math.max(min, next);
        setText(String(next));
        onChange(next);
        onBlur?.(e);
      }}
    />
  );
}
