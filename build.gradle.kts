import org.gradle.api.tasks.Exec

plugins {
    base
}

fun Exec.publicCommand(script: String) {
    workingDir = layout.projectDirectory.asFile
    val arguments = mutableListOf(
        "scripts/run-public-command.mjs",
        "--cwd",
        ".",
    )
    if (providers.gradleProperty("dryRun").orNull == "true") {
        arguments += "--dry-run"
    }
    arguments += listOf("--", "pnpm", script)
    commandLine("node", *arguments.toTypedArray())
}

tasks.register<Exec>("publicCheck") {
    group = "verification"
    description = "Runs the standalone public workspace verification suite."
    publicCommand("verify")
}

tasks.register<Exec>("publicReleasePreflight") {
    group = "verification"
    description = "Runs browser, package, consumer, metadata, and privacy release checks."
    publicCommand("verify:release")
}
