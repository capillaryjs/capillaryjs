import minimal from "@sylwellsoftware/fray/themes/minimal/theme.css?url";
import java from "@sylwellsoftware/fray/themes/java/theme.css?url";
import shiny from "@sylwellsoftware/fray/themes/shiny/theme.css?url";
import gray from "@sylwellsoftware/fray/colors/gray/colors.css?url";
import green from "@sylwellsoftware/fray/colors/green/colors.css?url";
import iceblue from "@sylwellsoftware/fray/colors/iceblue/colors.css?url";
import ocean from "@sylwellsoftware/fray/colors/ocean/colors.css?url";
import orange from "@sylwellsoftware/fray/colors/orange/colors.css?url";
import purple from "@sylwellsoftware/fray/colors/purple/colors.css?url";
import red from "@sylwellsoftware/fray/colors/red/colors.css?url";
import yellow from "@sylwellsoftware/fray/colors/yellow/colors.css?url";

export const themes = Object.entries({minimal, java, shiny}).map(([value, href]) => ({
    value,
    href,
    label: value[0]!.toUpperCase() + value.slice(1)
}));
export const palettes = Object.entries({
    gray,
    green,
    iceblue,
    ocean,
    orange,
    purple,
    red,
    yellow
}).map(([value, href]) => ({value, href, label: value[0]!.toUpperCase() + value.slice(1)}));
