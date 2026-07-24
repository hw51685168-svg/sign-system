package com.huangxiang.approval;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;

import androidx.core.content.FileProvider;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String LOG_TAG = "JUeSign";
    public static final String APP_URL = "https://huangxiang-approval.serveousercontent.com";
    public static final String NOTIFICATION_CHANNEL_ID = "ju_esign_alerts_v2";
    public static final String EXTRA_TARGET_URL = "targetUrl";

    private static final int NOTIFICATION_PERMISSION_REQUEST = 501;
    private static final int FILE_CHOOSER_REQUEST = 502;
    private static final String ANDROID_WEBVIEW_COMPAT_STYLE =
        "@media (max-width:767px){*,*::before,*::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}"
            + "header.sticky{background:#fff!important;background-image:none!important;"
            + "-webkit-backdrop-filter:none!important;backdrop-filter:none!important;position:relative!important;"
            + "top:auto!important;z-index:auto!important;}"
            + "nav.fixed.inset-x-0.bottom-0.z-40{padding-bottom:.5rem!important;}"
            + "main.mx-auto.max-w-7xl{padding-bottom:6rem!important;}}";
    private static final String FALLBACK_TITLE = "JU\u6578\u4f4d\u7ba1\u7406\u901a\u77e5";
    private static final String FALLBACK_BODY = "\u4f60\u6709\u4e00\u7b46\u5f85\u8655\u7406\u9805\u76ee\uff0c\u8acb\u9032\u5165 JU\u6578\u4f4d\u7ba1\u7406\u67e5\u770b\u3002";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private long pendingPdfDownloadId = -1L;
    private String pendingPdfFileName;
    private BroadcastReceiver pdfDownloadReceiver;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (getActionBar() != null) {
            getActionBar().hide();
        }
        setContentView(R.layout.activity_main);

        createNotificationChannel(this);
        requestNotificationPermissionIfNeeded();

        webView = findViewById(R.id.main_webview);
        applySystemBarInsets(findViewById(android.R.id.content));
        webView.setBackgroundColor(0xFFFFFFFF);
        webView.clearCache(true);
        webView.clearFormData();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebView.setWebContentsDebuggingEnabled(true);
        webView.addJavascriptInterface(new AndroidBridge(), "HuangxiangAndroid");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception error) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }

                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    MainActivity.this.filePathCallback = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView childView = new WebView(MainActivity.this);
                childView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        String url = request == null || request.getUrl() == null ? APP_URL : request.getUrl().toString();
                        if (isPdfExportUrl(url)) {
                            downloadAndOpenPdf(url, "JU-eSign-approval.pdf");
                        } else if (webView != null) {
                            webView.loadUrl(normalizeAppUrl(url));
                        }
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(childView);
                resultMsg.sendToTarget();
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                view.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                applyAndroidWebViewCompatibilityStyle(view);
                requestInitialWebViewRepaint(view);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request != null && request.isForMainFrame()) {
                    showErrorPage(error);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null || !request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (isPdfExportUrl(url)) {
                    downloadAndOpenPdf(url, "JU-eSign-approval.pdf");
                    return true;
                }
                return false;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(targetUrlFromIntent(getIntent()));
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void applyAndroidWebViewCompatibilityStyle(WebView view) {
        if (view == null) return;
        String script = "(function(){var id='ju-android-webview-compat';"
            + "if(document.getElementById(id)){return;}"
            + "var style=document.createElement('style');style.id=id;style.textContent='"
            + ANDROID_WEBVIEW_COMPAT_STYLE
            + "';(document.head||document.documentElement).appendChild(style);})();";
        view.evaluateJavascript(script, null);
    }

    private void requestInitialWebViewRepaint(WebView view) {
        if (view == null) return;
        String script = "(function(){if(window.__juAndroidInitialRepaintDone){return;}"
            + "window.__juAndroidInitialRepaintDone=true;var nudge=function(){"
            + "if(document.documentElement.scrollHeight<=window.innerHeight){return;}"
            + "var root=document.documentElement;var prior=root.style.scrollBehavior;"
            + "var x=window.scrollX;var y=window.scrollY;root.style.scrollBehavior='auto';"
            + "window.scrollTo(x,y+1);window.setTimeout(function(){window.scrollTo(x,y);"
            + "root.style.scrollBehavior=prior;},180);};"
            + "window.setTimeout(nudge,1200);window.setTimeout(nudge,2600);"
            + "window.setTimeout(nudge,4800);})();";
        view.evaluateJavascript(script, null);
    }

    private void applySystemBarInsets(View rootView) {
        rootView.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View content, WindowInsets insets) {
                content.setPadding(
                    insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom()
                );
                return insets;
            }
        });
        rootView.requestApplyInsets();
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "JU\u6578\u4f4d\u7ba1\u7406\u901a\u77e5",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("\u7c3d\u5448\u3001\u4efb\u52d9\u8207\u7cfb\u7d71\u63d0\u9192\u3002");
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 280, 120, 280 });
        channel.setSound(
            Settings.System.DEFAULT_NOTIFICATION_URI,
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.createNotificationChannel(channel);
            notificationManager.deleteNotificationChannel("huangxiang_approval_alerts");
        }
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !hasNotificationPermission()) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private String targetUrlFromIntent(Intent intent) {
        if (intent == null) return APP_URL;
        String targetUrl = intent.getStringExtra(EXTRA_TARGET_URL);
        if (targetUrl == null && intent.getData() != null) {
            targetUrl = intent.getData().toString();
        }
        return normalizeAppUrl(targetUrl);
    }

    private String normalizeAppUrl(String targetUrl) {
        if (targetUrl == null || targetUrl.trim().isEmpty()) return APP_URL;
        String trimmed = targetUrl.trim();
        try {
            Uri parsed = Uri.parse(trimmed);
            if (parsed.isRelative()) {
                return APP_URL + (trimmed.startsWith("/") ? trimmed : "/" + trimmed);
            }
            if ("huangxiang-approval.serveousercontent.com".equals(parsed.getHost())) {
                return trimmed;
            }
        } catch (Exception ignored) {
            return APP_URL;
        }
        return APP_URL;
    }

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

    private void showNativeNotification(String title, String body) {
        if (!hasNotificationPermission()) {
            requestNotificationPermissionIfNeeded();
            return;
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_TARGET_URL, "/notifications");
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() % Integer.MAX_VALUE),
            intent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification.Builder builder =
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);

        String safeTitle = cleanTitle(title);
        String safeBody = cleanBody(body);
        Notification notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(safeTitle)
            .setContentText(safeBody)
            .setStyle(new Notification.BigTextStyle().bigText(safeBody))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setShowWhen(true)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE | Notification.DEFAULT_LIGHTS)
            .setVibrate(new long[] { 0, 280, 120, 280 })
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .build();

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), notification);
        }
    }

    private boolean isPdfExportUrl(String url) {
        if (url == null) return false;
        return url.contains("/api/approvals/") && url.contains("/export");
    }

    private String safePdfFileName(String fileName) {
        String cleaned = fileName == null ? "" : fileName.trim().replaceAll("[\\\\/:*?\"<>|]", "-");
        if (cleaned.isEmpty()) cleaned = "JU-eSign-approval.pdf";
        if (!cleaned.toLowerCase().endsWith(".pdf")) cleaned += ".pdf";
        return cleaned;
    }

    private void unregisterPdfReceiver() {
        if (pdfDownloadReceiver == null) return;
        try {
            unregisterReceiver(pdfDownloadReceiver);
        } catch (Exception ignored) {
            // Receiver may already be unregistered by Android after process recreation.
        }
        pdfDownloadReceiver = null;
    }

    private void downloadAndOpenPdf(String targetUrl, String fileName) {
        String url = normalizeAppUrl(targetUrl);
        String safeFileName = safePdfFileName(fileName);
        String cookies = CookieManager.getInstance().getCookie(APP_URL);
        Log.i(LOG_TAG, "prepare pdf download url=" + url + " file=" + safeFileName + " hasCookies=" + (cookies != null && !cookies.trim().isEmpty()));
        showNativeNotification("正在準備 PDF", "下載完成後會開啟手機 PDF 檢視器。");

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                File downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (downloadsDir == null) throw new Exception("Downloads directory unavailable");
                if (!downloadsDir.exists() && !downloadsDir.mkdirs()) throw new Exception("Cannot create downloads directory");

                File pdfFile = new File(downloadsDir, safeFileName);
                URL pdfUrl = new URL(url);
                connection = (HttpURLConnection) pdfUrl.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("Accept", "application/pdf");
                if (cookies != null && !cookies.trim().isEmpty()) {
                    connection.setRequestProperty("Cookie", cookies);
                }

                int statusCode = connection.getResponseCode();
                Log.i(LOG_TAG, "pdf response status=" + statusCode + " contentType=" + connection.getContentType());
                if (statusCode < 200 || statusCode >= 300) {
                    throw new Exception("PDF request failed: " + statusCode);
                }

                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(pdfFile, false)) {
                    byte[] buffer = new byte[8192];
                    int length;
                    while ((length = input.read(buffer)) != -1) {
                        output.write(buffer, 0, length);
                    }
                    output.flush();
                }

                runOnUiThread(() -> openPdfFile(pdfFile));
            } catch (Exception error) {
                Log.e(LOG_TAG, "pdf download failed", error);
                runOnUiThread(() -> showNativeNotification("PDF 預覽失敗", "PDF 下載失敗，請確認登入狀態或稍後再試。"));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    private void openPdfFile(File pdfFile) {
        try {
            if (pdfFile == null || !pdfFile.exists()) {
                Log.e(LOG_TAG, "pdf file missing");
                showNativeNotification("PDF 預覽失敗", "PDF 尚未下載完成，請稍後再試。");
                return;
            }

            Log.i(LOG_TAG, "open pdf file=" + pdfFile.getAbsolutePath() + " length=" + pdfFile.length());
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", pdfFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(Intent.createChooser(intent, "開啟簽呈 PDF"));
        } catch (Exception error) {
            Log.e(LOG_TAG, "open pdf failed", error);
            showNativeNotification("PDF 開啟失敗", "手機沒有可用的 PDF 閱讀器，請先安裝 PDF 檢視器或改用下載 PDF。");
        }
    }

    private void downloadAndOpenPdfLegacy(String targetUrl, String fileName) {
        String url = normalizeAppUrl(targetUrl);
        String safeFileName = safePdfFileName(fileName);
        DownloadManager downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            showNativeNotification("PDF 預覽失敗", "手機下載服務無法使用，請稍後再試。");
            return;
        }

        try {
            unregisterPdfReceiver();
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle(safeFileName);
            request.setDescription("JU數位管理正在準備簽呈 PDF");
            request.setMimeType("application/pdf");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, safeFileName);

            String cookies = CookieManager.getInstance().getCookie(APP_URL);
            if (cookies != null && !cookies.trim().isEmpty()) {
                request.addRequestHeader("Cookie", cookies);
            }

            pendingPdfFileName = safeFileName;
            pendingPdfDownloadId = downloadManager.enqueue(request);
            pdfDownloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long completedId = intent == null ? -1L : intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                    if (completedId != pendingPdfDownloadId) return;
                    openDownloadedPdf(pendingPdfFileName);
                    unregisterPdfReceiver();
                }
            };

            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(pdfDownloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(pdfDownloadReceiver, filter);
            }
            showNativeNotification("正在準備 PDF", "下載完成後會開啟手機 PDF 檢視器。");
        } catch (Exception error) {
            showNativeNotification("PDF 預覽失敗", "無法準備 PDF，請確認網路後再試。");
        }
    }

    private void openDownloadedPdf(String fileName) {
        try {
            File downloadsDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadsDir == null) {
                showNativeNotification("PDF 預覽失敗", "找不到手機下載資料夾。");
                return;
            }

            File pdfFile = new File(downloadsDir, safePdfFileName(fileName));
            if (!pdfFile.exists()) {
                showNativeNotification("PDF 預覽失敗", "PDF 尚未下載完成，請稍後再試。");
                return;
            }

            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", pdfFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(Intent.createChooser(intent, "開啟簽呈 PDF"));
        } catch (Exception error) {
            showNativeNotification("PDF 已下載", "手機沒有可開啟 PDF 的應用程式，請安裝 PDF 檢視器後再試。");
        }
    }

    private boolean firebaseConfigured() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
            }
            return !FirebaseApp.getApps(this).isEmpty();
        } catch (Exception ignored) {
            return false;
        }
    }

    private void requestFcmToken() {
        if (!firebaseConfigured()) {
            dispatchNativePushToken("unavailable", null, "android", "fcm", "\u5c1a\u672a\u653e\u5165 google-services.json\uff0c\u66ab\u6642\u7121\u6cd5\u53d6\u5f97 FCM token");
            return;
        }

        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful() || task.getResult() == null) {
                    Exception exception = task.getException();
                    dispatchNativePushToken("error", null, "android", "fcm", exception == null ? "\u53d6\u5f97 FCM token \u5931\u6557" : exception.getMessage());
                    return;
                }
                dispatchNativePushToken("registered", task.getResult(), "android", "fcm", null);
            });
    }

    private void dispatchNativePushToken(String status, String token, String platform, String provider, String error) {
        if (webView == null) return;
        try {
            JSONObject detail = new JSONObject();
            detail.put("status", status);
            detail.put("platform", platform);
            detail.put("provider", provider);
            detail.put("deviceModel", Build.MANUFACTURER + " " + Build.MODEL);
            detail.put("osVersion", "Android " + Build.VERSION.RELEASE);
            detail.put("appVersion", "0.1.0");
            if (token != null) detail.put("token", token);
            if (error != null) detail.put("error", error);
            String script = "window.dispatchEvent(new CustomEvent('huangxiang:native-push-token',{detail:" + detail.toString() + "}));";
            runOnUiThread(() -> webView.evaluateJavascript(script, null));
        } catch (JSONException ignored) {
            runOnUiThread(() -> webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('huangxiang:native-push-token',{detail:{status:'error',error:'FCM token event failed'}}));", null));
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getNotificationPermissionStatus() {
            return hasNotificationPermission() ? "granted" : "denied";
        }

        @JavascriptInterface
        public String getFcmAvailabilityStatus() {
            return firebaseConfigured() ? "configured" : "missing-google-services";
        }

        @JavascriptInterface
        public String requestNotificationPermission() {
            runOnUiThread(() -> requestNotificationPermissionIfNeeded());
            return getNotificationPermissionStatus();
        }

        @JavascriptInterface
        public void requestFcmToken() {
            runOnUiThread(() -> MainActivity.this.requestFcmToken());
        }

        @JavascriptInterface
        public void showTestNotification(String title, String body) {
            runOnUiThread(() -> showNativeNotification(title, body));
        }

        @JavascriptInterface
        public void openPdf(String url, String fileName) {
            Log.i(LOG_TAG, "bridge openPdf url=" + url + " fileName=" + fileName);
            runOnUiThread(() -> downloadAndOpenPdf(url, fileName));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[] { data.getData() };
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    private void showErrorPage(WebResourceError error) {
        String description = error == null
            ? "\u7121\u6cd5\u9023\u7dda\u5230 JU\u96fb\u7c3d\uff0c\u8acb\u78ba\u8a8d\u7db2\u8def\u5f8c\u518d\u8a66\u4e00\u6b21\u3002"
            : String.valueOf(error.getDescription());
        String html = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1' />"
            + "<meta charset='utf-8' />"
            + "<style>body{font-family:sans-serif;padding:32px;background:#f6f8f7;color:#102033;line-height:1.7}"
            + "button{width:100%;padding:16px;border:0;border-radius:10px;background:#17633a;color:white;font-size:18px;font-weight:700}"
            + ".card{background:white;border-radius:14px;padding:24px;box-shadow:0 8px 24px rgba(0,0,0,.08)}</style></head>"
            + "<body><div class='card'><h1>\u7121\u6cd5\u958b\u555f JU\u96fb\u7c3d</h1>"
            + "<p>" + escapeHtml(description) + "</p>"
            + "<p>\u8acb\u78ba\u8a8d\u7db2\u8def\u9023\u7dda\u6b63\u5e38\uff0c\u6216\u56de\u5230\u9996\u9801\u91cd\u65b0\u8f09\u5165\u3002</p>"
            + "<button onclick=\"location.href='" + APP_URL + "'\">\u91cd\u65b0\u8f09\u5165</button></div></body></html>";
        webView.loadDataWithBaseURL(APP_URL, html, "text/html", "UTF-8", APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (webView != null) {
            webView.loadUrl(targetUrlFromIntent(intent));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
