import { ComponentChildren } from "preact";

interface TextProps {
    font?: "gantari" | "unscii";
    size?: "small" | "normal" | "big" | "huge";
    center?: boolean;
    children?: ComponentChildren;
}

const SIZES = {
    "small": "text-md",
    "normal": "text-lg",
    "big": "text-xl",
    "huge": "text-2xl",
};

export default function Text(props: TextProps) {
    return (
        <p
            class={`
				${SIZES[props.size ?? "normal"]}
				${props.center ? "text-center" : "~"}
				${props.font ? `font-${props.font}` : `font-gantari`}
			`}
        >
            {props.children}
        </p>
    );
}
