// The JetBrains-family host is a Gradle multi-project with ONE plugin
// subproject (:intellij) compiling the shared codebase in common/. It targets
// the base IntelliJ Platform (IC) with an unbounded build-number range, so the
// same build installs across the whole IntelliJ Platform family — IntelliJ
// IDEA, Android Studio, Huawei DevEco Studio, WebStorm, PyCharm, GoLand, etc.
// — from one Marketplace listing, without needing per-product flavors.
rootProject.name = "revision-graph-jetbrains"

include(":intellij")
