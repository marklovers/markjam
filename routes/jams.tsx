import { Handlers, PageProps } from "$fresh/server.ts";
import Nav from "../components/Nav.tsx";
import Jam from "../components/Jam.tsx";

export const handler: Handlers = {
    async GET(_, ctx) {
        const json =
            await (await fetch("https://markjam.kaboomjs.com/jams.json"))
                .json();

        return ctx.render(json.map((jam) => {
            return <Jam title={jam.title} theme={jam.theme} url={jam.url} />;
        }));
    },
};

export default function Jams(props: PageProps) {
    return (
        <div class="w-screen h-screen bg-repeat bg-[#fbc0f3] bg-mark-pattern text-[#1f102a] font-unscii">
            <div class="px-4 max-w-screen-lg h-screen overflow-auto bg-[#f1cddb] md:mx-auto">
                <Nav tabHighlight={2} />

                <div class="grid grid-cols-1 gap-2 justify-items-center">
                    {props.data}
                </div>
            </div>
        </div>
    );
}
