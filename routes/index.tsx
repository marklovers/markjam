import Page from "../components/Page.tsx";
import Nav from "../components/Nav.tsx";

export default function Home() {
    return (
        <Page>
            <Nav tabHighlight={1} />

            <p class="text-center p-8">
                MarkJam it's a jam about make games with Mark. Yes, the famous
                Kaboom character
            </p>

            <img class="mx-auto mb-6" src="images/markdefault.png" />

            <div class="inline-flex w-full justify-center flex-col text-[#fff] md:flex-row">
                <a
                    class="bg-[#5865F2] h-fit px-4 py-3 mx-4 rounded my-2"
                    href="https://kaboomjs.com/discord"
                >
                    Join Discord
                </a>

                <a
                    class="bg-[#fa5c5c] h-fit px-4 py-3 mx-4 rounded my-2"
                    href="https://itch.io/jam/markjam-5"
                >
                    Jam on Itch
                </a>
            </div>
        </Page>
    );
}
