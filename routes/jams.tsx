import { Handlers, PageProps } from "$fresh/server.ts";
import Page from "../components/Page.tsx";
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
        <Page>
            <Nav tabHighlight={2} />

            <div class="grid grid-cols-1 gap-2 justify-items-center">
                {props.data}
            </div>
        </Page>
    );
}
