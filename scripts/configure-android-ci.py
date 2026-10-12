#!/usr/bin/env python3
"""Apply CI versioning and signing settings to the generated Capacitor project."""

import os
import re
from pathlib import Path


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Required environment variable {name} is missing")
    return value


run_number = int(required_env("GITHUB_RUN_NUMBER"))
run_attempt = int(required_env("GITHUB_RUN_ATTEMPT"))
if run_number < 1 or not 1 <= run_attempt <= 99:
    raise SystemExit("GitHub run number must be positive and attempt must be between 1 and 99")

version_code = run_number * 100 + run_attempt
if version_code > 2_100_000_000:
    raise SystemExit("Computed Android versionCode exceeds Android's supported limit")

ref_type = required_env("GITHUB_REF_TYPE")
ref_name = required_env("GITHUB_REF_NAME")
if ref_type == "tag":
    if not re.fullmatch(r"v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", ref_name):
        raise SystemExit("Release tags must use vMAJOR.MINOR.PATCH, for example v1.2.3")
    version_name = ref_name[1:]
else:
    version_name = f"0.0.0-ci.{run_number}"

gradle_file = Path("android/app/build.gradle")
if not gradle_file.is_file():
    raise SystemExit(f"Generated Gradle file not found: {gradle_file}")

contents = gradle_file.read_text(encoding="utf-8")
contents, code_count = re.subn(r"(?m)^\s*versionCode\s+\d+\s*$", f"        versionCode {version_code}", contents, count=1)
contents, name_count = re.subn(
    r'(?m)^\s*versionName\s+"[^"]*"\s*$',
    f'        versionName "{version_name}"',
    contents,
    count=1,
)
if code_count != 1 or name_count != 1:
    raise SystemExit("Capacitor Gradle template changed; could not set versionCode/versionName")

signing_block = '''    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }

'''
build_types_start = "    buildTypes {\n        release {"
build_types_replacement = '''    buildTypes {
        debug {
            applicationIdSuffix ".debug"
            versionNameSuffix "-debug"
        }
        release {
            signingConfig signingConfigs.release'''
if contents.count(build_types_start) != 1:
    raise SystemExit("Capacitor Gradle template changed; could not configure build types")
contents = contents.replace(build_types_start, signing_block + build_types_replacement, 1)
gradle_file.write_text(contents, encoding="utf-8")

print(f"Configured Android versionCode={version_code}, versionName={version_name}")
print("Configured app.web.codexmusicae.debug for the debug build")

# Capacitor generates the Android project in CI. Keep the WebView edge-to-edge
# configuration here so the web app can account for system-bar safe areas via
# env(safe-area-inset-*), without committing generated Android sources.
activity_candidates = [
    Path("android/app/src/main/java/app/web/codexmusicae/MainActivity.java"),
    Path("android/app/src/main/java/app/web/codexmusicae/MainActivity.kt"),
]
activity_file = next((path for path in activity_candidates if path.is_file()), None)
if activity_file is None:
    raise SystemExit("Generated Capacitor MainActivity was not found")

activity = activity_file.read_text(encoding="utf-8")
if activity_file.suffix == ".java":
    if "WindowCompat.setDecorFitsSystemWindows" not in activity:
        activity = activity.replace(
            "import com.getcapacitor.BridgeActivity;",
            "import android.os.Bundle;\nimport androidx.core.view.WindowCompat;\nimport androidx.core.view.WindowInsetsCompat;\nimport androidx.core.view.WindowInsetsControllerCompat;\nimport com.getcapacitor.BridgeActivity;",
            1,
        )
        activity = activity.replace(
            "public class MainActivity extends BridgeActivity {",
            "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);\n        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());\n        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);\n        controller.hide(WindowInsetsCompat.Type.systemBars());\n    }",
            1,
        )
else:
    if "WindowCompat.setDecorFitsSystemWindows" not in activity:
        activity = activity.replace(
            "import com.getcapacitor.BridgeActivity",
            "import android.os.Bundle\nimport androidx.core.view.WindowCompat\nimport androidx.core.view.WindowInsetsCompat\nimport androidx.core.view.WindowInsetsControllerCompat\nimport com.getcapacitor.BridgeActivity",
            1,
        )
        activity = activity.replace(
            "class MainActivity : BridgeActivity()",
            "class MainActivity : BridgeActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        WindowCompat.setDecorFitsSystemWindows(window, false)\n        val controller = WindowCompat.getInsetsController(window, window.decorView)\n        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE\n        controller.hide(WindowInsetsCompat.Type.systemBars())\n    }",
            1,
        )
activity_file.write_text(activity, encoding="utf-8")
print(f"Configured edge-to-edge window in {activity_file}")
