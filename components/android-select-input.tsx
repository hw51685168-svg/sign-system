"use client";

import { useEffect, useMemo, useState } from "react";

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AndroidSelectInputProps = {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
};

export function AndroidSelectInput({ name, options, defaultValue, required, disabled }: AndroidSelectInputProps) {
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const initialValue = useMemo(() => {
    if (defaultValue !== undefined) return defaultValue;
    if (required) return options[0]?.value ?? "";
    return "";
  }, [defaultValue, options, required]);

  useEffect(() => {
    setIsAndroidApp(Boolean((window as Window & { HuangxiangAndroid?: unknown }).HuangxiangAndroid));
  }, []);

  if (!isAndroidApp) {
    return (
      <select name={name} defaultValue={initialValue} disabled={disabled} required={required}>
        {options.map((option) => (
          <option key={option.value || "__empty"} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (disabled) {
    const selectedLabel = options.find((option) => option.value === initialValue)?.label ?? options[0]?.label ?? "未指定";
    return (
      <div className="min-h-12 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-black text-slate-700">
        {selectedLabel}
      </div>
    );
  }

  return (
    <div className="grid max-h-72 gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-3">
      {options.map((option) => (
        <label
          key={option.value || "__empty"}
          className={`flex min-h-12 items-center gap-3 rounded-lg border border-slate-100 px-3 text-base font-black ${
            option.disabled ? "bg-slate-100 text-slate-400" : "bg-slate-50 text-slate-900"
          }`}
        >
          <input
            className="h-5 w-5 min-h-0 rounded border-slate-300 p-0"
            defaultChecked={option.value === initialValue}
            disabled={option.disabled}
            name={name}
            required={required}
            type="radio"
            value={option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
