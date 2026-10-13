# コードで育つペット — Code-Grown Pet

A little companion that hatches and grows as you write and save code in VS Code.

[日本語 README](README.ja.md) | [Architecture / 設計方針](ARCHITECTURE.ja.md)

## Concept

Turn everyday coding into a gentle pet-raising game. Start with an egg, make progress through your work, and watch your companion hatch and grow.

The pet lives in a small transparent overlay at the bottom-right of your screen. It should bring a little delight to your day while keeping your editor space available and letting mouse clicks pass through to the application underneath.

## Project status

**Planning stage.** This repository currently contains documentation only. The features below describe the intended experience, not functionality that is available today. Installation and usage instructions will be added when a runnable prototype exists.

## Planned experience

- Receive an egg on first use.
- Earn growth points by writing code and saving files in VS Code.
- See the egg develop cracks, hatch, and grow into a companion.
- Enjoy gentle idle animations and brief reactions to saves.
- Keep your companion and progress between sessions.
- Show or hide the pet with a keyboard shortcut, and exit from the system tray.
- Take breaks without penalties: the pet will not become weaker while you are away.

The initial target is Windows. The overlay is intended to work without reserving a VS Code panel.

## Growth rules under consideration

Growth should reflect changes made between saves, rather than repeatedly counting an entire file.

- Saving an unchanged file should award no points.
- Added and rewritten text should contribute to growth.
- Automatic saves should be supported, with reactions grouped or limited to avoid constant animation.
- Deletions and refactoring should be considered so that progress does not depend solely on writing more code.

The exact counting method, thresholds, treatment of generated files, and handling of undo operations are not decided yet. Character counts are a playful growth mechanic, not a measure of productivity or code quality.

An illustrative progression is:

`Egg → Cracked egg → Hatchling → Adult`

The first creature and its visual style are still to be chosen.

## Proposed architecture

| Component | Responsibility |
| --- | --- |
| Electron companion app | Render the overlay, apply growth rules, own pet progress and persistence, and provide tray controls. |
| VS Code extension | Start/stop the companion, observe saves, calculate eligible text changes, and send measurement events. |
| Shared protocol | Define and validate local messages. Electron owns persistence; the extension owns editor measurements. |

The initial Windows prototype will use Electron and TypeScript, with local HTML/CSS and an original SVG egg. TypeScript is chosen from the start because the developer is more familiar with it than JavaScript. VS Code provides `workspace.onDidSaveTextDocument` for future save detection. These choices will be validated through the prototype.

The intended design keeps code contents inside VS Code and sends only the information needed for growth to the local companion app. No cloud service is required by the proposed design.

The first overlay prototype may appear over any application. Showing it only while VS Code is active, and following the VS Code window, are possible later improvements that require additional Windows integration.

## Roadmap

- [ ] M0: Start/stop the companion from a VS Code extension; display a static click-through egg, provide tray exit, and clean up on disconnect.
- [ ] M1: Add a gentle idle animation and a visibility shortcut.
- [ ] Detect saves through a minimal VS Code extension.
- [ ] Define change-counting rules and connect save events to growth.
- [ ] Persist progress and add hatching and growth stages.
- [ ] Tune animations, accessibility, and resource usage for everyday work.
- [ ] Explore VS Code window tracking and additional creatures.

## Inspiration

- [VS Code Pets](https://github.com/tonybaloney/vscode-pets) — playful companions inside VS Code.
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api) — editor events and extension capabilities.
- [Electron window interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions) — click-through window behavior.

## License

A project license has not been selected yet. Any third-party character assets or code will need their own license review before inclusion.
