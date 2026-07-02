// Root of the JetBrains-family multi-project. It holds NO plugin of its own —
// the three flavor subprojects (:deveco, :intellij, :androidstudio) each produce
// a distribution from the SAME shared Kotlin sources in common/. The IntelliJ
// Platform Gradle plugin is declared here (apply false) only so every subproject
// can pin one version; each flavor's own build.gradle.kts applies the plugins and
// holds its full (nearly identical) config, differing only in the platform target
// and branding it reads from its gradle.properties.
plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.24" apply false
    id("org.jetbrains.intellij.platform") version "2.1.0" apply false
}
