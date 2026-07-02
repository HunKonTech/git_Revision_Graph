// Mainstream JetBrains IDE flavor (IntelliJ IDEA and the wider IntelliJ
// Platform family: WebStorm, PyCharm, GoLand, etc.). Built against a current
// IC release and prepared for JetBrains Marketplace publishing — set the
// PUBLISH_TOKEN env var to enable `publishPlugin` (it is a no-op otherwise, so
// local/CI builds without a token still succeed as a sideloadable ZIP).
//
// This file is intentionally near-identical to ../deveco/build.gradle.kts:
// both compile the SAME sources in ../common and differ only in the platform
// version they build against and the branding/build-range they declare.
plugins {
    id("org.jetbrains.kotlin.jvm")
    id("org.jetbrains.intellij.platform")
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

sourceSets {
    named("main") {
        // Pull in the shared Kotlin + shared resources (webview bundle, icons)
        // from common/; only META-INF/plugin.xml is this flavor's own resource.
        java.srcDir(rootProject.projectDir.resolve("common/src/main/kotlin"))
        resources.srcDir(rootProject.projectDir.resolve("common/src/main/resources"))
    }
}

dependencies {
    intellijPlatform {
        create("IC", "2024.1")
        bundledPlugin("Git4Idea")
        instrumentationTools()
    }
    // Gson ships bundled with the IntelliJ Platform, but declaring it
    // explicitly keeps compileOnly resolution predictable across IDE versions
    // (mirrors System.Text.Json's explicit use on the VS host).
    compileOnly("com.google.code.gson:gson:2.10.1")
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    pluginConfiguration {
        id = providers.gradleProperty("pluginGroup")
        name = "Revision Graph for Git (SVN style)"
        version = providers.gradleProperty("pluginVersion")

        ideaVersion {
            // Built against 2024.1, installable back to 2023.1 (build 231).
            // untilBuild explicitly cleared (the Gradle plugin otherwise
            // defaults it to the build-target's major version, e.g. "241.*",
            // which would block every newer IDE release without a republish).
            // See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
            sinceBuild = "231"
            untilBuild = provider { null }
        }
    }

    // JetBrains Marketplace publish. Guarded by env vars so builds without
    // credentials (the default) still succeed and just skip publishing.
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }

    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }
}

tasks {
    processResources {
        // common/ resources + this flavor's plugin.xml are merged; the shared
        // webview bundle is staged into common/ by `npm run build:jetbrains-assets`.
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    }
}
