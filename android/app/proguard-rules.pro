# SriSah Schooling — release shrinking rules.
#
# Capacitor injects JavaScript bridges into the WebView; those classes and methods are
# called reflectively from JavaScript and must survive R8 shrinking and renaming.

-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.PluginMethod protected *;
}
-keep class com.getcapacitor.plugin.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# WebView JavaScript interfaces are annotated with @JavascriptInterface.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep the host activity: it is referenced from AndroidManifest.xml by name.
-keep class in.srisah.schooling.MainActivity { *; }

# Cordova compatibility layer (Capacitor includes it even when unused).
-keep class org.apache.cordova.** { *; }

# Preserve annotations and line numbers so Play Console crash reports stay readable.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable

# AndroidX core is safe to shrink; keep the splash-screen compat helper.
-keep class androidx.core.splashscreen.** { *; }

# Silence warnings for optional dependencies the WebView layer references.
-dontwarn org.apache.cordova.**
-dontwarn com.getcapacitor.**
