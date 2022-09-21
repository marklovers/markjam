export default function Page(props: JamProps) {
    return (
        <div class="w-screen h-screen bg-repeat bg-[#fbc0f3] bg-mark-pattern text-[#1f102a] font-unscii">
            <div class="px-4 max-w-screen-lg h-screen overflow-auto bg-[#edb2d7] md:mx-auto">
                {props.children}
            </div>
        </div>
    );
}
