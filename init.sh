#!/usr/bin/env bash

# Load this file into the current shell:
#   source ./init.sh
#
# It configures the JDK used by Gradle and discovers the local Android SDK.

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  for candidate in \
    "/usr/lib/jvm/java-21-openjdk-amd64" \
    "/usr/lib/jvm/java-21-openjdk" \
    "${HOME}/.jdks/temurin-21" \
    "${HOME}/.jdks/openjdk-21"; do
    if [[ -x "${candidate}/bin/java" ]]; then
      export JAVA_HOME="${candidate}"
      break
    fi
  done
fi

if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  echo "JDK 21 was not found. Install JDK 21 or set JAVA_HOME before sourcing this file." >&2
  return 1 2>/dev/null || exit 1
fi

export PATH="${JAVA_HOME}/bin:${PATH}"

if [[ -n "${ANDROID_HOME:-}" && -d "${ANDROID_HOME}" ]]; then
  android_sdk="${ANDROID_HOME}"
elif [[ -n "${ANDROID_SDK_ROOT:-}" && -d "${ANDROID_SDK_ROOT}" ]]; then
  android_sdk="${ANDROID_SDK_ROOT}"
else
  android_sdk=""
  for candidate in \
    "${HOME}/Android/Sdk" \
    "${HOME}/.local/share/Android/Sdk" \
    "/opt/android-sdk"; do
    if [[ -d "${candidate}" ]]; then
      android_sdk="${candidate}"
      break
    fi
  done
fi

if [[ -z "${android_sdk}" ]]; then
  echo "Android SDK was not found. Install it with Android Studio or set ANDROID_HOME." >&2
  return 1 2>/dev/null || exit 1
fi

export ANDROID_HOME="${android_sdk}"
export ANDROID_SDK_ROOT="${android_sdk}"
export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator:${PATH}"

# local.properties is ignored by Git and is required by the Android Gradle plugin.
sdk_dir_for_gradle="${android_sdk// /\\ }"
printf 'sdk.dir=%s\n' "${sdk_dir_for_gradle}" > "${project_root}/android/local.properties"

echo "Configured Java:   ${JAVA_HOME}"
echo "Configured Android SDK: ${ANDROID_HOME}"
echo "Generated:         ${project_root}/android/local.properties"
echo "Run:               npm run android:debug"
