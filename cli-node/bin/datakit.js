#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const { startServer } = require("../lib/server");
const package = require("../package.json");

const fs = require("fs");
const path = require("path");
const os = require("os");

const program = new Command();

program
  .name("datakit")
  .description("DataKit - Modern web-based data analysis tool")
  .version(package.version);

program
  .command("serve")
  .alias("start")
  .description("Start DataKit server")
  .option("-p, --port <port>", "specify port number")
  .option("--no-open", "don't open browser automatically")
  .option("-h, --host <host>", "specify host (default: localhost)", "localhost")
  .action(async (options) => {
    try {
      console.log(chalk.blue("🚀 Starting DataKit..."));
      await startServer(options);
    } catch (error) {
      console.error(chalk.red("❌ Failed to start DataKit:"), error.message);
      process.exit(1);
    }
  });

program
  .command("open")
  .description("Start DataKit server and open in browser (default behavior)")
  .option("-p, --port <port>", "specify port number")
  .option("-h, --host <host>", "specify host (default: localhost)", "localhost")
  .action(async (options) => {
    try {
      console.log(chalk.blue("🚀 Starting DataKit..."));
      await startServer({ ...options, open: true });
    } catch (error) {
      console.error(chalk.red("❌ Failed to start DataKit:"), error.message);
      process.exit(1);
    }
  });

program
  .command("version")
  .alias("v")
  .description("Show DataKit version information")
  .action(() => {
    console.log("");
    console.log(chalk.blue("📦 DataKit CLI"));
    console.log(chalk.gray("Version: ") + chalk.green(package.version));
    console.log(chalk.gray("Homepage: ") + chalk.cyan("https://datakit.page"));
    console.log("");
    console.log(chalk.yellow("💡 Features:"));
    console.log(chalk.gray("  • Process CSV/JSON files up to 4-5GB"));
    console.log(chalk.gray("  • DuckDB-powered SQL engine"));
    console.log(chalk.gray("  • Complete data privacy (local processing)"));
    console.log(chalk.gray("  • Modern React-based interface"));
    console.log("");
  });

program
  .command("update")
  .description("Check for updates and update DataKit CLI")
  .action(async () => {
    const { checkForUpdates } = require("../lib/updater");
    try {
      await checkForUpdates();
    } catch (error) {
      console.error(
        chalk.red("❌ Failed to check for updates:"),
        error.message
      );
      process.exit(1);
    }
  });

program
  .command("info")
  .description("Show system and DataKit information")
  .action(() => {
    const os = require("os");
    const { getSystemInfo } = require("../lib/system");

    console.log("");
    console.log(chalk.blue("🔍 DataKit System Information"));
    console.log("");
    console.log(chalk.yellow("CLI Information:"));
    console.log(chalk.gray("  Version: ") + chalk.green(package.version));
    console.log(chalk.gray("  Install Path: ") + chalk.cyan(__dirname));
    console.log("");

    const systemInfo = getSystemInfo();
    console.log(chalk.yellow("System Information:"));
    console.log(chalk.gray("  Platform: ") + chalk.white(systemInfo.platform));
    console.log(
      chalk.gray("  Node.js: ") + chalk.white(systemInfo.nodeVersion)
    );
    console.log(chalk.gray("  Memory: ") + chalk.white(systemInfo.memory));
    console.log(chalk.gray("  CPU: ") + chalk.white(systemInfo.cpu));
    console.log("");

    console.log(chalk.yellow("💡 Recommended for optimal performance:"));
    console.log(chalk.gray("  • Node.js 16+ for better performance"));
    console.log(chalk.gray("  • 8GB+ RAM for large file processing"));
    console.log(chalk.gray("  • Modern browser (Chrome/Firefox/Safari/Edge)"));
    console.log("");
  });

// TODO: On the next iteration we could add these
//
//   program
//   .command('install-app')
//   .description('Create macOS app for Spotlight search')
//   .action(async () => {
//     try {
//       if (os.platform() !== 'darwin') {
//         console.log(chalk.yellow('⚠️ This command is only available on macOS'));
//         return;
//       }

//       const appPath = '/Applications/DataKit.app';
//       const contentsPath = path.join(appPath, 'Contents');
//       const macosPath = path.join(contentsPath, 'MacOS');
//       const executablePath = path.join(macosPath, 'DataKit');
//       const plistPath = path.join(contentsPath, 'Info.plist');

//       console.log(chalk.blue('📱 Creating DataKit app for Spotlight...'));

//       // Create directory structure
//       fs.mkdirSync(macosPath, { recursive: true });

//       // Create executable script
//       const executableScript = `#!/bin/bash
//             # DataKit macOS App Wrapper
//             # This script launches DataKit CLI and opens the browser

//             # Get the directory of the datakit binary
//             DATAKIT_PATH=$(which datakit)

