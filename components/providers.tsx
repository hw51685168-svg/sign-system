"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorCaptureClient } from "@/components/error-capture-client";
import { FormSubmitGuard } from "@/components/form-submit-guard";
import { NavigationStateRefresh } from "@/components/navigation-state-refresh";
import { NativePushClient } from "@/components/native-push-client";
import { NotificationClient } from "@/components/notification-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FormSubmitGuard />
      <Suspense fallback={null}>
        <NavigationStateRefresh />
      </Suspense>
      <ErrorCaptureClient />
      <NativePushClient />
      <NotificationClient />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
