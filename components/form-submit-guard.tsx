"use client";

import { useEffect } from "react";

function setSubmitButtonsDisabled(form: HTMLFormElement, disabled: boolean) {
  form.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button[type='submit'], input[type='submit']").forEach((button) => {
    if (disabled) {
      button.dataset.originalDisabled = button.disabled ? "true" : "false";
      button.disabled = true;
      return;
    }

    if (button.dataset.originalDisabled !== "true") button.disabled = false;
    delete button.dataset.originalDisabled;
  });
}

function notifyFormSubmitState(form: HTMLFormElement, state: "started" | "finished") {
  form.dispatchEvent(new CustomEvent("hx:form-submit-state", { detail: { state }, bubbles: true }));
}

function isSubmitControl(element: HTMLElement | null): element is HTMLButtonElement | HTMLInputElement {
  return element instanceof HTMLButtonElement || element instanceof HTMLInputElement;
}

function apiFormAction(form: HTMLFormElement) {
  const method = (form.getAttribute("method") || "get").toLowerCase();
  if (method !== "post") return null;

  const target = form.getAttribute("target");
  if (target && target !== "_self") return null;

  const action = form.getAttribute("action") || window.location.href;
  const actionUrl = new URL(action, window.location.href);
  if (actionUrl.origin !== window.location.origin || !actionUrl.pathname.startsWith("/api/")) return null;

  return actionUrl;
}

function buildFormData(form: HTMLFormElement, submitter: HTMLElement | null) {
  const formData = new FormData(form);
  if (!isSubmitControl(submitter) || !submitter.name) return formData;

  formData.set(submitter.name, submitter.value);
  return formData;
}

function messageFromJson(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : typeof record.message === "string" ? record.message : null;
}

async function submitApiForm(form: HTMLFormElement, submitter: HTMLElement | null, actionUrl: URL) {
  const formData = buildFormData(form, submitter);
  form.dataset.submitting = "true";
  notifyFormSubmitState(form, "started");
  setSubmitButtonsDisabled(form, true);

  try {
    const response = await fetch(actionUrl.toString(), {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      headers: { Accept: "text/html,application/xhtml+xml,application/json" },
      redirect: "follow"
    });

    if (response.redirected) {
      window.location.assign(response.url);
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => null);
      const message = messageFromJson(payload);
      if (!response.ok) {
        window.alert(message || "操作失敗，請重新整理後再試一次。");
        return;
      }
      window.location.reload();
      return;
    }

    if (!response.ok) {
      window.alert("操作失敗，請重新整理後再試一次。");
      return;
    }

    window.location.reload();
  } catch {
    window.alert("網路連線中斷，請確認連線後再試一次。");
  } finally {
    delete form.dataset.submitting;
    setSubmitButtonsDisabled(form, false);
    notifyFormSubmitState(form, "finished");
  }
}

export function FormSubmitGuard() {
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      if (form.dataset.submitting === "true") {
        event.preventDefault();
        return;
      }

      if (event.defaultPrevented) return;
      const actionUrl = apiFormAction(form);
      if (!actionUrl) return;

      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      event.preventDefault();
      void submitApiForm(form, submitter, actionUrl);
    }

    function resetSubmittingForms() {
      document.querySelectorAll<HTMLFormElement>("form[data-submitting='true']").forEach((form) => {
        delete form.dataset.submitting;
        setSubmitButtonsDisabled(form, false);
        notifyFormSubmitState(form, "finished");
      });
    }

    document.addEventListener("submit", handleSubmit);
    window.addEventListener("pageshow", resetSubmittingForms);
    return () => {
      document.removeEventListener("submit", handleSubmit);
      window.removeEventListener("pageshow", resetSubmittingForms);
    };
  }, []);

  return null;
}
