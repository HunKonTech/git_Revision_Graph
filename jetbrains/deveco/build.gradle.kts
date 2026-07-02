// DevEco Studio flavor. Huawei DevEco Studio is built on IntelliJ IDEA
// Community, so this targets the standard IntelliJ Platform against an IC
// version inside DevEco Studio's build-number range. Ships as a sideloaded
// ZIP AND is wired for JetBrains Marketplace publishing — DevEco Studio's
// own Settings > Plugins > Marketplace panel is the same JetBrains
// Marketplace (it's an IntelliJ Platform IDE, not a separate Huawei plugin
// store), so this flavor is published there under its own plugin id
// (pluginGroupDeveco), distinct from the :intellij flavor's id.
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

// Stamp the plugin version into a plain classpath resource so
// WebViewHostPanel can cache-bust its extracted webview bundle without
// touching @Internal plugin APIs (PluginManagerCore.getPlugin /
// PluginManager.findEnabledPlugin, both flagged by the plugin verifier).
val revGraphVersionDir = layout.buildDirectory.dir("generated/revgraph-resources")
val writeRevGraphVersion by tasks.registering {
    val versionValue = providers.gradleProperty("pluginVersion").get()
    val outFile = revGraphVersionDir.map { it.file("revgraph-version.txt") }
    inputs.property("version", versionValue)
    outputs.file(outFile)
    doLast { outFile.get().asFile.apply { parentFile.mkdirs(); writeText(versionValue) } }
}

sourceSets {
    named("main") {
        // Pull in the shared Kotlin + shared resources (webview bundle, icons)
        // from common/; only META-INF/plugin.xml is this flavor's own resource.
        java.srcDir(rootProject.projectDir.resolve("common/src/main/kotlin"))
        resources.srcDir(rootProject.projectDir.resolve("common/src/main/resources"))
        resources.srcDir(revGraphVersionDir)
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
        id = providers.gradleProperty("pluginGroupDeveco")
        name = "Revision Graph for Git (SVN style) - DevEco Studio"
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

    // JetBrains Marketplace publish, same as :intellij — guarded by env vars
    // so builds without credentials (the default) still succeed and just
    // skip publishing. Reuses the same PUBLISH_TOKEN/signing secrets as
    // :intellij since both listings live under the same Marketplace account;
    // only the plugin id (pluginGroupDeveco) differs between the two.
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
        dependsOn(writeRevGraphVersion)
    }
}
