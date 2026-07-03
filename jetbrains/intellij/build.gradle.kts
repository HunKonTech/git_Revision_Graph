// The single JetBrains-family plugin build. Targets the base IntelliJ
// Platform (IC) at its oldest supported baseline so one build/listing covers
// the whole family — IntelliJ IDEA, Android Studio, Huawei DevEco Studio,
// WebStorm, PyCharm, GoLand, etc. — since Marketplace/IDE compatibility is
// matched by build-number range, not by product name. Prepared for JetBrains
// Marketplace publishing — set the PUBLISH_TOKEN env var to enable
// `publishPlugin` (it is a no-op otherwise, so local/CI builds without a
// token still succeed as a sideloadable ZIP).
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
        // from common/; only META-INF/plugin.xml is this subproject's own resource.
        java.srcDir(rootProject.projectDir.resolve("common/src/main/kotlin"))
        resources.srcDir(rootProject.projectDir.resolve("common/src/main/resources"))
        resources.srcDir(revGraphVersionDir)
    }
}

dependencies {
    intellijPlatform {
        // Oldest supported baseline (also what Android Studio and DevEco
        // Studio's IC releases are built on) so this single build's platform
        // API surface stays compatible across the whole family.
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
        name = "Revision Graph for Git (SVN style)"
        version = providers.gradleProperty("pluginVersion")

        ideaVersion {
            // sinceBuild kept low, untilBuild explicitly cleared (the Gradle
            // plugin otherwise defaults it to the build-target's major
            // version, e.g. "231.*", which would block every newer IDE
            // release without a republish) so one build installs across
            // IntelliJ IDEA, Android Studio, DevEco Studio, and the rest of
            // the IntelliJ Platform family.
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
        // common/ resources + this subproject's plugin.xml are merged; the shared
        // webview bundle is staged into common/ by `npm run build:jetbrains-assets`.
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
        dependsOn(writeRevGraphVersion)
    }
}
