export default function Page(props) {
    return (
        <div class="w-screen h-screen bg-[#E98EAD] font-gantari">
            <div class="px-4 max-w-screen-lg h-screen overflow-auto bg-[#FEA1BF] md:mx-auto">
                {props.children}
            </div>
        </div>
    );
}
