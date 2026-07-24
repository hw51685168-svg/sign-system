"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui";

export function ApprovalSubmitButton() {
  const [submitting, setSubmitting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const button = buttonRef.current;
    const form = button?.form;
    if (!form) return;

    function handleSubmitState(event: Event) {
      const detail = (event as CustomEvent<{ state?: string }>).detail;
      setSubmitting(detail?.state === "started");
    }

    function reset() {
      setSubmitting(false);
    }

    form.addEventListener("hx:form-submit-state", handleSubmitState);
    window.addEventListener("pageshow", reset);
    return () => {
      form.removeEventListener("hx:form-submit-state", handleSubmitState);
      window.removeEventListener("pageshow", reset);
    };
  }, []);

  return (
    <Button
      ref={buttonRef}
      className="min-h-14 px-8 text-xl"
      type="submit"
      disabled={submitting}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (form && !form.checkValidity()) {
          event.preventDefault();
          form.reportValidity();
        }
      }}
    >
      <Send className="h-5 w-5" />
      {submitting ? "送出中，請稍候" : "送出簽呈"}
    </Button>
  );
}
