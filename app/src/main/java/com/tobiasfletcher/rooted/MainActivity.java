package com.tobiasfletcher.rooted;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.AtomicFile;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/** Offline journal host. Only packaged assets can access the narrow native bridge. */
public class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final int PICK_FILE = 41, EXPORT_FILE = 42;
    private static final int MAX_STATE_BYTES = 40 * 1024 * 1024;
    WebView web;
    private AtomicFile stateFile, previousFile, checkpointFile, upgradeFile;
    private ValueCallback<Uri[]> pickerCallback;
    private String pendingExport;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        stateFile = new AtomicFile(new File(getFilesDir(), "rooted-state.json"));
        previousFile = new AtomicFile(new File(getFilesDir(), "rooted-previous.json"));
        checkpointFile = new AtomicFile(new File(getFilesDir(), "rooted-before-import.json"));
        upgradeFile = new AtomicFile(new File(getFilesDir(), "rooted-before-history-v2.json"));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(247, 248, 242));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only user-selected documents returned by Android's picker.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("data".equals(uri.getScheme()) || "blob".equals(uri.getScheme())) return null;
                if ("https".equals(uri.getScheme()) && ORIGIN.equals(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/assets/")) {
                    WebResourceResponse response = assets.shouldInterceptRequest(uri);
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "utf-8", 403, "Blocked", null, new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !("https".equals(uri.getScheme()) && ORIGIN.equals(uri.getHost()) && "/assets/www/index.html".equals(uri.getPath()));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pickerCallback != null) pickerCallback.onReceiveValue(null);
                pickerCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] accepts = params.getAcceptTypes();
                boolean image = accepts.length > 0 && accepts[0].startsWith("image/");
                intent.setType(image ? "image/*" : "application/json");
                try { startActivityForResult(intent, PICK_FILE); }
                catch (Exception error) { pickerCallback.onReceiveValue(null); pickerCallback = null; notifyUser("No compatible file picker is available."); }
                return true;
            }
        });
        web.addJavascriptInterface(new NativeStorage(), "RootedNative");
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::handleBack);
        web.loadUrl("https://" + ORIGIN + "/assets/www/index.html");
    }

    private void handleBack() {
        web.evaluateJavascript("typeof rootedHandleBack === 'function' && rootedHandleBack()", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }
    // API 33+ uses the OnBackInvokedDispatcher registered in onCreate.
    // Keep this callback for back buttons on API 26-32 only.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    private void notifyUser(String message) {
        runOnUiThread(() -> web.evaluateJavascript("if(typeof toast==='function')toast(" + JSONObject.quote(message) + ")", null));
    }

    private byte[] readAtomic(AtomicFile file) throws java.io.IOException {
        if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath()+".bak").exists()) return null;
        return file.readFully();
    }
    private boolean validJournal(byte[] bytes) {
        try {
            JSONObject p = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            return p.optInt("version") == 1 && p.optJSONArray("containers") != null
                && p.optJSONArray("plants") != null && p.optJSONArray("events") != null && p.optJSONArray("nutrients") != null;
        } catch (Exception error) { return false; }
    }
    private void writeAtomic(AtomicFile file, byte[] bytes) throws java.io.IOException {
        FileOutputStream out = null;
        try { out = file.startWrite(); out.write(bytes); file.finishWrite(out); }
        catch (java.io.IOException error) { if (out != null) file.failWrite(out); throw error; }
    }
    private String readResult(AtomicFile file) {
        try {
            byte[] bytes = readAtomic(file);
            return new JSONObject().put("ok", true).put("value", bytes == null ? JSONObject.NULL : new String(bytes, StandardCharsets.UTF_8)).toString();
        } catch (Exception error) {
            return "{\"ok\":false,\"error\":\"Your saved journal could not be read. No data has been overwritten.\"}";
        }
    }
    public class NativeStorage {
        @JavascriptInterface public synchronized String readState() { return readResult(stateFile); }
        @JavascriptInterface public synchronized String readRecovery(String kind) {
            if ("upgrade".equals(kind)) return readResult(upgradeFile);
            if ("previous".equals(kind)) return readResult(previousFile);
            if ("checkpoint".equals(kind)) return readResult(checkpointFile);
            return "{\"ok\":false}";
        }
        @JavascriptInterface public synchronized String checkpoint() {
            try {
                byte[] old = readAtomic(stateFile);
                if (old != null) writeAtomic(checkpointFile, old);
                return "";
            } catch (Exception error) { return "Could not protect your existing journal. Export it before trying again."; }
        }
        @JavascriptInterface public synchronized String writeState(String json) {
            try {
                byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                if (bytes.length > MAX_STATE_BYTES) return "Journal exceeds 40 MB. Export a backup before adding more photos.";
                if (!validJournal(bytes)) return "Invalid journal data.";
                byte[] old = readAtomic(stateFile);
                if (old != null && java.util.Arrays.equals(old, bytes)) return "";
                if (old != null && validJournal(old)) {
                    if (readAtomic(upgradeFile) == null && new JSONObject(new String(old, StandardCharsets.UTF_8)).optInt("historyVersion") < 2) writeAtomic(upgradeFile, old);
                    writeAtomic(previousFile, old);
                }
                writeAtomic(stateFile, bytes);
                return "";
            } catch (Exception error) {
                return "Could not save your journal. Check available device storage and try again.";
            }
        }
        @JavascriptInterface public void exportBackup(String json) {
            if (json.getBytes(StandardCharsets.UTF_8).length > MAX_STATE_BYTES) { notifyUser("Backup exceeds the 40 MB limit."); return; }
            runOnUiThread(() -> {
                if (pendingExport != null) { notifyUser("A backup export is already open."); return; }
                pendingExport = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, "rooted-backup-" + LocalDate.now() + ".json");
                try { startActivityForResult(intent, EXPORT_FILE); }
                catch (Exception error) { pendingExport = null; notifyUser("Could not open the backup destination picker."); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && pickerCallback != null) {
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            pickerCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
            pickerCallback = null;
        } else if (request == EXPORT_FILE) {
            String json = pendingExport;
            pendingExport = null;
            if (result != RESULT_OK || data == null || data.getData() == null) return;
            if (json == null) { notifyUser("The app restarted during export. Please export again."); return; }
            Uri destination = data.getData();
            new Thread(() -> {
                try (OutputStream stream = getContentResolver().openOutputStream(destination, "wt")) {
                    if (stream == null) throw new java.io.IOException();
                    stream.write(json.getBytes(StandardCharsets.UTF_8));
                    notifyUser("Backup saved to your selected location.");
                } catch (Exception error) { notifyUser("Backup could not be saved. Please try another location."); }
            }).start();
        }
    }
    @Override protected void onDestroy() {
        if (pickerCallback != null) pickerCallback.onReceiveValue(null);
        web.removeJavascriptInterface("RootedNative");
        web.destroy();
        super.onDestroy();
    }
}
