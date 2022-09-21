interface JamProps {
    title: string;
    theme: string;
    url: string;
}

export default function Jam(props: JamProps) {
    return (
        <a href={props.url} target="_blank">
            <h1>{props.title}</h1>
            <p>{props.theme}</p>
        </a>
    );
}
