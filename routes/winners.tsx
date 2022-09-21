import Nav from "../components/Nav.tsx";

export default function Winners() {
    return (
        <div class="w-screen h-screen bg-repeat bg-[#fbc0f3] bg-mark-pattern text-[#1f102a] font-unscii">
            <div class="px-4 max-w-screen-lg h-screen overflow-auto bg-[#f1cddb] md:mx-auto">
                <Nav tabHighlight={2} />
            </div>
        </div>
    );
}
