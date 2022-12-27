interface GameProps {
    title: string;
    url: string;
    banner: string;
}

export default function Game(props: GameProps = {
    title: "game",
    url: "https://example.com",
    banner: "https://img.itch.zone/aW1nLzg3MzYzMTAucG5n/315x250%23c/bQob9%2B.png"
}) {
    return (
        <div class="grid grid-rows-2p-4">
            <div class="">
                <img src={props.banner}/>
            </div>
        </div>
    );
}
