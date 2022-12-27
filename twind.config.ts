import { Options } from "$fresh/plugins/twind.ts";

export default {
    selfURL: import.meta.url,
    theme: {
        fontFamily: {
            unscii: ["unscii", "serif"],
            gantari: ["Gantari", "serif"],
        },
        extend: {
            backgroundImage: {
                "mark-pattern": "url('/images/marksitos.png')",
            },
        },
    },
} as Options;
