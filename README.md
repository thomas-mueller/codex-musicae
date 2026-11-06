# CodexMusicae

Proprietary software, all rights reserved. See [LICENSE](LICENSE); third-party licenses are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.12.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Android local setup

Before building the Android debug APK, load the repository setup script into your current shell:

```bash
source ./init.sh
```

The script selects JDK 21 for Gradle, discovers the local Android SDK, exports `JAVA_HOME`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT`, and generates the ignored `android/local.properties` file required by the Android Gradle plugin. It checks existing SDK environment variables first, then common Android Studio SDK locations.

After setup, build the APK with:

```bash
npm run android:debug
```

If JDK 21 or the Android SDK is installed elsewhere, set `JAVA_HOME` or `ANDROID_HOME` before sourcing `init.sh`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Working with coding agents

Standing instructions for coding agents are in `AGENTS.md` (mirrored in `CLAUDE.md`, `.claude/CLAUDE.md` and `.gemini/GEMINI.md`). The repository owner commits and pushes all code personally; agents never run `git commit`, `git push` or `git tag`. They leave changes in the working tree and propose a commit message.
