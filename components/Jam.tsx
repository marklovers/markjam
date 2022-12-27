import Text from "./Text.tsx";

interface JamProps {
    title: string;
    number: string;
    theme: string;
    url: string;
}

export default function Jam(props: JamProps) {
    console.log(props);
    return (
        <div class="h-[300px] w-[140px] p-4 bg-[#E98EAD] rounded">
            <a href={props.url} target="_blank">
                <Text font="unscii" size="huge" center>
                    {"#" + (props.number ?? "1")}
                </Text>
                <Text font="unscii" size="small" center>{props.theme}</Text>
            </a>
        </div>
    );
}
