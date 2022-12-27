import { Handlers, PageProps } from "$fresh/server.ts";
import Nav from "../components/Nav.tsx";
import Page from "../components/Page.tsx";
import Text from "../components/Text.tsx";
import Jam from "../components/Jam.tsx";
import Jams from "../components/Jams.tsx";

export const handler: Handlers = {
    async GET(_, ctx) {
        const json =
            await (await fetch("https://markjam.kaboomjs.com/jams.json"))
                .json();

        return ctx.render(json.map((jam) => {
            return (
                <Jam
                    title={jam.title}
                    theme={jam.theme}
                    url={jam.url}
                    number={jam.number}
                />
            );
        }));
    },
};

export default function Home(props: PageProps) {
    return (
        <Page>
            <Nav tabHighlight={1} />

            <Text size="normal" center>
                <strong>{"MarkJam "}</strong>it's a recurrently Game Jam, where
                you will make games with Mark. And you will ask, who is Mark?
                Well...
            </Text>

            <br />

            <Jams data={props.data} />
        </Page>
    );
}
