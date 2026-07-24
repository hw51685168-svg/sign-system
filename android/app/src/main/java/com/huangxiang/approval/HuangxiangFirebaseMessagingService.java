package com.huangxiang.approval;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class HuangxiangFirebaseMessagingService extends FirebaseMessagingService {
    private static final String LOG_TAG = "JUeSignFcm";
    private static final String FALLBACK_TITLE = "JU\u6578\u4f4d\u7ba1\u7406\u901a\u77e5";
    private static final String FALLBACK_BODY = "\u4f60\u6709\u4e00\u7b46\u5f85\u8655\u7406\u9805\u76ee\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";

    private boolean looksGarbled(String value) {
        if (value == null) return true;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return true;
        int questionCount = 0;
        int replacementCount = 0;
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c == '?') questionCount++;
            if (c == '\uFFFD') replacementCount++;
        }
        return questionCount >= Math.max(3, trimmed.length() / 3) || replacementCount > 0;
    }

    private String cleanTitle(String title) {
        return looksGarbled(title) ? FALLBACK_TITLE : title.trim();
    }

    private String cleanBody(String body) {
        return looksGarbled(body) ? FALLBACK_BODY : body.trim();
    }

    @SuppressWarnings("deprecation")
    private void wakeScreenBrieflyIfNeeded() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null || powerManager.isInteractive()) return;

            PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "HuangxiangApproval:notificationWake"
            );
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(3_000);
        } catch (RuntimeException error) {
            Log.w(LOG_TAG, "Unable to wake screen for notification", error);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        MainActivity.createNotificationChannel(this);

        String title = FALLBACK_TITLE;
        String body = FALLBACK_BODY;
        Map<String, String> data = remoteMessage.getData();

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null) title = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null) body = remoteMessage.getNotification().getBody();
        }

        String dataTitle = data.get("title");
        String dataBody = data.get("body");
        if (looksGarbled(title) && dataTitle != null) title = dataTitle;
        if (looksGarbled(body) && dataBody != null) body = dataBody;

        title = cleanTitle(title);
        body = cleanBody(body);

        String targetUrl = data.get("targetUrl");
        if (targetUrl == null || targetUrl.trim().isEmpty()) targetUrl = "/notifications";

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(MainActivity.EXTRA_TARGET_URL, targetUrl);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() % Integer.MAX_VALUE),
            intent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification.Builder builder =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, MainActivity.NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);

        Notification notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS)
            .setVibrate(new long[] { 0, 280, 120, 280 })
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .build();

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            wakeScreenBrieflyIfNeeded();
            notificationManager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), notification);
        }
    }
}
