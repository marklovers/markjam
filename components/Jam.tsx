interface JamProps {
    title: string;
    theme: string;
    url: string;
}

export default function Jam(props: JamProps) {
    return (
        <div class="p-4 bg-[#d46eb3] rounded">
            <a href={props.url} target="_blank">
                <h1>{props.title}</h1>
                <p>{props.theme}</p>
            </a>
        </div>
    );
}
