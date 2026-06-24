import inquirer from "inquirer";
import type { CompressionPreset, OptimizationFlags } from "../types.js";
import { flagsFromPreset, presetLabel } from "../presets.js";

export interface CliOptions {
  files: string[];
  flags: OptimizationFlags;
  contextWindow: number;
  writeOutput: boolean;
  outputDir?: string;
}

export async function promptForOptions(
  initialFiles: string[],
): Promise<CliOptions> {
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "files",
      message: "Files or directories (comma-separated):",
      default: initialFiles.join(", "),
      filter: (value: string) =>
        value
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean),
      validate: (value: string[]) =>
        value.length > 0 || "Enter at least one path",
    },
    {
      type: "list",
      name: "preset",
      message: "Compression preset:",
      choices: [
        { name: presetLabel("safe"), value: "safe" },
        { name: presetLabel("balanced"), value: "balanced" },
        { name: presetLabel("aggressive"), value: "aggressive" },
      ],
      default: "balanced",
    },
    {
      type: "number",
      name: "contextWindow",
      message: "Context window size (for savings estimate):",
      default: 128_000,
      validate: (v: number) => v > 0 || "Must be positive",
    },
    {
      type: "confirm",
      name: "writeOutput",
      message: "Write .diet output files alongside sources?",
      default: false,
    },
  ]);

  return {
    files: answers.files,
    flags: flagsFromPreset(answers.preset as CompressionPreset),
    contextWindow: answers.contextWindow,
    writeOutput: answers.writeOutput,
  };
}

export function flagsFromCliArgs(args: {
  preset?: CompressionPreset;
  comments?: boolean;
  whitespace?: boolean;
  imports?: boolean;
  skeleton?: boolean;
  types?: boolean;
  all?: boolean;
}): OptimizationFlags {
  if (args.preset) return flagsFromPreset(args.preset);

  const base = flagsFromPreset("safe");

  if (args.all || args.types || args.skeleton) {
    return flagsFromPreset("aggressive");
  }

  return {
    ...base,
    stripComments: args.comments !== false,
    minifyWhitespace: args.whitespace !== false,
    stubImports: args.imports !== false,
  };
}
