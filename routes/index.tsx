import Nav from "../components/Nav.tsx";

export default function Home() {
    return (
        <div class="w-screen h-screen bg-repeat bg-[#fbc0f3]" style="background-image: url('images/marksitos.png');">
            <div class="p-4 mx-auto max-w-screen-lg bg-[#fcef8d]">
                <Nav />

                <img class="mx-auto" src="/images/Logo.png"></img>
            </div>
        </div>
    );
}
