import minimal from "@capillaryjs/capillary-ui/themes/minimal/theme.css?url";
import java from "@capillaryjs/capillary-ui/themes/java/theme.css?url";
import shiny from "@capillaryjs/capillary-ui/themes/shiny/theme.css?url";
import gray from "@capillaryjs/capillary-ui/colors/gray/colors.css?url";
import green from "@capillaryjs/capillary-ui/colors/green/colors.css?url";
import iceblue from "@capillaryjs/capillary-ui/colors/iceblue/colors.css?url";
import ocean from "@capillaryjs/capillary-ui/colors/ocean/colors.css?url";
import orange from "@capillaryjs/capillary-ui/colors/orange/colors.css?url";
import purple from "@capillaryjs/capillary-ui/colors/purple/colors.css?url";
import red from "@capillaryjs/capillary-ui/colors/red/colors.css?url";
import yellow from "@capillaryjs/capillary-ui/colors/yellow/colors.css?url";

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
