"use client";

import type { FormEvent } from "react";
import { useState } from "react";
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

  function validate(nextAction: string) {
    if (nextAction === "APPROVE") {
      if (requiresSignature && !hasSignature) {
        window.alert("請先完成電子手寫簽名，再按核准。");
        return false;
      }
      return window.confirm("確認要核准這張簽呈？送出後會進入下一關簽核。");
    }

    if (nextAction === "REJECT" && !comment.trim()) {
      window.alert("駁回必須填寫原因。");
      return false;
    }

    if (nextAction === "REQUEST_REVISION" && !comment.trim()) {
      window.alert("退回修改必須填寫修改說明。");
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
    }
  }

  return (
    <form action={`/api/approvals/${approvalId}/actions`} method="post" className="grid gap-4" onSubmit={handleSubmit}>
      {requiresSignature && !hasSignature ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-base font-bold leading-7 text-amber-950">
          此簽呈需要電子手寫簽名。請先完成簽名後，再按核准。
        </div>
      ) : null}
      <Field label="簽核意見 / 原因" hint="駁回或退回修改必填；核准可簡短備註。">
        <textarea
          name="comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="請輸入核准備註、駁回原因或退回修改說明。"
        />
      </Field>
      <div className="grid gap-3">
        <Button className="min-h-16 text-xl" name="action" value="APPROVE" type="submit" disabled={requiresSignature && !hasSignature}>
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
    </form>
  );
}
