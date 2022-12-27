import { useState } from "preact/hooks";

interface NavProps {
    tabHighlight: number;
}

export default function Nav(props: NavProps) {
    const [tab, setTab] = useState(props.tabHighlight);

    return (
        <nav class="flex flex-col justify-center h-fit p-5 font-unscii">
            <img class="mx-auto mb-2" src="/images/logo.gif" alt="MarkJam">
            </img>

            {
                /* <ul class="flex flex-row justify-center">
                <li class="text-lg text-bold mx-2 inline">
                    <a href="/">Home</a>
                </li>
                <li class="text-lg text-bold mx-2 inline">
                    <a href="/jams">Jams</a>
                </li>
                <li class="text-lg text-bold mx-2 inline">
                    <a href="/winners">Winners</a>
                </li>
            </ul> */
            }
        </nav>
    );
}
