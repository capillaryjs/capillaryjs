import type {FrayChild} from "@sylwellsoftware/fray";
import {
    Button,
    createFrayRuntime,
    FrayApp,
    mountFrayApp,
    Panel,
    ProgressBar,
    replaceFrayStylesheet,
} from "@sylwellsoftware/fray";
import "@sylwellsoftware/fray/themes/base.css";
import "../styles/styles.css";
import {ShellView} from "../views/index.tsx";
import {bootstrap, demo} from "./session.ts";
import {palettes, themes} from "./appearance.ts";

class BuildCoApp extends FrayApp {
    static dependencies = [Button, Panel, ProgressBar];

    initialize(): void {
        void bootstrap.activate();
    }

    protected renderContent(): FrayChild {
        return <ShellView/>;
    }
}

replaceFrayStylesheet("theme", themes.find(t => t.value === demo.theme.get()) ?? themes[0]!);
replaceFrayStylesheet("colors", palettes.find(t => t.value === demo.palette.get()) ?? palettes[3]!);
mountFrayApp(createFrayRuntime({}), BuildCoApp, document.getElementById("app")!, {
    sizing: "viewport",
    layout: "vertical",
    landmark: "none",
});
