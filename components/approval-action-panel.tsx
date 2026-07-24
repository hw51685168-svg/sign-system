"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button, Field } from "@/components/ui";

export function ApprovalActionPanel({
  approvalId,
  requiresSignature = false,
  hasSignature = true
}: {
  approvalId: string;
  requiresSignature?: boolean;
  hasSignature?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const approveButtonRef = useRef<HTMLButtonElement>(null);
  const approveConfirmedRef = useRef(false);

  function validate(nextAction: string) {
    setError("");

    if (nextAction === "APPROVE") {
      if (requiresSignature && !hasSignature) {
        setError("請先完成電子手寫簽名，再核准簽呈。");
        return false;
      }
      return true;
    }

    if (nextAction === "REJECT" && !comment.trim()) {
      setError("駁回時請填寫原因，讓申請人知道問題在哪裡。");
      return false;
    }

    if (nextAction === "REQUEST_REVISION" && !comment.trim()) {
      setError("退回修改時請填寫需要補充或修改的內容。");
      return false;
    }

    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;
    const nextAction = submitter?.value || "";

    if (!validate(nextAction)) {
      event.preventDefault();
      return;
    }

    if (nextAction === "APPROVE") {
      if (!approveConfirmedRef.current) {
        event.preventDefault();
        setIsApproveConfirmOpen(true);
        return;
      }

      approveConfirmedRef.current = false;
    }
  }

  function confirmApprove() {
    approveConfirmedRef.current = true;
    setIsApproveConfirmOpen(false);
    formRef.current?.requestSubmit(approveButtonRef.current ?? undefined);
  }

  function cancelApprove() {
    approveConfirmedRef.current = false;
    setIsApproveConfirmOpen(false);
  }

  return (
    <form ref={formRef} action={`/api/approvals/${approvalId}/actions`} method="post" className="grid gap-4" onSubmit={handleSubmit}>
      {requiresSignature && !hasSignature ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-base font-bold leading-7 text-amber-950">
          這張簽呈需要電子手寫簽名。請先在左側簽名區簽名，再按核准。
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-base font-bold leading-7 text-red-900" role="alert">
          {error}
        </div>
      ) : null}
      <Field label="簽核意見 / 原因" hint="核准可填寫備註；駁回或退回修改時必填。">
        <textarea
          name="comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="請輸入簽核意見、駁回原因或需要補充的內容。"
        />
      </Field>
      <div className="grid gap-3">
        <Button ref={approveButtonRef} className="min-h-16 text-xl" name="action" value="APPROVE" type="submit" disabled={requiresSignature && !hasSignature}>
          <Check className="h-6 w-6" />
          核准
        </Button>
        <Button className="min-h-16 text-xl" name="action" value="REJECT" type="submit" variant="danger">
          <X className="h-6 w-6" />
          駁回
        </Button>
        <Button className="min-h-16 text-xl" name="action" value="REQUEST_REVISION" type="submit" variant="secondary">
          <RotateCcw className="h-6 w-6" />
          退回修改
        </Button>
      </div>
      {isApproveConfirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="approve-confirm-title">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <p id="approve-confirm-title" className="text-2xl font-black leading-8 text-slate-950">
              確定要核准這張簽呈嗎？
            </p>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
              送出後會進入下一關，或在最後一關完成核准。請確認內容、附件與簽名都正確。
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button type="button" variant="secondary" className="min-h-14 text-lg" onClick={cancelApprove}>
                取消
              </Button>
              <Button type="button" className="min-h-14 text-lg" onClick={confirmApprove}>
                確定核准
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
