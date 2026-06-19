# AppMetrica Basic Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize AppMetrica 8.3.0 on Android for automatic audience and session analytics.

**Architecture:** A local Expo config plugin reads `APPMETRICA_API_KEY` during prebuild, adds the Android SDK dependency and BuildConfig value, and patches the generated `MainApplication.kt` to activate AppMetrica before React Native starts. The API key remains in ignored local environment files and is not committed.

**Tech Stack:** Expo SDK 56 config plugins, Kotlin, Gradle, AppMetrica Analytics 8.3.0, Jest.

---

### Task 1: Lock Config Plugin Behavior

**Files:**
- Create: `src/core/config/__tests__/appMetricaPlugin.test.ts`

- [x] Write tests requiring dependency insertion, BuildConfig configuration, Kotlin initialization, missing-key validation, and idempotency.
- [x] Run `npx jest src/core/config/__tests__/appMetricaPlugin.test.ts --runInBand` and confirm failure because the plugin is absent.

### Task 2: Implement AppMetrica Config Plugin

**Files:**
- Create: `plugins/withAppMetrica.js`
- Modify: `app.json`
- Modify locally: `.env.local`

- [x] Implement pure Gradle and Kotlin patch helpers.
- [x] Read and validate `APPMETRICA_API_KEY` without adding it to tracked configuration.
- [x] Add `io.appmetrica.analytics:analytics:8.3.0`.
- [x] Add `BuildConfig.APPMETRICA_API_KEY` and call `AppMetrica.activate()` in `MainApplication.onCreate()`.
- [x] Register the plugin after the existing Huawei plugin.
- [x] Run the focused Jest test and confirm it passes.

### Task 3: Generate and Verify Android

**Files:**
- Generated: `android/app/build.gradle`
- Generated: `android/app/src/main/java/com/intstrfloat/blockblast/MainApplication.kt`

- [x] Run `npx expo prebuild --platform android --no-install`.
- [x] Reapply release signing with `node scripts/patch-signing.js`.
- [x] Verify generated Gradle and Kotlin contain the dependency and initialization without printing the API key.
- [x] Run lint, typecheck, all Jest tests, and `:app:assembleDebug`.
- [x] Confirm the APK contains AppMetrica classes and report remaining dashboard-side verification.
