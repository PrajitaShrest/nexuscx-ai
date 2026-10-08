"use client";

import { useState } from "react";
import { inputClass } from "./Field";

// Password box with a Show/Hide button and a Caps Lock warning.
export default function PasswordInput({ id, name, autoComplete, invalid, value, onChange, describedBy }: {
  id: string; name: string; autoComplete: string; invalid?: boolean;
  value?: string; onChange?: (v: string) => void; describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));
  return (
    <div>
      <div className="relative">
        <input id={id} name={name} type={visible ? "text" : "password"} required autoComplete={autoComplete}
          value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => setCapsLock(false)}
          aria-invalid={invalid || undefined} aria-describedby={describedBy}
          className={`${inputClass(invalid)} pr-20`} />
        <button type="button" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}
          className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {capsLock && <p className="mt-1.5 text-sm text-amber-700">Caps Lock is on.</p>}
    </div>
  );
}
