import Nav from "../components/Nav.tsx";

export default function Home() {
    return (
        <div class="w-screen h-screen bg-repeat bg-[#fbc0f3] bg-mark-pattern text-[#1f102a]">
            <div class="p-4 mx-auto max-w-screen-lg h-screen bg-[#fcef8d]">
                <Nav />

                <img class="mx-auto" src="/images/Logo.png" alt="MarkJam"></img>

                <p class="text-center font-unscii p-8">
                    MarkJam it's a jam about make games with Mark. Yes, the
                    famous Kaboom character
                </p>

                <img class="mx-auto" src="images/markdefault.png"></img>
            </div>
        </div>
    );
}