//             if [ -z "$DATAKIT_PATH" ]; then
//                 echo "DataKit CLI not found in PATH"
//                 exit 1
//             fi

//             # Launch DataKit
//             exec "$DATAKIT_PATH" "$@"
//             `;

//       fs.writeFileSync(executablePath, executableScript);
//       fs.chmodSync(executablePath, 0o755);

//       // Create Info.plist
//       const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
//             <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
//             <plist version="1.0">
//             <dict>
//                 <key>CFBundleExecutable</key>
//                 <string>DataKit</string>
//                 <key>CFBundleIdentifier</key>
//                 <string>page.datakit.app</string>
//                 <key>CFBundleName</key>
//                 <string>DataKit</string>
//                 <key>CFBundleDisplayName</key>
//                 <string>DataKit</string>
//                 <key>CFBundleShortVersionString</key>
//                 <string>1.0</string>
//                 <key>CFBundleVersion</key>
//                 <string>1.0</string>
//                 <key>CFBundlePackageType</key>
//                 <string>APPL</string>
//                 <key>CFBundleSignature</key>
//                 <string>????</string>
//                 <key>LSUIElement</key>
//                 <true/>
//                 <key>NSHighResolutionCapable</key>
//                 <true/>
//             </dict>
//             </plist>`;

//       fs.writeFileSync(plistPath, plistContent);

//       console.log(chalk.green('✅ DataKit app created successfully!'));
//       console.log('');
//       console.log(chalk.cyan('📍 Location: ') + chalk.white('/Applications/DataKit.app'));
//       console.log(chalk.cyan('🔍 Spotlight: ') + chalk.white('Search for "DataKit" in Spotlight'));
//       console.log(chalk.cyan('🚀 Usage: ') + chalk.white('Click to launch DataKit in your browser'));
//       console.log('');

//     } catch (error) {
//       console.error(chalk.red('❌ Failed to create app:'), error.message);

//       if (error.code === 'EACCES' || error.code === 'EPERM') {
//         console.log('');
//         console.log(chalk.yellow('💡 Try running with sudo:'));
//         console.log(chalk.cyan('  sudo datakit install-app'));
//       }
//     }
//   });

// program
//   .command('remove-app')
//   .description('Remove macOS app wrapper')
//   .action(async () => {
//     try {
//       if (os.platform() !== 'darwin') {
//         console.log(chalk.yellow('⚠️  This command is only available on macOS'));
//         return;
//       }

//       const appPath = '/Applications/DataKit.app';

//       if (!fs.existsSync(appPath)) {
//         console.log(chalk.yellow('⚠️  DataKit app not found in Applications'));
//         return;
//       }

//       console.log(chalk.blue('🗑️  Removing DataKit app...'));

//       // Remove the app
//       fs.rmSync(appPath, { recursive: true, force: true });

//       console.log(chalk.green('✅ DataKit app removed successfully!'));
//       console.log('');
//       console.log(chalk.gray('The DataKit CLI is still available via terminal'));

//     } catch (error) {
//       console.error(chalk.red('❌ Failed to remove app:'), error.message);

//       if (error.code === 'EACCES' || error.code === 'EPERM') {
//         console.log('');
//         console.log(chalk.yellow('💡 Try running with sudo:'));
//         console.log(chalk.cyan('  sudo datakit remove-app'));
//       }
//     }
//   });

// program
//   .command('app-status')
//   .description('Check if macOS app is installed')
//   .action(() => {
//     if (os.platform() !== 'darwin') {
//       console.log(chalk.yellow('⚠️  This command is only available on macOS'));
//       return;
//     }

//     const appPath = '/Applications/DataKit.app';
//     const isInstalled = fs.existsSync(appPath);

//     console.log('');
//     console.log(chalk.blue('📱 DataKit macOS App Status'));
//     console.log('');

//     if (isInstalled) {
//       console.log(chalk.green('✅ DataKit app is installed'));
//       console.log(chalk.cyan('📍 Location: ') + chalk.white(appPath));
//       console.log(chalk.cyan('🔍 Search: ') + chalk.white('Available in Spotlight'));
//       console.log('');
//       console.log(chalk.gray('To remove: ') + chalk.cyan('datakit remove-app'));
//     } else {
//       console.log(chalk.yellow('❌ DataKit app is not installed'));
//       console.log('');
//       console.log(chalk.gray('To install: ') + chalk.cyan('datakit install-app'));
//     }
//     console.log('');
//   });

// Default command when no subcommand is provided
program.action(async () => {
  try {
    console.log(chalk.blue("🚀 Starting DataKit..."));
    await startServer({ open: true });
  } catch (error) {
    console.error(chalk.red("❌ Failed to start DataKit:"), error.message);
    process.exit(1);
  }
});

program.parse();
