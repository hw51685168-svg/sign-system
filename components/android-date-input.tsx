"use client";

import { useEffect, useState } from "react";

type AndroidDateInputProps = {
  name: string;
  required?: boolean;
  defaultValue?: string;
  label?: string;
};

export function AndroidDateInput({ name, required, defaultValue = "", label = "請輸入截止日期" }: AndroidDateInputProps) {
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setIsAndroidApp(Boolean((window as Window & { HuangxiangAndroid?: unknown }).HuangxiangAndroid));
  }, []);

  if (isAndroidApp) {
    return (
      <div className="grid gap-2">
        <input
          aria-label={label}
          autoComplete="off"
          defaultValue={defaultValue}
          inputMode="numeric"
          maxLength={10}
          name={name}
          onChange={(event) => setValue(event.currentTarget.value)}
          pattern="\d{4}-\d{2}-\d{2}"
          placeholder={`${label}，例如 2026-07-31`}
          required={required}
          title="請輸入西元年月日，格式例如 2026-07-31"
          type="text"
        />
        <p className="text-sm font-bold text-slate-500">Android App 日期請輸入西元年月日，例如 2026-07-31。</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        aria-label={label}
        defaultValue={defaultValue}
        name={name}
        onChange={(event) => setValue(event.currentTarget.value)}
        required={required}
        type="date"
      />
      {isAndroidApp && !value ? (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-500">
          {label}
        </span>
      ) : null}
    </div>
  );
}
