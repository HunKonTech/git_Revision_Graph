// Root of the JetBrains-family multi-project. It holds NO plugin of its own —
// the :intellij subproject produces the single distribution from the shared
// Kotlin sources in common/. The IntelliJ Platform Gradle plugin is declared
// here (apply false) only so the subproject can pin one version;
// intellij/build.gradle.kts applies the plugins and holds the full config.
plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.24" apply false
    id("org.jetbrains.intellij.platform") version "2.1.0" apply false
}
