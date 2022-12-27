import Page from "../components/Page.tsx";
import Nav from "../components/Nav.tsx";
import Game from "../components/Game.tsx";

export default function Winners() {
    return (
        <Page>
            <Nav tabHighlight={2} />

            <Game/>
        </Page>
    );
}
