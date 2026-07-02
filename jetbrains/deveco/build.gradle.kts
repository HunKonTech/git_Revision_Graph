// DevEco Studio flavor. Huawei DevEco Studio is built on IntelliJ IDEA
// Community, so this targets the standard IntelliJ Platform against an IC
// version inside DevEco Studio's build-number range. Sideloaded ZIP only —
// no JetBrains Marketplace publish (see the :intellij flavor for that).
//
// This file is intentionally near-identical to ../intellij/build.gradle.kts:
// both compile the SAME sources in ../common and differ only in the platform
// version they build against and the branding/build-range they declare. The
// shared Kotlin lives in common/, not here.
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
        // DevEco Studio 5.x / NEXT is built on IntelliJ Platform ~231-233.
        create("IC", "2023.1.7")
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
        name = "Revision Graph for Git (SVN style) — DevEco Studio"
        version = providers.gradleProperty("pluginVersion")

        ideaVersion {
            // sinceBuild kept low so one ZIP installs across DevEco Studio's
            // whole range. untilBuild explicitly cleared (the Gradle plugin
            // otherwise defaults it to the build-target's major version,
            // which would block every newer IDE release without a republish).
            // See https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html
            sinceBuild = "231"
            untilBuild = provider { null }
        }
    }
}

tasks {
    processResources {
        // common/ resources + this flavor's plugin.xml are merged; the shared
        // webview bundle is staged into common/ by `npm run build:jetbrains-assets`.
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    }
}
